import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('Naoum007.@@', 12);
  
  // Find role ID for INFLUENCER
  const role = await prisma.role.findFirst({
    where: { name: 'INFLUENCER' }
  });
  if (!role) {
    throw new Error('INFLUENCER role not found');
  }

  // Find or create influencer user
  const user = await prisma.user.upsert({
    where: { email: 'naoum00007@silacod.ma' },
    update: {
      isActive: true,
      password: hashedPassword,
      isInfluencer: true,
      kycStatus: 'APPROVED'
    },
    create: {
      email: 'naoum00007@silacod.ma',
      phone: '+212600000009',
      password: hashedPassword,
      roleId: role.id,
      isActive: true,
      isInfluencer: true,
      kycStatus: 'APPROVED',
      emailVerifiedAt: new Date(),
    }
  });

  // Ensure user has profile
  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {
      fullName: 'Ali Influencer',
      instagramUsername: 'ali_influencer',
      facebookUsername: 'ali_fb',
      tiktokUsername: 'ali_tiktok',
      youtubeUsername: 'ali_yt'
    },
    create: {
      userId: user.id,
      fullName: 'Ali Influencer',
      instagramUsername: 'ali_influencer',
      facebookUsername: 'ali_fb',
      tiktokUsername: 'ali_tiktok',
      youtubeUsername: 'ali_yt'
    }
  });

  // Let's get an active product in the system to claim
  const product = await prisma.product.findFirst({
    where: { isActive: true }
  });

  if (product) {
    console.log(`Found active product: ${product.nameFr} (ID: ${product.id})`);
    // Create an APPROVED claim for this product
    const claim = await prisma.affiliateClaim.upsert({
      where: { userId_productId: { userId: user.id, productId: product.id } },
      update: { status: 'APPROVED' },
      create: {
        userId: user.id,
        productId: product.id,
        status: 'APPROVED'
      }
    });
    console.log(`Ensured APPROVED claim for product ID: ${product.id}`);
  } else {
    console.log('No active products found to claim.');
  }

  console.log('Test influencer user influencer@silacod.com is ready!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
