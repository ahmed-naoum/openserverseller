import { prisma } from '../lib/prisma.js';
import { AppException } from '../middleware/errorHandler.js';
import { getClientIp, getClientCountry } from '../utils/clientIp.js';
import { maybeAutoBanForOrders } from '../lib/ipBan.js';
import { findVendorBan, recordVendorBanHit } from '../lib/vendorIpBan.js';
import { enqueueSheetPush } from './sheetPush.service.js';
import { reportLeadToMetaCapi } from './metaCapi.service.js';
import { getIO } from '../lib/realtime.js';
import { getNotifiableAgentIds } from '../utils/agentScope.js';
import { validateLandingPageUpdate } from '../validations/landingPage.validation.js';
import { defaultsFor } from '../shared/blocks/index.js';
import {
  listPublicProducts,
  getPublicProduct,
  resolveCartProducts,
  getStoreCategories,
} from './storeCatalogue.service.js';

/**
 * Stands in for a referral code when reporting a store conversion.
 *
 * `pixelRowsForCode` (landingCompiler/head.ts:47) returns the pixels a seller
 * scoped to the code it is given, and falls back to their account-wide pixels
 * when none match. A store order belongs to no link, so a sentinel that matches
 * nothing is what selects the account-wide set — the correct answer here.
 */
const STORE_PIXEL_CODE = '__store__';

export interface ResolveStoreResult {
  store: {
    id: number;
    name: string;
    slug: string;
    tagline: string | null;
    description: string | null;
    logoUrl: string | null;
    bannerUrl: string | null;
    faviconUrl: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    whatsappNumber: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    tiktokUrl: string | null;
    themeName: string;
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    headerStyle: string;
    footerStyle: string;
    announcementText: string | null;
    announcementActive: boolean;
    customCss: string | null;
    homeStructure: any;
    navigationMenu: any;
    footerMenu: any;
    metaTitle: string | null;
    metaDescription: string | null;
    ogImageUrl: string | null;
    currency: string;
    enableCod: boolean;
    freeShippingThreshold: number | null;
    standardShippingFee: number;
    status: string;
    isPublished: boolean;
    collections: Array<{
      id: number;
      nameFr: string;
      nameAr: string | null;
      slug: string;
      description: string | null;
      imageUrl: string | null;
    }>;
    /**
     * The shop category menu, parents each carrying their children. Shipped in
     * this payload rather than fetched separately because the static compiler
     * renders the menu into the HTML and has no second request to make.
     */
    categories: Array<{
      id: number;
      nameFr: string;
      nameAr: string | null;
      slug: string;
      imageUrl: string | null;
      productsCount: number;
      children: Array<{
        id: number;
        nameFr: string;
        nameAr: string | null;
        slug: string;
        productsCount: number;
      }>;
    }>;
    customPages: Array<{
      id: number;
      title: string;
      slug: string;
    }>;
    /** Documents rendered on every page: the header above, the footer below. */
    globalSections: { header: any; footer: any };
  };
  vendor: {
    id: number;
    uuid: string;
    subdomain: string | null;
    customDomain: string | null;
    customDomainStatus: string;
  };
  pixels: Array<{
    id?: number;
    platform: string;
    pixelId: string;
    conversionEvent?: string;
    testEventCode?: string | null;
  }>;
}

function normalizeHost(rawHost: string): string {
  return rawHost.trim().toLowerCase().replace(/^www\./i, '');
}

export function extractSubdomainFromHost(host: string): string | null {
  const norm = normalizeHost(host);
  const hostWithoutPort = norm.split(':')[0];

  if (hostWithoutPort.endsWith('.localhost')) {
    const parts = hostWithoutPort.split('.');
    return parts.length > 1 && parts[0] !== 'localhost' ? parts[0] : null;
  }

  const frontendUrl = process.env.FRONTEND_URL || 'https://silacod.com';
  let baseHost = 'silacod.com';
  try {
    baseHost = new URL(frontendUrl).host;
  } catch {}
  const normBase = normalizeHost(baseHost);
  const baseWithoutPort = normBase.split(':')[0];

  if (hostWithoutPort.endsWith('.' + baseWithoutPort)) {
    const sub = hostWithoutPort.slice(0, -(baseWithoutPort.length + 1));
    return sub === 'custom' || sub === 'app' || sub === 'api' || sub === 'admin' ? null : sub;
  }

  return null;
}

/**
 * The store's global header and footer.
 *
 * They are page documents like any other, edited in Studio and rendered on
 * every page of the store. Rather than two new columns — and a schema push on
 * a live database for the sake of two JSON fields — they live as store pages
 * with reserved slugs, unpublished so no listing or public lookup ever shows
 * them. `resolveStoreByHost` reads them out by slug for the storefront.
 */
