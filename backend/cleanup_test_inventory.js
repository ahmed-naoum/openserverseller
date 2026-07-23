const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userIds = [70, 60, 63];
  
  // Clean up seeded inventory items (IDs 189, 190, 191, 192, 193, 194, 195, 196, 197, 198)
  const productIds = [189, 190, 191, 192, 193, 194, 195, 196, 197, 198];

  const deleted = await prisma.productInventory.deleteMany({
    where: {
      userId: { in: userIds },
      productId: { in: productIds }
    }
  });

  console.log(`Deleted ${deleted.count} test inventory entries.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
