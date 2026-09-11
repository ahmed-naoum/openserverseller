import { Router, Request, Response, NextFunction } from 'express';
import { serveSpaFallback } from '../services/landingCompiler/spaFallback.js';
import { getCompiledStorePage, type StorePageKind } from '../services/storeCompiler/index.js';

/**
 * Serves compiled storefront pages on seller hosts.
 *
 * Mounted at the root, beside /r. It only ever acts on two paths — `/` and
 * `/pages/:slug` — and only when the request's host resolves to a published
 * store; on the platform's own domain it calls `next()` and the marketing
 * site is served exactly as before. nginx has to proxy those paths here for
 * seller hosts (see the note in setup.sh); until it does, the SPA serves them
 * and nothing changes.
 *
 * A store that has not built its home page in Studio gets the SPA, whose
 * stock layout is what it has always shown.
 */

const router = Router();

/** In development the SPA is on :5173 and the API on :3001; `?__store=` names the store. */
const TRUSTS_CALLER = process.env.NODE_ENV !== 'production';

async function serve(req: Request, res: Response, next: NextFunction, kind: StorePageKind, slug: string | null) {
  const host = (req.headers.host || '').toString();
  const devSlug = TRUSTS_CALLER && typeof req.query.__store === 'string' ? req.query.__store : undefined;

  let page;
  try {
    page = await getCompiledStorePage(host, kind, slug, devSlug);
  } catch (err) {
    console.error('[StoreSSG] lookup failed for', host, kind, slug, err);
    return next();
  }

  // Not a store host, or nothing built for this page: not ours to answer.
  if (!page) return next();

  if (req.query.__ssg === '0') return serveSpaFallback(res, 200);

  res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
  res.setHeader('Vary', 'Accept-Encoding');
  res.setHeader('X-DNS-Prefetch-Control', 'on');

  const acceptsBrotli = /\bbr\b/.test(String(req.headers['accept-encoding'] || ''));
  const body = acceptsBrotli ? page.brotli : page.html;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Length', String(body.length));
  if (acceptsBrotli) res.setHeader('Content-Encoding', 'br');

  res.removeHeader('Content-Security-Policy');
  if (page.csp) {
    const header = process.env.SSG_CSP_ENFORCE === '1' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
    res.setHeader(header, page.csp);
  }
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  return res.status(200).end(body);
}

router.get('/', (req, res, next) => serve(req, res, next, 'home', null));

router.get('/products', (req, res, next) => serve(req, res, next, 'catalogue', null));

router.get('/collections/:slug', (req, res, next) => {
  const slug = String(req.params.slug || '');
  if (!slug || slug.length > 120 || !/^[a-z0-9_-]+$/i.test(slug)) return next();
  return serve(req, res, next, 'collection', slug);
});

router.get('/p/:slug', (req, res, next) => {
  const slug = String(req.params.slug || '');
  if (!slug || slug.length > 160 || !/^[A-Za-z0-9._-]+$/.test(slug)) return next();
  return serve(req, res, next, 'product', slug);
});

router.get('/pages/:slug', (req, res, next) => {
  const slug = String(req.params.slug || '');
  if (!slug || slug.length > 120 || !/^[a-z0-9_-]+$/i.test(slug)) return next();
  return serve(req, res, next, 'page', slug);
});

export default router;
