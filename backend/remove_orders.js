const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function removeOrders() {
  const ids = [1, 2, 3, 4, 5, 6, 7];
  console.log(`--- Removing Orders ${ids.join(', ')} ---`);

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Delete Wallet Transactions linked to these orders
      const walletDelete = await tx.walletTransaction.deleteMany({
        where: { orderId: { in: ids } }
      });
      console.log(`  Deleted ${walletDelete.count} Wallet Transactions.`);

      // 2. Delete Influencer Commissions linked to these orders
      const commissionDelete = await tx.influencerCommission.deleteMany({
        where: { orderId: { in: ids } }
      });
      console.log(`  Deleted ${commissionDelete.count} Influencer Commissions.`);

      // 3. Delete Shipments, Returns, ProductionJobs, StatusHistory (most are cascade, but let's be safe)
      await tx.shipment.deleteMany({ where: { orderId: { in: ids } } });
      await tx.orderReturn.deleteMany({ where: { orderId: { in: ids } } });
      await tx.productionJob.deleteMany({ where: { orderId: { in: ids } } });
      await tx.orderStatusHistory.deleteMany({ where: { orderId: { in: ids } } });
      await tx.orderItem.deleteMany({ where: { orderId: { in: ids } } });

      // 4. Delete the Orders themselves
      const orderDelete = await tx.order.deleteMany({
        where: { id: { in: ids } }
      });
      console.log(`  Deleted ${orderDelete.count} Orders.`);

      // 5. Cleanup Conversations
      // Find conversations linked via metadata
      const conversations = await tx.conversation.findMany();
      const idsToDelete = conversations.filter(c => {
        if (!c.metadata) return false;
        try {
          const metadata = typeof c.metadata === 'string' ? JSON.parse(c.metadata) : c.metadata;
          return ids.includes(metadata.orderId);
        } catch (e) { return false; }
      }).map(c => c.id);

      if (idsToDelete.length > 0) {
        // Delete messages first
        await tx.message.deleteMany({ where: { conversationId: { in: idsToDelete } } });
        // Delete participants
        await tx.conversationParticipant.deleteMany({ where: { conversationId: { in: idsToDelete } } });
        // Delete conversations
        const convDelete = await tx.conversation.deleteMany({ where: { id: { in: idsToDelete } } });
        console.log(`  Deleted ${convDelete.count} linked Conversations & their messages.`);
      }
    });

    console.log('--- Cleanup Complete ---');
  } catch (error) {
    console.error('--- Cleanup Failed ---');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

removeOrders();