export const GLOBAL_SECTION_SLUGS = { header: '__header', footer: '__footer', product: '__product', catalogue: '__catalogue' } as const;
export type GlobalSectionKey = keyof typeof GLOBAL_SECTION_SLUGS;

export function isReservedSlug(slug: unknown): boolean {
  return typeof slug === 'string' && slug.startsWith('__');
}

/**
 * What a store's product and catalogue pages are before a seller touches
 * them in Studio: a bound product card, a bound grid. Both compile on day one.
 */
export const DEFAULT_TEMPLATES: Partial<Record<GlobalSectionKey, any>> = {
  product: {
    version: 3, kind: 'product', settings: {},
    root: [{ id: 'page', type: 'section', implicit: true, children: [
      // Registry defaults, not an empty object: the theme tokens the block
      // ships with ($primary on the price and the button) live in those.
      { id: 'detail', type: 'block', block: 'product_detail', props: defaultsFor('product_detail'), bind: { product: '$page.product' } },
    ] }],
  },
  catalogue: {
    version: 3, kind: 'collection', settings: {},
    root: [{ id: 'page', type: 'section', implicit: true, children: [
      { id: 'grid', type: 'block', block: 'products', props: { ...defaultsFor('products'), layoutType: 'grid', gridCols: 3, showPrice: true }, bind: { items: '$page.collection' } },
    ] }],
  },
};

export async function getOrCreateGlobalSection(storeId: number, key: GlobalSectionKey) {
  const slug = GLOBAL_SECTION_SLUGS[key];
  const existing = await (prisma as any).storePage.findFirst({ where: { storeId, slug } });
  if (existing) return existing;
  const titles: Record<GlobalSectionKey, string> = { header: 'En-tête', footer: 'Pied de page', product: 'Modèle de fiche produit', catalogue: 'Modèle de catalogue' };
  return (prisma as any).storePage.create({
    data: { storeId, slug, title: titles[key], isPublished: false, customStructure: DEFAULT_TEMPLATES[key] ?? null },
  });
}

async function loadGlobalSections(storeId: number): Promise<{ header: any; footer: any }> {
  const rows = await (prisma as any).storePage.findMany({
    where: { storeId, slug: { in: [GLOBAL_SECTION_SLUGS.header, GLOBAL_SECTION_SLUGS.footer] } },
    select: { slug: true, customStructure: true },
  });
  const by = new Map(rows.map((r: any) => [r.slug, r.customStructure]));
  return { header: by.get(GLOBAL_SECTION_SLUGS.header) ?? null, footer: by.get(GLOBAL_SECTION_SLUGS.footer) ?? null };
}

