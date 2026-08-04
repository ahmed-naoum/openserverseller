/**
 * Schema.org JSON-LD builders.
 *
 * Purpose: let machines resolve SILACOD into a single unambiguous entity.
 * Structured data is not a proven ranking lever on its own, but it is how
 * search and AI systems disambiguate "SilaCOD" from unrelated names and link
 * every profile back to one company.
 *
 * Legal facts below are from the Moroccan trade register (RC Agadir 68439).
 */

import { SITE_URL, type SeoLang } from './config';

/** Profiles that belong to the SILACOD entity. Add each new profile as it goes live. */
export const SAME_AS: string[] = [
  'https://www.instagram.com/silacod.ma/',
  // TODO add as created (task Y8): Facebook Page, LinkedIn company,
  // YouTube channel, TikTok, Wikidata item, Trustpilot profile.
];

export const ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: 'SILACOD',
  alternateName: ['سيلاكود', 'SilaCOD', 'SILACOD SARL'],
  legalName: 'SILACOD SARL',
  url: SITE_URL,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_URL}/logo-full-new.svg`,
  },
  email: 'contact@silacod.com',
  telephone: '+212660517679',
  foundingDate: '2026-04-17',
  taxID: '003942785000074',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Agadir',
    addressRegion: 'Souss-Massa',
    addressCountry: 'MA',
  },
  areaServed: {
    '@type': 'Country',
    name: 'Morocco',
  },
  knowsAbout: [
    'dropshipping',
    'white-label manufacturing',
    'private label cosmetics',
    'dietary supplements',
    'cash on delivery',
    'e-commerce fulfillment',
    'order confirmation call centre',
  ],
  sameAs: SAME_AS,
} as const;

const LANG_TAG: Record<SeoLang, string> = {
  fr: 'fr-MA',
  ar: 'ar-MA',
  en: 'en',
};

/** Organization + WebSite graph. Emit once, on every page. */
export function buildSiteSchema(lang: SeoLang) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      ORGANIZATION,
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: 'SILACOD',
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: LANG_TAG[lang],
      },
    ],
  };
}

/** WebPage node linking a specific page to the site and org. */
export function buildPageSchema(opts: {
  url: string;
  name: string;
  description: string;
  lang: SeoLang;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${opts.url}#webpage`,
    url: opts.url,
    name: opts.name,
    description: opts.description,
    inLanguage: LANG_TAG[opts.lang],
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: { '@id': `${SITE_URL}/#organization` },
  };
}

/**
 * FAQPage schema. Feed it the questions actually rendered on the page —
 * schema that does not match visible content is a manual-action risk.
 */
export function buildFaqSchema(items: Array<{ question: string; answer: string }>) {
  if (!items.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: it.answer,
      },
    })),
  };
}

/** Product schema for catalogue detail pages. */
export function buildProductSchema(opts: {
  name: string;
  description?: string;
  image?: string;
  sku?: string;
  price?: number;
  url: string;
  category?: string;
  inStock?: boolean;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: opts.name,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.image ? { image: opts.image } : {}),
    ...(opts.sku ? { sku: opts.sku } : {}),
    ...(opts.category ? { category: opts.category } : {}),
    brand: { '@type': 'Brand', name: 'SILACOD' },
    url: opts.url,
    ...(opts.price !== undefined
      ? {
          offers: {
            '@type': 'Offer',
            price: opts.price,
            priceCurrency: 'MAD',
            availability: opts.inStock === false
              ? 'https://schema.org/OutOfStock'
              : 'https://schema.org/InStock',
            url: opts.url,
            seller: { '@id': `${SITE_URL}/#organization` },
          },
        }
      : {}),
  };
}

/** Breadcrumbs help engines understand site structure. */
export function buildBreadcrumbSchema(trail: Array<{ name: string; url: string }>) {
  if (trail.length < 2) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: step.name,
      item: step.url,
    })),
  };
}

/** Article schema for blog posts. */
export function buildArticleSchema(opts: {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  image?: string;
  lang: SeoLang;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.headline,
    description: opts.description,
    url: opts.url,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified ?? opts.datePublished,
    ...(opts.image ? { image: opts.image } : {}),
    inLanguage: LANG_TAG[opts.lang],
    author: { '@id': `${SITE_URL}/#organization` },
    publisher: { '@id': `${SITE_URL}/#organization` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': opts.url },
  };
}
