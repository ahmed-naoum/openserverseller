const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const leads = await prisma.lead.findMany({ where: { referralLinkId: 48 } });
  console.log(leads.map(l => l.createdAt));
}
main().finally(() => prisma.$disconnect());
