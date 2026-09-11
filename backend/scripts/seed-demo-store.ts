/**
 * Fills a store with a believable catalogue so the storefront can be reviewed
 * with real rows behind every card — collections, products, multiple photos
 * per product and a couple of quantity tiers.
 *
 * Development only. It writes real Product rows owned by the store's user, so
 * point it at a scratch account, never a live seller.
 *
 *   npx tsx scripts/seed-demo-store.ts <storeId>
 *   npx tsx scripts/seed-demo-store.ts <storeId> --clean   # remove them again
 *
 * Every row it creates carries the DEMO_SKU_PREFIX, which is what `--clean`
 * matches on — so a re-run replaces its own products and leaves anything the
 * seller added untouched.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_SKU_PREFIX = 'DEMO-';

const img = (id: string, w = 900) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${w}&q=80`;

interface DemoProduct {
  sku: string;
  nameFr: string;
  nameAr: string;
  description: string;
  price: number;
  cost: number;
  stock: number;
  stockStatus?: string;
  collection: string;
  images: string[];
  packs?: Array<{ min: number; max: number; unit: number }>;
}

const COLLECTIONS = [
  { slug: 'mode-femme', nameFr: 'Mode Femme', nameAr: 'أزياء نسائية', image: '1515886657613-9f3515b0c78f' },
  { slug: 'mode-homme', nameFr: 'Mode Homme', nameAr: 'أزياء رجالية', image: '1487222477894-8943e31ef7b2' },
  { slug: 'chaussures', nameFr: 'Chaussures', nameAr: 'أحذية', image: '1549298916-b41d501d3772' },
  { slug: 'electronique', nameFr: 'Électronique', nameAr: 'إلكترونيات', image: '1546435770-a3e426bf472b' },
  { slug: 'beaute', nameFr: 'Beauté & Parfums', nameAr: 'الجمال والعطور', image: '1596462502278-27bfdc403348' },
  { slug: 'accessoires', nameFr: 'Sacs & Accessoires', nameAr: 'حقائب وإكسسوارات', image: '1590874103328-eac38a683ce7' },
];

const PRODUCTS: DemoProduct[] = [
  {
    sku: 'DEMO-SNK-001',
    nameFr: 'Sneakers Urban Runner',
    nameAr: 'حذاء رياضي أوربان رانر',
    description:
      "Sneakers légères à semelle amortissante, pensées pour la marche quotidienne. Tige respirante et maintien ferme au talon.",
    price: 349,
    cost: 180,
    stock: 42,
    collection: 'chaussures',
    images: ['1549298916-b41d501d3772', '1608667508764-33cf0726b13a', '1600185365483-26d7a4cc7519'],
    packs: [
      { min: 2, max: 4, unit: 315 },
      { min: 5, max: 999, unit: 289 },
    ],
  },
  {
    sku: 'DEMO-SNK-002',
    nameFr: 'Baskets Retro Court',
    nameAr: 'حذاء ريترو كورت',
    description: 'Silhouette rétro en cuir synthétique, coloris intemporel. Se porte du bureau au week-end.',
    price: 299,
    cost: 155,
    stock: 4,
    collection: 'chaussures',
    images: ['1607522370275-f14206abe5d3', '1542291026-7eec264c27ff'],
  },
  {
    sku: 'DEMO-AUD-001',
    nameFr: 'Casque Bluetooth Studio Pro',
    nameAr: 'سماعة بلوتوث ستوديو برو',
    description:
      "Casque circum-aural sans fil, réduction de bruit passive et 30 heures d'autonomie. Livré avec câble jack et housse.",
    price: 599,
    cost: 310,
    stock: 27,
    collection: 'electronique',
    images: ['1546435770-a3e426bf472b', '1505740420928-5e560c06d30e', '1517336714731-489689fd1ca8'],
    packs: [{ min: 3, max: 999, unit: 529 }],
  },
  {
    sku: 'DEMO-AUD-002',
    nameFr: 'Écouteurs Sport Sans Fil',
    nameAr: 'سماعات رياضية لاسلكية',
    description: 'Écouteurs intra-auriculaires résistants à la transpiration, boîtier de charge compact.',
    price: 249,
    cost: 118,
    stock: 63,
    collection: 'electronique',
    images: ['1550009158-9ebf69173e03', '1593642532842-98d0fd5ebc1a'],
  },
  {
    sku: 'DEMO-WTC-001',
    nameFr: 'Montre Acier Classic 40mm',
    nameAr: 'ساعة فولاذية كلاسيك 40 ملم',
    description: "Boîtier acier brossé 40 mm, verre minéral et bracelet interchangeable. Étanchéité 3 ATM.",
    price: 449,
    cost: 210,
    stock: 18,
    collection: 'accessoires',
    images: ['1523275335684-37898b6baf30', '1546868871-7041f2a55e12'],
  },
  {
    sku: 'DEMO-BAG-001',
    nameFr: 'Sac à Main Structuré Camel',
    nameAr: 'حقيبة يد كامل',
    description: 'Sac porté main ou épaule, doublure intérieure et poche zippée. Finitions soignées.',
    price: 389,
    cost: 175,
    stock: 22,
    collection: 'accessoires',
    images: ['1590874103328-eac38a683ce7', '1584917865442-de89df76afd3', '1594223274512-ad4803739b7c'],
    packs: [{ min: 2, max: 999, unit: 349 }],
  },
  {
    sku: 'DEMO-BAG-002',
    nameFr: 'Sac à Dos Business Slim',
    nameAr: 'حقيبة ظهر سليم',
    description: "Compartiment matelassé 15 pouces, dos aéré et port USB. Format cabine.",
    price: 329,
    cost: 148,
    stock: 35,
    collection: 'accessoires',
    images: ['1553062407-98eeb64c6a62'],
  },
  {
    sku: 'DEMO-FEM-001',
    nameFr: 'Combinaison Fluide Ocre',
    nameAr: 'بدلة انسيابية بلون أوكر',
    description: 'Combinaison longue en viscose fluide, ceinture à nouer. Tombé élégant, coupe droite.',
    price: 279,
    cost: 120,
    stock: 16,
    collection: 'mode-femme',
    images: ['1515886657613-9f3515b0c78f', '1588117305388-c2631a279f82'],
  },
  {
    sku: 'DEMO-FEM-002',
    nameFr: 'Veste Oversize Beige',
    nameAr: 'سترة أوفرسايز بيج',
    description: 'Veste mi-saison à coupe oversize, doublée et déperlante. Deux poches passepoilées.',
    price: 459,
    cost: 205,
    stock: 3,
    collection: 'mode-femme',
    images: ['1591047139829-d91aecb6caea', '1596755094514-f87e34085b2c'],
  },
  {
    sku: 'DEMO-HOM-001',
    nameFr: 'T-shirt Coton Peigné Blanc',
    nameAr: 'تي شيرت قطن أبيض',
    description: 'Jersey 180 g/m² en coton peigné, col côtelé renforcé. Lavable en machine à 30°.',
    price: 129,
    cost: 48,
    stock: 120,
    collection: 'mode-homme',
    images: ['1521572163474-6864f9cf17ab', '1620799140408-edc6dcb6d633'],
    packs: [
      { min: 3, max: 5, unit: 109 },
      { min: 6, max: 999, unit: 95 },
    ],
  },
  {
    sku: 'DEMO-HOM-002',
    nameFr: 'Blazer Structuré Bleu Nuit',
    nameAr: 'بليزر أزرق داكن',
    description: 'Blazer deux boutons en laine mélangée, épaules structurées et doublure satinée.',
    price: 699,
    cost: 320,
    stock: 0,
    stockStatus: 'out_of_stock',
    collection: 'mode-homme',
    images: ['1487222477894-8943e31ef7b2'],
  },
  {
    sku: 'DEMO-BEA-001',
    nameFr: 'Eau de Parfum Nuit Ambrée 50ml',
    nameAr: 'عطر ليلة عنبرية 50 مل',
    description: "Sillage boisé ambré, notes de vanille et de bois de santal. Tenue longue durée.",
    price: 379,
    cost: 165,
    stock: 31,
    collection: 'beaute',
    images: ['1585386959984-a4155224a1ad', '1611930022073-b7a4ba5fcccd'],
    packs: [{ min: 2, max: 999, unit: 339 }],
  },
  {
    sku: 'DEMO-BEA-002',
    nameFr: 'Sérum Visage Éclat Vitamine C',
    nameAr: 'سيروم فيتامين سي للوجه',
    description: 'Sérum concentré à la vitamine C stabilisée, texture non grasse. Flacon 30 ml avec pipette.',
    price: 219,
    cost: 82,
    stock: 54,
    collection: 'beaute',
    images: ['1608571423902-eed4a5ad8108', '1620916566398-39f1143ab7be'],
  },
  {
    sku: 'DEMO-BEA-003',
    nameFr: 'Palette Maquillage Nude 12 Teintes',
    nameAr: 'باليت مكياج 12 لون',
    description: 'Douze teintes mates et satinées fortement pigmentées, miroir intégré et pinceau double embout.',
    price: 189,
    cost: 70,
    stock: 47,
    collection: 'beaute',
    images: ['1596462502278-27bfdc403348'],
  },
  {
    sku: 'DEMO-ACC-001',
    nameFr: 'Lunettes de Soleil Polarisées',
    nameAr: 'نظارات شمسية مستقطبة',
    description: 'Verres polarisés catégorie 3, monture acétate légère. Étui rigide et chiffon inclus.',
    price: 179,
    cost: 62,
    stock: 68,
    collection: 'accessoires',
    images: ['1572635196237-14b3f281503f'],
    packs: [{ min: 4, max: 999, unit: 149 }],
  },
  {
    sku: 'DEMO-ACC-002',
    nameFr: 'Collier Plaqué Or Fin',
    nameAr: 'عقد مطلي بالذهب',
    description: 'Chaîne fine plaquée or 18 carats, fermoir mousqueton. Longueur réglable 40-45 cm.',
    price: 159,
    cost: 55,
    stock: 5,
    collection: 'accessoires',
    images: ['1611652022419-a9419f74343d'],
  },
];

async function main() {
  const storeId = parseInt(process.argv[2] || '', 10);
  const clean = process.argv.includes('--clean');

  if (!storeId || Number.isNaN(storeId)) {
    console.error('Usage: npx tsx scripts/seed-demo-store.ts <storeId> [--clean]');
    process.exit(1);
  }

  const store = await (prisma as any).store.findUnique({
    where: { id: storeId },
    select: { id: true, name: true, userId: true },
  });
  if (!store) {
    console.error(`No store with id ${storeId}`);
    process.exit(1);
  }
  if (!store.userId) {
    console.error(`Store ${storeId} has no owner; products need one.`);
    process.exit(1);
  }

  if (clean) {
    const removed = await prisma.product.deleteMany({
      where: { ownerId: store.userId, sku: { startsWith: DEMO_SKU_PREFIX } },
    });
    const cols = await (prisma as any).storeCollection.deleteMany({
      where: { storeId, slug: { in: COLLECTIONS.map((c) => c.slug) } },
    });
    console.log(`Removed ${removed.count} demo products and ${cols.count} collections from "${store.name}".`);
    return;
  }

  // Collections first: products attach to them by slug below.
  const collectionIds = new Map<string, number>();
  for (const [i, c] of COLLECTIONS.entries()) {
    const row = await (prisma as any).storeCollection.upsert({
      where: { storeId_slug: { storeId, slug: c.slug } },
      update: { nameFr: c.nameFr, nameAr: c.nameAr, imageUrl: img(c.image, 800), sortOrder: i, isActive: true },
      create: {
        storeId,
        slug: c.slug,
        nameFr: c.nameFr,
        nameAr: c.nameAr,
        imageUrl: img(c.image, 800),
        sortOrder: i,
        isActive: true,
      },
    });
    collectionIds.set(c.slug, row.id);
  }

  // Replace only this script's own products, so a re-run is idempotent and a
  // seller's real catalogue in the same account survives untouched.
  await prisma.product.deleteMany({
    where: { ownerId: store.userId, sku: { startsWith: DEMO_SKU_PREFIX } },
  });

  for (const [i, p] of PRODUCTS.entries()) {
    const collectionId = collectionIds.get(p.collection);
    await prisma.product.create({
      data: {
        sku: p.sku,
        ref: p.sku.toLowerCase(),
        nameFr: p.nameFr,
        nameAr: p.nameAr,
        description: p.description,
        baseCostMad: p.cost,
        retailPriceMad: p.price,
        stockQuantity: p.stock,
        stockStatus: p.stockStatus || (p.stock > 0 ? 'available' : 'out_of_stock'),
        ownerId: store.userId,
        status: 'APPROVED',
        isActive: true,
        showInStore: true,
        storeSortOrder: i,
        images: {
          create: p.images.map((id, n) => ({ imageUrl: img(id), sortOrder: n, isPrimary: n === 0 })),
        },
        ...(p.packs
          ? {
              wholesalePrices: {
                create: p.packs.map((t, n) => ({
                  minQuantity: t.min,
                  maxQuantity: t.max,
                  pricePerUnit: t.unit,
                  sortOrder: n,
                })),
              },
            }
          : {}),
        ...(collectionId ? { collections: { connect: { id: collectionId } } } : {}),
      },
    });
  }

  console.log(
    `Seeded ${PRODUCTS.length} demo products across ${COLLECTIONS.length} collections into "${store.name}" (store ${storeId}).`
  );
  console.log(`Undo with: npx tsx scripts/seed-demo-store.ts ${storeId} --clean`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
