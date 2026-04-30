import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.lead.findMany({
    include: { referralLink: true }
  });
  console.log('Total Leads:', leads.length);
  console.log('Leads with ReferralLink:', leads.filter(l => l.referralLinkId).length);
  const commissions = await prisma.influencerCommission.findMany();
  console.log('Total Commissions:', commissions.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
