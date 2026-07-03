import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const log = await (prisma as any).webhookLog.findUnique({
    where: { id: 49 }
  });
  console.log(JSON.stringify(log, null, 2));
  await prisma.$disconnect();
}

run();
