import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Please specify an email address.');
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email },
    select: { emailOtp: true }
  });

  if (user) {
    console.log(`OTP:${user.emailOtp}`);
  } else {
    console.log('USER_NOT_FOUND');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
