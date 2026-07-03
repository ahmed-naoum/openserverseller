import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const link = await prisma.referralLink.findUnique({
    where: { code: 'hhbnhjun' },
    include: {
      product: true,
      influencer: true
    }
  });
  console.log("Link data:", JSON.stringify({
    code: link?.code,
    isActive: link?.isActive,
    status: link?.status,
    productName: link?.product?.nameFr || link?.product?.nameEn,
    productActive: link?.product?.isActive,
    influencerSubdomain: link?.influencer?.subdomain
  }, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
