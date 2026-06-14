import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting full database clean up (keeping only admin accounts and configurations)...');

  // 1. Get all non-admin users to delete
  const adminUsers = await prisma.user.findMany({
    where: {
      role: {
        name: 'SUPER_ADMIN'
      }
    },
    select: { id: true }
  });
  const adminIds = adminUsers.map(u => u.id);
  console.log(`Found admin user IDs to preserve: ${adminIds.join(', ')}`);

  // Delete all transactional tables completely
  
  // Webhook logs
  const { count: wl } = await (prisma as any).webhookLog.deleteMany({});
  console.log(`Deleted ${wl} webhook logs.`);

  // Announcements
  const { count: ann } = await prisma.announcement.deleteMany({});
  console.log(`Deleted ${ann} announcements.`);

  // Kyc documents
  const { count: kyc } = await prisma.kycDocument.deleteMany({});
  console.log(`Deleted ${kyc} KYC documents.`);

  // User bank accounts
  const { count: uba } = await prisma.userBankAccount.deleteMany({});
  console.log(`Deleted ${uba} bank accounts.`);

  // Helper/Agent assignments
  const { count: hua } = await prisma.helperUserAssignment.deleteMany({});
  console.log(`Deleted ${hua} helper assignments.`);

  const { count: aia } = await prisma.agentInfluencerAssignment.deleteMany({});
  console.log(`Deleted ${aia} agent influencer assignments.`);

  // Chats, messages, conversations
  const { count: msg } = await prisma.message.deleteMany({});
  console.log(`Deleted ${msg} messages.`);

  const { count: part } = await prisma.conversationParticipant.deleteMany({});
  console.log(`Deleted ${part} conversation participants.`);

  const { count: conv } = await prisma.conversation.deleteMany({});
  console.log(`Deleted ${conv} conversations.`);

  const { count: sr } = await prisma.supportRequest.deleteMany({});
  console.log(`Deleted ${sr} support requests.`);

  // Activity logs
  const { count: al } = await prisma.activityLog.deleteMany({});
  console.log(`Deleted ${al} activity logs.`);

  // Invoices
  const { count: inv } = await prisma.invoice.deleteMany({});
  console.log(`Deleted ${inv} invoices.`);

  // Notifications
  const { count: nt } = await prisma.notification.deleteMany({});
  console.log(`Deleted ${nt} notifications.`);

  // Password resets
  const { count: pr } = await prisma.passwordReset.deleteMany({});
  console.log(`Deleted ${pr} password reset tokens.`);

  // Payout requests
  const { count: por } = await prisma.payoutRequest.deleteMany({});
  console.log(`Deleted ${por} payout requests.`);

  // Favorites
  const { count: fav } = await prisma.favorite.deleteMany({});
  console.log(`Deleted ${fav} favorites.`);

  // Affiliate claims
  const { count: ac } = await prisma.affiliateClaim.deleteMany({});
  console.log(`Deleted ${ac} affiliate claims.`);

  // Product inventory
  const { count: pinv } = await prisma.productInventory.deleteMany({});
  console.log(`Deleted ${pinv} product inventories.`);

  // Warehouse inventory
  const { count: winv } = await prisma.inventory.deleteMany({});
  console.log(`Deleted ${winv} warehouse inventories.`);

  // Production and jobs
  const { count: pj } = await prisma.productionJob.deleteMany({});
  console.log(`Deleted ${pj} production jobs.`);

  const { count: pb } = await prisma.productionBatch.deleteMany({});
  console.log(`Deleted ${pb} production batches.`);

  // Shipments & proof
  const { count: sdp } = await prisma.shipmentDeliveryProof.deleteMany({});
  console.log(`Deleted ${sdp} shipment delivery proofs.`);

  const { count: ste } = await prisma.shipmentTrackingEvent.deleteMany({});
  console.log(`Deleted ${ste} shipment tracking events.`);

  const { count: sh } = await prisma.shipment.deleteMany({});
  console.log(`Deleted ${sh} shipments.`);

  // Order items, returns, history, and orders
  const { count: oi } = await prisma.orderItem.deleteMany({});
  console.log(`Deleted ${oi} order items.`);

  const { count: oret } = await prisma.orderReturn.deleteMany({});
  console.log(`Deleted ${oret} order returns.`);

  const { count: osh } = await prisma.orderStatusHistory.deleteMany({});
  console.log(`Deleted ${osh} order status histories.`);

  const { count: wt } = await prisma.walletTransaction.deleteMany({});
  console.log(`Deleted ${wt} wallet transactions.`);

  const { count: ic } = await prisma.influencerCommission.deleteMany({});
  console.log(`Deleted ${ic} influencer commissions.`);

  const { count: ord } = await prisma.order.deleteMany({});
  console.log(`Deleted ${ord} orders.`);

  // Leads
  const { count: la } = await prisma.leadAssignment.deleteMany({});
  console.log(`Deleted ${la} lead assignments.`);

  const { count: lsh } = await prisma.leadStatusHistory.deleteMany({});
  console.log(`Deleted ${lsh} lead status histories.`);

  const { count: cl } = await prisma.callLog.deleteMany({});
  console.log(`Deleted ${cl} call logs.`);

  const { count: ld } = await prisma.lead.deleteMany({});
  console.log(`Deleted ${ld} leads.`);

  const { count: lib } = await prisma.leadImportBatch.deleteMany({});
  console.log(`Deleted ${lib} lead import batches.`);

  // Referral links & clicks
  const { count: rlc } = await (prisma as any).referralLinkClick.deleteMany({});
  console.log(`Deleted ${rlc} referral link clicks.`);

  const { count: rllp } = await prisma.referralLinkLandingPage.deleteMany({});
  console.log(`Deleted ${rllp} referral link landing pages.`);

  const { count: rl } = await prisma.referralLink.deleteMany({});
  console.log(`Deleted ${rl} referral links.`);

  const { count: icamp } = await prisma.influencerCampaign.deleteMany({});
  console.log(`Deleted ${icamp} influencer campaigns.`);

  // Wallets
  const { count: w } = await prisma.wallet.deleteMany({});
  console.log(`Deleted ${w} wallets.`);

  // User profiles
  // Keep profile for admin users, delete all other profiles
  const { count: up } = await prisma.userProfile.deleteMany({
    where: {
      userId: {
        notIn: adminIds
      }
    }
  });
  console.log(`Deleted ${up} non-admin user profiles.`);

  // Delete all non-admin users
  const { count: u } = await prisma.user.deleteMany({
    where: {
      id: {
        notIn: adminIds
      }
    }
  });
  console.log(`Deleted ${u} non-admin user accounts.`);

  // Ensure wallets exist and are zeroed out for remaining admin users
  for (const adminId of adminIds) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: adminId }
    });
    if (!wallet) {
      await prisma.wallet.create({
        data: {
          userId: adminId,
          balanceMad: 0,
          totalEarnedMad: 0,
          totalWithdrawnMad: 0
        }
      });
      console.log(`Created new empty wallet for admin ID ${adminId}.`);
    } else {
      await prisma.wallet.update({
        where: { userId: adminId },
        data: {
          balanceMad: 0,
          totalEarnedMad: 0,
          totalWithdrawnMad: 0
        }
      });
      console.log(`Reset wallet balance to 0 for admin ID ${adminId}.`);
    }

    // Reset user totalEarnings to 0
    await prisma.user.update({
      where: { id: adminId },
      data: { totalEarnings: 0 }
    });
  }

  console.log('Database cleanup complete! Only admin accounts and static configurations are preserved.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
