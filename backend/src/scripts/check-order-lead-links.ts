import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkLinks() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      lead: true
    }
  });

  orders.forEach(o => {
    console.log(`Order ID: ${o.id} | Lead ID: ${o.leadId} | Lead Name: ${o.lead?.fullName} | Lead Variant: ${o.lead?.productVariant} | Order Variant: ${o.productVariant}`);
  });

  process.exit(0);
}

checkLinks();
