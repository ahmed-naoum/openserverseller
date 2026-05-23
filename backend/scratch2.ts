import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const isHourly = false;
  const getKey = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const link = await prisma.referralLink.findFirst({
    where: { code: '5B925201' }
  });
  if (!link) return;

  const whereBase = { influencerId: link.influencerId, id: link.id };
  const dateLimitStart = new Date(link.createdAt);
  dateLimitStart.setHours(0,0,0,0);
  const dateLimitEnd = new Date();
  
  const leads = await prisma.lead.findMany({
    where: { referralLink: whereBase, createdAt: { gte: dateLimitStart, lte: dateLimitEnd } }
  });
  
  const clicks = await (prisma as any).referralLinkClick.findMany({
    where: { referralLink: whereBase, createdAt: { gte: dateLimitStart, lte: dateLimitEnd } }
  });

  const clicksByDate: Record<string, Set<string>> = {};
  clicks.forEach((c: any) => {
    const key = getKey(c.createdAt);
    if (!clicksByDate[key]) clicksByDate[key] = new Set();
    clicksByDate[key].add(`${c.ipAddress}-${c.userAgent || 'unknown'}`);
  });

  const uniqueClicksByDate: Record<string, number> = {};
  Object.keys(clicksByDate).forEach(key => {
    uniqueClicksByDate[key] = clicksByDate[key].size;
  });

  const salesByDate: Record<string, number> = {};
  leads.forEach(l => {
    const key = getKey(l.createdAt);
    salesByDate[key] = (salesByDate[key] || 0) + 1;
  });

  console.log("salesByDate", salesByDate);
  console.log("uniqueClicksByDate", uniqueClicksByDate);

  const stats: any[] = [];
  const currentDate = new Date(dateLimitStart);
  console.log("dateLimitStart", dateLimitStart);
  console.log("dateLimitEnd", dateLimitEnd);
  
  while (currentDate <= dateLimitEnd) {
    const key = getKey(currentDate);
    stats.push({
      date: new Date(currentDate),
      key,
      views: uniqueClicksByDate[key] || 0,
      sales: salesByDate[key] || 0,
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  console.log("Stats array:", stats);
}

run().catch(console.error).finally(() => prisma.$disconnect());
