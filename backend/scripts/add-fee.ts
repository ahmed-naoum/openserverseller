import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      profile: { fullName: { contains: 'Ali', mode: 'insensitive' } },
      role: { name: 'INFLUENCER' }
    },
    include: { profile: true, wallet: true }
  });
  
  if (!user) {
    console.log('User not found');
    return;
  }
  
  console.log('Found user:', user.profile?.fullName, 'ID:', user.id);
  
  if (!user.wallet) {
    console.log('User has no wallet, creating one...');
    const wallet = await prisma.wallet.create({
      data: { userId: user.id, balanceMad: 0 }
    });
    user.wallet = wallet;
  }
  
  const feeAmount = -230;
  const newBalance = user.wallet.balanceMad + feeAmount;
  
  await prisma.$transaction([
    prisma.wallet.update({
      where: { userId: user.id },
      data: { balanceMad: newBalance }
    }),
    prisma.walletTransaction.create({
      data: {
        walletId: user.wallet.id,
        type: 'Frais',
        amountMad: feeAmount,
        balanceAfterMad: newBalance,
        description: 'Frais'
      }
    })
  ]);
  
  console.log('Fee added successfully. New balance:', newBalance);
}

main().finally(() => prisma.$disconnect());
