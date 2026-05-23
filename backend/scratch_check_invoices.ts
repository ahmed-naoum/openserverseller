import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { role: 'INFLUENCER' },
    select: { id: true, fullName: true, email: true }
  });
  console.log('Influencers:', JSON.stringify(users, null, 2));

  for (const user of users) {
    const invoices = await prisma.invoice.findMany({
      where: { userId: user.id },
      select: { totalAmountMad: true, invoiceNumber: true }
    });
    const total = invoices.reduce((sum, inv) => sum + inv.totalAmountMad, 0);
    console.log(`User ${user.fullName} (ID: ${user.id}) total invoices sum: ${total}`);
  }
}

main();
