const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      profile: true
    }
  });

  users.forEach(u => {
    if (u.profile && u.profile.fullName && u.profile.fullName.toUpperCase().includes('ASDASD')) {
      console.log(`MATCH: ID: ${u.id}, Email: ${u.email}, FullName: ${u.profile.fullName}`);
    }
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
