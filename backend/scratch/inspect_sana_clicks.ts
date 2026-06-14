import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const emails = [
    'naoum_ahmed@hotmail.fr',
    'sana12abarra@gmail.com',
    'naoum00007@gmail.com',
    'noussaiba@gmail.com',
    'abderrahimchaib@gmail.com'
  ];

  for (const email of emails) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { wallet: true, role: true }
    });
    if (!user) { console.log(`${email}: NOT FOUND`); continue; }

    // Wallet
    const wallet = user.wallet;

    // Referral Links
    const links = await prisma.referralLink.findMany({
      where: { influencerId: user.id }
    });
    const activeLinks = links.filter(l => l.isActive).length;

    // Clicks (total views & unique visitors)
    const clicks = await (prisma as any).referralLinkClick.findMany({
      where: { referralLinkId: { in: links.map(l => l.id) } },
      select: { ipAddress: true, userAgent: true, referralLinkId: true }
    });
    const totalViews = clicks.length;
    const uniqueSet = new Set();
    clicks.forEach((c: any) => uniqueSet.add(`${c.ipAddress}-${c.userAgent || 'unknown'}`));
    const uniqueVisitors = uniqueSet.size;

    // WhatsApp clicks
    const totalWhatsappClicks = links.reduce((sum, l) => sum + (l.whatsappClicks || 0), 0);

    // Leads
    const leads = await prisma.lead.findMany({
      where: { referralLink: { influencerId: user.id } },
      include: { order: true }
    });
    const totalLeads = leads.length;

    // Confirmed (have an order)
    const confirmedLeads = leads.filter(l => l.order).length;

    // Delivered
    const deliveredLeads = leads.filter(l => l.status === 'DELIVERED').length;

    // Commissions
    const commissions = await prisma.influencerCommission.findMany({
      where: { influencerId: user.id }
    });
    const totalEarned = commissions.reduce((sum, c) => sum + Number(c.amount), 0);

    // Payout requests
    const payouts = await prisma.payoutRequest.findMany({
      where: { vendorId: user.id }
    });
    const totalWithdrawn = payouts
      .filter(p => p.status === 'COMPLETED' || p.status === 'APPROVED')
      .reduce((sum, p) => sum + Number(p.amountMad), 0);

    console.log(`\n=== ${email} ===`);
    console.log(`Role: ${user.role.name}`);
    console.log(`Links: ${links.length} total, ${activeLinks} active`);
    console.log(`Views: ${totalViews} total, ${uniqueVisitors} unique`);
    console.log(`WhatsApp clicks: ${totalWhatsappClicks}`);
    console.log(`Leads: ${totalLeads}, Confirmed: ${confirmedLeads}, Delivered: ${deliveredLeads}`);
    console.log(`Wallet balance: ${wallet?.balanceMad ?? 'NO WALLET'}`);
    console.log(`Total earned (commissions): ${totalEarned}`);
    console.log(`Total withdrawn: ${totalWithdrawn}`);
    console.log(`Wallet totalEarned: ${wallet?.totalEarnedMad ?? 'N/A'}, totalWithdrawn: ${wallet?.totalWithdrawnMad ?? 'N/A'}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
