import { prisma } from './src/lib/prisma.js';

async function main() {
  const where = { isActive: true, status: 'APPROVED', visibility: { has: 'REGULAR' } };
  const count = await prisma.product.count({ where });
  console.log('count:', count);
  const products = await prisma.product.findMany({
    where, skip: 0, take: 12, orderBy: { createdAt: 'desc' },
    select: { id: true, nameFr: true, createdAt: true },
  });
  console.log('first 12 ids:', products.map(p => p.id));
  console.log('first 12 createdAts:', products.map(p => p.createdAt));
  
  // Check how many products have no images
  const noImages = await prisma.product.count({
    where: { ...where, images: { none: {} } }
  });
  console.log('products with no images:', noImages);
  
  await prisma.$disconnect();
}
main();
