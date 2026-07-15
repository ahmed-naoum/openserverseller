import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [
          'dimaruby1@gmail.com',
          '123yassine.chaib@gmail.com',
          'naoum00007@gmail.com'
        ]
      }
    },
    include: {
      bankAccounts: true,
      role: true
    }
  });
  console.log('TARGET USERS DATA:', JSON.stringify(users, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
