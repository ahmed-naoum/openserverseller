import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkData() {
  console.log('--- LATEST LEADS ---');
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, fullName: true, productVariant: true, createdAt: true }
  });
  console.table(leads);

  console.log('--- LATEST ORDERS ---');
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, customerName: true, productVariant: true, createdAt: true }
  });
  console.table(orders);

  await prisma.$disconnect();
}

checkData();
