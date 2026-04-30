import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function inspectLeads() {
  console.log('--- INSPECTING LAST 10 LEADS ---');
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      referralLink: {
        include: { product: true }
      }
    }
  });

  leads.forEach(l => {
    console.log(`ID: ${l.id} | Name: ${l.fullName} | Variant: ${l.productVariant} | Notes: ${l.notes}`);
  });

  process.exit(0);
}

inspectLeads();
