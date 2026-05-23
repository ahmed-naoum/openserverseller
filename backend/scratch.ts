import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const link = await prisma.referralLink.findFirst({
    where: { code: '5B925201' } // Code from screenshot
  });
  console.log("Link:", link);
  if (!link) return;

  const whereBase = { influencerId: link.influencerId, id: link.id };
  const dateLimitStart = new Date(link.createdAt);
  dateLimitStart.setHours(0,0,0,0);
  const dateLimitEnd = new Date();
  
  const leads = await prisma.lead.findMany({
    where: {
      referralLink: whereBase,
      createdAt: { gte: dateLimitStart, lte: dateLimitEnd }
    }
  });
  console.log("Leads (gte limit):", leads.length);
  
  const allLeads = await prisma.lead.findMany({
    where: { referralLink: whereBase }
  });
  console.log("All Leads:", allLeads.length);
  
  const clicks = await (prisma as any).referralLinkClick.findMany({
    where: { referralLink: whereBase, createdAt: { gte: dateLimitStart, lte: dateLimitEnd } }
  });
  console.log("Clicks (gte limit):", clicks.length);

  const allClicks = await (prisma as any).referralLinkClick.findMany({
    where: { referralLink: whereBase }
  });
  console.log("All Clicks:", allClicks.length);
}

run().catch(console.error).finally(() => prisma.$disconnect());
