/**
 * Exercises the lead fraud scoring against the database.
 *
 *   npx tsx scripts/check-phone-fraud.ts [limit]
 *
 * Read-only. Prints the busiest numbers with the signals the leads screens
 * would badge them with, so the thresholds can be sanity-checked against real
 * rows before anyone trusts a badge.
 */
import { prisma } from '../src/lib/prisma.js';
import {
  leadFraudSignalsFor,
  fraudThreshold,
  normalizePhone,
} from '../src/lib/leadFraud.js';

async function main() {
  const limit = Number(process.argv[2]) || 40;

  // Newest leads, which is what a seller actually looks at.
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      fullName: true,
      phone: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
    },
  });

  const threshold = await fraudThreshold();
  const signals = await leadFraudSignalsFor(leads, threshold);

  console.log(`ip threshold = ${threshold}, scored ${leads.length} newest leads\n`);

  let flagged = 0;
  for (const l of leads) {
    const s = signals.get(l.id);
    if (!s?.codes.length) continue;
    flagged++;
    const c = s.counts;
    console.log(
      `#${l.id}  ${String(l.fullName).slice(0, 24).padEnd(24)} ${normalizePhone(l.phone)}  ` +
      `[${s.severity}] ${s.codes.join(', ')}`
    );
    console.log(
      `        phone ${c.phoneLeads} leads / ${c.phoneIdentities} identities · ` +
      `name on ${c.namePhones} numbers · ip ${c.ipOrders} in 24h · device ${c.uaCluster} in 24h`
    );
  }

  console.log(`\n${flagged}/${leads.length} flagged, ${leads.length - flagged} clean`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
