import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.activityLog.count();
  console.log('Log count:', count);
  if (count > 0) {
    const logs = await prisma.activityLog.findMany({ 
      take: 5, 
      orderBy: { createdAt: 'desc' },
      include: { user: { include: { profile: true } } }
    });
    console.log('Last 5 logs:', JSON.stringify(logs, null, 2));
  }
}
main().finally(() => prisma.$disconnect());
