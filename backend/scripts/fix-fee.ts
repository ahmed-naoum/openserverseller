import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const userId = 5;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallet: true }
  });
  
  if (!user || !user.wallet) {
    console.log('User or wallet not found');
    return;
  }
  
  // Find the last transaction (the -230 one)
  const lastTx = await prisma.walletTransaction.findFirst({
    where: { walletId: user.wallet.id },
    orderBy: { createdAt: 'desc' }
  });
  
  if (lastTx && lastTx.amountMad === -230 && lastTx.description === 'Frais') {
    console.log('Reverting last transaction:', lastTx.id);
    
    const revertedBalance = user.wallet.balanceMad + 230;
    const finalBalance = revertedBalance + 230; // Adding 230 as requested
    
    await prisma.$transaction([
      prisma.walletTransaction.delete({ where: { id: lastTx.id } }),
      prisma.wallet.update({
        where: { userId: userId },
        data: { balanceMad: finalBalance }
      }),
      prisma.walletTransaction.create({
        data: {
          walletId: user.wallet.id,
          type: 'Frais',
          amountMad: 230,
          balanceAfterMad: finalBalance,
          description: 'Frais'
        }
      })
    ]);
    
    console.log('Corrected balance to +230 effect. Final balance:', finalBalance);
  } else {
    console.log('Last transaction was not the expected -230 fee. Adding +230 now.');
    const finalBalance = user.wallet.balanceMad + 230;
    await prisma.$transaction([
      prisma.wallet.update({
        where: { userId: userId },
        data: { balanceMad: finalBalance }
      }),
      prisma.walletTransaction.create({
        data: {
          walletId: user.wallet.id,
          type: 'Frais',
          amountMad: 230,
          balanceAfterMad: finalBalance,
          description: 'Frais'
        }
      })
    ]);
    console.log('Added +230 fee. Final balance:', finalBalance);
  }
}

main().finally(() => prisma.$disconnect());
