import { prisma } from './lib/prisma.js';

async function main() {
  const allLeads = await prisma.lead.findMany({
    include: { referralLink: { include: { product: true } } }
  });
  console.log(`Total Leads: ${allLeads.length}`);
  for (const l of allLeads) {
    console.log(`Lead ID: ${l.id}, Name: ${l.fullName}, Phone: ${l.phone}, Status: ${l.status}, VendorId: ${l.vendorId}`);
  }
}

main().catch(console.error);
