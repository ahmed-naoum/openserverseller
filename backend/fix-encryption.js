const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();
const ALGORITHM = 'aes-256-cbc';
require('dotenv').config();
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  console.error('ENCRYPTION_KEY must be set in .env and be exactly 32 characters.');
  process.exit(1);
}

function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return 'ENC:' + iv.toString('hex') + ':' + encrypted.toString('hex');
}

async function fix() {
  console.log('Fixing UserBankAccount...');
  
  const mapping = {
    1: '011780000012345678901234',
    2: '123123123101231231231234',
    3: '123123123101231231231234',
    4: '123123123101231231231234',
    5: '111111111111111111111111',
    6: '123123123101231231231234',
    7: '999999999999999999999999',
    8: '123123123101231231231234',
    9: '123123123101231231231234',
    10: '011780000012345678901234',
    11: '123123123101231231231234'
  };

  for (const [id, rib] of Object.entries(mapping)) {
    await prisma.userBankAccount.update({
      where: { id: parseInt(id) },
      data: { ribAccount: encrypt(rib) }
    });
  }

  console.log('Fixing PayoutRequest...');
  const payouts = await prisma.payoutRequest.findMany();
  for (const p of payouts) {
     // Most likely the same test RIB
     await prisma.payoutRequest.update({
       where: { id: p.id },
       data: { ribAccount: encrypt('123123123101231231231234') }
     });
  }

  console.log('Done!');
}

fix().catch(console.error).finally(() => prisma.$disconnect());
