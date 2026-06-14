import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const USER_EMAIL = 'naoum00007@gmail.com';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: USER_EMAIL }
  });

  if (!user) {
    console.error(`User with email ${USER_EMAIL} not found.`);
    return;
  }

  const userId = user.id;
  console.log(`Starting to clear account for User ID: ${userId} (${USER_EMAIL})...`);

  // 1. Get user's referral links
  const referralLinks = await prisma.referralLink.findMany({
    where: { influencerId: userId },
    select: { id: true }
  });
  const referralLinkIds = referralLinks.map(rl => rl.id);
  console.log(`Found ${referralLinkIds.length} referral links.`);

  // 2. Get all leads to delete
  // (leads where referralLinkId is in user's links, OR where vendorId = userId)
  const leadsToDelete = await prisma.lead.findMany({
    where: {
      OR: [
        { referralLinkId: { in: referralLinkIds } },
        { vendorId: userId }
      ]
    },
    select: { id: true }
  });
  const leadIds = leadsToDelete.map(l => l.id);
  console.log(`Found ${leadIds.length} leads to delete.`);

  // 3. Get all orders associated with those leads or vendorId
  const ordersToDelete = await prisma.order.findMany({
    where: {
      OR: [
        { leadId: { in: leadIds } },
        { vendorId: userId }
      ]
    },
    select: { id: true }
  });
  const orderIds = ordersToDelete.map(o => o.id);
  console.log(`Found ${orderIds.length} orders to delete.`);

  // Deletion: Dependent tables first to satisfy constraints

  // Order dependencies
  if (orderIds.length > 0) {
    // order_status_history
    const { count: osh } = await prisma.orderStatusHistory.deleteMany({
      where: { orderId: { in: orderIds } }
    });
    console.log(`Deleted ${osh} order status history entries.`);

    // order_items
    const { count: oi } = await prisma.orderItem.deleteMany({
      where: { orderId: { in: orderIds } }
    });
    console.log(`Deleted ${oi} order items.`);

    // order_returns
    const { count: or } = await prisma.orderReturn.deleteMany({
      where: { orderId: { in: orderIds } }
    });
    console.log(`Deleted ${or} order returns.`);

    // shipment_tracking_events
    const { count: ste } = await prisma.shipmentTrackingEvent.deleteMany({
      where: { shipment: { orderId: { in: orderIds } } }
    });
    console.log(`Deleted ${ste} shipment tracking events.`);

    // shipment_delivery_proof
    const { count: sdp } = await prisma.shipmentDeliveryProof.deleteMany({
      where: { shipment: { orderId: { in: orderIds } } }
    });
    console.log(`Deleted ${sdp} shipment delivery proofs.`);

    // shipments
    const { count: sh } = await prisma.shipment.deleteMany({
      where: { orderId: { in: orderIds } }
    });
    console.log(`Deleted ${sh} shipments.`);

    // influencer_commissions
    const { count: ic } = await prisma.influencerCommission.deleteMany({
      where: { orderId: { in: orderIds } }
    });
    console.log(`Deleted ${ic} influencer commissions connected to orders.`);
  }

  // Delete any other influencer commissions for this user
  const { count: icUser } = await prisma.influencerCommission.deleteMany({
    where: { influencerId: userId }
  });
  console.log(`Deleted ${icUser} general influencer commissions.`);

  // Lead dependencies
  if (leadIds.length > 0) {
    // lead_status_history
    const { count: lsh } = await prisma.leadStatusHistory.deleteMany({
      where: { leadId: { in: leadIds } }
    });
    console.log(`Deleted ${lsh} lead status history entries.`);

    // lead_assignments
    const { count: la } = await prisma.leadAssignment.deleteMany({
      where: { leadId: { in: leadIds } }
    });
    console.log(`Deleted ${la} lead assignments.`);

    // call_logs
    const { count: cl } = await prisma.callLog.deleteMany({
      where: { leadId: { in: leadIds } }
    });
    console.log(`Deleted ${cl} call logs.`);
  }

  // Delete Orders
  if (orderIds.length > 0) {
    const { count: ord } = await prisma.order.deleteMany({
      where: { id: { in: orderIds } }
    });
    console.log(`Deleted ${ord} orders.`);
  }

  // Delete Leads
  if (leadIds.length > 0) {
    const { count: ld } = await prisma.lead.deleteMany({
      where: { id: { in: leadIds } }
    });
    console.log(`Deleted ${ld} leads.`);
  }

  // Referral Link dependencies
  if (referralLinkIds.length > 0) {
    // referral_link_clicks
    const { count: rlc } = await (prisma as any).referralLinkClick.deleteMany({
      where: { referralLinkId: { in: referralLinkIds } }
    });
    console.log(`Deleted ${rlc} referral link clicks.`);

    // referral_link_landing_pages
    const { count: rllp } = await prisma.referralLinkLandingPage.deleteMany({
      where: { referralLinkId: { in: referralLinkIds } }
    });
    console.log(`Deleted ${rllp} referral link landing pages.`);

    // referral_links
    const { count: rl } = await prisma.referralLink.deleteMany({
      where: { id: { in: referralLinkIds } }
    });
    console.log(`Deleted ${rl} referral links.`);
  }

  // Wallet
  const wallet = await prisma.wallet.findUnique({
    where: { userId }
  });

  if (wallet) {
    // wallet transactions
    const { count: wt } = await prisma.walletTransaction.deleteMany({
      where: { walletId: wallet.id }
    });
    console.log(`Deleted ${wt} wallet transactions.`);

    // Reset wallet balance
    await prisma.wallet.update({
      where: { userId },
      data: {
        balanceMad: 0,
        totalEarnedMad: 0,
        totalWithdrawnMad: 0
      }
    });
    console.log(`Reset wallet balance to 0.`);
  }

  // Payout requests
  const { count: pr } = await prisma.payoutRequest.deleteMany({
    where: { vendorId: userId }
  });
  console.log(`Deleted ${pr} payout requests.`);

  // Product Inventory
  const { count: pi } = await prisma.productInventory.deleteMany({
    where: { userId }
  });
  console.log(`Deleted ${pi} product inventories.`);

  // Affiliate Claims
  const { count: ac } = await prisma.affiliateClaim.deleteMany({
    where: { userId }
  });
  console.log(`Deleted ${ac} affiliate claims.`);

  // Invoices
  const { count: inv } = await prisma.invoice.deleteMany({
    where: { userId }
  });
  console.log(`Deleted ${inv} invoices.`);

  // Notifications
  const { count: nt } = await prisma.notification.deleteMany({
    where: { userId }
  });
  console.log(`Deleted ${nt} notifications.`);

  // Reset User model cumulative stats
  await prisma.user.update({
    where: { id: userId },
    data: {
      totalEarnings: 0
    }
  });
  console.log(`Reset totalEarnings count on User profile to 0.`);

  console.log(`Successfully reset account for ${USER_EMAIL}!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
