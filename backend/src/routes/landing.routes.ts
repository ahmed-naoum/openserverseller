import { Router, Request, Response } from 'express';
import { validateInfluencerHost } from '../utils/subdomain.js';
import { recordReferralClick } from '../services/referralClicks.js';
import { getCompiledLanding } from '../services/landingCompiler/index.js';
import { resolveServerCloak } from '../services/landingCompiler/cloak.js';
import { serveSpaFallback } from '../services/landingCompiler/spaFallback.js';
import { serveLinkUnavailable } from '../services/landingCompiler/unavailable.js';

const router = Router();

/**
 * off = always serve the SPA (kill switch), shadow = compile but do not serve,
 * on = serve compiled HTML.
 *
 * Anything other than an explicit, recognised `on` resolves to shadow. This flag
 * gates what real visitors receive, so the ambiguous cases — unset, empty, or a
 * typo — are exactly the ones where the safe answer is "compile, but keep serving
 * React". It previously defaulted to `on`, which meant a deploy that never got the
 * variable set was live to visitors while looking dormant: nothing had compiled,
 * so the health check read 0 errors out of 0 rows and passed.
 */
let warnedFor: string | null = null;

export function mode(): 'off' | 'shadow' | 'on' {
  const raw = process.env.SSG_LANDING;
  if (raw === undefined || raw.trim() === '') return 'shadow';

  const value = raw.trim().toLowerCase();
  if (value === 'off' || value === 'shadow' || value === 'on') return value;

  // Once per distinct bad value, not once per request — this runs on every /r/ hit.
  if (warnedFor !== value) {
    warnedFor = value;
    console.warn(`[SSG] unrecognised SSG_LANDING=${JSON.stringify(raw)} — falling back to shadow`);
  }
  return 'shadow';
}

/**
 * Codes that serve compiled HTML while the global flag is still `shadow`.
 *
 * The rollout unit is one link. A page can be proven in a real browser, on its
 * real domain, without moving every other page's ad traffic onto the compiler
 * in the same change — and rolling back is emptying a variable, not a deploy.
 *
 * Matching is case-SENSITIVE, deliberately. `Miel` and `miel` are both live
 * codes on this instance, so folding case would quietly switch on a page nobody
 * named.
 *
 * Re-read whenever the variable changes rather than cached at import, so the
 * list can be widened with a pm2 restart and no rebuild. The parse is memoised
 * on the raw string because this runs on every /r/ hit.
 */
let allowRaw: string | undefined;
let allowSet = new Set<string>();

function allowedCodes(): Set<string> {
  const raw = process.env.SSG_LANDING_CODES;
  if (raw !== allowRaw) {
    allowRaw = raw;
    allowSet = new Set(
      String(raw || '')
        .split(/[\s,]+/)
        .filter(Boolean)
    );
  }
  return allowSet;
}

/**
 * The mode this one code is served under.
 *
 * The allow-list only ever upgrades shadow -> on. `off` is the kill switch and
 * stays absolute: the one thing it must guarantee is that nothing anywhere is
 * serving compiled HTML, and an allow-list that could override it would make it
 * useless in the incident it exists for.
 */
export function modeFor(code: string): 'off' | 'shadow' | 'on' {
  const global = mode();
  if (global === 'shadow' && allowedCodes().has(code)) return 'on';
  return global;
}

/**
 * Where a link should have been opened, when it was opened somewhere else.
 *
 * An influencer with no subdomain is handed `https://silacod.com/r/<code>` by
 * the dashboard — `buildReferralUrl` falls back to the host the dashboard is
 * served from (frontend/src/utils/referral.ts). That URL can never validate,
 * because `validateInfluencerHost` returns false the moment the influencer has
 * no subdomain, so the app has been generating links its own backend refuses.
 * Facebook ads point at those URLs today and cannot be edited retroactively,
 * which is why this redirects rather than just fixing new links.
 *
 * Only a subdomain is a valid target. `customDomain` is deliberately not used:
 * `CompiledPage` does not carry `customDomainStatus`, and sending paid traffic
 * to a domain still PENDING or FAILED would turn a page that half-works into
 * one that does not resolve at all.
 *
 * Returns null when there is nowhere better to send the visitor, and the caller
 * falls back to the SPA exactly as before.
 */
export function canonicalUrl(req: Request, subdomain: string | null): string | null {
  if (!subdomain) return null;

  // Same source of truth as getSubdomainFromRequest, so the two cannot disagree
  // about what the base domain is.
  let baseHost = 'silacod.com';
  try {
    baseHost = new URL(process.env.FRONTEND_URL || 'https://silacod.com').host;
  } catch {
    // keep the default
  }
  baseHost = baseHost.replace(/^www\./i, '').toLowerCase();

  const target = `${subdomain.toLowerCase()}.${baseHost}`;
  const current = String(req.headers.host || '').replace(/^www\./i, '').toLowerCase();
  // Belt and braces: validation already failed, so these should differ. If they
  // ever don't, redirecting would loop until the browser gives up.
  if (!target || target === current) return null;

  // originalUrl rather than a rebuilt path: it carries the query string as sent,
  // and fbclid/utm are what the ad platform and the cloaking rules read. Rebuilding
  // it would also risk double-encoding a code that arrived percent-encoded.
  return `${req.protocol}://${target}${req.originalUrl}`;
}