export async function resolveStoreByHost(
  hostHeader?: string,
  explicitSlug?: string
): Promise<ResolveStoreResult | null> {
  let user = null;
  let store = null;

  if (explicitSlug) {
    store = await (prisma as any).store.findUnique({
      where: { slug: explicitSlug },
      include: {
        user: {
          select: {
            id: true,
            uuid: true,
            subdomain: true,
            customDomain: true,
            customDomainStatus: true,
            pixels: {
              where: { type: 'GLOBAL' },
              select: { id: true, platform: true, pixelId: true, conversionEvent: true, testEventCode: true },
            },
          },
        },
        collections: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, nameFr: true, nameAr: true, slug: true, description: true, imageUrl: true },
        },
        customPages: {
          where: { isPublished: true },
          select: { id: true, title: true, slug: true },
        },
      },
    });

    if (store && store.user) {
      user = store.user;
    }
  }

  if (!store && hostHeader) {
    const normHost = normalizeHost(hostHeader);
    const domainWithoutPort = normHost.split(':')[0];

    const userWithDomain = await prisma.user.findFirst({
      where: {
        OR: [
          { customDomain: domainWithoutPort, customDomainStatus: 'ACTIVE' },
          { customDomain: normHost, customDomainStatus: 'ACTIVE' },
        ],
      },
      select: {
        id: true,
        uuid: true,
        subdomain: true,
        customDomain: true,
        customDomainStatus: true,
        pixels: {
          where: { type: 'GLOBAL' },
          select: { id: true, platform: true, pixelId: true, conversionEvent: true, testEventCode: true },
        },
      },
    });

    if (userWithDomain) {
      user = userWithDomain;
      store = await (prisma as any).store.findUnique({
        where: { userId: user.id },
        include: {
          collections: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            select: { id: true, nameFr: true, nameAr: true, slug: true, description: true, imageUrl: true },
          },
          customPages: {
            where: { isPublished: true },
            select: { id: true, title: true, slug: true },
          },
        },
      });
    }
  }

  if (!store && hostHeader) {
    const sub = extractSubdomainFromHost(hostHeader);
    if (sub) {
      let userWithSub = await prisma.user.findFirst({
        where: { subdomain: sub },
        select: {
          id: true,
          uuid: true,
          subdomain: true,
          customDomain: true,
          customDomainStatus: true,
          pixels: {
            where: { type: 'GLOBAL' },
            select: { id: true, platform: true, pixelId: true, conversionEvent: true, testEventCode: true },
          },
        },
      });

      if (userWithSub) {
        user = userWithSub;
        store = await (prisma as any).store.findUnique({
          where: { userId: user.id },
          include: {
            collections: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
              select: { id: true, nameFr: true, nameAr: true, slug: true, description: true, imageUrl: true },
            },
            customPages: {
              where: { isPublished: true },
              select: { id: true, title: true, slug: true },
            },
          },
        });
      } else {
        // Fallback: Check if store exists with slug === sub
        const storeBySlug = await (prisma as any).store.findUnique({
          where: { slug: sub },
          include: {
            user: {
              select: {
                id: true,
                uuid: true,
                subdomain: true,
                customDomain: true,
                customDomainStatus: true,
                pixels: {
                  where: { type: 'GLOBAL' },
                  select: { id: true, platform: true, pixelId: true, conversionEvent: true, testEventCode: true },
                },
              },
            },
            collections: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
              select: { id: true, nameFr: true, nameAr: true, slug: true, description: true, imageUrl: true },
            },
            customPages: {
              where: { isPublished: true },
              select: { id: true, title: true, slug: true },
            },
          },
        });

        if (storeBySlug && storeBySlug.user) {
          store = storeBySlug;
          user = storeBySlug.user;
        }
      }
    }
  }

  if (!store || !user) {
    return null;
  }

  const globalSections = await loadGlobalSections(store.id);

  return {
    store: {
      id: store.id,
      name: store.name,
      slug: store.slug,
      tagline: store.tagline,
      description: store.description,
      logoUrl: store.logoUrl,
      bannerUrl: store.bannerUrl,
      faviconUrl: store.faviconUrl,
      contactEmail: store.contactEmail,
      contactPhone: store.contactPhone,
      whatsappNumber: store.whatsappNumber,
      instagramUrl: store.instagramUrl,
      facebookUrl: store.facebookUrl,
      tiktokUrl: store.tiktokUrl,
      themeName: store.themeName,
      primaryColor: store.primaryColor,
      secondaryColor: store.secondaryColor,
      fontFamily: store.fontFamily,
      headerStyle: store.headerStyle,
      footerStyle: store.footerStyle,
      announcementText: store.announcementText,
      announcementActive: store.announcementActive,
      customCss: store.customCss,
      homeStructure: store.homeStructure,
      navigationMenu: store.navigationMenu,
      footerMenu: store.footerMenu,
      metaTitle: store.metaTitle,
      metaDescription: store.metaDescription,
      ogImageUrl: store.ogImageUrl,
      currency: store.currency,
      enableCod: store.enableCod,
      freeShippingThreshold: store.freeShippingThreshold,
      standardShippingFee: store.standardShippingFee,
      status: store.status,
      isPublished: store.isPublished,
      collections: store.collections || [],
      categories: (await getStoreCategories(store.id, { activeOnly: true })).tree as any,
      customPages: store.customPages || [],
      globalSections,
    },
    vendor: {
      id: user.id,
      uuid: user.uuid,
      subdomain: user.subdomain,
      customDomain: user.customDomain,
      customDomainStatus: user.customDomainStatus,
    },
    pixels: user.pixels || [],
  };
}

const STORE_INCLUDE = {
  user: {
    select: { id: true, subdomain: true, customDomain: true, customDomainStatus: true },
  },
  collections: { orderBy: { sortOrder: 'asc' as const } },
  customPages: true,
};

/**
 * A slug that is free, starting from the one we want.
 *
 * The store name a seller picks at registration is unique across both
 * `user.subdomain` and `store.slug`, so the first candidate almost always wins.
 * The suffix path exists for the accounts that predate that rule — stores seeded
 * from a full name — so provisioning can never die on a P2002 it cannot explain
 * to the user.
 */
