import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const usersWithNotifs = await prisma.user.findMany({
    where: {
      notifications: {
        some: {}
      }
    },
    include: {
      role: true,
      _count: {
        select: { notifications: true }
      }
    }
  });
  console.log('USERS WITH NOTIFICATIONS IN DB:');
  for (const u of usersWithNotifs) {
    console.log(`- User ID: ${u.id}, Email: ${u.email}, Role: ${u.role.name}, Notification Count: ${u._count.notifications}`);
  }

  const latestNotifs = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      user: {
        select: { email: true, role: { select: { name: true } } }
      }
    }
  });
  console.log('\nLATEST 5 NOTIFICATIONS IN DB:');
  console.log(JSON.stringify(latestNotifs, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
