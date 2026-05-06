import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const commissions = await prisma.influencerCommission.findMany({
    include: {
      order: true
    }
  });
  
  console.log('COMMISSIONS ORDER CHECK:');
  commissions.forEach(c => {
    console.log(`Comm ID: ${c.id}, Order ID: ${c.orderId}, Coliaty Code: ${c.order?.coliatyPackageCode}`);
  });
  
  process.exit(0);
}

check();