async function availableSlug(desired: string, forUserId: number): Promise<string> {
  const base = desired.replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '') || `store-${forUserId}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const clash = await (prisma as any).store.findFirst({
      where: { slug: candidate, NOT: { userId: forUserId } },
      select: { id: true },
    });
    if (!clash) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Creates the seller's storefront, seeded and publishable on day one.
 *
 * Called at registration the moment the account exists — the store name the user
 * typed on the sign-up form is their subdomain, so there is nothing left to ask
 * — and kept as the lazy fallback behind `getOrCreateVendorStore` for accounts
 * created before that. Idempotent: an existing store is returned untouched, so
 * a retried registration or a second call is harmless.
 */
export async function provisionStoreForUser(
  userId: number,
  opts: { name?: string | null; slug?: string | null } = {}
) {
  const existing = await (prisma as any).store.findUnique({
    where: { userId },
    include: STORE_INCLUDE,
  });
  if (existing) return existing;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, subdomain: true, profile: { select: { fullName: true } } },
  });

  const desiredSlug =
    (opts.slug || '').trim().toLowerCase() ||
    user?.subdomain ||
    `store-${userId}-${Date.now().toString(36)}`;
  const slug = await availableSlug(desiredSlug, userId);

  const name =
    (opts.name || '').trim() ||
    user?.profile?.fullName ||
    (user?.subdomain ? `Boutique ${user.subdomain}` : `Boutique #${userId}`);

  const store = await (prisma as any).store.create({
    data: {
      userId,
      name,
      slug,
      tagline: 'Bienvenue dans notre boutique officielle',
      themeName: 'MODERN_MINIMAL',
      primaryColor: '#f97316',
      announcementText: 'Livraison express 24/48h partout au Maroc — Paiement à la livraison !',
      announcementActive: true,
      navigationMenu: [
        { label: 'Accueil', url: '/' },
        { label: 'Tous les Produits', url: '/products' },
      ],
      footerMenu: [
        { label: 'Politique de Livraison', url: '/pages/livraison' },
        { label: 'Conditions Générales', url: '/pages/terms' },
        { label: 'Contact', url: '/pages/contact' },
      ],
    },
    include: STORE_INCLUDE,
  });

  await (prisma as any).storePage.createMany({
    data: [
      {
        storeId: store.id,
        title: 'Politique de Livraison',
        slug: 'livraison',
        contentHtml: `<h2>Livraison Rapide et Sécurisée</h2><p>Nous livrons vos commandes partout au Maroc sous 24 à 48 heures ouvrées.</p><p>Le paiement s'effectue en espèces à la livraison (Cash on Delivery) après vérification de votre colis.</p>`,
        isPublished: true,
      },
      {
        storeId: store.id,
        title: 'À Propos de Nous',
        slug: 'about',
        contentHtml: `<h2>À Propos de notre Boutique</h2><p>Nous nous engageons à vous fournir des produits authentiques et de haute qualité avec un service client disponible 7j/7.</p>`,
        isPublished: true,
      },
    ],
    skipDuplicates: true,
  });

  return store;
}

/**
 * Keeps the storefront reachable after the seller renames it.
 *
 * `resolveStoreByHost` matches `user.subdomain` first and falls back to
 * `store.slug`, so a rename that moved only the subdomain left the old slug
 * behind as a second live address for the same store. Renaming both in step
 * means one store, one name, one URL — and the store row's `updatedAt` moves,
 * which is part of the compiler's cache key, so the next visitor gets the
 * rebuilt page rather than the one carrying the old canonical URL.
 *
 * Provisions the store when the account has none yet, so an old account that
 * never opened Studio still ends up with a storefront the first time it sets a
 * name.
 */
export async function syncStoreNameWithSubdomain(userId: number, subdomain: string) {
  const desired = subdomain.trim().toLowerCase();
  const store = await provisionStoreForUser(userId, { slug: desired });

  if (store.slug === desired) return store;

  return (prisma as any).store.update({
    where: { id: store.id },
    data: { slug: await availableSlug(desired, userId) },
    include: STORE_INCLUDE,
  });
}

export async function getOrCreateVendorStore(vendorId: number) {
  const store = await (prisma as any).store.findUnique({
    where: { userId: vendorId },
    include: STORE_INCLUDE,
  });

  return store ?? provisionStoreForUser(vendorId);
}

