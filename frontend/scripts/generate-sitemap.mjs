/**
 * Generates public/sitemap.xml at build time.
 *
 * Runs before `vite build` so the file is copied into dist/ and served by nginx
 * at https://silacod.com/sitemap.xml — the URL referenced in robots.txt.
 *
 * Static marketing pages are always emitted. Catalogue products are added when
 * the backend API is reachable; if it is not, the script still writes a valid
 * sitemap of the static pages and warns rather than failing the build.
 *
 * Usage:
 *   node scripts/generate-sitemap.mjs
 *   API_URL=http://localhost:3001/api/v1 node scripts/generate-sitemap.mjs
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SITE_URL = 'https://silacod.com';
/**
 * Must carry the backend's API_PREFIX, which is `/api/v1` (backend/.env, read at
 * backend/src/index.ts:306) — not `/api`. Mirrors the dev default in
 * src/lib/api.ts. Getting this wrong 404s every catalogue request and the
 * sitemap silently ships marketing pages only.
 */
const API_URL = process.env.API_URL || 'http://localhost:3001/api/v1';

/** Products are paged out of the marketplace endpoint; it caps `limit` per call. */
const PRODUCTS_PAGE_SIZE = 100;
const PRODUCTS_MAX_PAGES = 50;

/**
 * The public catalogue is the REGULAR marketplace view — the same set an
 * anonymous visitor sees at /marketplace, and the only one whose /product/:id
 * pages render without a session.
 */
const CATALOGUE_VIEW = 'REGULAR';

/**
 * Language-prefixed URLs are the target structure. Keep false until the
 * prefixed routes ship, otherwise the sitemap advertises URLs that 404.
 * Flip together with LANG_PREFIXED_ROUTES_LIVE in src/components/Seo.tsx.
 */
const LANG_PREFIXED_ROUTES_LIVE = false;
const LANGS = ['fr', 'ar', 'en'];
const HREFLANG = { fr: 'fr-MA', ar: 'ar-MA', en: 'en' };
const DEFAULT_LANG = 'fr';

/**
 * Public routes. Mirrors PAGE_PATHS in src/lib/seo/config.ts — keep in step.
 * Only genuinely public, indexable pages belong here; dashboards and auth
 * flows are excluded and also blocked in robots.txt.
 */
const STATIC_PAGES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/marketplace', changefreq: 'daily', priority: '0.9' },
  { path: '/pricing', changefreq: 'monthly', priority: '0.9' },
  { path: '/about', changefreq: 'monthly', priority: '0.7' },
  { path: '/faq', changefreq: 'monthly', priority: '0.8' },
  { path: '/blog', changefreq: 'weekly', priority: '0.8' },
  { path: '/contact', changefreq: 'monthly', priority: '0.6' },
  { path: '/careers', changefreq: 'weekly', priority: '0.5' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
];

const xmlEscape = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

function absoluteUrl(routePath, lang) {
  if (!LANG_PREFIXED_ROUTES_LIVE) {
    return routePath === '/' ? `${SITE_URL}/` : `${SITE_URL}${routePath}`;
  }
  return routePath === '/' ? `${SITE_URL}/${lang}` : `${SITE_URL}/${lang}${routePath}`;
}

function urlEntry({ loc, lastmod, changefreq, priority, alternates }) {
  const lines = [`  <url>`, `    <loc>${xmlEscape(loc)}</loc>`];
  if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) lines.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) lines.push(`    <priority>${priority}</priority>`);
  for (const alt of alternates || []) {
    lines.push(
      `    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${xmlEscape(alt.href)}"/>`,
    );
  }
  lines.push(`  </url>`);
  return lines.join('\n');
}

/** Unwraps the response envelopes this API has used across versions. */
function productList(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.products)) return body.products;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.data?.products)) return body.data.products;
  return [];
}

const normalize = (list) =>
  list
    .map((p) => ({
      id: p.id ?? p._id ?? p.productId,
      updatedAt: p.updatedAt ?? p.updated_at ?? null,
    }))
    .filter((p) => p.id != null);

async function getJson(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.json();
}

/**
 * Walks every page of the public marketplace so the sitemap carries the whole
 * catalogue. /public/products/featured is only the 12-item homepage widget, so
 * it is a last-resort fallback rather than the source.
 */
async function fetchProducts() {
  const seen = new Map();

  try {
    for (let page = 1; page <= PRODUCTS_MAX_PAGES; page++) {
      const body = await getJson(
        `${API_URL}/public/marketplace/products` +
          `?view=${CATALOGUE_VIEW}&page=${page}&limit=${PRODUCTS_PAGE_SIZE}`,
      );
      const batch = normalize(productList(body));
      for (const product of batch) {
        if (!seen.has(product.id)) seen.set(product.id, product);
      }

      const total = Number(body?.data?.total ?? body?.total);
      if (batch.length < PRODUCTS_PAGE_SIZE) break;
      if (Number.isFinite(total) && seen.size >= total) break;
    }

    if (seen.size > 0) return [...seen.values()];
    console.warn('[sitemap] Marketplace returned no products; trying featured.');
  } catch (err) {
    console.warn(`[sitemap] Marketplace catalogue unavailable (${err.message}); trying featured.`);
  }

  try {
    const body = await getJson(`${API_URL}/public/products/featured`);
    const featured = normalize(productList(body));
    if (featured.length > 0) return featured;
  } catch (err) {
    console.warn(`[sitemap] Featured products unavailable (${err.message}).`);
  }

  console.warn(
    `[sitemap] WARNING: 0 product URLs. The API at ${API_URL} answered nothing usable.\n` +
      `[sitemap] Static pages are still written, but the catalogue will drop out of\n` +
      `[sitemap] the index. Check the backend is up and that API_URL carries the\n` +
      `[sitemap] /api/v1 prefix, then re-run: npm run sitemap`,
  );
  return [];
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const entries = [];

  for (const page of STATIC_PAGES) {
    const langs = LANG_PREFIXED_ROUTES_LIVE ? LANGS : [DEFAULT_LANG];
    for (const lang of langs) {
      entries.push(
        urlEntry({
          loc: absoluteUrl(page.path, lang),
          lastmod: today,
          changefreq: page.changefreq,
          priority: page.priority,
          alternates: LANG_PREFIXED_ROUTES_LIVE
            ? [
                ...LANGS.map((l) => ({
                  hreflang: HREFLANG[l],
                  href: absoluteUrl(page.path, l),
                })),
                { hreflang: 'x-default', href: absoluteUrl(page.path, DEFAULT_LANG) },
              ]
            : [],
        }),
      );
    }
  }

  const products = await fetchProducts();
  for (const product of products) {
    entries.push(
      urlEntry({
        loc: `${SITE_URL}/product/${encodeURIComponent(product.id)}`,
        lastmod: product.updatedAt ? String(product.updatedAt).slice(0, 10) : today,
        changefreq: 'weekly',
        priority: '0.7',
      }),
    );
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');

  const outPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../public/sitemap.xml',
  );
  await writeFile(outPath, xml, 'utf8');

  console.log(
    `[sitemap] Wrote ${entries.length} URLs ` +
      `(${entries.length - products.length} pages, ${products.length} products) -> public/sitemap.xml`,
  );
}

main().catch((err) => {
  console.error('[sitemap] Failed:', err);
  process.exit(1);
});
