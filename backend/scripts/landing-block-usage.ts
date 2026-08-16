/**
 * Which block types do real landing pages actually use?
 *
 * Scoping the HTML compiler from the builder's block palette is how you end up
 * writing renderers nobody needs. This reports what is genuinely on live pages,
 * and how many pages each candidate compiler scope would cover.
 *
 * Run it where the production DATABASE_URL is set — on the VPS, not locally:
 *   cd /var/www/openseller/backend && npx tsx scripts/landing-block-usage.ts
 *
 * The checkout is at /var/www/openseller. Older scripts say
 * /var/www/silacod, which does not exist on the server — if the path
 * above is wrong, `pm2 describe silacod-api` reports the real one.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Ordered by how much each addition buys, cheapest first. */
const CANDIDATE_SCOPES: Array<[string, string[]]> = [
  ['express_checkout only', ['express_checkout']],
  ['+ button + image', ['express_checkout', 'button', 'image']],
  ['+ video', ['express_checkout', 'button', 'image', 'video']],
  ['+ whatsapp', ['express_checkout', 'button', 'image', 'video', 'whatsapp']],
  ['+ audio', ['express_checkout', 'button', 'image', 'video', 'whatsapp', 'audio']],
  ['+ countdown + text', ['express_checkout', 'button', 'image', 'video', 'whatsapp',
    'audio', 'countdown', 'text']],
];

function blocksOf(customStructure: any): any[] {
  // Two shapes are in the wild: a bare array (legacy) and { blocks, settings }.
  if (Array.isArray(customStructure)) return customStructure;
  return customStructure?.blocks || [];
}

(async () => {
  const rows: any[] = await (prisma as any).referralLinkLandingPage.findMany({
    select: {
      referralLinkId: true,
      customStructure: true,
      referralLink: { select: { code: true, isActive: true } },
    },
  });

  const totalLinks = await (prisma as any).referralLink.count();
  const activeLinks = await (prisma as any).referralLink.count({ where: { isActive: true } });

  console.log(`referral links: ${totalLinks} (${activeLinks} active)`);
  console.log(`landing pages : ${rows.length}\n`);

  if (!rows.length) {
    console.log('No landing pages. Nothing to scope from.');
    await prisma.$disconnect();
    return;
  }

  const pages = rows.map((r) => ({
    code: r.referralLink?.code ?? `#${r.referralLinkId}`,
    active: r.referralLink?.isActive ?? false,
    types: [...new Set(blocksOf(r.customStructure).map((b: any) => b?.type).filter(Boolean))] as string[],
  }));

  const placements: Record<string, number> = {};
  const pageCount: Record<string, number> = {};
  for (const pg of pages) {
    for (const t of pg.types) pageCount[t] = (pageCount[t] || 0) + 1;
    for (const b of blocksOf(rows.find((r) => (r.referralLink?.code ?? `#${r.referralLinkId}`) === pg.code)!.customStructure)) {
      if (b?.type) placements[b.type] = (placements[b.type] || 0) + 1;
    }
  }

  console.log('block type            placed   on pages');
  for (const [t, n] of Object.entries(pageCount).sort((a, b) => b[1] - a[1])) {
    console.log(`${t.padEnd(20)} ${String(placements[t] ?? 0).padStart(6)} ${String(n).padStart(10)}`);
  }

  console.log('\nper page:');
  for (const pg of pages) {
    console.log(`  ${pg.active ? ' ' : '(inactive) '}${pg.code.padEnd(22)} ${pg.types.join(', ') || '(empty)'}`);
  }

  console.log('\ncandidate compiler scope           pages covered');
  for (const [name, scope] of CANDIDATE_SCOPES) {
    const allowed = new Set(scope);
    const covered = pages.filter((pg) => pg.types.length && pg.types.every((t) => allowed.has(t)));
    const pct = Math.round((covered.length / pages.length) * 100);
    console.log(`${name.padEnd(34)} ${String(covered.length).padStart(3)}/${pages.length}  (${pct}%)`);
  }

  const everUsed = new Set(pages.flatMap((pg) => pg.types));
  console.log(`\nblock types never placed on any page: ${
    ['header', 'hero', 'text', 'image', 'button', 'express_checkout', 'spacer', 'countdown',
     'whatsapp', 'slider', 'products', 'audio', 'video']
      .filter((t) => !everUsed.has(t)).join(', ') || '(none)'}`);

  await prisma.$disconnect();
})().catch((e) => {
  console.error('failed:', e.message);
  process.exit(1);
});
