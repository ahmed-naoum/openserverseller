import { Router, Request, Response } from 'express';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import rateLimit from 'express-rate-limit';
import { getClientIp } from '../utils/clientIp.js';
import { getStoreCategories } from '../services/storeCatalogue.service.js';
import {
  resolveStoreByHost,
  getStoreProducts,
  getStoreProductBySlug,
  getStorePageBySlug,
  executeStoreCheckout,
} from '../services/store.service.js';

const router = Router();

/**
 * Whether the caller may say which host it is on, rather than being told by the
 * connection it arrived over.
 *
 * In production it may not. nginx proxies /api/ with `proxy_set_header Host
 * $host` (setup.sh:188), so the API is same-origin with the storefront and the
 * Host header already IS the seller's domain — asking the browser for it adds
 * nothing and lets anyone claim to be on any seller's domain.
 *
 * In development the SPA is on :5173 and the API on :3001, so the Host header
 * says `localhost:3001` and there is no other way to name the store under test.
 */
const TRUSTS_CALLER_FOR_HOST = process.env.NODE_ENV !== 'production';

/**
 * The host this request actually arrived on.
 *
 * This is the whole identity of a storefront request: which seller owns this
 * domain is decided from it, and so is which catalogue and which checkout the
 * visitor is talking to. It used to be read from a query parameter first, then
 * two custom headers, then Origin and Referer, with the real Host header last —
 * five values a caller controls ahead of the one it does not.
 */
function extractHostFromRequest(req: Request): string {
  if (TRUSTS_CALLER_FOR_HOST && typeof req.query.host === 'string' && req.query.host.trim()) {
    return req.query.host.trim();
  }
  return (req.headers.host || '').toString();
}

/** The `?__store=slug` development shortcut, ignored in production. */
function devSlug(req: Request): string | undefined {
  if (!TRUSTS_CALLER_FOR_HOST) return undefined;
  const slug = typeof req.query.slug === 'string' ? req.query.slug.trim() : '';
  return slug || undefined;
}

/**
 * Same backstop as the landing checkout's `orderRateLimiter`, and keyed the same
 * way and for the same reason: `getClientIp` (CF-Connecting-IP first), never the
 * visitor-controlled X-Forwarded-For and never with the User-Agent mixed in,
 * because either of those let a caller mint a fresh bucket per request. The fraud
 * threshold, not this number, is what actually stops a spraying address.
 */
const checkoutRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => getClientIp(req) || 'unknown',
  handler: (_req, res) => {
    res.status(429).json({
      status: 'error',
      message: "Vous avez atteint la limite de commandes pour aujourd'hui. Veuillez réessayer plus tard.",
    });
  },
});

router.get(
  '/resolve',
  asyncHandler(async (req: Request, res: Response) => {
    const resolved = await resolveStoreByHost(extractHostFromRequest(req), devSlug(req));

    if (!resolved) {
      throw new AppException(404, 'Boutique introuvable pour ce domaine');
    }

    res.json({
      status: 'success',
      data: resolved,
    });
  })
);

router.get(
  '/products',
  asyncHandler(async (req: Request, res: Response) => {
    let storeId = parseInt(req.query.storeId as string, 10);

    if (isNaN(storeId)) {
      const resolved = await resolveStoreByHost(extractHostFromRequest(req), devSlug(req));
      if (resolved) {
        storeId = resolved.store.id;
      }
    }

    if (!storeId || isNaN(storeId)) {
      throw new AppException(400, 'Identifiant de boutique (storeId) requis');
    }

    const result = await getStoreProducts(storeId, {
      page: parseInt(req.query.page as string, 10) || 1,
      limit: parseInt(req.query.limit as string, 10) || 12,
      collectionSlug: typeof req.query.collection === 'string' ? req.query.collection : undefined,
      categorySlug: typeof req.query.category === 'string' ? req.query.category : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      sort: typeof req.query.sort === 'string' ? req.query.sort : undefined,
    });

    res.json({
      status: 'success',
      data: result,
    });
  })
);

router.get(
  '/products/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const slug = String(req.params.slug || '');
    let storeId = parseInt(req.query.storeId as string, 10);

    if (isNaN(storeId)) {
      const resolved = await resolveStoreByHost(extractHostFromRequest(req), devSlug(req));
      if (resolved) {
        storeId = resolved.store.id;
      }
    }

    if (!storeId || isNaN(storeId)) {
      throw new AppException(400, 'Identifiant de boutique (storeId) requis');
    }

    const result = await getStoreProductBySlug(storeId, slug);

    res.json({
      status: 'success',
      data: result,
    });
  })
);

/**
 * The shop category menu, nested parents-with-children.
 *
 * A shop that has not created a product of its own answers with the platform
 * starter tree, exactly as /products answers with the starter products, so a
 * new storefront is browsable from the moment it exists.
 */
router.get(
  '/categories',
  asyncHandler(async (req: Request, res: Response) => {
    let storeId = parseInt(req.query.storeId as string, 10);

    if (isNaN(storeId)) {
      const resolved = await resolveStoreByHost(extractHostFromRequest(req), devSlug(req));
      if (resolved) {
        storeId = resolved.store.id;
      }
    }

    if (!storeId || isNaN(storeId)) {
      throw new AppException(400, 'Identifiant de boutique (storeId) requis');
    }

    const result = await getStoreCategories(storeId, { activeOnly: true });

    res.json({
      status: 'success',
      data: { categories: result.tree, flat: result.flat },
    });
  })
);

router.get(
  '/pages/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const slug = String(req.params.slug || '');
    let storeId = parseInt(req.query.storeId as string, 10);

    if (isNaN(storeId)) {
      const resolved = await resolveStoreByHost(extractHostFromRequest(req), devSlug(req));
      if (resolved) {
        storeId = resolved.store.id;
      }
    }

    if (!storeId || isNaN(storeId)) {
      throw new AppException(400, 'Identifiant de boutique (storeId) requis');
    }

    const page = await getStorePageBySlug(storeId, slug);

    res.json({
      status: 'success',
      data: { page },
    });
  })
);

router.post(
  '/checkout',
  checkoutRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const reqIp = getClientIp(req);
    const userAgent = (req.headers['user-agent'] || '').toString();
    const referer = req.headers.referer;

    // The store is whichever one owns the domain this order arrived on, not
    // whichever one the body names. An order placed on a seller's shop must
    // land in that seller's queue; letting the payload pick meant any page
    // anywhere could file orders against any store, and the daily rate limit
    // below is per-visitor, not per-store, so nothing else was holding that
    // shut. In development the host is localhost:3001, so the body still
    // decides — see TRUSTS_CALLER_FOR_HOST.
    const resolved = await resolveStoreByHost(extractHostFromRequest(req), devSlug(req));
    const storeId = resolved?.store.id ?? (TRUSTS_CALLER_FOR_HOST ? Number(req.body?.storeId) : NaN);

    if (!storeId || Number.isNaN(storeId)) {
      throw new AppException(404, 'Boutique introuvable pour ce domaine');
    }

    const result = await executeStoreCheckout({ ...req.body, storeId }, reqIp, userAgent, referer);

    res.status(201).json({
      status: 'success',
      data: result,
    });
  })
);

export default router;
