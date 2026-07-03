import { prisma } from './src/lib/prisma';

async function check() {
  try {
    const total = await prisma.product.count();
    const approved = await prisma.product.count({ where: { status: 'APPROVED', isActive: true } });
    const regular = await prisma.product.count({ where: { status: 'APPROVED', isActive: true, visibility: { has: 'REGULAR' } } });
    const affiliate = await prisma.product.count({ where: { status: 'APPROVED', isActive: true, visibility: { has: 'AFFILIATE' } } });
    const influencer = await prisma.product.count({ where: { status: 'APPROVED', isActive: true, visibility: { has: 'INFLUENCER' } } });
    
    console.log('--- Database Product Counts ---');
    console.log('Total Products:', total);
    console.log('Approved & Active Products:', approved);
    console.log('REGULAR Visibility:', regular);
    console.log('AFFILIATE Visibility:', affiliate);
    console.log('INFLUENCER Visibility:', influencer);
    
    const sample = await prisma.product.findMany({
      where: { status: 'APPROVED', isActive: true },
      select: { id: true, nameFr: true, visibility: true },
      take: 5
    });
    console.log('Sample Active Approved Products:', sample);
  } catch (error) {
    console.error('Error checking products:', error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
