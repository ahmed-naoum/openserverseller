/**
 * Would the new save-route validation reject any landing page that exists today?
 *
 * `PUT /links/:id/landing-page` now validates customStructure before storing it.
 * That is a good thing, but it is applied to pages that were written when nothing
 * was checked — so a page with an unexpected block id or an unknown block type
 * would start failing to save, and the influencer would see only a 400.
 *
 * Run this BEFORE deploying, on the machine with the production DATABASE_URL:
 *   cd /var/www/openseller/backend && npx tsx scripts/landing-validation-dryrun.ts
 *
 * The checkout is at /var/www/openseller. Older scripts say
 * /var/www/silacod, which does not exist on the server — if the path
 * above is wrong, `pm2 describe silacod-api` reports the real one.
 *
 * Exit code is 0 either way — this reports, it does not gate.
 */
import { PrismaClient } from '@prisma/client';
import { validateLandingPageUpdate } from '../src/validations/landingPage.validation.js';

const prisma = new PrismaClient();

(async () => {
  const rows: any[] = await (prisma as any).referralLinkLandingPage.findMany({
    select: {
      referralLinkId: true,
      themeColor: true,
      title: true,
      description: true,
      buttonText: true,
      customStructure: true,
      referralLink: { select: { code: true } },
    },
  });

  console.log(`checking ${rows.length} landing page(s)\n`);

  let bad = 0;
  for (const row of rows) {
    const label = row.referralLink?.code || `#${row.referralLinkId}`;

    // Exactly what the route now receives when the builder saves.
    const problem = validateLandingPageUpdate({
      themeColor: row.themeColor,
      title: row.title,
      description: row.description,
      buttonText: row.buttonText,
      customStructure: row.customStructure,
    });

    if (!problem) continue;
    bad++;
    console.log(`REJECTED  ${label}`);
    console.log(`          ${problem}`);

    const s = row.customStructure;
    const blocks = Array.isArray(s) ? s : s?.blocks || [];
    const ids = blocks.map((b: any) => b?.id).filter(Boolean);
    const offending = ids.filter((id: any) => !/^[A-Za-z0-9_-]{1,64}$/.test(String(id)));
    if (offending.length) {
      console.log(`          offending block ids: ${offending.slice(0, 3).map(String).join(', ')}`);
    }
    const types = [...new Set(blocks.map((b: any) => b?.type))];
    console.log(`          block types: ${types.join(', ') || '(none)'}`);
    console.log(`          blocks: ${blocks.length}, size: ${Math.round(
      Buffer.byteLength(JSON.stringify(s || {}), 'utf8') / 1024
    )} KB\n`);
  }

  console.log(
    bad === 0
      ? 'All existing pages pass. Safe to deploy the validation.'
      : `${bad} page(s) would fail to save after deploy. Loosen the schema or fix the rows first.`
  );

  await prisma.$disconnect();
})().catch((e) => {
  console.error('failed:', e.message);
  process.exit(1);
});
