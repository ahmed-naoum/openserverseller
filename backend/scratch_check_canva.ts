import { prisma } from './src/lib/prisma.js';

async function main() {
  const where = {
    isActive: true,
    status: 'APPROVED',
    visibility: { has: 'REGULAR' },
  };

  const total = await prisma.product.count({ where });
  console.log('Marketplace REGULAR count:', total);

  // Check a few products
  const knownNew = await prisma.product.findMany({
    where: { sku: { in: ['melatonine30', 'neuroboost', 'hypertension', 'vitamax', 'collagen-prodre', 'acides-amines', 'huile-epilation'] } },
    select: { id: true, sku: true, visibility: true, isActive: true, status: true },
  });
  console.log('Specifically imported products:');
  for (const s of knownNew) {
    console.log(`  id=${s.id} sku="${s.sku}" visibility=${JSON.stringify(s.visibility)} active=${s.isActive} status=${s.status}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
