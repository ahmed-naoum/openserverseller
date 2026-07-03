import { prisma } from './src/lib/prisma';

async function run() {
  try {
    const product = await prisma.product.findUnique({
      where: { id: 306 },
      include: { categories: true }
    });
    console.log('Product 306 Details:', {
      id: product?.id,
      nameFr: product?.nameFr,
      nameAr: product?.nameAr,
      nameEn: product?.nameEn,
      categories: product?.categories,
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
