import { prisma } from './lib/prisma.js';
import bcrypt from 'bcryptjs';

async function main() {
  const helper = await prisma.user.findFirst({
    where: { email: 'helper@silacod.ma' }
  });

  if (!helper) {
    console.error('Helper user not found');
    return;
  }

  const hashedPassword = await bcrypt.hash('password123', 10);
  await prisma.user.update({
    where: { id: helper.id },
    data: { password: hashedPassword, isActive: true }
  });

  console.log('Successfully set password to password123 for helper@silacod.ma');
}

main().catch(console.error);
