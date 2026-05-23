import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findUnique({
    where: { email: 'influencer@silacod.ma' },
    include: { wallet: true }
  });

  if (!user) {
    console.log("User not found");
    return;
  }
  
  console.log("User:", user.email);

  if (user.wallet) {
    await prisma.wallet.update({
      where: { id: user.wallet.id },
      data: {
        totalEarnedMad: { increment: 1000000 },
        balanceMad: { increment: 1000000 }
      }
    });

    // Create a transaction to make it show up in history if needed
    await prisma.walletTransaction.create({
      data: {
        walletId: user.wallet.id,
        amountMad: 1000000,
        type: 'CREDIT',
        description: 'Test commission to reach Gold tier',
        balanceAfterMad: user.wallet.balanceMad + 1000000
      }
    });
    console.log("Updated wallet successfully.");
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
