const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const vendorId = 70;
  const products = await prisma.product.findMany({
    where: {
      status: 'APPROVED',
      OR: [
        { ownerId: Number(vendorId) },
        { inventories: { some: { userId: Number(vendorId) } } },
        { claims: { some: { userId: Number(vendorId), status: { in: ['APPROVED', 'ACTIVE'] } } } }
      ]
    },
    include: {
      images: {
        where: { isPrimary: true },
        take: 1,
      },
      inventories: {
        where: { userId: Number(vendorId) }
      },
      claims: {
        where: { userId: Number(vendorId) }
      }
    },
    orderBy: {
      nameFr: 'asc'
    }
  });

  const data = products.map(p => ({
    id: p.id,
    sku: p.sku,
    name: p.nameFr || p.nameAr,
    retailPriceMad: p.retailPriceMad,
    image: p.images[0]?.imageUrl || null,
    ownerId: p.ownerId,
    hasInventory: p.inventories.length > 0,
    isClaimed: p.claims.some(c => ['APPROVED', 'ACTIVE'].includes(c.status))
  }));

  console.log('OUTPUT DATA FOR VENDOR 70:', data);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
