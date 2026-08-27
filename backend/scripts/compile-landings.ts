/**
 * Compile every landing page now, instead of waiting for a visitor to do it.
 *
 * The lazy path in landingCompiler/index.ts is still what serves traffic and is
 * still the thing that self-heals after a COMPILER_VERSION bump. This exists for
 * the two moments where waiting is the wrong answer:
 *
 *   - Straight after a deploy that bumped COMPILER_VERSION, so the first real ad
 *     click lands on a warm row rather than paying for the compile itself.
 *   - When you want to know, before flipping SSG_LANDING, exactly which pages
 *     would be served compiled and which would silently fall back to React.
 *
 * Reuses compileNow(), so there is exactly one code path that writes compiled
 * rows. A page that declines (unsupported block, no blocks) is reported, not
 * retried — declining is a normal outcome, not a failure.
 *
 * Run it where the target DATABASE_URL is set. On the VPS:
 *   cd /var/www/openseller/backend && npx tsx scripts/compile-landings.ts
 *
 * Options:
 *   --dry-run   Report what would happen; write nothing.
 *   --force     Recompile every page, including rows already at the current version.
 *   --code=X    Limit to one referral code. Repeatable.
 */
import { PrismaClient } from '@prisma/client';
import { compileNow, COMPILER_VERSION, unsupportedBlocks } from '../src/services/landingCompiler/index.js';
import { modeFor, mode } from '../src/routes/landing.routes.js';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const ONLY = new Set(
  process.argv
    .filter((a) => a.startsWith('--code='))
    .map((a) => a.slice('--code='.length))
    .filter(Boolean)
);

interface Row {
  code: string;
  clicks: number;
  lpId: number;
  ssgEnabled: boolean;
  lpUpdated: Date | null;
  subdomain: string | null;
  customDomain: string | null;
  compiledAt: Date | null;
  compilerVersion: number | null;
  hasHtml: boolean;
}

/** Why this page does or does not need a compile right now. */
function needsCompile(row: Row): string | null {
  if (FORCE) return 'forced';
  if (!row.hasHtml) return 'never compiled';
  if (row.compilerVersion !== COMPILER_VERSION) {
    return `built with compiler v${row.compilerVersion ?? '?'} (current is v${COMPILER_VERSION})`;
  }
  if (row.compiledAt && row.lpUpdated && row.compiledAt < row.lpUpdated) {
    return 'page edited since it was compiled';
  }
  return null;
}

