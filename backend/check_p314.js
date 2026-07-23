const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.product.findUnique({
    where: {
      id: 314
    }
  });
  console.log('PRODUCT 314 DETAILS:', p);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
