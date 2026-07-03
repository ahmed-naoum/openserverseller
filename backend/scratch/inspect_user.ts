import { prisma } from '../src/lib/prisma.js';

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: '123yassine.chaib@gmail.com' },
    include: {
      profile: true,
      bankAccounts: true,
      role: true,
    }
  });
  console.log('User 71 Details:');
  console.log(JSON.stringify(user, null, 2));
}

main().catch(console.error);
