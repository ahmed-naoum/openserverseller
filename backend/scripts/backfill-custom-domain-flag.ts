/**
 * Backfill: open custom domains to every existing account.
 *
 * Changing a column's DEFAULT only affects rows inserted afterwards, so every
 * account that existed when the flag defaulted to false is still false and would
 * see no tab. This flips them, and reports the result.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.user.count({ where: { customDomainEnabled: false } });
  const result = await prisma.user.updateMany({
    where: { customDomainEnabled: false },
    data: { customDomainEnabled: true },
  });
  const after = await prisma.user.count({ where: { customDomainEnabled: false } });
  const total = await prisma.user.count();

  console.log(`accounts with the feature off before : ${before}`);
  console.log(`rows updated                         : ${result.count}`);
  console.log(`accounts with the feature off after  : ${after}`);
  console.log(`total accounts                       : ${total}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
