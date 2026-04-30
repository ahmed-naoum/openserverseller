const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.wallet.findMany().then(console.log).finally(() => p.$disconnect());
