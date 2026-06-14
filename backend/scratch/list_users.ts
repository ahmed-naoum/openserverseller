import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    include: { role: true }
  });
  console.log(users.map(u => ({ id: u.id, email: u.email, role: u.role?.name, isActive: u.isActive })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
