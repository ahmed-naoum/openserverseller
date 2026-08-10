/**
 * Round-trips the new rate through the admin-edit endpoint the Users modal
 * calls, then restores the original value. Run with the dev server up.
 */
import jwt from 'jsonwebtoken';
import { prisma } from '../src/lib/prisma.js';

const API = 'http://localhost:3001/api/v1';

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: { name: 'SUPER_ADMIN' } },
    select: { uuid: true, email: true },
  });
  const agent = await prisma.user.findFirst({
    where: { role: { name: 'CALL_CENTER_AGENT' } },
    select: { uuid: true, email: true, netProfitPerDeliveredParcelMad: true },
  });
  if (!admin || !agent) throw new Error('need a SUPER_ADMIN and a CALL_CENTER_AGENT');

  const original = agent.netProfitPerDeliveredParcelMad;
  const token = jwt.sign({ userId: admin.uuid }, process.env.JWT_SECRET!, { expiresIn: '10m' });

  const save = async (value: number) => {
    const res = await fetch(`${API}/users/${agent.uuid}/admin-edit`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ netProfitPerDeliveredParcelMad: value }),
    });
    const row = await prisma.user.findUnique({
      where: { uuid: agent.uuid },
      select: { netProfitPerDeliveredParcelMad: true },
    });
    return { status: res.status, stored: row?.netProfitPerDeliveredParcelMad };
  };

  const written = await save(12.5);
  console.log(
    `${written.status === 200 && written.stored === 12.5 ? 'PASS' : 'FAIL'}  ` +
      `PATCH admin-edit 12.5 → stored ${written.stored} (status ${written.status})`
  );

  // The modal reads the value back through GET /users/:uuid.
  const get = await fetch(`${API}/users/${agent.uuid}`, { headers: { Authorization: `Bearer ${token}` } });
  const body: any = await get.json().catch(() => null);
  const readBack = body?.data?.user?.netProfitPerDeliveredParcelMad;
  console.log(`${readBack === 12.5 ? 'PASS' : 'FAIL'}  GET /users/:uuid returns ${readBack}`);

  const restored = await save(original);
  console.log(
    `${restored.stored === original ? 'PASS' : 'FAIL'}  restored to ${restored.stored} (was ${original})`
  );

  await prisma.$disconnect();
}

main().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
