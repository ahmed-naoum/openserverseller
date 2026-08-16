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
 *
 * Options:
 *   --min-clicks=N          Treat links below N recorded clicks as test pages. Default 1.
 *   --exclude=a,b           Additionally exclude these referral codes.
 *   --all                   Report only the unfiltered numbers.
 *   --include-unreachable   Keep pages whose influencer has no subdomain or custom
 *                           domain. Off by default: validateInfluencerHost cannot
 *                           admit such a request, so those pages can never compile
 *                           and only distort the denominator that picks the next
 *                           renderer. Excluding them is what made the model agree
 *                           with production — 16/32 predicted, 16 compiled.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const arg = (name: string): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const MIN_CLICKS = Number(arg('min-clicks') ?? 1);
const EXCLUDED = new Set(
  (arg('exclude') || '').split(',').map((s) => s.trim()).filter(Boolean)
);
const SHOW_ALL_ONLY = process.argv.includes('--all');
const INCLUDE_UNREACHABLE = process.argv.includes('--include-unreachable');

/** Ordered by how much each addition buys, cheapest first. */
const CANDIDATE_SCOPES: Array<[string, string[]]> = [
  ['express_checkout only', ['express_checkout']],
  ['+ button + image', ['express_checkout', 'button', 'image']],
  ['+ video  (SHIPPED)', ['express_checkout', 'button', 'image', 'video']],
  ['+ whatsapp', ['express_checkout', 'button', 'image', 'video', 'whatsapp']],
  ['+ audio', ['express_checkout', 'button', 'image', 'video', 'whatsapp', 'audio']],
  ['+ slider', ['express_checkout', 'button', 'image', 'video', 'whatsapp', 'audio', 'slider']],
  ['+ hero + spacer', ['express_checkout', 'button', 'image', 'video', 'whatsapp', 'audio',
    'slider', 'hero', 'spacer']],
  ['+ products (everything)', ['express_checkout', 'button', 'image', 'video', 'whatsapp',
    'audio', 'slider', 'hero', 'spacer', 'products']],
];

function blocksOf(customStructure: any): any[] {
  // Two shapes are in the wild: a bare array (legacy) and { blocks, settings }.
  if (Array.isArray(customStructure)) return customStructure;
  return customStructure?.blocks || [];
}

/**
 * Does this code look like someone testing the builder?
 *
 * Reported only, never decisive. Traffic is the real signal — a page nobody has
 * ever visited is a test page whatever it is called, and a legitimate short code
 * like "MTN" or "NRJ" would trip every name heuristic ever written.
 */
function looksLikeJunk(code: string): string | null {
  const c = code.toLowerCase();
  if (/^(.)\1+$/.test(c)) return 'one repeated character';
  if (new Set(c).size <= 3 && c.length >= 4) return 'fewer than 4 distinct characters';
  if (!/[aeiouy0-9]/.test(c) && c.length >= 3) return 'no vowels or digits';
  if (/(.)\1{2,}/.test(c)) return 'a character repeated 3+ times';
  if (/^(asdf|qwer|zxcv|sdfg|dfgh|fghj|ghjk)/.test(c)) return 'keyboard run';
  // Catches mashes that happen to contain one vowel, e.g. "uzgftftzf". No word
  // in French, Arabic transliteration or English runs five consonants together.
  if (/[^aeiouy0-9_-]{5,}/.test(c)) return 'five or more consonants in a row';
  return null;
}

interface Page {
  code: string;
  clicks: number;
  conversions: number;
  leads: number;
  types: string[];
  placements: number;
  /** customDomain, else "<subdomain>.silacod.com", else null when neither is set. */
  host: string | null;
}

function report(label: string, pages: Page[], total: number): void {
  console.log(`\n${'='.repeat(64)}`);
  console.log(`${label} — ${pages.length} page(s)`);
  console.log('='.repeat(64));

  if (!pages.length) {
    console.log('(none)');
    return;
  }

  const placed: Record<string, number> = {};
  const onPages: Record<string, number> = {};
  for (const page of pages) {
    for (const type of page.types) onPages[type] = (onPages[type] || 0) + 1;
  }
  for (const page of pages) {
    for (const type of page.types) placed[type] = placed[type] || 0;
  }

  console.log('\nblock type            on pages    % of set');
  for (const [type, n] of Object.entries(onPages).sort((a, b) => b[1] - a[1])) {
    const pct = Math.round((n / pages.length) * 100);
    console.log(`${type.padEnd(20)} ${String(n).padStart(8)} ${String(pct).padStart(10)}%`);
  }

  console.log('\ncandidate compiler scope        pages covered      Δ');
  let previous = 0;
  for (const [name, scope] of CANDIDATE_SCOPES) {
    const allowed = new Set(scope);
    const covered = pages.filter(
      (p) => p.types.length && p.types.every((t) => allowed.has(t))
    ).length;
    const pct = Math.round((covered / pages.length) * 100);
    const delta = covered - previous;
    previous = covered;
    console.log(
      `${name.padEnd(31)} ${String(covered).padStart(3)}/${String(pages.length).padEnd(3)} ` +
        `(${String(pct).padStart(3)}%)  ${delta > 0 ? '+' + delta : '—'}`
    );
  }

  if (pages.length !== total) {
    console.log(`\n(${total - pages.length} page(s) excluded from this view)`);
  }
}

