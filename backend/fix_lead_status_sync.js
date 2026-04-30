const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const orders = await p.order.findMany({
    where: { leadId: { not: null } },
    select: { id: true, status: true, leadId: true, lead: { select: { id: true, status: true } } }
  });

  const mismatched = orders.filter(o => o.lead && o.status !== o.lead.status);
  console.log('Mismatched:', mismatched.length);

  for (const o of mismatched) {
    console.log(`Order #${o.id}: order=${o.status}, lead=${o.lead.status}`);
    await p.lead.update({ where: { id: o.leadId }, data: { status: o.status } });
  }

  console.log('Fixed', mismatched.length, 'leads');
  await p.$disconnect();
})();
