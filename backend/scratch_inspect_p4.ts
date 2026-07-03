import { prisma } from './src/lib/prisma.js';

async function check() {
  try {
    const influencers = await (prisma as any).user.findMany({
      where: { role: { name: 'INFLUENCER' } },
      select: {
        id: true,
        email: true,
        subdomain: true,
        profile: { select: { fullName: true } }
      }
    });
    console.log('Influencers in database:');
    console.log(JSON.stringify(influencers, null, 2));

    const links = await (prisma as any).referralLink.findMany({
      select: {
        id: true,
        code: true,
        influencerId: true,
        influencer: {
          select: {
            id: true,
            subdomain: true
          }
        }
      }
    });
    console.log('Referral Links in database:');
    console.log(JSON.stringify(links, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
