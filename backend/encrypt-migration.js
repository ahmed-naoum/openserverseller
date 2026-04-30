const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);

function encrypt(text) {
  if (!text || text.startsWith('ENC:')) return text;
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return 'ENC:' + iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (err) {
    return text;
  }
}

async function migrate() {
  console.log('Migrating UserBankAccount...');
  const accounts = await prisma.userBankAccount.findMany();
  for (const acc of accounts) {
    if (!acc.ribAccount.startsWith('ENC:')) {
      await prisma.userBankAccount.update({
        where: { id: acc.id },
        data: { ribAccount: encrypt(acc.ribAccount) }
      });
      console.log(`Encrypted RIB for account ${acc.id}`);
    }
  }

  console.log('Migrating PayoutRequest...');
  const payouts = await prisma.payoutRequest.findMany();
  for (const payout of payouts) {
    if (!payout.ribAccount.startsWith('ENC:')) {
      await prisma.payoutRequest.update({
        where: { id: payout.id },
        data: { ribAccount: encrypt(payout.ribAccount) }
      });
      console.log(`Encrypted RIB for payout ${payout.id}`);
    }
  }

  console.log('Done!');
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
