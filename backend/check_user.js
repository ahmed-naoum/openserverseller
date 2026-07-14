const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const link = await prisma.referralLink.findUnique({ where: { id: 48 }, include: { influencer: true } });
  console.log('Link 48 Influencer ID:', link.influencerId, 'Influencer Email:', link.influencer?.email);
  const user = await prisma.user.findFirst({ where: { email: 'naoum00007@gmail.com' } });
  console.log('User naoum00007@gmail.com ID:', user?.id);
}
main().finally(() => prisma.$disconnect());
