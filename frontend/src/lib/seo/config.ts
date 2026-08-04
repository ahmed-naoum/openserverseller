/**
 * Per-page, per-language SEO metadata.
 *
 * Every public route gets a distinct title and description in all three
 * languages. Before this file existed, every page on silacod.com shared the
 * single title/description hardcoded in index.html, so search engines and AI
 * crawlers saw ten identical pages.
 *
 * Keep descriptions between 140-165 characters: longer gets truncated in
 * results, shorter wastes the slot.
 */

export const SITE_URL = 'https://silacod.com';

export type SeoLang = 'fr' | 'ar' | 'en';
export const SEO_LANGS: SeoLang[] = ['fr', 'ar', 'en'];

/** The language a crawler gets when no prefix is present. */
export const DEFAULT_LANG: SeoLang = 'fr';

export interface PageSeo {
  title: string;
  description: string;
  /** Optional per-page keyword hint. Not a ranking factor; used for OG/meta parity. */
  keywords?: string;
}

export type SeoPageKey =
  | 'home'
  | 'pricing'
  | 'about'
  | 'faq'
  | 'contact'
  | 'careers'
  | 'blog'
  | 'marketplace'
  | 'terms'
  | 'privacy';

type SeoTable = Record<SeoPageKey, Record<SeoLang, PageSeo>>;