export async function updateVendorStore(vendorId: number, data: any) {
  const store = await getOrCreateVendorStore(vendorId);

  const allowedFields = [
    'name', 'slug', 'tagline', 'description', 'logoUrl', 'bannerUrl', 'faviconUrl',
    'contactEmail', 'contactPhone', 'whatsappNumber', 'instagramUrl', 'facebookUrl', 'tiktokUrl',
    'themeName', 'primaryColor', 'secondaryColor', 'fontFamily', 'headerStyle', 'footerStyle',
    'announcementText', 'announcementActive', 'customCss', 'homeStructure', 'navigationMenu', 'footerMenu',
    'metaTitle', 'metaDescription', 'ogImageUrl', 'enableCod', 'freeShippingThreshold', 'standardShippingFee',
    'status', 'isPublished',
  ];

  const updateData: any = {};
  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      updateData[key] = data[key];
    }
  }

  // The home page is a block structure that reaches the renderer and, later,
  // the compiler. It gets the same guards a landing page gets: known block
  // types, id pattern, size and depth limits.
  if (updateData.homeStructure !== undefined && updateData.homeStructure !== null) {
    const problem = validateLandingPageUpdate({ customStructure: updateData.homeStructure });
    if (problem) throw new AppException(400, `homeStructure: ${problem}`);
  }

  if (updateData.slug) {
    updateData.slug = String(updateData.slug).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');
    const existing = await (prisma as any).store.findFirst({
      where: { slug: updateData.slug, id: { not: store.id } },
    });
    if (existing) {
      throw new AppException(400, 'Cet identifiant de boutique (slug) est déjà utilisé.');
    }
  }

  const updated = await (prisma as any).store.update({
    where: { id: store.id },
    data: updateData,
    include: {
      user: {
        select: { id: true, subdomain: true, customDomain: true, customDomainStatus: true },
      },
      collections: { orderBy: { sortOrder: 'asc' } },
      customPages: true,
    },
  });

  return updated;
}

/**
 * The shop catalogue listing.
 *
 * Everything public reads through here — the storefront pages, the studio
 * preview and the static compiler — so the switch from `Product` to
 * `StoreProduct` happened at this one seam and left their payload untouched.
 */
export async function getStoreProducts(
  storeId: number,
  options: {
    page?: number;
    limit?: number;
    collectionSlug?: string;
    categorySlug?: string;
    search?: string;
    sort?: string;
  }
) {
  const store = await (prisma as any).store.findUnique({
    where: { id: storeId },
    select: { id: true },
  });

  if (!store) {
    throw new AppException(404, 'Store not found');
  }

  return listPublicProducts(storeId, options);
}

export async function getStoreProductBySlug(storeId: number, slugOrId: string) {
  const store = await (prisma as any).store.findUnique({
    where: { id: storeId },
    select: { id: true },
  });

  if (!store) {
    throw new AppException(404, 'Store not found');
  }

  return getPublicProduct(storeId, slugOrId);
}

export async function getStorePageBySlug(storeId: number, slug: string) {
  const page = await (prisma as any).storePage.findFirst({
    where: { storeId, slug: slug.trim().toLowerCase(), isPublished: true },
  });

  if (!page) {
    throw new AppException(404, 'Page introuvable');
  }

  return page;
}

export interface StoreCartItemInput {
  productId: number;
  variantName?: string;
  variantOptionId?: string;
  quantity: number;
}

export interface StoreCheckoutPayload {
  storeId: number;
  fullName: string;
  phone: string;
  city: string;
  address: string;
  notes?: string;
  cartItems: StoreCartItemInput[];
  checkoutSessionId?: string;
  fbp?: string;
  fbc?: string;
  capiEventId?: string;
  eventSourceUrl?: string;
}

