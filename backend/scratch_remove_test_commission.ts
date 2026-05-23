import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$transaction([
      prisma.walletTransaction.delete({
        where: { id: 119 }
      }),
      prisma.wallet.update({
        where: { id: 15 },
        data: {
          balanceMad: { decrement: 1000000 },
          totalEarnedMad: { decrement: 1000000 }
        }
      })
    ]);
    console.log('Successfully removed test commission (1,000,000 MAD) for naoum00007@gmail.com');
  } catch (error) {
    console.error('Error during removal:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
