import { prisma } from './src/lib/prisma';

async function check() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: '123yassine.chaib@gmail.com' },
      include: { role: true }
    });
    console.log('User:', user);
  } catch (error) {
    console.error('Error checking user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