export async function executeStoreCheckout(
  payload: StoreCheckoutPayload,
  reqIp: string,
  userAgent: string | null,
  refererHeader?: string
) {
  const { storeId, fullName, phone, city, address, notes, cartItems } = payload;

  if (!fullName || !phone || !city || !address) {
    throw new AppException(400, 'Nom, téléphone, ville et adresse sont requis');
  }

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new AppException(400, 'Le panier est vide');
  }

  const store = await (prisma as any).store.findUnique({
    where: { id: storeId },
    include: {
      user: {
        select: {
          id: true,
          subdomain: true,
          customDomain: true,
          autoSendLeadsToCallCenter: true,
        },
      },
    },
  });

  if (!store || !store.isPublished || store.status !== 'ACTIVE') {
    throw new AppException(404, 'Cette boutique est actuellement indisponible');
  }

  const vendorId = store.userId;

  // The seller's own blocklist (lib/vendorIpBan.ts), the store-checkout twin of
  // the guard on the landing checkout. Same 404-shaped refusal the rest of this
  // function uses for a store that is not taking orders, so a banned visitor
  // learns nothing beyond "not available".
  const vendorBan = await findVendorBan(vendorId, reqIp);
  if (vendorBan) {
    recordVendorBanHit(vendorBan.id);
    throw new AppException(404, 'Cette boutique est actuellement indisponible');
  }

  // As on the landing checkout: no fraud check here. Suspect orders are saved
  // and badged with their reason on the leads screens, never refused at the
  // form — see the note beside the landing checkout in public.routes.ts.

  const productIds = cartItems.map((item) => item.productId);
  // Scoped to what this shop actually sells: its own products, or the starter
  // catalogue while it has none. A basket naming another shop's product, a
  // hidden one, or a starter row in a shop that has since built its own
  // catalogue comes back short and is refused on the next line.
  const products = await resolveCartProducts(storeId, productIds);

  if (products.length !== productIds.length) {
    throw new AppException(400, 'Un ou plusieurs produits du panier sont introuvables ou inactifs');
  }

  const productMap = new Map<number, any>(products.map((p: any) => [p.id, p]));

  let subtotalMad = 0;
  const detailedCartItems: any[] = [];
  const packageContentParts: string[] = [];

  for (const item of cartItems) {
    const qty = Math.max(1, Math.min(99, Number(item.quantity) || 1));
    const p = productMap.get(item.productId)!;
    const unitPrice = Number(p.priceMad) || 0;
    const itemTotal = unitPrice * qty;
    subtotalMad += itemTotal;

    const variantLabel = item.variantName?.trim() || null;
    const variantId = item.variantOptionId?.trim() || null;

    detailedCartItems.push({
      productId: p.id,
      productName: p.nameFr || p.nameAr,
      sku: p.sku,
      imageUrl: p.images[0]?.imageUrl || null,
      variantName: variantLabel,
      variantOptionId: variantId,
      quantity: qty,
      unitPriceMad: unitPrice,
      totalPriceMad: itemTotal,
    });

    const itemDesc = variantLabel ? `${qty}x ${p.nameFr} (${variantLabel})` : `${qty}x ${p.nameFr}`;
    packageContentParts.push(itemDesc);
  }

  let shippingFeeMad = store.standardShippingFee || 0;
  if (store.freeShippingThreshold !== null && subtotalMad >= store.freeShippingThreshold) {
    shippingFeeMad = 0;
  }
  const totalAmountMad = subtotalMad + shippingFeeMad;

  const packageContent = packageContentParts.join(', ').slice(0, 400);

  const ipCountry = getClientCountry({ headers: {} } as any, reqIp);

  /**
   * A store checkout writes a LEAD and nothing else. No order, deliberately.
   *
   * An order is the record of a parcel that is actually going out, and on this
   * platform that only becomes true after a call-centre agent has phoned the
   * customer and confirmed it — every fee, stock movement and courier hand-off
   * hangs off that call. `POST /leads/:id/push-to-delivery` is the one place an
   * order is born, and it opens by checking whether one already exists for the
   * lead: if it finds one it assumes a double click, marks the lead
   * PUSHED_TO_DELIVERY and returns early. Creating the order here would trip
   * that check on every store order, so the parcel would never be created at
   * Coliaty, stock would never move, the packaging desk would never be rung,
   * and the lead would sit in the agent's history looking shipped.
   *
   * `Order.leadId` is unique too, so there is no version of this where both
   * paths write an order and the second one merely loses.
   *
   * What the customer ordered lives in `cartItems`; what is being shipped and
   * collected is decided on the confirmation call. Keeping those apart is what
   * lets an agent change a quantity, agree a different price, or drop an
   * out-of-stock line — the normal case here, not the exception.
   */
  const lead = await (prisma as any).lead.create({
    data: {
      vendorId,
      storeId,
      // Null on purpose. The seller's own referral link for this product is not
      // where this lead came from, and attaching it would inflate that link's
      // lead and conversion counters with traffic it never sent. It would also
      // hand getPackPrice a landing-page price for a multi-item basket.
      referralLinkId: null,
      fullName: fullName.trim().slice(0, 120),
      phone: phone.trim().slice(0, 40),
      city: city.trim().slice(0, 80),
      address: address.trim().slice(0, 400),
      // The human-readable summary, for the 25+ screens and two `contains`
      // filters that read this column. `cartItems` below is the authoritative
      // basket; this is its label.
      productVariant: packageContent.slice(0, 120),
      cartItems: detailedCartItems,
      totalAmountMad,
      shippingFeeMad,
      ipAddress: reqIp,
      ipCountry,
      userAgent: userAgent?.slice(0, 500) || null,
      status: 'NEW',
      source: 'STORE_CHECKOUT',
      sourceMode: 'VENDOR',
      notes: notes ? String(notes).trim().slice(0, 500) : null,
    },
  });

  /**
   * What the customer quotes back on the phone or on WhatsApp. Derived from the
   * lead id rather than minted at random so support can find the row from it,
   * and so it stays stable if the page is reloaded.
   */
  const reference = `CMD-${String(lead.id).padStart(6, '0')}`;

  if (payload.checkoutSessionId) {
    try {
      await prisma.checkoutAttempt.updateMany({
        where: { sessionId: payload.checkoutSessionId },
        data: { completed: true },
      });
    } catch (err) {
      console.error('[StoreCheckout] Failed to close checkout attempt:', err);
    }
  }

  try {
    await maybeAutoBanForOrders(reqIp, lead.id);
  } catch (err) {
    console.error('[StoreCheckout] AutoBan check error:', err);
  }

  try {
    await enqueueSheetPush(lead.id, vendorId, 'STORE_CHECKOUT');
  } catch (err) {
    console.error('[StoreCheckout] Google Sheets enqueue error:', err);
  }

  void reportLeadToMetaCapi({
    vendorId,
    // Not a referral code, and deliberately not one of the seller's own link
    // codes either: `pixelRowsForCode` narrows to the pixels scoped to the code
    // it is given, so borrowing a link's code would fire that link's pixel for
    // traffic it never sent. A store order matches the account-wide pixels only.
    code: STORE_PIXEL_CODE,
    leadId: lead.id,
    fullName,
    phone,
    city,
    ipAddress: reqIp,
    userAgent: userAgent || undefined,
    fbp: payload.fbp,
    fbc: payload.fbc,
    eventId: payload.capiEventId,
    value: totalAmountMad,
    currency: 'MAD',
    productName: packageContent,
    productId: products[0]?.id || 0,
    quantity: detailedCartItems.reduce((acc, it) => acc + it.quantity, 0),
    sourceUrl: payload.eventSourceUrl || refererHeader || `https://${store.slug}.silacod.com/checkout`,
  });

  if (store.user?.autoSendLeadsToCallCenter) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.leadStatusHistory.create({
          data: {
            leadId: lead.id,
            oldStatus: lead.status,
            newStatus: 'AVAILABLE',
            changedBy: vendorId,
          },
        });
        await tx.lead.update({
          where: { id: lead.id },
          data: { status: 'AVAILABLE' },
        });

        let wallet = await tx.wallet.findUnique({ where: { userId: vendorId } });
        if (!wallet) wallet = await tx.wallet.create({ data: { userId: vendorId } });
        const newBalance = wallet.balanceMad - 2;
        await tx.wallet.update({ where: { id: wallet.id }, data: { balanceMad: newBalance } });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'CALL_CENTER_FEE',
            amountMad: -2,
            balanceAfterMad: newBalance,
            description: `Frais d'envoi automatique boutique au Call Center (Lead #${lead.id})`,
          },
        });
      });

      const notifiableAgentIds = await getNotifiableAgentIds(vendorId, products[0]?.id || 0);
      const io = getIO();
      if (io && notifiableAgentIds.length) {
        const payloadLead = {
          id: lead.id,
          fullName,
          phone,
          city,
          address,
          product: { name: packageContent },
          createdAt: lead.createdAt,
        };
        notifiableAgentIds.forEach((id) => io.to(`user:${id}`).emit('new-available-lead', payloadLead));
      }
    } catch (err) {
      console.error('[StoreCheckout] Auto call center failed:', err);
    }
  }

  const io = getIO();
  if (io) {
    io.to(`user:${vendorId}`).emit('new-store-order', {
      leadId: lead.id,
      reference,
      totalAmountMad,
      customerName: fullName,
      packageContent,
      createdAt: lead.createdAt,
    });
  }

  // The same bell + toast a landing-page order raises (public.routes.ts
  // POST /leads). Without it a store order reached the seller's list silently:
  // no "Nouveau lead" toast, no unread badge on Leads, nothing in the
  // notifications page — so it looked as if the order had never arrived.
  try {
    const { createNotification } = await import('../utils/notification.js');
    await createNotification(
      vendorId,
      'NEW_LEAD',
      '🎉 Nouvelle vente (Lead) !',
      `Vous avez reçu un nouveau lead de ${fullName} (${city}) pour le produit "${packageContent}".`
    );
  } catch (err) {
    console.error('[StoreCheckout] new lead notification failed:', err);
  }

  return {
    reference,
    leadId: lead.id,
    totalAmountMad,
    shippingFeeMad,
    subtotalMad,
    customerName: fullName,
    customerPhone: phone,
    customerCity: city,
    customerAddress: address,
    items: detailedCartItems,
  };
}

