import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const influencers = await prisma.user.findMany({
    where: { role: { name: 'INFLUENCER' } },
    include: { wallet: true, profile: true },
  });

  for (const user of influencers) {
    const leads = await prisma.lead.findMany({
      where: { referralLink: { influencerId: user.id } },
      include: { order: true },
    });

    const totalLeads = leads.length;
    const confirmedLeads = leads.filter(l => l.order).length;
    const deliveredLeads = leads.filter(l => l.status === 'DELIVERED').length;

    // Revenue from delivered orders (current method)
    const revenueFromDelivered = leads
      .filter(l => l.status === 'DELIVERED' && l.order)
      .reduce((sum, l) => sum + Number(l.order?.totalAmountMad || 0), 0);

    // Revenue from all orders that have order attached
    const revenueFromAllOrders = leads
      .filter(l => l.order)
      .reduce((sum, l) => sum + Number(l.order?.totalAmountMad || 0), 0);

    // Commissions
    const commissions = await prisma.influencerCommission.findMany({
      where: { influencerId: user.id },
    });
    const totalCommissions = commissions.reduce((s, c) => s + Number(c.amount), 0);
    const approvedCommissions = commissions.filter(c => c.status === 'APPROVED').reduce((s, c) => s + Number(c.amount), 0);
    const paidCommissions = commissions.filter(c => c.status === 'PAID').reduce((s, c) => s + Number(c.amount), 0);

    // Wallet
    const wallet = user.wallet;

    console.log(`\n=== ${user.email} ===`);
    console.log(`  Leads: ${totalLeads} | Confirmed: ${confirmedLeads} | Delivered: ${deliveredLeads}`);
    console.log(`  Revenue (delivered orders): ${revenueFromDelivered} MAD`);
    console.log(`  Revenue (all orders): ${revenueFromAllOrders} MAD`);
    console.log(`  Commissions - Total: ${totalCommissions} | Approved: ${approvedCommissions} | Paid: ${paidCommissions}`);
    console.log(`  Wallet - Balance: ${wallet?.balanceMad} | TotalEarned: ${wallet?.totalEarnedMad} | TotalWithdrawn: ${wallet?.totalWithdrawnMad}`);
    
    // Show individual delivered leads with order amounts
    const deliveredWithOrders = leads.filter(l => l.status === 'DELIVERED' && l.order);
    if (deliveredWithOrders.length > 0) {
      console.log(`  Delivered order amounts:`);
      deliveredWithOrders.forEach(l => {
        console.log(`    Lead #${l.id} -> Order #${l.order!.id}: ${l.order!.totalAmountMad} MAD (order status: ${l.order!.status})`);
      });
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
