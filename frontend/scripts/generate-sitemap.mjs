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
 *   API_URL=http://localhost:3001/api node scripts/generate-sitemap.mjs
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SITE_URL = 'https://silacod.com';
const API_URL = process.env.API_URL || 'http://localhost:3001/api';

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

async function fetchProducts() {
  const endpoints = [
    `${API_URL}/public/products/featured`,
    `${API_URL}/public/categories`,
  ];
  try {
    const res = await fetch(endpoints[0], {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();

    // Response shape varies by endpoint version; accept the common ones.
    const list = Array.isArray(body)
      ? body
      : Array.isArray(body?.products)
        ? body.products
        : Array.isArray(body?.data)
          ? body.data
          : [];

    return list
      .map((p) => ({
        id: p.id ?? p._id ?? p.productId,
        updatedAt: p.updatedAt ?? p.updated_at ?? null,
      }))
      .filter((p) => p.id);
  } catch (err) {
    console.warn(
      `[sitemap] Catalogue skipped — API unreachable at ${API_URL} (${err.message}).\n` +
        `[sitemap] Static pages still written. Re-run with the backend up to include products.`,
    );
    return [];
  }
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
