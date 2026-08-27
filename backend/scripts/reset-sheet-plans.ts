/**
 * Puts the two launch Google Sheets packs back to the agreed commercial terms:
 *
 *   Pack 2K — $30 / 30 days / 2 000 leads
 *   Pack 5K — $50 / 30 days / 5 000 leads
 *
 * WHY THIS IS NOT `ensureDefaultPlans`. That one only ever CREATES, deliberately:
 * it runs on every boot, and an admin who reprices a pack must not find it back at
 * the seeded price after the next deploy. So there has to be an EXPLICIT way to say
 * "no, put these two back to spec" — this script — and running it is a decision
 * rather than a side effect of restarting the server.
 *
 * SAFE ON A LIVE DATABASE. Running subscriptions snapshot `leadQuota` and
 * `priceCents` at approval and never re-read SheetPlan, so nothing a seller is
 * currently paying for changes underneath them. The new terms apply from the next
 * approval onwards. Nothing is deleted and no subscription row is touched.
 *
 * Run it wherever the wrong numbers are showing:
 *   npx tsx scripts/reset-sheet-plans.ts
 */

import { prisma } from '../src/lib/prisma.js';
import { DEFAULT_PLANS } from '../src/services/sheetPlans.service.js';

async function main() {
  console.log('Resetting Google Sheets packs to the launch terms…\n');

  for (const spec of DEFAULT_PLANS) {
    const { legacyCode, ...columns } = spec;

    // The row to fix is the one under the CURRENT code, or failing that the one
    // still under the old one — renaming that in place keeps its id, and with it
    // every subscription pointing at it. Creating a fresh row instead would strand
    // those sellers on a pack that had vanished from the catalogue.
    const before =
      (await prisma.sheetPlan.findUnique({ where: { code: spec.code } })) ??
      (await prisma.sheetPlan.findUnique({ where: { code: legacyCode } }));

    const after = before
      ? await prisma.sheetPlan.update({
          where: { id: before.id },
          data: {
            ...columns,
            // A pack that was hidden is put back on sale: the point of this script
            // is that the seller can see the right two packs afterwards.
            active: true,
          },
        })
      : await prisma.sheetPlan.create({ data: columns });

    const money = (c: number) => `$${(c / 100).toFixed(2)}`;
    const line = (p: { name: string; priceCents: number; leadQuota: number; periodDays: number }) =>
      `${p.name} — ${money(p.priceCents)} / ${p.periodDays}d / ${p.leadQuota.toLocaleString('en-US')} leads`;

    if (!before) {
      console.log(`  created  ${line(after)}`);
      continue;
    }

    // Field by field, so the log says WHAT moved. A summary line alone prints two
    // identical-looking rows whenever only the description changed, which reads as
    // a no-op that somehow reported itself as a fix.
    const fields = ['code', 'name', 'priceCents', 'leadQuota', 'periodDays', 'description', 'active'] as const;
    const moved = fields
      .filter((f) => (before as any)[f] !== (after as any)[f])
      .map((f) => `           ${f}: ${JSON.stringify((before as any)[f])} -> ${JSON.stringify((after as any)[f])}`);

    if (!moved.length) console.log(`  ok       ${line(after)}`);
    else console.log(`  fixed    ${line(after)}\n${moved.join('\n')}`);
  }

  // The number that actually decides what a seller can send. If a pack was wrong,
  // anyone approved on it is still on the OLD quota until they are re-approved —
  // say so rather than letting it be discovered later.
  const live = await prisma.sheetSubscription.findMany({
    where: { status: 'ACTIVE', endsAt: { gt: new Date() } },
    select: { id: true, userId: true, leadQuota: true, plan: { select: { code: true, leadQuota: true } } },
  });
  const stale = live.filter((s) => s.leadQuota !== s.plan.leadQuota);

  console.log(`\n${live.length} live subscription(s).`);
  if (stale.length) {
    console.log(
      `${stale.length} of them were approved on the old terms and keep their snapshot:\n` +
        stale
          .map((s) => `  subscription #${s.id} (user ${s.userId}, ${s.plan.code}): ${s.leadQuota} leads, plan now ${s.plan.leadQuota}`)
          .join('\n') +
        '\nRe-approve those accounts to move them onto the corrected quota.'
    );
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
