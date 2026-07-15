import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { id: 142 },
        { longDescription: { contains: 'زيت مبتكر' } },
        { longDescription: { contains: 'المكونات' } }
      ]
    }
  });
  console.log('FOUND PRODUCTS:', products.map(p => ({ id: p.id, nameFr: p.nameFr, longDescLength: p.longDescription?.length })));
  if (products.length > 0) {
    console.log('FIRST PRODUCT LONG DESC:', products[0].longDescription);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