/**
 * Narrows whatever ids the client sent to the ones this shop may group: its
 * own products, plus the starter catalogue while it is still showing that.
 * Without it a seller could post another shop's product id and pull a rival
 * product onto their own storefront.
 */
async function sellableProductIds(storeId: number, ids: any): Promise<number[]> {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const wanted = ids.map((n: any) => Number(n)).filter((n: number) => !isNaN(n));
  if (!wanted.length) return [];

  const rows = await (prisma as any).storeProduct.findMany({
    where: {
      id: { in: wanted },
      OR: [{ storeId }, { storeId: null, isDefault: true }],
    },
    select: { id: true },
  });
  return rows.map((r: any) => r.id);
}

export async function createStoreCollection(vendorId: number, data: any) {
  const store = await getOrCreateVendorStore(vendorId);
  const slug = String(data.nameFr || 'collection')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '-');

  const collection = await (prisma as any).storeCollection.create({
    data: {
      storeId: store.id,
      nameFr: data.nameFr,
      nameAr: data.nameAr || null,
      slug: data.slug || slug,
      description: data.description || null,
      imageUrl: data.imageUrl || null,
      sortOrder: Number(data.sortOrder) || 0,
      isActive: data.isActive !== false,
      products: data.productIds?.length
        ? {
            connect: (await sellableProductIds(store.id, data.productIds)).map((id) => ({ id })),
          }
        : undefined,
    },
    include: {
      products: { select: { id: true, nameFr: true, nameAr: true, priceMad: true, slug: true } },
    },
  });

  return collection;
}

