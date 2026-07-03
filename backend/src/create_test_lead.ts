import { prisma } from './lib/prisma.js';

async function main() {
  const vendorId = 55; // influencer@silacod.com
  const productId = 1; // pr test

  // 1. Ensure referral link exists
  let refLink = await prisma.referralLink.findFirst({
    where: { influencerId: vendorId, productId: productId }
  });

  if (!refLink) {
    refLink = await prisma.referralLink.create({
      data: {
        influencerId: vendorId,
        productId: productId,
        code: `test-code-${Date.now().toString(36)}`,
        isActive: true,
      }
    });
    console.log('Created referral link:', refLink.id);
  } else {
    console.log('Referral link already exists:', refLink.id);
  }

  // 2. Create lead in CONFIRMED status
  const lead = await prisma.lead.create({
    data: {
      vendorId: vendorId,
      referralLinkId: refLink.id,
      fullName: 'John Doe Test',
      phone: '0612345678',
      whatsapp: '0612345678',
      city: 'Casablanca',
      address: 'Test address 1234567890',
      status: 'CONFIRMED',
      productVariant: 'Standard Option',
    }
  });

  console.log('Created test lead:', lead.id);
}

main().catch(console.error);
