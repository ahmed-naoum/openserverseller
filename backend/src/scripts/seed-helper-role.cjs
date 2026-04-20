const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const role = await p.role.upsert({
    where: { name: 'HELPER' },
    update: {},
    create: { name: 'HELPER', guardName: 'web' },
  });
  console.log('HELPER role seeded, id:', role.id);
}

main().catch(console.error).finally(() => p.$disconnect());
