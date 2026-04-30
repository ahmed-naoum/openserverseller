import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function backfillVariants() {
  console.log('--- BACKFILLING VARIANTS ---');
  
  // Find all orders that have a lead but no productVariant
  const orders = await prisma.order.findMany({
    where: {
      productVariant: null,
      leadId: { not: null }
    },
    include: {
      lead: true
    }
  });

  console.log(`Found ${orders.length} orders to update.`);

  let updatedCount = 0;
  for (const order of orders) {
    if (order.lead && order.lead.productVariant) {
      await prisma.order.update({
        where: { id: order.id },
        data: { productVariant: order.lead.productVariant }
      });
      updatedCount++;
    }
  }

  console.log(`Successfully backfilled ${updatedCount} orders.`);
  
  // Also check if any leads have productVariant null but it was mentioned in notes
  // (Optional, but let's stick to the reliable mapping first)

  await prisma.$disconnect();
}

backfillVariants();
