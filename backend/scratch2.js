const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.payoutRequest.findMany().then(console.log).finally(() => p.$disconnect());