router.get('/:code', async (req: Request, res: Response) => {
  const code = String(req.params.code || '');

  if (!code || code.length > 128 || !/^[\w.-]+$/.test(code)) {
    return serveSpaFallback(res, 404);
  }

  // `no-cache`, not `no-store`, and the difference is worth the sentence:
  // `no-store` was the sole reason Lighthouse reported the back/forward cache
  // as disabled, so every back-navigation from an ad paid a full reload. Both
  // headers revalidate with the origin on each navigation — cloaking still
  // decides afresh — but `no-cache` permits bfcache. `private` keeps Cloudflare
  // and every other shared cache out, which is what a per-visitor cloaking
  // decision actually requires.
  res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
  res.setHeader('Vary', 'Accept-Encoding');
  // helmet sets this to `off` globally, which would negate the dns-prefetch
  // hints in the SPA shell.
  res.setHeader('X-DNS-Prefetch-Control', 'on');

  // Resolved once and reused below, so a variable edited mid-request cannot make
  // one hit take the compiled branch on one line and the SPA branch on the next.
  const ssg = modeFor(code);

  // `?__ssg=0` forces the React page for one request, so a compiled page and the
  // original can be compared side by side in a browser.
  if (ssg === 'off' || req.query.__ssg === '0') {
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
    // 302, not 301. The mapping is mutable — an admin can clear or reassign a
    // subdomain (admin.routes.ts) and the influencer can change it themselves
    // through the OTP flow — and a 301 cached by Cloudflare and every visitor's
    // browser would keep pointing at a host that no longer serves the page,
    // with no way to recall it. The response already carries `no-store`.
    const target = canonicalUrl(req, page.subdomain);
    if (target) return res.redirect(302, target);

    // Nowhere to send them and nowhere the page can be served: no subdomain and
    // no custom domain means no host validateInfluencerHost will ever admit.
    // The SPA shell would boot, ask /public for this link, be refused for the
    // same reason, and leave the visitor on a broken page — so say it plainly.
    if (!page.subdomain && !page.customDomain) {
      return serveLinkUnavailable(res);
    }

    // A page that does have a home, opened on the wrong host — the custom-domain
    // case this deliberately will not redirect to. Unchanged behaviour.
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
  // client rules — no IP-lookup round trip — and harder to evade, since a
  // visitor who blocks that lookup would otherwise sail past every geo rule.
  // The page whose bytes are actually served. Normally the primary; an audience
  // rule in `render` mode swaps it for one of the seller's other pages, served at
  // this same URL. Host validation and click recording above always run against
  // the primary — the alternate is content, not a different home.
  let target = page;

  if (page.cloaking) {
    try {
      const decision = resolveServerCloak(page.cloaking, req);
      if (decision.redirect) return res.redirect(302, decision.redirect);
      if (decision.renderCode) {
        const alt = await getCompiledLanding(decision.renderCode);
        // Only a servable page belonging to the SAME seller may be rendered here.
        // Anything else (missing, uncompiled, or another influencer's page) falls
        // back to the primary — a render rule must never 500 or leak a foreign page.
        if (alt && alt.html && alt.influencerId === page.influencerId) {
          target = alt;
        } else {
          console.warn('[SSG] render alternate unavailable for', code, '->', decision.renderCode);
        }
      }
    } catch (err) {
      // A broken cloaking config must not take the page down with it.
      console.error('[SSG] cloak evaluation failed for', code, err);
    }
  }

  if (ssg === 'shadow' || !target.ssgEnabled || !target.html) {
    return serveSpaFallback(res, 200);
  }

  const acceptsBrotli = /\bbr\b/.test(String(req.headers['accept-encoding'] || ''));
  const body = acceptsBrotli && target.brotli ? target.brotli : target.html;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Length', String(body.length));
  if (acceptsBrotli && target.brotli) res.setHeader('Content-Encoding', 'br');

  // helmet's default policy blocks inline scripts and connect.facebook.net,
  // which would stop every pixel on the page from firing. Replaced with a
  // per-page policy that allow-lists this page's inline scripts by hash.
  res.removeHeader('Content-Security-Policy');
  if (target.csp) {
    // Report-only until a rollout has confirmed no pixel vendor is being
    // blocked: a CSP that silently drops a tracking script costs conversions
    // before anyone notices. SSG_CSP_ENFORCE=1 switches it to enforcing.
    const header =
      process.env.SSG_CSP_ENFORCE === '1'
        ? 'Content-Security-Policy'
        : 'Content-Security-Policy-Report-Only';
    res.setHeader(header, target.csp);
  }
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  return res.status(200).end(body);
});

/** Bare /r/ is not a landing page; hand it to the SPA router to 404 in-app. */
router.get('/', (_req: Request, res: Response) => serveSpaFallback(res, 404));

export default router;