(async () => {
  const rows: any[] = await (prisma as any).referralLinkLandingPage.findMany({
    select: {
      referralLinkId: true,
      customStructure: true,
      referralLink: {
        select: {
          code: true,
          clicks: true,
          conversions: true,
          isActive: true,
          _count: { select: { leads: true } },
          influencer: { select: { subdomain: true, customDomain: true } },
        },
      },
    },
  });

  const pages: Page[] = rows.map((r) => {
    const blocks = blocksOf(r.customStructure);
    const inf = r.referralLink?.influencer;
    return {
      code: r.referralLink?.code || `#${r.referralLinkId}`,
      clicks: r.referralLink?.clicks ?? 0,
      conversions: r.referralLink?.conversions ?? 0,
      leads: r.referralLink?._count?.leads ?? 0,
      types: [...new Set(blocks.map((b: any) => b?.type).filter(Boolean))] as string[],
      placements: blocks.length,
      host: inf?.customDomain || (inf?.subdomain ? `${inf.subdomain}.silacod.com` : null),
    };
  });

  console.log(`${pages.length} landing page(s) total`);

  // Which pages the compiler handles right now, read from the live registry
  // rather than a hardcoded list, so this cannot drift as renderers land.
  const { supportedTypes } = await import('../src/services/landingCompiler/blocks/index.js');
  const supported = supportedTypes();
  const compilable = pages.filter(
    (p) => p.types.length && p.types.every((t) => supported.has(t))
  );

  console.log(`\nrenderers registered: ${[...supported].sort().join(', ')}`);
  console.log(`pages that compile today: ${compilable.length}/${pages.length}`);
  if (compilable.length) {
    console.log('\ncode                      clicks  blocks');
    for (const p of compilable.sort((a, b) => b.clicks - a.clicks)) {
      console.log(
        `${p.code.slice(0, 24).padEnd(24)} ${String(p.clicks).padStart(6)}  ${p.types.join(', ')}`
      );
    }
    console.log('\nThose are the pages to open when testing — everything else falls back.');
  }

  report('ALL PAGES', pages, pages.length);
  if (SHOW_ALL_ONLY) {
    await prisma.$disconnect();
    return;
  }

  /**
   * Why this page is not in the decision set, or null to keep it.
   *
   * Order matters: unreachable is reported ahead of no-traffic, because a page
   * with no host cannot receive traffic in the first place — blaming its click
   * count would describe a symptom as the cause.
   */
  const dropReason = (p: Page): string | null => {
    if (EXCLUDED.has(p.code)) return 'excluded by --exclude';
    if (!INCLUDE_UNREACHABLE && !p.host) return 'no subdomain or custom domain';
    if (p.clicks >= MIN_CLICKS || p.conversions > 0 || p.leads > 0) return null;
    return 'no clicks, leads or conversions';
  };

  // A page with no clicks, no conversions and no leads has never been used.
  // That is a far more reliable test-page signal than the shape of its code.
  const real = pages.filter((p) => dropReason(p) === null);

  const label = INCLUDE_UNREACHABLE
    ? `PAGES WITH REAL TRAFFIC (>= ${MIN_CLICKS} click, or any lead/conversion)`
    : `REACHABLE PAGES WITH REAL TRAFFIC (>= ${MIN_CLICKS} click, or any lead/conversion)`;
  report(label, real, pages.length);

  const dropped = pages.filter((p) => dropReason(p) !== null);
  if (dropped.length) {
    console.log('\nexcluded, and why:');
    console.log('code                      clicks  leads  reason');
    for (const p of dropped.sort((a, b) => b.clicks - a.clicks)) {
      console.log(
        `${p.code.slice(0, 24).padEnd(24)} ${String(p.clicks).padStart(6)} ` +
          `${String(p.leads).padStart(6)}  ${dropReason(p)}`
      );
    }

    const unreachable = dropped.filter((p) => dropReason(p) === 'no subdomain or custom domain');
    if (unreachable.length) {
      console.log(
        `\n${unreachable.length} page(s) have no host to be served on, yet several have real\n` +
          'traffic — so they are reached by some route this script does not model.\n' +
          'Re-run with --include-unreachable to see what they would add.'
      );
    }

    const quiet = dropped.filter((p) => dropReason(p) === 'no clicks, leads or conversions');
    if (quiet.length) {
      console.log('\nof the untrafficked ones, whether the name looks like a test:');
      for (const p of quiet.sort((a, b) => a.code.localeCompare(b.code))) {
        console.log(`${p.code.slice(0, 24).padEnd(24)}  ${looksLikeJunk(p.code) || '(plausible name)'}`);
      }
      console.log(
        '\nA page with no traffic may be genuinely new rather than a test — check any\n' +
          'row above whose name looks plausible before treating it as junk.'
      );
    }
  }

  await prisma.$disconnect();
})().catch((e) => {
  console.error('failed:', e.message);
  process.exit(1);
});
