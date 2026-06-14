import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const leads = await prisma.lead.findMany({
    include: {
      vendor: { select: { email: true, role: { select: { name: true } } } },
      order: { select: { status: true } }
    }
  });
  console.log(`Total Leads in DB: ${leads.length}`);
  const group: Record<string, { total: number; confirmed: number; statusList: Record<string, number> }> = {};
  for (const lead of leads) {
    const email = lead.vendor?.email || 'no-vendor';
    if (!group[email]) {
      group[email] = { total: 0, confirmed: 0, statusList: {} };
    }
    group[email].total++;
    const status = lead.status === 'NEW' ? 'LEAD' : lead.status;
    group[email].statusList[status] = (group[email].statusList[status] || 0) + 1;
    if (lead.order) {
      group[email].confirmed++;
    }
  }
  console.log(JSON.stringify(group, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
