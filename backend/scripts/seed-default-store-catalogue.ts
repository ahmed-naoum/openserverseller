/**
 * Moves the demo shop catalogue off `Product` and into the new store tables.
 *
 * Before this script the only products a shop could show were `Product` rows
 * owned by the seller — the same table the marketplace and the referral links
 * at /r/<code> read from. The 16 rows seeded for the "0x0" test shop were the
 * ones actually on screen, so they become the platform starter catalogue:
 * `storeId = null, isDefault = true`, which every shop displays until its owner
 * creates a product of their own.
 *
 * The originals are deleted afterwards. They were demo data with no order line,
 * referral link, claim or inventory row pointing at them (checked before this
 * was written); leaving them behind would put "Sneakers Urban Runner" in the
 * marketplace list every seller picks landing pages from.
 *
 * Idempotent: it does nothing if a default catalogue already exists.
 *
 *   npx tsx scripts/seed-default-store-catalogue.ts
 *   npx tsx scripts/seed-default-store-catalogue.ts --force   (rebuild it)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const db = prisma as any;

/** The demo rows to lift, in the shape the storefront needs them. */
const SOURCE_PRODUCT_IDS = [322, 323, 324, 325, 326, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336, 337];

interface CategorySeed {
  nameFr: string;
  nameAr: string;
  slug: string;
  children: { nameFr: string; nameAr: string; slug: string; productIds: number[] }[];
}

/**
 * The starter tree. Two levels, because a sub-category is the thing a seller
 * copying this catalogue most often wants to see working before building their
 * own. Products hang off the leaves only — browsing a parent picks up its
 * descendants, so listing them twice would just double-count.
 */
const CATEGORY_TREE: CategorySeed[] = [
  {
    nameFr: 'Mode Femme',
    nameAr: 'أزياء نسائية',
    slug: 'mode-femme',
    children: [
      { nameFr: 'Robes & Combinaisons', nameAr: 'فساتين', slug: 'robes-combinaisons', productIds: [329] },
      { nameFr: 'Vestes & Manteaux', nameAr: 'جاكيتات ومعاطف', slug: 'vestes-manteaux', productIds: [330] },
    ],
  },
  {
    nameFr: 'Mode Homme',
    nameAr: 'أزياء رجالية',
    slug: 'mode-homme',
    children: [
      { nameFr: 'T-shirts', nameAr: 'تيشرتات', slug: 't-shirts', productIds: [331] },
      { nameFr: 'Vestes & Blazers', nameAr: 'جاكيتات', slug: 'vestes-blazers', productIds: [332] },
    ],
  },
  {
    nameFr: 'Chaussures',
    nameAr: 'أحذية',
    slug: 'chaussures',
    children: [{ nameFr: 'Sneakers', nameAr: 'سنيكرز', slug: 'sneakers', productIds: [322, 323] }],
  },
  {
    nameFr: 'Électronique',
    nameAr: 'إلكترونيات',
    slug: 'electronique',
    children: [{ nameFr: 'Audio', nameAr: 'صوتيات', slug: 'audio', productIds: [324, 325] }],
  },
  {
    nameFr: 'Beauté & Parfums',
    nameAr: 'الجمال والعطور',
    slug: 'beaute',
    children: [
      { nameFr: 'Parfums', nameAr: 'عطور', slug: 'parfums', productIds: [333] },
      { nameFr: 'Soins Visage', nameAr: 'العناية بالوجه', slug: 'soins-visage', productIds: [334] },
      { nameFr: 'Maquillage', nameAr: 'مكياج', slug: 'maquillage', productIds: [335] },
    ],
  },
  {
    nameFr: 'Sacs & Accessoires',
    nameAr: 'حقائب وإكسسوارات',
    slug: 'accessoires',
    children: [
      { nameFr: 'Sacs', nameAr: 'حقائب', slug: 'sacs', productIds: [327, 328] },
      { nameFr: 'Montres & Bijoux', nameAr: 'ساعات ومجوهرات', slug: 'montres-bijoux', productIds: [326, 337] },
      { nameFr: 'Lunettes', nameAr: 'نظارات', slug: 'lunettes', productIds: [336] },
    ],
  },
];

function slugify(input: string): string {
  return (
    input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'produit'
  );
}

