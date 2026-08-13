/**
 * Lists parcels already handed to Coliaty under a city name Coliaty does not
 * publish.
 *
 * The dispatch path used to send our own spelling — the accented French form
 * from OpenStreetMap — instead of the carrier's. Everything dispatched after
 * that fix is correct; this finds what went out before it, so those parcels can
 * be redirected with a CHANGE_DESTINATION rather than discovered when they fail
 * to arrive.
 *
 * Read-only. Prints a table and changes nothing.
 *
 *   npx tsx scripts/audit-dispatched-city-names.ts
 */
import { prisma } from '../src/lib/prisma.js';
import { coliatyCityNameResolver } from '../src/lib/coliatyCityName.js';

const run = async () => {
  const orders = await prisma.order.findMany({
    where: { coliatyPackageCode: { not: null } },
    select: {
      id: true,
      customerCity: true,
      customerName: true,
      coliatyPackageCode: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const resolve = await coliatyCityNameResolver(orders.map((o) => o.customerCity));

  const affected = orders
    .map((o) => ({ ...o, shouldBe: resolve(o.customerCity), sent: (o.customerCity || '').trim() }))
    .filter((o) => {
      if (!o.shouldBe || o.shouldBe === o.sent) return false;
      // Case alone was never the problem — the old comparison lowercased both
      // sides, which is why "Agadir" against "AGADIR" always went through.
      // Flagging those here would send someone redirecting parcels that arrived
      // perfectly well. Only a difference that comparison could not absorb —
      // an accent, a hyphen, a spelling — actually left with an unmatched name.
      return o.shouldBe.toLowerCase() !== o.sent.toLowerCase();
    });

  console.log(`dispatched parcels:        ${orders.length}`);
  console.log(`sent with a name Coliaty does not publish: ${affected.length}\n`);

  if (affected.length === 0) return;

  // Grouped, because one wrong city usually means many parcels to the same hub.
  const byCity = new Map<string, number>();
  for (const o of affected) {
    const k = `${o.sent}  ->  ${o.shouldBe}`;
    byCity.set(k, (byCity.get(k) || 0) + 1);
  }
  console.log('by city:');
  for (const [k, n] of [...byCity.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${k}`);
  }

  // Only parcels still in flight can be redirected; delivered ones are history.
  const actionable = affected.filter((o) => o.status === 'PENDING');
  console.log(`\nstill PENDING (redirectable via CHANGE_DESTINATION): ${actionable.length}`);
  for (const o of actionable.slice(0, 40)) {
    console.log(
      `  order ${String(o.id).padEnd(7)} ${o.coliatyPackageCode?.padEnd(16)} ` +
        `${o.sent.padEnd(20)} -> ${o.shouldBe}`
    );
  }
  if (actionable.length > 40) console.log(`  ... and ${actionable.length - 40} more`);
};

run()
  .catch((e) => {
    console.error('ERR:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
