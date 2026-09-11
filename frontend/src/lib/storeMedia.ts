/**
 * Stock imagery for the default storefront.
 *
 * A brand-new store has no banner, no collection artwork and often no product
 * photos, and the stock theme used to render that as grey boxes — which reads
 * to a visitor as a broken shop rather than a new one. These are Unsplash CDN
 * photos, hotlinked (which is what Unsplash asks for) and sized through their
 * image proxy, so they cost the platform nothing and stay sharp on retina.
 *
 * Every id here was checked against the CDN; a 404 would leave a hole in the
 * page, so add nothing to these lists without loading it once first.
 *
 * These fill DECORATIVE slots only — hero art, category tiles, editorial
 * panels. Nothing here ever stands in for a product the shop does not have:
 * a card the visitor can click and buy is always backed by a real row.
 */

/** Builds an Unsplash CDN URL cropped to the box the layout actually paints. */
export function unsplash(id: string, w: number, h: number, q = 75): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=${q}`;
}

export interface HeroSlide {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  /** Which corner the copy sits in, so it never lands on the photo's subject. */
  align: 'left' | 'right';
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: '1483985988355-763728e1935b',
    eyebrow: 'Nouvelle saison',
    title: 'La collection qui fait la différence',
    subtitle: 'Des pièces sélectionnées une par une, livrées chez vous en 24 à 48h partout au Maroc.',
    cta: 'Découvrir la collection',
    href: '/products',
    align: 'left',
  },
  {
    id: '1505740420928-5e560c06d30e',
    eyebrow: 'High-Tech & Audio',
    title: 'Le son qui vous accompagne partout',
    subtitle: 'Casques, écouteurs et accessoires testés avant expédition. Payez à la réception.',
    cta: 'Voir les nouveautés',
    href: '/products?sort=newest',
    align: 'right',
  },
  {
    id: '1585386959984-a4155224a1ad',
    eyebrow: 'Beauté & Parfums',
    title: 'Votre routine, en version premium',
    subtitle: 'Parfums, soins et cosmétiques authentiques. Satisfait ou échangé sous 7 jours.',
    cta: 'Explorer la boutique',
    href: '/products',
    align: 'left',
  },
];

export interface DemoCategory {
  label: string;
  /** Feeds the storefront search, so the tile keeps working once stock lands. */
  query: string;
  id: string;
}

/**
 * Shown only while the seller has configured no collections of their own.
 * Each tile searches the shop's real catalogue, so it is a navigation aid that
 * grows into the store rather than decoration that has to be torn out later.
 */
export const DEMO_CATEGORIES: DemoCategory[] = [
  { label: 'Mode Femme', query: 'femme', id: '1515886657613-9f3515b0c78f' },
  { label: 'Mode Homme', query: 'homme', id: '1487222477894-8943e31ef7b2' },
  { label: 'Chaussures', query: 'chaussure', id: '1549298916-b41d501d3772' },
  { label: 'Beauté & Parfums', query: 'parfum', id: '1596462502278-27bfdc403348' },
  { label: 'Électronique', query: 'electronique', id: '1546435770-a3e426bf472b' },
  { label: 'Montres & Bijoux', query: 'montre', id: '1523275335684-37898b6baf30' },
  { label: 'Sacs & Accessoires', query: 'sac', id: '1590874103328-eac38a683ce7' },
  { label: 'Maison & Déco', query: 'maison', id: '1616486338812-3dadae4b4ace' },
];

export interface PromoPanel {
  id: string;
  kicker: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  tone: 'light' | 'dark';
}

export const PROMO_PANELS: PromoPanel[] = [
  {
    id: '1571019613454-1cb2f99b2d8b',
    kicker: 'Sport & Bien-être',
    title: 'Bougez plus, dépensez moins',
    body: 'Équipement et accessoires de sport livrés partout au Maroc.',
    cta: 'Voir la sélection',
    href: '/products?search=sport',
    tone: 'dark',
  },
  {
    id: '1620916566398-39f1143ab7be',
    kicker: 'Soins & Beauté',
    title: 'Une routine qui vous ressemble',
    body: 'Soins visage, cheveux et corps — produits authentiques garantis.',
    cta: 'Découvrir',
    href: '/products?search=soin',
    tone: 'light',
  },
];

/** The wide, image-led band that breaks up the product grids. */
export const EDITORIAL = {
  wide: '1607083206869-4c7672e72a8a',
  storefront: '1556742049-0cfed4f6a45d',
  counter: '1556740738-b6a63e27c4df',
};

export interface LookbookShot {
  id: string;
  label: string;
  query: string;
}

export const LOOKBOOK: LookbookShot[] = [
  { id: '1588117305388-c2631a279f82', label: 'Casual', query: 'jean' },
  { id: '1591047139829-d91aecb6caea', label: 'Outerwear', query: 'veste' },
  { id: '1554062614-6da4fa67725a', label: 'Soirée', query: 'talons' },
];

/** Square lifestyle shots for the closing mood grid. */
export const MOOD_GRID: string[] = [
  '1560769629-975ec94e6a86',
  '1445205170230-053b83016050',
  '1594223274512-ad4803739b7c',
  '1608571423902-eed4a5ad8108',
  '1603006905003-be475563bc59',
  '1607522370275-f14206abe5d3',
  '1522337360788-8b13dee7a37e',
  '1611652022419-a9419f74343d',
];

/**
 * Last-resort artwork for a product row whose seller uploaded no photo.
 *
 * Picked by product id rather than at random so the same product keeps the
 * same picture between the grid, the cart and a reload — a card that reshuffles
 * its own image on every render looks broken.
 */
const PRODUCT_FALLBACKS: string[] = [
  '1542291026-7eec264c27ff',
  '1572635196237-14b3f281503f',
  '1600185365483-26d7a4cc7519',
  '1553062407-98eeb64c6a62',
  '1611930022073-b7a4ba5fcccd',
  '1620799140408-edc6dcb6d633',
  '1593642532842-98d0fd5ebc1a',
  '1596755094514-f87e34085b2c',
  '1608667508764-33cf0726b13a',
  '1523381210434-271e8be1f52b',
  '1434389677669-e08b4cac3105',
  '1598300042247-d088f8ab3a91',
];

export function productFallbackImage(seed: number | string, size = 600): string {
  const n = typeof seed === 'number' ? seed : Array.from(String(seed)).reduce((a, c) => a + c.charCodeAt(0), 0);
  const pick = PRODUCT_FALLBACKS[Math.abs(n) % PRODUCT_FALLBACKS.length];
  return unsplash(pick, size, size);
}