export const SEO: SeoTable = {
  home: {
    fr: {
      title: 'SILACOD — Dropshipping marque blanche au Maroc | COD & Fulfillment',
      description:
        "Lancez votre marque de cosmétiques et compléments alimentaires au Maroc sans stock. SILACOD gère le sourcing, le branding, le stockage, la confirmation et la livraison COD.",
      keywords:
        'dropshipping maroc, marque blanche maroc, white label, cash on delivery, fulfillment maroc, cosmétiques, compléments alimentaires',
    },
    ar: {
      title: 'سيلاكود — الدروبشيبينغ بالعلامة الخاصة في المغرب | الدفع عند الاستلام',
      description:
        'أطلق علامتك التجارية في مستحضرات التجميل والمكملات الغذائية بالمغرب دون مخزون. سيلاكود تتكفل بالتوريد والتغليف والتخزين والتأكيد والتوصيل مع الدفع عند الاستلام.',
      keywords:
        'دروبشيبينغ المغرب, العلامة الخاصة, الدفع عند الاستلام, التجارة الإلكترونية المغرب, مكملات غذائية, مستحضرات تجميل',
    },
    en: {
      title: 'SILACOD — White-Label Dropshipping in Morocco | COD & Fulfillment',
      description:
        'Launch your own cosmetics and supplements brand in Morocco with no inventory. SILACOD handles sourcing, branding, warehousing, order confirmation and COD delivery.',
      keywords:
        'dropshipping morocco, white label morocco, private label, cash on delivery, fulfillment morocco',
    },
  },

  pricing: {
    fr: {
      title: 'Tarifs SILACOD — 57 DH livraison, 13% commission | Sans frais cachés',
      description:
        'Tarification transparente : 57 DH par colis livré, 13% de commission sur le profit net, 2 DH par lead landing page, 8 DH par lead WhatsApp, 3 DH par retour.',
    },
    ar: {
      title: 'أسعار سيلاكود — 57 درهم للتوصيل و13% عمولة | بدون رسوم خفية',
      description:
        'تسعير شفاف: 57 درهم لكل طرد مُسلَّم، 13% عمولة على الربح الصافي، 2 درهم لكل طلب من صفحة الهبوط، 8 دراهم لكل طلب واتساب، 3 دراهم لكل مرتجع.',
    },
    en: {
      title: 'SILACOD Pricing — 57 MAD delivery, 13% commission | No hidden fees',
      description:
        'Transparent pricing: 57 MAD per delivered parcel, 13% commission on net profit, 2 MAD per landing-page lead, 8 MAD per WhatsApp lead, 3 MAD per return.',
    },
  },

  about: {
    fr: {
      title: 'À propos de SILACOD — Plateforme marocaine de dropshipping white-label',
      description:
        "SILACOD SARL, basée à Agadir avec un centre d'appel à Casablanca, permet aux vendeurs marocains de lancer leur propre marque de cosmétiques et compléments.",
    },
    ar: {
      title: 'عن سيلاكود — منصة مغربية للدروبشيبينغ بالعلامة الخاصة',
      description:
        'سيلاكود ش.م.م، ومقرها أكادير مع مركز اتصال بالدار البيضاء، تمكّن البائعين المغاربة من إطلاق علامتهم الخاصة في مستحضرات التجميل والمكملات الغذائية.',
    },
    en: {
      title: 'About SILACOD — Moroccan white-label dropshipping platform',
      description:
        'SILACOD SARL, based in Agadir with a call centre in Casablanca, helps Moroccan sellers launch their own cosmetics and supplements brand without inventory.',
    },
  },

  faq: {
    fr: {
      title: 'FAQ SILACOD — Comment fonctionne le dropshipping COD au Maroc ?',
      description:
        'Réponses aux questions fréquentes : comment démarrer, comment fonctionne le paiement à la livraison, les délais, les retours, la personnalisation de votre marque.',
    },
    ar: {
      title: 'الأسئلة الشائعة — كيف يعمل الدروبشيبينغ بالدفع عند الاستلام في المغرب؟',
      description:
        'أجوبة عن الأسئلة الأكثر تكرارًا: كيف تبدأ، كيف يعمل الدفع عند الاستلام، آجال التوصيل، المرتجعات، وتخصيص علامتك التجارية.',
    },
    en: {
      title: 'SILACOD FAQ — How does COD dropshipping work in Morocco?',
      description:
        'Answers to common questions: how to start, how cash on delivery works, delivery times, returns, and how to put your own brand on the products.',
    },
  },

  contact: {
    fr: {
      title: 'Contact SILACOD — Support 7j/7 | Agadir & Casablanca',
      description:
        'Contactez SILACOD par email, téléphone ou WhatsApp au +212 660-517679. Siège à Agadir, centre d\'appel à Casablanca. Support disponible pour les vendeurs.',
    },
    ar: {
      title: 'اتصل بسيلاكود — دعم على مدار الأسبوع | أكادير والدار البيضاء',
      description:
        'تواصل مع سيلاكود عبر البريد الإلكتروني أو الهاتف أو واتساب على 517679-660 212+. المقر بأكادير ومركز الاتصال بالدار البيضاء.',
    },
    en: {
      title: 'Contact SILACOD — Support 7/7 | Agadir & Casablanca',
      description:
        'Reach SILACOD by email, phone or WhatsApp on +212 660-517679. Head office in Agadir, call centre in Casablanca. Support available for sellers.',
    },
  },

  careers: {
    fr: {
      title: 'Carrières SILACOD — Offres d\'emploi à Agadir et Casablanca',
      description:
        'Rejoignez SILACOD : agents de centre d\'appel à Casablanca, développeur front-end, coordinateur logistique à Agadir. Postulez à jobs@silacod.com.',
    },
    ar: {
      title: 'وظائف سيلاكود — فرص عمل بأكادير والدار البيضاء',
      description:
        'انضم إلى سيلاكود: وكلاء مركز اتصال بالدار البيضاء، مطور واجهات أمامية، منسق لوجستيك بأكادير. أرسل سيرتك إلى jobs@silacod.com.',
    },
    en: {
      title: 'SILACOD Careers — Jobs in Agadir and Casablanca',
      description:
        'Join SILACOD: call-centre agents in Casablanca, front-end developer, logistics coordinator in Agadir. Apply at jobs@silacod.com.',
    },
  },

  blog: {
    fr: {
      title: 'Blog SILACOD — Guides e-commerce, COD et marque blanche au Maroc',
      description:
        'Guides pratiques pour vendre en ligne au Maroc : démarrer en COD, réduire les refus de livraison, créer sa marque, choisir ses produits, réglementation.',
    },
    ar: {
      title: 'مدونة سيلاكود — أدلة التجارة الإلكترونية والدفع عند الاستلام بالمغرب',
      description:
        'أدلة عملية للبيع عبر الإنترنت في المغرب: البدء بالدفع عند الاستلام، خفض نسب رفض الطلبات، إنشاء علامتك، اختيار المنتجات، والجانب القانوني.',
    },
    en: {
      title: 'SILACOD Blog — E-commerce, COD and private-label guides for Morocco',
      description:
        'Practical guides for selling online in Morocco: starting with COD, cutting delivery refusals, building your brand, picking products, and the legal side.',
    },
  },

  marketplace: {
    fr: {
      title: 'Catalogue SILACOD — 200+ produits à personnaliser à votre marque',
      description:
        'Parcourez notre catalogue de cosmétiques et compléments alimentaires prêts à porter votre marque, avec prix de vente conseillés et marges pour le Maroc.',
    },
    ar: {
      title: 'كتالوج سيلاكود — أكثر من 200 منتج جاهز لعلامتك التجارية',
      description:
        'تصفح كتالوج مستحضرات التجميل والمكملات الغذائية الجاهزة لحمل علامتك التجارية، مع أسعار البيع المقترحة وهوامش الربح في السوق المغربي.',
    },
    en: {
      title: 'SILACOD Catalogue — 200+ products ready for your own brand',
      description:
        'Browse our catalogue of cosmetics and dietary supplements ready to carry your brand, with suggested retail prices and margins for the Moroccan market.',
    },
  },

  terms: {
    fr: {
      title: 'Conditions générales — SILACOD',
      description:
        "Conditions générales d'utilisation de la plateforme SILACOD : obligations des vendeurs, tarification, livraison, retours et paiements.",
    },
    ar: {
      title: 'الشروط والأحكام — سيلاكود',
      description:
        'الشروط العامة لاستخدام منصة سيلاكود: التزامات البائعين، التسعير، التوصيل، المرتجعات، والمدفوعات.',
    },
    en: {
      title: 'Terms and Conditions — SILACOD',
      description:
        'Terms of use for the SILACOD platform: seller obligations, pricing, delivery, returns and payouts.',
    },
  },

  privacy: {
    fr: {
      title: 'Politique de confidentialité — SILACOD',
      description:
        'Comment SILACOD collecte, utilise et protège les données personnelles des vendeurs et des clients finaux, conformément à la loi 09-08.',
    },
    ar: {
      title: 'سياسة الخصوصية — سيلاكود',
      description:
        'كيف تجمع سيلاكود البيانات الشخصية للبائعين والعملاء وتستخدمها وتحميها، وفقًا للقانون 09-08 المتعلق بحماية المعطيات الشخصية.',
    },
    en: {
      title: 'Privacy Policy — SILACOD',
      description:
        'How SILACOD collects, uses and protects the personal data of sellers and end customers, in line with Moroccan law 09-08.',
    },
  },
};

/** Route path for each SEO page key, without language prefix. */
export const PAGE_PATHS: Record<SeoPageKey, string> = {
  home: '/',
  pricing: '/pricing',
  about: '/about',
  faq: '/faq',
  contact: '/contact',
  careers: '/careers',
  blog: '/blog',
  marketplace: '/marketplace',
  terms: '/terms',
  privacy: '/privacy',
};

/**
 * Build an absolute URL for a page in a given language.
 *
 * Language-prefixed URLs (/fr/pricing) are the target structure so each
 * language is separately indexable. Until the prefixed routes ship, pass
 * `prefixed = false` to emit the current unprefixed URLs.
 */
export function pageUrl(page: SeoPageKey, lang: SeoLang, prefixed = true): string {
  const path = PAGE_PATHS[page];
  if (!prefixed) {
    return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`;
  }
  return path === '/' ? `${SITE_URL}/${lang}` : `${SITE_URL}/${lang}${path}`;
}
