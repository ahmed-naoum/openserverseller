/**
 * Smoke test for the agent dashboard's period filter. Covers the four endpoints
 * the dashboard reads, the `datetime-local` input format, and the livraison
 * stats scope. Run with the dev server up.
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

let token = '';
const get = async (path: string, params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API}${path}${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body: any = await res.json().catch(() => null);
  return { status: res.status, body };
};

/** Local wall-clock `YYYY-MM-DDTHH:mm` — exactly what a datetime-local emits. */
const local = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);
const sum = (o: Record<string, number> = {}) => Object.values(o).reduce((a, b) => a + b, 0);

(async () => {
  const agent = await prisma.user.findFirst({
    where: { role: { name: 'CALL_CENTER_AGENT' }, isActive: true },
    select: { id: true, uuid: true, email: true },
  });
  if (!agent) throw new Error('no active CALL_CENTER_AGENT to test with');
  token = jwt.sign({ userId: agent.uuid }, process.env.JWT_SECRET!, { expiresIn: '1h' });
  console.log(`agent: #${agent.id} ${agent.email}\n`);

  // Windows the dashboard can actually produce. `wide` must be a no-op, `empty`
  // must zero everything, and both are given to the minute.
  const wide = { dateFrom: local(daysFromNow(-3650)), dateTo: local(daysFromNow(1)) };
  const empty = { dateTo: local(daysFromNow(-3650)) };

  // --- Phase 1: /leads?withStats ------------------------------------------
  console.log('— Phase 1: /leads (withStats)');
  const base = await get('/leads', { withStats: 'true', limit: '1' });
  check('baseline loads', base.status === 200, `HTTP ${base.status}`);
  const baseByStatus = base.body?.data?.stats?.byStatus || {};

  // The regression this whole change turns on: the old handler built
  // `new Date(\`${dateFrom}T00:00:00.000Z\`)`, so a value carrying a time became
  // "...T14:30T00:00:00.000Z" — an Invalid Date, and a 500 from Prisma.
  const dtLeads = await get('/leads', { withStats: 'true', limit: '1', ...wide });
  check('accepts a datetime-local value', dtLeads.status === 200, `HTTP ${dtLeads.status}`);
  check('a wide window matches the unfiltered stats',
    JSON.stringify(dtLeads.body?.data?.stats?.byStatus) === JSON.stringify(baseByStatus),
    `${sum(dtLeads.body?.data?.stats?.byStatus)} vs ${sum(baseByStatus)}`);

  const emptyLeads = await get('/leads', { withStats: 'true', limit: '1', ...empty });
  check('an empty window zeroes Phase 1', sum(emptyLeads.body?.data?.stats?.byStatus) === 0,
    `${sum(emptyLeads.body?.data?.stats?.byStatus)} leads`);

  // --- Phase 2: /leads/livraison -------------------------------------------
  console.log('\n— Phase 2: /leads/livraison');
  const baseDel = await get('/leads/livraison', { limit: '1' });
  check('baseline loads', baseDel.status === 200, `HTTP ${baseDel.status}`);
  const baseStats = baseDel.body?.data?.stats;
  const baseCities = baseDel.body?.data?.filterOptions?.cities?.length ?? 0;

  const wideDel = await get('/leads/livraison', { limit: '1', ...wide });
  check('a wide window matches the unfiltered stats',
    wideDel.body?.data?.stats?.total === baseStats?.total,
    `${wideDel.body?.data?.stats?.total} vs ${baseStats?.total}`);

  // The bug: stats were computed over `baseWhere`, so a window moved the parcel
  // list but left every total, rate and status count exactly where they were.
  const emptyDel = await get('/leads/livraison', { limit: '1', ...empty });
  check('an empty window zeroes the parcel stats',
    emptyDel.body?.data?.stats?.total === 0 && sum(emptyDel.body?.data?.stats?.byStatus) === 0,
    `total=${emptyDel.body?.data?.stats?.total} byStatus=${sum(emptyDel.body?.data?.stats?.byStatus)}`);
  check('an empty window zeroes the revenue counters',
    emptyDel.body?.data?.stats?.revenueTotal === 0,
    `revenueTotal=${emptyDel.body?.data?.stats?.revenueTotal}`);
  // Options describe reach, not the window — narrowing them would strand the
  // agent with a city filter they can no longer switch away from.
  check('filter options stay unnarrowed',
    (emptyDel.body?.data?.filterOptions?.cities?.length ?? 0) === baseCities,
    `${emptyDel.body?.data?.filterOptions?.cities?.length} vs ${baseCities} cities`);

  // --- Tiles: /leads/available and /leads/abandoned-carts -------------------
  console.log('\n— Tiles');
  const baseAvail = await get('/leads/available', { limit: '1' });
  const wideAvail = await get('/leads/available', { limit: '1', ...wide });
  const emptyAvail = await get('/leads/available', { limit: '1', ...empty });
  check('available: wide window is a no-op',
    wideAvail.body?.data?.totalAvailable === baseAvail.body?.data?.totalAvailable,
    `${wideAvail.body?.data?.totalAvailable} vs ${baseAvail.body?.data?.totalAvailable}`);
  check('available: empty window returns nothing',
    emptyAvail.body?.data?.totalAvailable === 0,
    `${emptyAvail.body?.data?.totalAvailable}`);

  const baseCarts = await get('/leads/abandoned-carts', { limit: '1' });
  const wideCarts = await get('/leads/abandoned-carts', { limit: '1', ...wide });
  const emptyCarts = await get('/leads/abandoned-carts', { limit: '1', ...empty });
  check('carts: baseline loads', baseCarts.status === 200, `HTTP ${baseCarts.status}`);
  check('carts: wide window is a no-op',
    wideCarts.body?.counts?.all === baseCarts.body?.counts?.all,
    `${wideCarts.body?.counts?.all} vs ${baseCarts.body?.counts?.all}`);
  check('carts: empty window zeroes the counts',
    emptyCarts.body?.counts?.all === 0 && emptyCarts.body?.counts?.converted === 0,
    `all=${emptyCarts.body?.counts?.all} converted=${emptyCarts.body?.counts?.converted}`);

  // --- Bound rounding -------------------------------------------------------
  console.log('\n— Bound rounding');
  // A bare date must cover its whole day on both ends, and a minute-precision
  // bound must include that whole minute.
  const today = local(new Date()).slice(0, 10);
  const bare = await get('/leads', { withStats: 'true', limit: '1', dateFrom: today, dateTo: today });
  check('a bare date range is accepted', bare.status === 200, `HTTP ${bare.status}`);
  const nowMinute = local(new Date());
  const toMinute = await get('/leads', { withStats: 'true', limit: '1', dateFrom: today, dateTo: nowMinute });
  check('a minute-precision bound is accepted', toMinute.status === 200, `HTTP ${toMinute.status}`);
  check('today-to-now never exceeds the whole of today',
    sum(toMinute.body?.data?.stats?.byStatus) <= sum(bare.body?.data?.stats?.byStatus),
    `${sum(toMinute.body?.data?.stats?.byStatus)} <= ${sum(bare.body?.data?.stats?.byStatus)}`);
  // Garbage must degrade to "no bound", never to a 500 or an empty page.
  const junk = await get('/leads', { withStats: 'true', limit: '1', dateFrom: 'not-a-date' });
  check('an unparseable bound is ignored, not fatal',
    junk.status === 200 && sum(junk.body?.data?.stats?.byStatus) === sum(baseByStatus),
    `HTTP ${junk.status}, ${sum(junk.body?.data?.stats?.byStatus)} vs ${sum(baseByStatus)}`);

  await prisma.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
