import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Fetching first 4 products to enable for homepage...");
  const products = await prisma.product.findMany({
    take: 6,
    where: { isActive: true, status: 'APPROVED' },
    orderBy: { createdAt: 'desc' }
  });

  if (products.length === 0) {
    console.log("No approved active products found in the database!");
    return;
  }

  for (const p of products) {
    await prisma.product.update({
      where: { id: p.id },
      data: { showInHomepage: true }
    });
    console.log(`Enabled product ID: ${p.id} for homepage slider.`);
  }

  console.log("Database updated successfully!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
