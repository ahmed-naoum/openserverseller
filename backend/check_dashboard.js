const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const userId = 63;
  const dateLimitStart = undefined;
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
        },
        select: {
          status: true,
          order: {
            select: {
              status: true
            }
          }
        }
      });
  console.log('Leads fetched for dashboard:', leads.length);
}
main().finally(() => prisma.$disconnect());
