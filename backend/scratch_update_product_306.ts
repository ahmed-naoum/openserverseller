import { prisma } from './src/lib/prisma';

async function run() {
  try {
    const updated = await prisma.product.update({
      where: { id: 306 },
      data: { nameAr: 'مزيل عرق' }
    });
    console.log('Successfully updated product 306:', updated.nameAr);
  } catch (error) {
    console.error('Error updating:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
