const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const userId = 63;
  const numDays = 7;
  const dateLimitStart = new Date();
  dateLimitStart.setDate(dateLimitStart.getDate() - (numDays - 1));
  dateLimitStart.setHours(0, 0, 0, 0);
  const dateLimitEnd = new Date();
  
  const leads = await prisma.lead.findMany({
        where: {
          referralLink: {
            influencerId: userId
          },
          createdAt: dateLimitStart || dateLimitEnd ? {
            ...(dateLimitStart ? { gte: dateLimitStart } : {}),
            ...(dateLimitEnd ? { lte: dateLimitEnd } : {})
          } : undefined
        }
      });
  console.log('Leads fetched for 7 days:', leads.length);
}
main().finally(() => prisma.$disconnect());
