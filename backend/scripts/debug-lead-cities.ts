import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const leads = await prisma.lead.findMany({
    select: { city: true }
  });
  
  const uniqueLeadCities = [...new Set(leads.map(c => c.city))];
  console.log('Unique Cities in Leads:');
  console.log(uniqueLeadCities);
  
  process.exit(0);
}

check();
