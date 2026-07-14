const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const leads = await prisma.lead.findMany();
  console.log('Total Leads in DB:', leads.length);
  const links = await prisma.referralLink.findMany();
  console.log('Total Links in DB:', links.length);
  for (const link of links) {
    if (link.conversions > 0) {
      const linkLeads = await prisma.lead.count({ where: { referralLinkId: link.id } });
      console.log(`Link ${link.id} (Code: ${link.code}): DB Conversions=${link.conversions}, Actual Leads=${linkLeads}`);
    }
  }
}
main().finally(() => prisma.$disconnect());
