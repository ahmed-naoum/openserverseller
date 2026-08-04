import { useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  SEO,
  SITE_URL,
  SEO_LANGS,
  DEFAULT_LANG,
  pageUrl,
  type SeoLang,
  type SeoPageKey,
} from '../lib/seo/config';
import { buildSiteSchema, buildPageSchema } from '../lib/seo/schema';

/**
 * Sets per-page SEO tags: title, description, canonical, hreflang, Open Graph,
 * Twitter cards and JSON-LD.
 *
 * Implemented with direct DOM writes rather than a helmet library so it adds no
 * dependency and so a prerenderer capturing the rendered DOM picks the tags up
 * verbatim.
 *
 * Usage on a public page:
 *   <Seo page="pricing" />
 *
 * Or with explicit overrides (blog articles, product pages):
 *   <Seo title="..." description="..." path="/blog/mon-article" jsonLd={schema} />
 */

/**
 * Language-prefixed URLs (/fr/pricing) are the target structure. Flip this to
 * true in the same change that ships the prefixed routes, so canonical and
 * hreflang start pointing at real URLs rather than 404s.
 */
const LANG_PREFIXED_ROUTES_LIVE = false;

interface SeoProps {
  /** Key into the SEO table. Omit when supplying title/description directly. */
  page?: SeoPageKey;
  title?: string;
  description?: string;
  /** Path without language prefix, e.g. "/blog/demarrer-cod". Defaults to the page's path. */
  path?: string;
  image?: string;
  /** Extra JSON-LD blocks (FAQ, Product, Article, Breadcrumb). */
  jsonLd?: Array<Record<string, unknown> | null>;
  /** Set true on pages that must never be indexed. */
  noindex?: boolean;
}

const MANAGED = 'data-seo-managed';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    el.setAttribute(MANAGED, 'true');
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string, hreflang?: string) {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    if (hreflang) el.setAttribute('hreflang', hreflang);
    el.setAttribute(MANAGED, 'true');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLd(id: string, data: unknown) {
  const domId = `ld-${id}`;
  let el = document.getElementById(domId) as HTMLScriptElement | null;
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = domId;
    el.setAttribute(MANAGED, 'true');
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

const OG_LOCALE: Record<SeoLang, string> = {
  fr: 'fr_MA',
  ar: 'ar_MA',
  en: 'en_US',
};

export function Seo({
  page,
  title,
  description,
  path,
  image,
  jsonLd,
  noindex = false,
}: SeoProps) {
  const { language } = useLanguage();
  const lang: SeoLang = (SEO_LANGS as string[]).includes(language)
    ? (language as SeoLang)
    : DEFAULT_LANG;

  const entry = page ? SEO[page][lang] : undefined;
  const finalTitle = title ?? entry?.title ?? 'SILACOD';
  const finalDescription = description ?? entry?.description ?? '';
  const keywords = page ? SEO[page][lang].keywords : undefined;

  const resolvedPath =
    path ?? (page ? new URL(pageUrl(page, lang, false)).pathname : '/');

  const canonical = LANG_PREFIXED_ROUTES_LIVE
    ? `${SITE_URL}/${lang}${resolvedPath === '/' ? '' : resolvedPath}`
    : `${SITE_URL}${resolvedPath === '/' ? '/' : resolvedPath}`;

  const ogImage = image ?? `${SITE_URL}/logo-full-new.svg`;

  // Serialised so the effect re-runs when any extra schema block changes.
  const jsonLdKey = JSON.stringify(jsonLd ?? null);

  useEffect(() => {
    document.title = finalTitle;

    if (finalDescription) upsertMeta('name', 'description', finalDescription);
    if (keywords) upsertMeta('name', 'keywords', keywords);
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');

    upsertLink('canonical', canonical);

    // hreflang: only meaningful once each language has its own URL. Emitting
    // three alternates that all resolve to the same URL tells engines the
    // languages are duplicates, which is worse than emitting none.
    if (LANG_PREFIXED_ROUTES_LIVE) {
      SEO_LANGS.forEach((l) => {
        upsertLink(
          'alternate',
          `${SITE_URL}/${l}${resolvedPath === '/' ? '' : resolvedPath}`,
          l === 'fr' ? 'fr-MA' : l === 'ar' ? 'ar-MA' : 'en',
        );
      });
      upsertLink(
        'alternate',
        `${SITE_URL}/${DEFAULT_LANG}${resolvedPath === '/' ? '' : resolvedPath}`,
        'x-default',
      );
    }

    // Open Graph
    upsertMeta('property', 'og:title', finalTitle);
    if (finalDescription) upsertMeta('property', 'og:description', finalDescription);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:site_name', 'SILACOD');
    upsertMeta('property', 'og:locale', OG_LOCALE[lang]);
    upsertMeta('property', 'og:image', ogImage);

    // Twitter / X
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', finalTitle);
    if (finalDescription) upsertMeta('name', 'twitter:description', finalDescription);
    upsertMeta('name', 'twitter:image', ogImage);

    // Structured data
    setJsonLd('site', buildSiteSchema(lang));
    setJsonLd(
      'page',
      buildPageSchema({
        url: canonical,
        name: finalTitle,
        description: finalDescription,
        lang,
      }),
    );

    const extras = (jsonLd ?? []).filter(Boolean) as Array<Record<string, unknown>>;
    extras.forEach((block, i) => setJsonLd(`extra-${i}`, block));
    // Drop stale extras left by a previously rendered page.
    for (let i = extras.length; i < 8; i++) setJsonLd(`extra-${i}`, null);

    // Keep the document language attributes in step with the rendered content.
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }, [
    finalTitle,
    finalDescription,
    keywords,
    canonical,
    resolvedPath,
    ogImage,
    lang,
    noindex,
    jsonLdKey,
  ]);

  return null;
}

export default Seo;
