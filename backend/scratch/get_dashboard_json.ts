import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const totalLeads = await prisma.lead.count();
  const unassigned = await prisma.lead.count({ where: { assignedAgentId: null } });
  const totalLeadsWithOrder = await prisma.lead.count({ where: { order: { isNot: null } } });
  console.log('Total Leads:', totalLeads);
  console.log('Unassigned Leads:', unassigned);
  console.log('Total Leads With Order:', totalLeadsWithOrder);
}
main().catch(console.error).finally(() => prisma.$disconnect());
