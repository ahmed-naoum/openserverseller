const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const link = await prisma.referralLink.findUnique({ where: { id: 48 }, include: { product: true } });
  console.log('Link 48 Product:', link.product.nameFr);
  console.log('Product Owner ID:', link.product.ownerId);
}
main().finally(() => prisma.$disconnect());
