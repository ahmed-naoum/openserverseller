const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$executeRawUnsafe('ALTER TABLE payout_requests RENAME COLUMN "userId" TO "vendorId"')
  .then(() => console.log('Renamed'))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
