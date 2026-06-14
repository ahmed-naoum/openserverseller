import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function runTest() {
  console.log('🧪 Running automated backend validation for custom links...');

  // Get test influencer
  const influencer = await prisma.user.findFirst({
    where: { email: 'influencer@silacod.com' }
  });

  if (!influencer) {
    console.error('❌ Test influencer not found.');
    return;
  }

  const userId = influencer.id;
  const productId = 1; // approved product in ensure_influencer.ts

  // Clean up any existing referral links for this test
  await prisma.referralLink.deleteMany({
    where: { influencerId: userId }
  });
  console.log('🧹 Cleaned up existing referral links for test influencer.');

  // Test 1: Check check-unique endpoint logic
  const checkUnique = async (name: string) => {
    const exists = await prisma.referralLink.findUnique({
      where: { code: name }
    });
    return !exists;
  };

  console.log('Test 1: Check-unique logic initially:', await checkUnique('test-custom-code') ? '✅ Unique' : '❌ Taken');

  // Test 2: Create a link with a custom name
  const createLink = async (customName: string) => {
    try {
      const linkCount = await prisma.referralLink.count({
        where: { influencerId: userId, productId }
      });
      if (linkCount >= 5) {
        throw new Error('Vous ne pouvez pas créer plus de 5 liens pour ce produit.');
      }

      const nameStr = customName.trim();
      if (nameStr.length < 3 || nameStr.length > 20) {
        throw new Error('Le nom personnalisé doit contenir entre 3 et 20 caractères.');
      }
      const nameRegex = /^[a-zA-Z0-9-_]+$/;
      if (!nameRegex.test(nameStr)) {
        throw new Error('Le nom personnalisé ne peut contenir que des lettres, chiffres, tirets (-) et underscores (_).');
      }

      const existingCode = await prisma.referralLink.findUnique({
        where: { code: nameStr }
      });
      if (existingCode) {
        throw new Error('Ce nom de lien est déjà utilisé.');
      }

      const link = await prisma.referralLink.create({
        data: {
          influencerId: userId,
          productId,
          code: nameStr,
          isActive: true,
          status: 'ACTIVE'
        }
      });
      console.log(`✅ Link created successfully: ${link.code}`);
      return link;
    } catch (e: any) {
      console.log(`❌ Link creation failed: ${e.message}`);
      return null;
    }
  };

  // Create 1st link: promo-one
  await createLink('promo-one');
  
  // Test check-unique logic after creation
  console.log('Check-unique logic for "promo-one" (should be taken):', await checkUnique('promo-one') ? '❌ Unique' : '✅ Taken');

  // Create 2nd link: promo-two
  await createLink('promo-two');

  // Create 3rd link: promo-three
  await createLink('promo-three');

  // Create 4th link: promo-four
  await createLink('promo-four');

  // Create 5th link: promo-five
  await createLink('promo-five');

  // Attempt to create 6th link: promo-six (should fail due to 5 links limit!)
  console.log('Attempting to create 6th link...');
  await createLink('promo-six');

  // Test name validation < 3 chars
  console.log('Attempting to create link with 2 characters...');
  await createLink('ab');

  // Test name validation > 20 chars
  console.log('Attempting to create link with > 20 characters...');
  await createLink('a-very-long-link-name-that-exceeds-twenty-characters');

  // Test name validation with invalid characters
  console.log('Attempting to create link with invalid characters...');
  await createLink('promo ali');

  // Verify total links created
  const totalCreated = await prisma.referralLink.count({
    where: { influencerId: userId, productId }
  });
  console.log(`📊 Total links created in DB: ${totalCreated} (expected: 5)`);
}

runTest().catch(console.error).finally(() => prisma.$disconnect());