async function main() {
  const dbLabel = String(process.env.DATABASE_URL || '').replace(/:\/\/[^@]*@/, '://***@');
  console.log(`DB                ${dbLabel}`);
  console.log(`Compiler          v${COMPILER_VERSION}`);
  console.log(`SSG_LANDING       ${JSON.stringify(process.env.SSG_LANDING ?? null)} -> serve mode "${mode()}"`);
  console.log(`SSG_LANDING_CODES ${JSON.stringify(process.env.SSG_LANDING_CODES ?? null)}`);
  if (DRY_RUN) console.log('MODE              dry run — nothing will be written');
  console.log('');

  // Metadata only. Selecting cp.html here would pull every page's bytes into
  // this process for no reason; its nullness is all the planning needs.
  const rows: Row[] = (
    await prisma.$queryRawUnsafe<any[]>(`
      SELECT rl.code, rl.clicks, lp.id AS "lpId", lp."ssgEnabled",
             lp."updatedAt" AS "lpUpdated", u.subdomain, u."customDomain",
             cp."compiledAt", cp."compilerVersion", (cp.html IS NOT NULL) AS "hasHtml"
      FROM referral_link_landing_pages lp
      JOIN referral_links rl ON rl.id = lp."referralLinkId"
      JOIN users u ON u.id = rl."influencerId"
      LEFT JOIN referral_link_compiled_pages cp ON cp."landingPageId" = lp.id
      ORDER BY rl.clicks DESC, rl.code ASC
    `)
  ).map((r) => ({ ...r, clicks: Number(r.clicks), hasHtml: Boolean(r.hasHtml) }));

  const targets = ONLY.size ? rows.filter((r) => ONLY.has(r.code)) : rows;
  if (ONLY.size) {
    for (const code of ONLY) {
      if (!targets.some((r) => r.code === code)) console.log(`  ! no landing page for code "${code}"`);
    }
  }

  const structures = await prisma.referralLinkLandingPage.findMany({
    where: { id: { in: targets.map((r) => r.lpId) } },
    select: { id: true, customStructure: true },
  });
  const structureOf = new Map(structures.map((s) => [s.id, s.customStructure]));

  const compiled: string[] = [];
  const skipped: string[] = [];
  const declined: Array<{ code: string; reason: string }> = [];
  const failed: Array<{ code: string; reason: string }> = [];

  for (const row of targets) {
    const reason = needsCompile(row);
    if (!reason) {
      skipped.push(row.code);
      continue;
    }

    // Checked before calling so a page that can never compile is reported as
    // such even under --dry-run, where compileNow is not reached.
    const unsupported = unsupportedBlocks(structureOf.get(row.lpId));
    if (unsupported.length) {
      declined.push({ code: row.code, reason: `unsupported block(s): ${unsupported.join(', ')}` });
      continue;
    }

    if (DRY_RUN) {
      console.log(`  would compile  ${row.code.padEnd(20)} ${reason}`);
      compiled.push(row.code);
      continue;
    }

    const report = await compileNow(row.code, modeFor(row.code));
    if (report.status === 'compiled') {
      const kb = report.brotliBytes ? (report.brotliBytes / 1024).toFixed(1) : '?';
      console.log(
        `  compiled       ${row.code.padEnd(20)} ${String(report.durationMs).padStart(5)}ms  ` +
          `${kb.padStart(6)}KB br  ${report.blocks} block(s)  (${reason})`
      );
      compiled.push(row.code);
    } else if (report.status === 'declined') {
      declined.push({ code: row.code, reason: report.reason });
    } else {
      failed.push({ code: row.code, reason: report.error || report.reason });
    }
  }

  console.log('');
  console.log(`${String(compiled.length).padStart(4)}  ${DRY_RUN ? 'would compile' : 'compiled'}`);
  console.log(`${String(skipped.length).padStart(4)}  already current (v${COMPILER_VERSION}, newer than last edit)`);
  console.log(`${String(declined.length).padStart(4)}  declined — served by React, as designed`);
  console.log(`${String(failed.length).padStart(4)}  failed — a real bug`);

  for (const d of declined) console.log(`      declined  ${d.code.padEnd(20)} ${d.reason}`);
  for (const f of failed) console.log(`      FAILED    ${f.code.padEnd(20)} ${f.reason}`);

  // A compiled row is not the same thing as a visitor receiving it. Three
  // separate conditions can still send the SPA, and none of them is visible in
  // the compile report alone.
  const blocked = targets.filter((r) => {
    const servable = compiled.includes(r.code) || skipped.includes(r.code);
    if (!servable) return false;
    return modeFor(r.code) !== 'on' || !r.ssgEnabled || (!r.subdomain && !r.customDomain);
  });

  if (blocked.length) {
    console.log(`\n${blocked.length} compiled page(s) will still be served as React:`);
    for (const r of blocked) {
      const why: string[] = [];
      if (modeFor(r.code) !== 'on') why.push(`serve mode is "${modeFor(r.code)}"`);
      if (!r.ssgEnabled) why.push('ssgEnabled=false on the page');
      if (!r.subdomain && !r.customDomain) why.push('seller has no subdomain or custom domain');
      console.log(`      ${r.code.padEnd(20)} ${why.join('; ')}`);
    }
    console.log('\n  Serve mode is set by SSG_LANDING (off | shadow | on) in backend/.env.');
    console.log('  SSG_LANDING_CODES=code1,code2 upgrades named pages to "on" while the rest stay shadow.');
  }

  if (failed.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
