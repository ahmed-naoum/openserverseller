import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const orders = await prisma.order.findMany({
    where: { status: 'DELIVERED' },
    select: { id: true, coliatyPackageCode: true, coliatyPackageId: true }
  });
  
  console.log('Delivered Orders Coliaty Info:');
  console.log(orders);
  
  process.exit(0);
}

check();