export async function updateStoreCollection(vendorId: number, collectionId: number, data: any) {
  const store = await getOrCreateVendorStore(vendorId);

  const existing = await (prisma as any).storeCollection.findFirst({
    where: { id: collectionId, storeId: store.id },
  });
  if (!existing) {
    throw new AppException(404, 'Collection introuvable');
  }

  const updateData: any = {};
  if (data.nameFr !== undefined) updateData.nameFr = data.nameFr;
  if (data.nameAr !== undefined) updateData.nameAr = data.nameAr;
  if (data.slug !== undefined) updateData.slug = data.slug;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.sortOrder !== undefined) updateData.sortOrder = Number(data.sortOrder);
  if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

  if (Array.isArray(data.productIds)) {
    updateData.products = {
      set: (await sellableProductIds(store.id, data.productIds)).map((id) => ({ id })),
    };
  }

  const updated = await (prisma as any).storeCollection.update({
    where: { id: collectionId },
    data: updateData,
    include: {
      products: { select: { id: true, nameFr: true, nameAr: true, priceMad: true, slug: true } },
    },
  });

  return updated;
}

export async function deleteStoreCollection(vendorId: number, collectionId: number) {
  const store = await getOrCreateVendorStore(vendorId);

  const existing = await (prisma as any).storeCollection.findFirst({
    where: { id: collectionId, storeId: store.id },
  });
  if (!existing) {
    throw new AppException(404, 'Collection introuvable');
  }

  await (prisma as any).storeCollection.delete({
    where: { id: collectionId },
  });

  return { success: true };
}

export async function createStorePage(vendorId: number, data: any) {
  const store = await getOrCreateVendorStore(vendorId);
  const slug = String(data.slug || data.title || 'page')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '-');
  if (isReservedSlug(slug)) throw new AppException(400, 'Cet identifiant de page est réservé.');

  const page = await (prisma as any).storePage.create({
    data: {
      storeId: store.id,
      title: data.title,
      slug,
      contentHtml: data.contentHtml || null,
      customStructure: data.customStructure || null,
      isPublished: data.isPublished !== false,
    },
  });

  return page;
}

export async function updateStorePage(vendorId: number, pageId: number, data: any) {
  const store = await getOrCreateVendorStore(vendorId);

  const existing = await (prisma as any).storePage.findFirst({
    where: { id: pageId, storeId: store.id },
  });
  if (!existing) {
    throw new AppException(404, 'Page introuvable');
  }

  const updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.slug !== undefined) {
    updateData.slug = String(data.slug).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');
    if (isReservedSlug(updateData.slug) || isReservedSlug(existing.slug)) {
      throw new AppException(400, 'Cet identifiant de page est réservé.');
    }
  }
  if (data.contentHtml !== undefined) updateData.contentHtml = data.contentHtml;
  if (data.customStructure !== undefined) {
    if (data.customStructure !== null) {
      const problem = validateLandingPageUpdate({ customStructure: data.customStructure });
      if (problem) throw new AppException(400, `customStructure: ${problem}`);
    }
    updateData.customStructure = data.customStructure;
  }
  if (data.isPublished !== undefined) updateData.isPublished = Boolean(data.isPublished);

  const updated = await (prisma as any).storePage.update({
    where: { id: pageId },
    data: updateData,
  });

  return updated;
}

export async function deleteStorePage(vendorId: number, pageId: number) {
  const store = await getOrCreateVendorStore(vendorId);

  const existing = await (prisma as any).storePage.findFirst({
    where: { id: pageId, storeId: store.id },
  });
  if (!existing) {
    throw new AppException(404, 'Page introuvable');
  }

  await (prisma as any).storePage.delete({
    where: { id: pageId },
  });

  return { success: true };
}
