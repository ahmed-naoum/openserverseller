import { Router, Request, Response } from 'express';
import { validateInfluencerHost } from '../utils/subdomain.js';
import { recordReferralClick } from '../services/referralClicks.js';
import { getCompiledLanding } from '../services/landingCompiler/index.js';
import { resolveServerCloak } from '../services/landingCompiler/cloak.js';
import { serveSpaFallback } from '../services/landingCompiler/spaFallback.js';

const router = Router();

/** off = always serve the SPA (kill switch), shadow = compile but do not serve, on = serve compiled HTML. */
function mode(): 'off' | 'shadow' | 'on' {
  const value = (process.env.SSG_LANDING || 'on').toLowerCase();
  return value === 'off' || value === 'shadow' ? value : 'on';
}

router.get('/:code', async (req: Request, res: Response) => {
  const code = String(req.params.code || '');

  if (!code || code.length > 128 || !/^[\w.-]+$/.test(code)) {
    return serveSpaFallback(res, 404);
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Accept-Encoding');
  // helmet sets this to `off` globally, which would negate the dns-prefetch
  // hints in the SPA shell.
  res.setHeader('X-DNS-Prefetch-Control', 'on');

  // `?__ssg=0` forces the React page for one request, so a compiled page and the
  // original can be compared side by side in a browser.
  if (mode() === 'off' || req.query.__ssg === '0') {
    return serveSpaFallback(res, 200);
  }

  let page;
  try {
    page = await getCompiledLanding(code);
  } catch (err) {
    console.error('[SSG] lookup failed for', code, err);
    // Never 500 a URL that ad money points at.
    return serveSpaFallback(res, 200);
  }

  if (!page) return serveSpaFallback(res, 404);

  // Host binding, NOT validateInfluencerSubdomain(): a top-level navigation
  // carries no Origin and a Referer of the ad network, which that helper would
  // read as the request host and reject.
  if (!validateInfluencerHost(req, page.subdomain, page.customDomain)) {
    return serveSpaFallback(res, 404);
  }

  // Fire and forget, and deliberately before any cloaking decision: the SPA
  // records the click before cloaking runs today, so the influencer's click
  // count keeps meaning the same thing.
  void recordReferralClick({
    linkId: page.linkId,
    influencerId: page.influencerId,
    code,
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] as string | undefined,
  });

  // Cloaking, decided from headers before a byte is written. Faster than the
  // client rules — no ipapi.co round trip — and harder to evade, since a
  // visitor who blocks that lookup currently sails past every geo rule.
  if (page.cloaking) {
    try {
      const decision = resolveServerCloak(page.cloaking, req);
      if (decision.redirect) return res.redirect(302, decision.redirect);
    } catch (err) {
      // A broken cloaking config must not take the page down with it.
      console.error('[SSG] cloak evaluation failed for', code, err);
    }
  }

  if (mode() === 'shadow' || !page.ssgEnabled || !page.html) {
    return serveSpaFallback(res, 200);
  }

  const acceptsBrotli = /\bbr\b/.test(String(req.headers['accept-encoding'] || ''));
  const body = acceptsBrotli && page.brotli ? page.brotli : page.html;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Length', String(body.length));
  if (acceptsBrotli && page.brotli) res.setHeader('Content-Encoding', 'br');

  // helmet's default policy blocks inline scripts and connect.facebook.net,
  // which would stop every pixel on the page from firing. Replaced with a
  // per-page policy that allow-lists this page's inline scripts by hash.
  res.removeHeader('Content-Security-Policy');
  if (page.csp) {
    // Report-only until a rollout has confirmed no pixel vendor is being
    // blocked: a CSP that silently drops a tracking script costs conversions
    // before anyone notices. SSG_CSP_ENFORCE=1 switches it to enforcing.
    const header =
      process.env.SSG_CSP_ENFORCE === '1'
        ? 'Content-Security-Policy'
        : 'Content-Security-Policy-Report-Only';
    res.setHeader(header, page.csp);
  }
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  return res.status(200).end(body);
});

/** Bare /r/ is not a landing page; hand it to the SPA router to 404 in-app. */
router.get('/', (_req: Request, res: Response) => serveSpaFallback(res, 404));

export default router;
