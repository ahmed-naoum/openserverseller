import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting data cleanup...');

  try {
    // 1. Delete all Invoices
    console.log('Deleting Invoices...');
    const deletedInvoices = await prisma.invoice.deleteMany({});
    console.log(`Deleted ${deletedInvoices.count} invoices.`);

    // 2. Delete all Orders (Colis) and their related items via Cascade or explicit delete
    console.log('Deleting Orders & Order Items...');
    const deletedOrderItems = await prisma.orderItem.deleteMany({});
    console.log(`Deleted ${deletedOrderItems.count} order items.`);
    
    const deletedOrderStatusHistory = await prisma.orderStatusHistory.deleteMany({});
    console.log(`Deleted ${deletedOrderStatusHistory.count} order status histories.`);
    
    // Some related models might not be cascading:
    await prisma.walletTransaction.deleteMany({});
    console.log('Deleted all Wallet Transactions.');
    
    await prisma.shipmentTrackingEvent.deleteMany({});
    await prisma.shipmentDeliveryProof.deleteMany({});
    await prisma.shipment.deleteMany({});
    console.log('Deleted Shipments.');

    const deletedOrders = await prisma.order.deleteMany({});
    console.log(`Deleted ${deletedOrders.count} orders.`);

    // 3. Delete all Leads
    console.log('Deleting Leads & Call Logs...');
    const deletedCallLogs = await prisma.callLog.deleteMany({});
    console.log(`Deleted ${deletedCallLogs.count} call logs.`);

    const deletedLeadStatusHistory = await prisma.leadStatusHistory.deleteMany({});
    console.log(`Deleted ${deletedLeadStatusHistory.count} lead status histories.`);

    const deletedLeadAssignments = await prisma.leadAssignment.deleteMany({});
    console.log(`Deleted ${deletedLeadAssignments.count} lead assignments.`);

    const deletedLeads = await prisma.lead.deleteMany({});
    console.log(`Deleted ${deletedLeads.count} leads.`);

    // 4. Reset Wallets & Payouts since they are related to these earnings
    console.log('Resetting Wallets & Payouts...');
    const deletedPayouts = await prisma.payoutRequest.deleteMany({});
    console.log(`Deleted ${deletedPayouts.count} payout requests.`);

    const updatedWallets = await prisma.wallet.updateMany({
      data: {
        balanceMad: 0,
        totalEarnedMad: 0,
        totalWithdrawnMad: 0,
      }
    });
    console.log(`Reset ${updatedWallets.count} wallets to 0 MAD.`);

    console.log('Cleanup completed successfully!');
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