async function main() {
  const force = process.argv.includes('--force');

  const existing = await db.storeProduct.count({ where: { isDefault: true } });
  if (existing > 0 && !force) {
    console.log(`[skip] ${existing} default products already exist. Pass --force to rebuild.`);
    return;
  }

  if (force && existing > 0) {
    console.log(`[force] removing ${existing} existing default products and their categories`);
    await db.storeProduct.deleteMany({ where: { isDefault: true } });
    await db.storeCategory.deleteMany({ where: { isDefault: true } });
  }

  const sourceProducts = await prisma.product.findMany({
    where: { id: { in: SOURCE_PRODUCT_IDS } },
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      wholesalePrices: { orderBy: { minQuantity: 'asc' } },
    },
  });

  if (sourceProducts.length === 0) {
    console.log('[warn] none of the source demo products remain — nothing to migrate.');
    return;
  }
  console.log(`[read] ${sourceProducts.length} demo products found`);

  // --- categories -----------------------------------------------------------
  const bySlug = new Map<string, number>();
  let parentOrder = 0;

  for (const parent of CATEGORY_TREE) {
    const created = await db.storeCategory.create({
      data: {
        storeId: null,
        isDefault: true,
        parentId: null,
        nameFr: parent.nameFr,
        nameAr: parent.nameAr,
        slug: parent.slug,
        sortOrder: parentOrder++,
        isActive: true,
      },
    });
    bySlug.set(parent.slug, created.id);

    let childOrder = 0;
    for (const child of parent.children) {
      const sub = await db.storeCategory.create({
        data: {
          storeId: null,
          isDefault: true,
          parentId: created.id,
          nameFr: child.nameFr,
          nameAr: child.nameAr,
          slug: child.slug,
          sortOrder: childOrder++,
          isActive: true,
        },
      });
      bySlug.set(child.slug, sub.id);
    }
  }
  console.log(`[write] ${bySlug.size} default categories (${CATEGORY_TREE.length} top level)`);

  /** productId -> the leaf category it belongs to. */
  const categoryOfProduct = new Map<number, number>();
  for (const parent of CATEGORY_TREE) {
    for (const child of parent.children) {
      for (const pid of child.productIds) {
        categoryOfProduct.set(pid, bySlug.get(child.slug)!);
      }
    }
  }

  // --- products -------------------------------------------------------------
  const usedSlugs = new Set<string>();
  let sortOrder = 0;

  for (const p of sourceProducts) {
    let slug = slugify(p.nameFr || p.nameAr || `produit-${p.id}`);
    let n = 2;
    while (usedSlugs.has(slug)) slug = `${slugify(p.nameFr)}-${n++}`;
    usedSlugs.add(slug);

    const categoryId = categoryOfProduct.get(p.id);

    await db.storeProduct.create({
      data: {
        storeId: null,
        isDefault: true,
        slug,
        sku: p.sku || null,
        nameFr: p.nameFr,
        nameAr: p.nameAr || null,
        nameEn: p.nameEn || null,
        description: p.description || null,
        longDescription: p.longDescription || null,
        priceMad: p.retailPriceMad,
        compareAtPriceMad: null,
        costMad: p.baseCostMad || null,
        stockQuantity: p.stockQuantity,
        stockStatus: p.stockStatus,
        trackStock: true,
        isActive: true,
        showInStore: true,
        sortOrder: sortOrder++,
        wholesalePacks: p.wholesalePrices.length
          ? p.wholesalePrices.map((wp) => ({ minQuantity: wp.minQuantity, pricePerUnitMad: wp.pricePerUnit }))
          : undefined,
        ...(categoryId ? { categories: { connect: [{ id: categoryId }] } } : {}),
        ...(p.images.length
          ? {
              images: {
                create: p.images.map((img, i) => ({
                  imageUrl: img.imageUrl,
                  isPrimary: i === 0,
                  sortOrder: i,
                })),
              },
            }
          : {}),
      },
    });
  }
  console.log(`[write] ${sourceProducts.length} default products`);

  // --- retire the originals -------------------------------------------------
  const movedIds = sourceProducts.map((p) => p.id);
  await prisma.wholesalePriceTier.deleteMany({ where: { productId: { in: movedIds } } });
  await prisma.productImage.deleteMany({ where: { productId: { in: movedIds } } });
  const removed = await prisma.product.deleteMany({ where: { id: { in: movedIds } } });
  console.log(`[clean] ${removed.count} demo rows removed from the marketplace catalogue`);

  console.log('\nDone. Every shop with no product of its own now shows this catalogue.');
}

main()
  .catch((err) => {
    console.error('[fail]', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
