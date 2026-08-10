/**
 * Smoke test for the vendor dashboard's period bar (/dashboard/seller-affiliate
 * and /influencer/links). Proves the window is inclusive, that a single bound is
 * enough, and — the point of the change — that an hour on a bound survives.
 *
 * Every expectation is computed from the database first and then asserted
 * against the API, and the test anchors itself on the vendor's busiest day so
 * the windows are never compared on empty data. Run with the dev server up.
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

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const atHour = (day: string, hour: number, minute = 0) => `${day}T${pad(hour)}:${pad(minute)}`;

let token = '';
const conversionsFor = async (params: Record<string, string>) => {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API}/dashboard/seller-affiliate?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body: any = await res.json().catch(() => null);
  return { status: res.status, conversions: body?.stats?.conversions ?? null };
};

(async () => {
  const counts = await prisma.lead.groupBy({ by: ['vendorId'], _count: { _all: true } });
  const best = counts.filter(c => c.vendorId).sort((a, b) => b._count._all - a._count._all)[0];
  const vendor = await prisma.user.findUnique({
    where: { id: best.vendorId! },
    select: { id: true, uuid: true, email: true },
  });
  if (!vendor) throw new Error('no VENDOR with leads to test with');

  const leads = await prisma.lead.findMany({
    where: { vendorId: vendor.id },
    select: { createdAt: true },
  });

  // Busiest local day, and an hour inside it that splits its leads in two — the
  // split is what makes the time-precision assertions meaningful.
  const byDay = new Map<string, Date[]>();
  for (const l of leads) {
    const k = isoDate(l.createdAt);
    byDay.set(k, [...(byDay.get(k) || []), l.createdAt]);
  }
  const [day, dayLeads] = [...byDay.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const hours = dayLeads.map(d => d.getHours()).sort((a, b) => a - b);
  const splitHour = hours[hours.length - 1]; // last hour that carries leads
  const before = dayLeads.filter(d => d.getHours() < splitHour).length;
  const after = dayLeads.filter(d => d.getHours() >= splitHour).length;

  token = jwt.sign({ userId: vendor.uuid }, process.env.JWT_SECRET!, { expiresIn: '10m' });
  console.log(
    `vendor ${vendor.email}\n` +
      `anchor day ${day}: ${dayLeads.length} leads — ${before} before ${pad(splitHour)}:00, ${after} from ${pad(splitHour)}:00\n`
  );
  if (before === 0 || after === 0) {
    console.log('WARNING: the anchor day has no hour split, so the time assertions prove little.\n');
  }

  // --- The whole day, both spellings ------------------------------------------
  const bare = await conversionsFor({ start: day, end: day });
  check('start=end=<day> loads', bare.status === 200, `HTTP ${bare.status}`);
  check(
    `whole day = ${dayLeads.length} leads`,
    bare.conversions === dayLeads.length,
    `API says ${bare.conversions}`
  );

  const spelled = await conversionsFor({ start: atHour(day, 0), end: atHour(day, 23, 59) });
  check(
    'a bare end date covers the whole day',
    spelled.conversions === bare.conversions,
    `${spelled.conversions} vs ${bare.conversions}`
  );

  // --- The regression this change fixes ---------------------------------------
  // The old handler ran `end.setHours(23,59,59,999)` on every end bound, so both
  // halves below returned the whole day and the split was invisible.
  const firstHalf = await conversionsFor({ start: atHour(day, 0), end: atHour(day, splitHour - 1, 59) });
  check(
    `00:00–${pad(splitHour - 1)}:59 = ${before} leads (an hour on the bound survives)`,
    firstHalf.conversions === before,
    `API says ${firstHalf.conversions}`
  );

  const secondHalf = await conversionsFor({ start: atHour(day, splitHour), end: atHour(day, 23, 59) });
  check(
    `${pad(splitHour)}:00–23:59 = ${after} leads`,
    secondHalf.conversions === after,
    `API says ${secondHalf.conversions}`
  );

  check(
    'the two halves add up to the day',
    (firstHalf.conversions ?? 0) + (secondHalf.conversions ?? 0) === bare.conversions,
    `${firstHalf.conversions} + ${secondHalf.conversions} vs ${bare.conversions}`
  );

  // --- A single bound is a valid range ----------------------------------------
  const sinceDay = await conversionsFor({ start: day });
  const expectedSince = leads.filter(l => isoDate(l.createdAt) >= day).length;
  check('start alone loads', sinceDay.status === 200, `HTTP ${sinceDay.status}`);
  check(
    `depuis ${day} = ${expectedSince} leads`,
    sinceDay.conversions === expectedSince,
    `API says ${sinceDay.conversions}`
  );

  const untilDay = await conversionsFor({ end: day });
  const expectedUntil = leads.filter(l => isoDate(l.createdAt) <= day).length;
  check(
    `jusqu'au ${day} = ${expectedUntil} leads`,
    untilDay.conversions === expectedUntil,
    `API says ${untilDay.conversions}`
  );

  // --- Links honour the same bounds -------------------------------------------
  const linksRes = async (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    const r = await fetch(`${API}/influencer/links?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const b: any = await r.json().catch(() => null);
    return { status: r.status, clicks: Array.isArray(b) ? b.reduce((s, l: any) => s + (l.clicks || 0), 0) : -1 };
  };
  const linksAll = await linksRes({});
  const linksSince = await linksRes({ start: day });
  check('links load with a single bound', linksSince.status === 200, `HTTP ${linksSince.status}`);
  check(
    'links: a bounded window is no wider than all-time',
    linksSince.clicks <= linksAll.clicks,
    `${linksSince.clicks} vs ${linksAll.clicks} clicks`
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
