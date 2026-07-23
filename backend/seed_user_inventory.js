const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userIds = [70, 60, 63]; // Add to all test users
  
  // Find some active products
  const products = await prisma.product.findMany({
    where: {
      isActive: true
    },
    take: 10
  });

  console.log(`Found ${products.length} active products.`);

  for (const userId of userIds) {
    for (const product of products) {
      const existing = await prisma.productInventory.findFirst({
        where: {
          userId,
          productId: product.id
        }
      });

      if (!existing) {
        await prisma.productInventory.create({
          data: {
            userId,
            productId: product.id,
            quantity: 150
          }
        });
        console.log(`Added Product ${product.id} (${product.sku}) to User ${userId}'s inventory.`);
      } else {
        console.log(`Product ${product.id} already in User ${userId}'s inventory.`);
      }
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
