/**
 * Smoke test for the /leads/available changes: ascending order, the 20-row
 * default, and the date/time window. Run with the dev server up.
 */
import jwt from 'jsonwebtoken';
import { prisma } from '../src/lib/prisma.js';

const API = 'http://localhost:3001/api/v1';
let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  ok ? pass++ : fail++;
};

const get = async (qs: string, token: string) => {
  const res = await fetch(`${API}/leads/available${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body: any = await res.json().catch(() => null);
  return { status: res.status, leads: body?.data?.leads || [], total: body?.data?.totalAvailable };
};

(async () => {
  const agent = await prisma.user.findFirst({
    where: { role: { name: 'CALL_CENTER_AGENT' }, isActive: true },
    select: { id: true, uuid: true, email: true },
  });
  if (!agent) throw new Error('no active CALL_CENTER_AGENT to test with');
  const token = jwt.sign({ userId: agent.uuid }, process.env.JWT_SECRET!, { expiresIn: '1h' });
  console.log(`agent: #${agent.id} ${agent.email}\n`);

  const all = await get('?limit=max', token);
  check('available leads load', all.status === 200, `HTTP ${all.status}, ${all.leads.length} rows`);
  if (!all.leads.length) {
    console.log('\nno available leads in this database — ordering/window assertions skipped');
    await prisma.$disconnect();
    process.exit(0);
  }

  const times = all.leads.map((l: any) => new Date(l.createdAt).getTime());
  const ascending = times.every((t: number, i: number) => i === 0 || times[i - 1] <= t);
  check('oldest first', ascending,
    `first=${all.leads[0].createdAt} last=${all.leads[all.leads.length - 1].createdAt}`);

  // The row limit must take the OLDEST N, i.e. the head of the same list.
  const twenty = await get('?limit=20', token);
  check('limit=20 returns at most 20', twenty.leads.length <= 20, `${twenty.leads.length} rows`);
  check('limit=20 takes the oldest, not the newest',
    twenty.leads[0]?.id === all.leads[0]?.id,
    `limited-first=${twenty.leads[0]?.id} all-first=${all.leads[0]?.id}`);
  check('total still reports the whole pool', (twenty.total ?? 0) === (all.total ?? -1),
    `limited-total=${twenty.total} all-total=${all.total}`);

  // Date window: everything strictly before the oldest lead should be empty,
  // and a window ending at the oldest lead should contain it.
  const oldest = new Date(all.leads[0].createdAt);
  const before = new Date(oldest.getTime() - 60_000).toISOString();
  const wayBefore = new Date(oldest.getTime() - 120_000).toISOString();

  const emptyWindow = await get(`?limit=max&dateTo=${encodeURIComponent(wayBefore)}`, token);
  check('dateTo before every lead returns nothing', emptyWindow.leads.length === 0,
    `${emptyWindow.leads.length} rows`);

  const fromWindow = await get(`?limit=max&dateFrom=${encodeURIComponent(before)}`, token);
  check('dateFrom before every lead returns them all', fromWindow.leads.length === all.leads.length,
    `${fromWindow.leads.length} of ${all.leads.length}`);

  const newest = new Date(all.leads[all.leads.length - 1].createdAt);
  const afterNewest = new Date(newest.getTime() + 60_000).toISOString();
  const noneAfter = await get(`?limit=max&dateFrom=${encodeURIComponent(afterNewest)}`, token);
  check('dateFrom after every lead returns nothing', noneAfter.leads.length === 0,
    `${noneAfter.leads.length} rows`);

  // A bare date on dateTo must cover the whole day, not midnight.
  const oldestDay = oldest.toISOString().slice(0, 10);
  const wholeDay = await get(`?limit=max&dateTo=${oldestDay}`, token);
  const sameDayCount = all.leads.filter(
    (l: any) => new Date(l.createdAt).toISOString().slice(0, 10) <= oldestDay,
  ).length;
  check('a bare dateTo covers the whole day', wholeDay.leads.length >= sameDayCount,
    `${wholeDay.leads.length} rows, expected at least ${sameDayCount}`);

  await prisma.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
