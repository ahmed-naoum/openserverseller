const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkOrders() {
  const ids = [1, 2, 3, 4, 5, 6, 7];
  console.log('--- Checking Orders 1 to 7 ---');

  for (const id of ids) {
    try {
      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          items: true,
          walletTransactions: true,
          influencerCommissions: true,
          statusHistory: true,
          shipment: true,
          returns: true,
          productionJobs: true,
        }
      });

      if (order) {
        console.log(`Order ID: ${order.id}, Number: ${order.orderNumber}, Status: ${order.status}`);
        console.log(`  Items: ${order.items.length}`);
        console.log(`  Wallet Transactions: ${order.walletTransactions.length}`);
        console.log(`  Influencer Commissions: ${order.influencerCommissions.length}`);
        console.log(`  Status History: ${order.statusHistory.length}`);
        console.log(`  Shipment: ${order.shipment ? 'Yes' : 'No'}`);
        console.log(`  Returns: ${order.returns.length}`);
        console.log(`  Production Jobs: ${order.productionJobs.length}`);
      } else {
        console.log(`Order ID: ${id} not found.`);
      }
    } catch (e) {
      console.log(`Error checking order ${id}:`, e.message);
    }
  }

  // Also check conversations linked to these order IDs in metadata
  console.log('\n--- Checking Linked Conversations ---');
  try {
    const conversations = await prisma.conversation.findMany();
    const linked = conversations.filter(c => {
      if (!c.metadata) return false;
      const metadata = typeof c.metadata === 'string' ? JSON.parse(c.metadata) : c.metadata;
      return ids.includes(metadata.orderId);
    });
    
    console.log(`Found ${linked.length} conversations linked via metadata.`);
    for (const conv of linked) {
      console.log(`  Conv ID: ${conv.id}, Title: ${conv.title}`);
    }
  } catch (e) {
    console.log('Error checking conversations:', e.message);
  }

  await prisma.$disconnect();
}

checkOrders().catch(console.error);
