import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const payouts = await prisma.payoutRequest.findMany({
    take: 5,
    include: {
      vendor: {
        include: { wallet: true }
      }
    }
  });
  
  console.log('PAYOUTS WALLET CHECK:');
  payouts.forEach(p => {
    console.log(`Payout ID: ${p.id}, Vendor: ${p.vendorId}, Wallet Balance: ${p.vendor?.wallet?.balanceMad}`);
  });
  
  process.exit(0);
}

check();
