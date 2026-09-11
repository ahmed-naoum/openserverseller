/**
 * The seller shop catalogue: `StoreProduct` and `StoreCategory`.
 *
 * This is deliberately a second catalogue. `Product` is the marketplace — the
 * table behind /dashboard/products, the referral links at /r/<code> and every
 * landing page — and nothing here touches it. A product a seller creates for
 * their shop cannot become a landing page, and a marketplace product never
 * shows up in a shop. That separation is the whole point of the split.
 *
 * ## The starter catalogue
 *
 * A shop with no product of its own shows the platform starter catalogue: the
 * rows with `storeId = null, isDefault = true`. The moment its owner creates
 * their first product the starter rows disappear from that shop and only their
 * own are listed — see `storeOwnsCatalogue`. Nothing is copied and nothing is
 * deleted by that switch; it is purely which `where` the reads use, so a seller
 * who deletes their last product falls back to the starter set again.
 *
 * `copyDefaultsIntoStore` is the other door: it duplicates the starter rows
 * into a shop as editable products, which also makes that shop own its
 * catalogue from then on.
 */
import { prisma } from '../lib/prisma.js';
import { AppException } from '../middleware/errorHandler.js';

const db = prisma as any;

/** The public product payload. Named for what the storefront already reads. */
export interface PublicStoreProduct {
  id: number;
  sku: string | null;
  ref: string;
  nameFr: string;
  nameAr: string | null;
  nameEn: string | null;
  description: string | null;
  longDescription?: string | null;
  retailPriceMad: number;
  compareAtPriceMad: number | null;
  stockQuantity: number;
  stockStatus: string;
  images: { id: number; url: string; sortOrder: number }[];
  categories: { id: number; nameFr: string; nameAr: string | null; slug: string }[];
  wholesalePacks: { minQuantity: number; pricePerUnitMad: number }[];
  variants?: any;
}

const PRODUCT_INCLUDE = {
  images: { orderBy: { sortOrder: 'asc' as const } },
  categories: { select: { id: true, nameFr: true, nameAr: true, slug: true } },
};

// ---------------------------------------------------------------------------
// scope
// ---------------------------------------------------------------------------

/**
 * Whether this shop has a catalogue of its own.
 *
 * Counts every row the shop owns, including hidden and out-of-stock ones: a
 * seller who creates a product and then unpublishes it has still started their
 * catalogue, and flipping back to the starter products underneath them would
 * put goods they never chose on their live storefront.
 */
export async function storeOwnsCatalogue(storeId: number): Promise<boolean> {
  const own = await db.storeProduct.count({ where: { storeId } });
  return own > 0;
}

/** The `where` fragment selecting the rows a shop sells from. */
function scopeWhere(storeId: number, owns: boolean) {
  return owns ? { storeId } : { storeId: null, isDefault: true };
}

