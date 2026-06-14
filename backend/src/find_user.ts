import { prisma } from './lib/prisma.js';


async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'yous' } },
        { email: { contains: 'contact' } },
        { email: { contains: 'gmail' } },
      ]
    },
    select: {
      id: true,
      email: true,
      phone: true,
      isActive: true,
      role: {
        select: {
          name: true
        }
      }
    }
  });
  console.log('USERS FOUND MATCHING SEARCH:', JSON.stringify(users, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
