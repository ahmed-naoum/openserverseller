import { prisma } from './lib/prisma.js';

async function main() {
  console.log('--- Roles ---');
  const roles = await prisma.role.findMany();
  console.log(roles);

  console.log('--- Users with Roles ---');
  const users = await prisma.user.findMany({
    include: { role: true, profile: true },
  });
  for (const u of users) {
    console.log(`ID: ${u.id}, Email: ${u.email}, Role: ${u.role.name}, canManageLeads: ${u.canManageLeads}`);
  }

  console.log('--- Helper User Assignments ---');
  const helperAssignments = await (prisma as any).helperUserAssignment.findMany({
    include: {
      helper: { include: { profile: true } },
      targetUser: { include: { profile: true } },
    }
  });
  console.log(helperAssignments.map((a: any) => ({
    helperId: a.helperId,
    helperEmail: a.helper.email,
    targetUserId: a.targetUserId,
    targetUserEmail: a.targetUser.email,
  })));

  console.log('--- Leads with ORDERED/CONFIRMED status ---');
  const leads = await prisma.lead.findMany({
    where: { status: { in: ['ORDERED', 'CONFIRMED', 'PUSHED_TO_DELIVERY'] } },
    include: { referralLink: { include: { product: true } }, order: true }
  });
  for (const l of leads) {
    console.log(`Lead ID: ${l.id}, Name: ${l.fullName}, Status: ${l.status}, ColiatyCode: ${l.order?.coliatyPackageCode}, RefLinkProductId: ${l.referralLink?.productId}, Product: ${l.referralLink?.product?.nameFr}`);
  }
}

main().catch(console.error);