function slugify(input: string): string {
  return (
    String(input || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'produit'
  );
}

/**
 * A slug no other product in this shop is using. `@@unique([storeId, slug])`
 * would not hold for the starter rows, whose `storeId` is null and which
 * Postgres therefore treats as all-distinct, so the check lives here.
 */
async function uniqueProductSlug(storeId: number | null, wanted: string, ignoreId?: number): Promise<string> {
  const base = slugify(wanted);
  let candidate = base;
  for (let n = 2; n < 500; n++) {
    const clash = await db.storeProduct.findFirst({
      where: { storeId, slug: candidate, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

async function uniqueCategorySlug(storeId: number | null, wanted: string, ignoreId?: number): Promise<string> {
  const base = slugify(wanted);
  let candidate = base;
  for (let n = 2; n < 500; n++) {
    const clash = await db.storeCategory.findFirst({
      where: { storeId, slug: candidate, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// shaping
// ---------------------------------------------------------------------------

function packsOf(row: any): { minQuantity: number; pricePerUnitMad: number }[] {
  if (!Array.isArray(row.wholesalePacks)) return [];
  return row.wholesalePacks
    .filter((p: any) => p && Number(p.minQuantity) > 0 && Number(p.pricePerUnitMad) >= 0)
    .map((p: any) => ({ minQuantity: Number(p.minQuantity), pricePerUnitMad: Number(p.pricePerUnitMad) }))
    .sort((a: any, b: any) => a.minQuantity - b.minQuantity);
}

/**
 * The shape the storefront, the studio and the static compiler already read.
 * `retailPriceMad` rather than the column name `priceMad` on purpose: keeping
 * the outward contract identical is what let the catalogue move tables without
 * touching a single page component.
 */
export function toPublicProduct(row: any, opts: { long?: boolean } = {}): PublicStoreProduct {
  return {
    id: row.id,
    sku: row.sku ?? null,
    ref: row.slug,
    nameFr: row.nameFr,
    nameAr: row.nameAr ?? null,
    nameEn: row.nameEn ?? null,
    description: row.description ?? null,
    ...(opts.long ? { longDescription: row.longDescription ?? null } : {}),
    retailPriceMad: Number(row.priceMad) || 0,
    compareAtPriceMad: row.compareAtPriceMad != null ? Number(row.compareAtPriceMad) : null,
    stockQuantity: row.stockQuantity ?? 0,
    stockStatus: row.stockStatus || 'available',
    images: (row.images || []).map((img: any) => ({ id: img.id, url: img.imageUrl, sortOrder: img.sortOrder })),
    categories: row.categories || [],
    wholesalePacks: packsOf(row),
    ...(row.variants ? { variants: row.variants } : {}),
  };
}

// ---------------------------------------------------------------------------
// categories
// ---------------------------------------------------------------------------

/** A category and every category beneath it, so browsing a parent is complete. */
async function categoryWithDescendants(storeId: number, owns: boolean, slug: string): Promise<number[]> {
  const all = await db.storeCategory.findMany({
    where: scopeWhere(storeId, owns),
    select: { id: true, parentId: true, slug: true },
  });

  const root = all.find((c: any) => c.slug === slug);
  if (!root) return [];

  const ids = [root.id];
  for (let i = 0; i < ids.length; i++) {
    for (const c of all) {
      if (c.parentId === ids[i] && !ids.includes(c.id)) ids.push(c.id);
    }
  }
  return ids;
}

export interface CategoryNode {
  id: number;
  nameFr: string;
  nameAr: string | null;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
  parentId: number | null;
  productsCount: number;
  children: CategoryNode[];
}

/**
 * The shop category tree, nested. Returns the starter tree for a shop that has
 * not started its own catalogue, exactly as the product list does.
 */
export async function getStoreCategories(
  storeId: number,
  options: { activeOnly?: boolean } = {}
): Promise<{ tree: CategoryNode[]; flat: CategoryNode[]; isDefault: boolean }> {
  const owns = await storeOwnsCatalogue(storeId);

  const rows = await db.storeCategory.findMany({
    where: {
      ...scopeWhere(storeId, owns),
      ...(options.activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { nameFr: 'asc' }],
    include: { _count: { select: { products: true } } },
  });

  const flat: CategoryNode[] = rows.map((c: any) => ({
    id: c.id,
    nameFr: c.nameFr,
    nameAr: c.nameAr,
    slug: c.slug,
    description: c.description,
    imageUrl: c.imageUrl,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    isDefault: c.isDefault,
    parentId: c.parentId,
    productsCount: c._count.products,
    children: [],
  }));

  const byId = new Map(flat.map((c) => [c.id, { ...c, children: [] as CategoryNode[] }]));
  const tree: CategoryNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId != null ? byId.get(node.parentId) : null;
    if (parent) parent.children.push(node);
    else tree.push(node);
  }

  return { tree, flat, isDefault: !owns };
}

export async function createStoreCategory(storeId: number, data: any) {
  const nameFr = String(data.nameFr || '').trim();
  if (!nameFr) throw new AppException(400, 'Le nom de la categorie est requis');

  // A sub-category may only sit under one of this shop's own categories. The
  // starter tree is shared by every shop, so hanging a private category off it
  // would show one seller a branch of another seller catalogue.
  let parentId: number | null = null;
  if (data.parentId) {
    const parent = await db.storeCategory.findFirst({
      where: { id: Number(data.parentId), storeId },
      select: { id: true },
    });
    if (!parent) throw new AppException(400, 'Categorie parente introuvable dans cette boutique');
    parentId = parent.id;
  }

  return db.storeCategory.create({
    data: {
      storeId,
      isDefault: false,
      parentId,
      nameFr,
      nameAr: data.nameAr?.trim() || null,
      slug: await uniqueCategorySlug(storeId, data.slug || nameFr),
      description: data.description?.trim() || null,
      imageUrl: data.imageUrl || null,
      sortOrder: Number(data.sortOrder) || 0,
      isActive: data.isActive !== false,
    },
  });
}

export async function updateStoreCategory(storeId: number, categoryId: number, data: any) {
  const existing = await db.storeCategory.findFirst({ where: { id: categoryId, storeId } });
  if (!existing) throw new AppException(404, 'Categorie introuvable');

  const patch: any = {};
  if (data.nameFr !== undefined) patch.nameFr = String(data.nameFr).trim();
  if (data.nameAr !== undefined) patch.nameAr = data.nameAr?.trim() || null;
  if (data.description !== undefined) patch.description = data.description?.trim() || null;
  if (data.imageUrl !== undefined) patch.imageUrl = data.imageUrl || null;
  if (data.sortOrder !== undefined) patch.sortOrder = Number(data.sortOrder) || 0;
  if (data.isActive !== undefined) patch.isActive = Boolean(data.isActive);
  if (data.slug !== undefined) patch.slug = await uniqueCategorySlug(storeId, data.slug, categoryId);

  if (data.parentId !== undefined) {
    if (!data.parentId) {
      patch.parentId = null;
    } else {
      const wanted = Number(data.parentId);
      if (wanted === categoryId) throw new AppException(400, 'Une categorie ne peut pas etre sa propre parente');

      const parent = await db.storeCategory.findFirst({ where: { id: wanted, storeId }, select: { id: true } });
      if (!parent) throw new AppException(400, 'Categorie parente introuvable dans cette boutique');

      // Walking up from the wanted parent must never arrive back here, or the
      // tree becomes a ring and every recursive read spins forever.
      let cursor: number | null = wanted;
      const seen = new Set<number>();
      while (cursor != null) {
        if (cursor === categoryId) throw new AppException(400, 'Deplacement impossible: cela creerait une boucle');
        if (seen.has(cursor)) break;
        seen.add(cursor);
        const row: any = await db.storeCategory.findUnique({ where: { id: cursor }, select: { parentId: true } });
        cursor = row?.parentId ?? null;
      }
      patch.parentId = wanted;
    }
  }

  return db.storeCategory.update({ where: { id: categoryId }, data: patch });
}

export async function deleteStoreCategory(storeId: number, categoryId: number) {
  const existing = await db.storeCategory.findFirst({
    where: { id: categoryId, storeId },
    include: { _count: { select: { children: true, products: true } } },
  });
  if (!existing) throw new AppException(404, 'Categorie introuvable');

  if (existing._count.children > 0) {
    throw new AppException(400, 'Supprimez ou deplacez les sous-categories avant de supprimer celle-ci');
  }

  // The products survive; only the grouping goes. Prisma clears the join rows.
  await db.storeCategory.delete({ where: { id: categoryId } });
  return { success: true, productsDetached: existing._count.products };
}

// ---------------------------------------------------------------------------
// public reads
// ---------------------------------------------------------------------------

export async function listPublicProducts(
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
  const owns = await storeOwnsCatalogue(storeId);

  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(options.limit) || 12));
  const skip = (page - 1) * limit;

  const where: any = { ...scopeWhere(storeId, owns), isActive: true, showInStore: true };

  if (options.collectionSlug) {
    where.collections = { some: { slug: options.collectionSlug, storeId } };
  }

  if (options.categorySlug) {
    const ids = await categoryWithDescendants(storeId, owns, options.categorySlug);
    // An unknown slug must return nothing, not everything.
    where.categories = { some: { id: { in: ids.length ? ids : [-1] } } };
  }

  if (options.search && options.search.trim()) {
    const q = options.search.trim();
    where.OR = [
      { nameFr: { contains: q, mode: 'insensitive' } },
      { nameAr: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { sku: { contains: q, mode: 'insensitive' } },
    ];
  }

  let orderBy: any = [{ sortOrder: 'asc' }, { createdAt: 'desc' }];
  if (options.sort === 'price_asc') orderBy = [{ priceMad: 'asc' }];
  else if (options.sort === 'price_desc') orderBy = [{ priceMad: 'desc' }];
  else if (options.sort === 'oldest') orderBy = [{ createdAt: 'asc' }];
  else if (options.sort === 'name') orderBy = [{ nameFr: 'asc' }];

  const [rows, total] = await Promise.all([
    db.storeProduct.findMany({ where, skip, take: limit, orderBy, include: PRODUCT_INCLUDE }),
    db.storeProduct.count({ where }),
  ]);

  return {
    products: rows.map((r: any) => toPublicProduct(r)),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    isDefaultCatalogue: !owns,
  };
}

export async function getPublicProduct(storeId: number, slugOrId: string) {
  const owns = await storeOwnsCatalogue(storeId);

  const trimmed = String(slugOrId || '').trim();
  const numericId = parseInt(trimmed, 10);
  const isNumeric = !isNaN(numericId) && String(numericId) === trimmed;
  const synthetic = /^p-(\d+)$/.exec(trimmed);

  const where: any = { ...scopeWhere(storeId, owns), isActive: true };
  if (synthetic) where.id = parseInt(synthetic[1], 10);
  else if (isNumeric) where.OR = [{ id: numericId }, { slug: trimmed }, { sku: trimmed }];
  else where.OR = [{ slug: trimmed }, { sku: trimmed }];

  const row = await db.storeProduct.findFirst({ where, include: PRODUCT_INCLUDE });
  if (!row) throw new AppException(404, 'Produit introuvable dans cette boutique');

  const related = await db.storeProduct.findMany({
    where: {
      ...scopeWhere(storeId, owns),
      isActive: true,
      showInStore: true,
      id: { not: row.id },
    },
    take: 4,
    orderBy: { createdAt: 'desc' },
    include: { images: { orderBy: { sortOrder: 'asc' } } },
  });

  return {
    product: {
      ...toPublicProduct(row, { long: true }),
      // A shop product has no referral link by construction: links belong to
      // the marketplace catalogue. Kept so the storefront contract is unchanged.
      referralCode: null,
      updatedAt: row.updatedAt,
    },
    related: related.map((p: any) => ({
      id: p.id,
      sku: p.sku,
      ref: p.slug,
      nameFr: p.nameFr,
      nameAr: p.nameAr,
      retailPriceMad: Number(p.priceMad) || 0,
      images: (p.images || []).map((img: any) => ({ id: img.id, url: img.imageUrl })),
    })),
  };
}

/**
 * The cart lines a checkout may actually buy. Returns only rows this shop
 * sells right now, so a basket naming another shop products, a hidden product
 * or a starter product in a shop that has since built its own catalogue is
 * rejected by the caller when the counts do not match.
 */
export async function resolveCartProducts(storeId: number, productIds: number[]) {
  const owns = await storeOwnsCatalogue(storeId);
  return db.storeProduct.findMany({
    where: { ...scopeWhere(storeId, owns), id: { in: productIds }, isActive: true },
    include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
  });
}

// ---------------------------------------------------------------------------
// vendor CRUD
// ---------------------------------------------------------------------------

export async function listVendorProducts(
  storeId: number,
  options: { page?: number; limit?: number; search?: string; categoryId?: number } = {}
) {
  const owns = await storeOwnsCatalogue(storeId);

  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 24));

  const where: any = scopeWhere(storeId, owns);
  if (options.search?.trim()) {
    const q = options.search.trim();
    where.OR = [
      { nameFr: { contains: q, mode: 'insensitive' } },
      { nameAr: { contains: q, mode: 'insensitive' } },
      { sku: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (options.categoryId) where.categories = { some: { id: Number(options.categoryId) } };

  const [rows, total] = await Promise.all([
    db.storeProduct.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: PRODUCT_INCLUDE,
    }),
    db.storeProduct.count({ where }),
  ]);

  return {
    products: rows.map((r: any) => ({
      ...toPublicProduct(r, { long: true }),
      costMad: r.costMad,
      isActive: r.isActive,
      showInStore: r.showInStore,
      sortOrder: r.sortOrder,
      trackStock: r.trackStock,
      isDefault: r.isDefault,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    /**
     * True while the shop is still showing the starter catalogue. The dashboard
     * uses it to mark those rows read-only and explain that creating a product
     * replaces them.
     */
    isDefaultCatalogue: !owns,
  };
}

/** Category ids that belong to this shop, filtered from whatever was sent. */
async function ownCategoryIds(storeId: number, ids: any): Promise<number[]> {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const rows = await db.storeCategory.findMany({
    where: { storeId, id: { in: ids.map((i: any) => Number(i)).filter((n: number) => !isNaN(n)) } },
    select: { id: true },
  });
  return rows.map((r: any) => r.id);
}

function normalisePacks(input: any): any {
  if (!Array.isArray(input)) return undefined;
  const packs = input
    .map((p: any) => ({ minQuantity: Number(p?.minQuantity), pricePerUnitMad: Number(p?.pricePerUnitMad) }))
    .filter((p) => p.minQuantity > 0 && !isNaN(p.pricePerUnitMad) && p.pricePerUnitMad >= 0)
    .sort((a, b) => a.minQuantity - b.minQuantity);
  return packs.length ? packs : null;
}

export async function createVendorProduct(storeId: number, data: any) {
  const nameFr = String(data.nameFr || '').trim();
  if (!nameFr) throw new AppException(400, 'Le nom du produit est requis');

  const priceMad = Number(data.priceMad ?? data.retailPriceMad);
  if (isNaN(priceMad) || priceMad < 0) throw new AppException(400, 'Le prix de vente est invalide');

  const categoryIds = await ownCategoryIds(storeId, data.categoryIds);
  const images: string[] = Array.isArray(data.imageUrls)
    ? data.imageUrls.filter((u: any) => typeof u === 'string' && u.trim())
    : [];

  return db.storeProduct.create({
    data: {
      storeId,
      isDefault: false,
      slug: await uniqueProductSlug(storeId, data.slug || nameFr),
      sku: data.sku?.trim() || null,
      nameFr,
      nameAr: data.nameAr?.trim() || null,
      nameEn: data.nameEn?.trim() || null,
      description: data.description?.trim() || null,
      longDescription: data.longDescription || null,
      priceMad,
      compareAtPriceMad:
        data.compareAtPriceMad !== undefined && data.compareAtPriceMad !== null && data.compareAtPriceMad !== ''
          ? Number(data.compareAtPriceMad)
          : null,
      costMad: data.costMad !== undefined && data.costMad !== null && data.costMad !== '' ? Number(data.costMad) : null,
      stockQuantity: Number(data.stockQuantity) || 0,
      stockStatus: data.stockStatus || 'available',
      trackStock: data.trackStock !== false,
      isActive: data.isActive !== false,
      showInStore: data.showInStore !== false,
      sortOrder: Number(data.sortOrder) || 0,
      metaTitle: data.metaTitle?.trim() || null,
      metaDescription: data.metaDescription?.trim() || null,
      wholesalePacks: normalisePacks(data.wholesalePacks) ?? undefined,
      variants: Array.isArray(data.variants) && data.variants.length ? data.variants : undefined,
      ...(categoryIds.length ? { categories: { connect: categoryIds.map((id) => ({ id })) } } : {}),
      ...(images.length
        ? {
            images: {
              create: images.map((url: string, i: number) => ({
                imageUrl: url.trim(),
                isPrimary: i === 0,
                sortOrder: i,
              })),
            },
          }
        : {}),
    },
    include: PRODUCT_INCLUDE,
  });
}

export async function updateVendorProduct(storeId: number, productId: number, data: any) {
  const existing = await db.storeProduct.findFirst({ where: { id: productId, storeId }, select: { id: true } });
  if (!existing) {
    // Covers both a product of another shop and a starter row, which nobody
    // edits in place — a seller who wants to change one copies it in first.
    throw new AppException(404, 'Produit introuvable dans cette boutique');
  }

  const patch: any = {};
  if (data.nameFr !== undefined) patch.nameFr = String(data.nameFr).trim();
  if (data.nameAr !== undefined) patch.nameAr = data.nameAr?.trim() || null;
  if (data.nameEn !== undefined) patch.nameEn = data.nameEn?.trim() || null;
  if (data.description !== undefined) patch.description = data.description?.trim() || null;
  if (data.longDescription !== undefined) patch.longDescription = data.longDescription || null;
  if (data.sku !== undefined) patch.sku = data.sku?.trim() || null;
  if (data.slug !== undefined) patch.slug = await uniqueProductSlug(storeId, data.slug, productId);

  if (data.priceMad !== undefined || data.retailPriceMad !== undefined) {
    const price = Number(data.priceMad ?? data.retailPriceMad);
    if (isNaN(price) || price < 0) throw new AppException(400, 'Le prix de vente est invalide');
    patch.priceMad = price;
  }
  if (data.compareAtPriceMad !== undefined) {
    patch.compareAtPriceMad =
      data.compareAtPriceMad === null || data.compareAtPriceMad === '' ? null : Number(data.compareAtPriceMad);
  }
  if (data.costMad !== undefined) {
    patch.costMad = data.costMad === null || data.costMad === '' ? null : Number(data.costMad);
  }
  if (data.stockQuantity !== undefined) patch.stockQuantity = Number(data.stockQuantity) || 0;
  if (data.stockStatus !== undefined) patch.stockStatus = data.stockStatus || 'available';
  if (data.trackStock !== undefined) patch.trackStock = Boolean(data.trackStock);
  if (data.isActive !== undefined) patch.isActive = Boolean(data.isActive);
  if (data.showInStore !== undefined) patch.showInStore = Boolean(data.showInStore);
  if (data.sortOrder !== undefined) patch.sortOrder = Number(data.sortOrder) || 0;
  if (data.metaTitle !== undefined) patch.metaTitle = data.metaTitle?.trim() || null;
  if (data.metaDescription !== undefined) patch.metaDescription = data.metaDescription?.trim() || null;
  if (data.wholesalePacks !== undefined) patch.wholesalePacks = normalisePacks(data.wholesalePacks);
  if (data.variants !== undefined) patch.variants = Array.isArray(data.variants) && data.variants.length ? data.variants : null;

  if (Array.isArray(data.categoryIds)) {
    patch.categories = { set: (await ownCategoryIds(storeId, data.categoryIds)).map((id) => ({ id })) };
  }

  if (Array.isArray(data.imageUrls)) {
    const urls = data.imageUrls.filter((u: any) => typeof u === 'string' && u.trim());
    patch.images = {
      deleteMany: {},
      create: urls.map((url: string, i: number) => ({ imageUrl: url.trim(), isPrimary: i === 0, sortOrder: i })),
    };
  }

  return db.storeProduct.update({ where: { id: productId }, data: patch, include: PRODUCT_INCLUDE });
}

export async function deleteVendorProduct(storeId: number, productId: number) {
  const existing = await db.storeProduct.findFirst({
    where: { id: productId, storeId },
    include: { _count: { select: { orderItems: true } } },
  });
  if (!existing) throw new AppException(404, 'Produit introuvable dans cette boutique');

  // A product already on a parcel stays, or the order line loses what it sold.
  // Hiding it takes it off the storefront and leaves the history intact.
  if (existing._count.orderItems > 0) {
    await db.storeProduct.update({
      where: { id: productId },
      data: { isActive: false, showInStore: false },
    });
    return { success: true, archived: true };
  }

  await db.storeProduct.delete({ where: { id: productId } });
  return { success: true, archived: false };
}

/**
 * Duplicates the starter catalogue into a shop as its own editable products.
 *
 * The seller ends up owning every row, which is also what stops the starter
 * set from being shown alongside them.
 */
export async function copyDefaultsIntoStore(storeId: number, productIds?: number[]) {
  const where: any = { storeId: null, isDefault: true };
  if (Array.isArray(productIds) && productIds.length) {
    where.id = { in: productIds.map((n) => Number(n)).filter((n) => !isNaN(n)) };
  }

  const sources = await db.storeProduct.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
    include: { images: { orderBy: { sortOrder: 'asc' } }, categories: { select: { slug: true, parentId: true, id: true } } },
  });

  if (!sources.length) throw new AppException(404, 'Aucun produit du catalogue de demarrage a copier');

  // Rebuild the branches those products sit on, parents first, so the copied
  // shop keeps the same two-level shape rather than a flat list.
  const defaultCats = await db.storeCategory.findMany({
    where: { storeId: null, isDefault: true },
    orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }],
  });
  const wantedIds = new Set<number>();
  for (const p of sources) {
    for (const c of p.categories) {
      wantedIds.add(c.id);
      let cursor = defaultCats.find((d: any) => d.id === c.id)?.parentId ?? null;
      while (cursor != null) {
        wantedIds.add(cursor);
        cursor = defaultCats.find((d: any) => d.id === cursor)?.parentId ?? null;
      }
    }
  }

  const idMap = new Map<number, number>();
  for (const cat of defaultCats.filter((c: any) => c.parentId === null && wantedIds.has(c.id))) {
    const made = await db.storeCategory.create({
      data: {
        storeId,
        isDefault: false,
        parentId: null,
        nameFr: cat.nameFr,
        nameAr: cat.nameAr,
        slug: await uniqueCategorySlug(storeId, cat.slug),
        description: cat.description,
        imageUrl: cat.imageUrl,
        sortOrder: cat.sortOrder,
        isActive: true,
      },
    });
    idMap.set(cat.id, made.id);
  }
  for (const cat of defaultCats.filter((c: any) => c.parentId !== null && wantedIds.has(c.id))) {
    const parentId = idMap.get(cat.parentId);
    if (!parentId) continue;
    const made = await db.storeCategory.create({
      data: {
        storeId,
        isDefault: false,
        parentId,
        nameFr: cat.nameFr,
        nameAr: cat.nameAr,
        slug: await uniqueCategorySlug(storeId, cat.slug),
        description: cat.description,
        imageUrl: cat.imageUrl,
        sortOrder: cat.sortOrder,
        isActive: true,
      },
    });
    idMap.set(cat.id, made.id);
  }

  let copied = 0;
  for (const p of sources) {
    const cats = p.categories.map((c: any) => idMap.get(c.id)).filter(Boolean);
    await db.storeProduct.create({
      data: {
        storeId,
        isDefault: false,
        slug: await uniqueProductSlug(storeId, p.slug),
        sku: p.sku,
        nameFr: p.nameFr,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        description: p.description,
        longDescription: p.longDescription,
        priceMad: p.priceMad,
        compareAtPriceMad: p.compareAtPriceMad,
        costMad: p.costMad,
        stockQuantity: p.stockQuantity,
        stockStatus: p.stockStatus,
        trackStock: p.trackStock,
        isActive: true,
        showInStore: true,
        sortOrder: p.sortOrder,
        wholesalePacks: p.wholesalePacks ?? undefined,
        variants: p.variants ?? undefined,
        ...(cats.length ? { categories: { connect: cats.map((id: number) => ({ id })) } } : {}),
        ...(p.images.length
          ? {
              images: {
                create: p.images.map((img: any, i: number) => ({
                  imageUrl: img.imageUrl,
                  isPrimary: i === 0,
                  sortOrder: i,
                })),
              },
            }
          : {}),
      },
    });
    copied++;
  }

  return { copied, categoriesCreated: idMap.size };
}
