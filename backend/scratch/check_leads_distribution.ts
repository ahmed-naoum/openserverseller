import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const leads = await prisma.lead.findMany({
    include: { vendor: { include: { role: true } } }
  });
  const distribution: Record<string, number> = {};
  leads.forEach(l => {
    const roleName = l.vendor?.role?.name || 'NO_ROLE';
    distribution[roleName] = (distribution[roleName] || 0) + 1;
  });
  console.log('Leads count distribution by vendor role:', distribution);
}
main().catch(console.error).finally(() => prisma.$disconnect());
