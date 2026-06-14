import { prisma } from './lib/prisma.js';


async function main() {
  const usersWithLeads = await prisma.user.findMany({
    where: { id: { in: [1, 5, 10, 19, 21, 22] } },
    select: {
      id: true,
      email: true,
      role: { select: { name: true } }
    }
  });

  const roles = await prisma.role.findMany({
    include: {
      _count: {
        select: { users: true }
      }
    }
  });

  console.log('--- USER ROLES WITH LEADS ---');
  console.log(usersWithLeads);
  console.log('\n--- ALL ROLES ---');
  console.log(roles);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
