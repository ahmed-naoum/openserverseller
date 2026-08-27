/**
 * Is the Claude CLI engine usable on this machine?
 *
 * Run with:  npx tsx src/wa/cliCheck.ts
 *
 * Separate from smoke.ts because it depends on what is installed on the box
 * rather than on the database, and because it is the thing an admin wants to
 * run before switching a platform-owned account onto the CLI engine.
 */

import { execFile } from 'node:child_process';
import { resolveBin, CLI_NOT_FOUND } from './cliProvider.js';
import { loadSecrets, getSecret, getSecretNumber } from '../lib/secretStore.js';
import { prisma } from '../lib/prisma.js';

const run = (bin: string, args: string[]): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: 20_000, encoding: 'utf8' }, (err, stdout, stderr) =>
      err ? reject(new Error(String(stderr || err.message).slice(0, 200))) : resolve(String(stdout).trim())
    );
  });

/**
 * Like run(), but keeps stdout when the command exits non-zero.
 *
 * `claude auth status` exits non-zero when nobody is logged in, while still
 * printing the JSON that says so. Treating that as a failure throws away the
 * exact answer we asked for.
 */
const runTolerant = (bin: string, args: string[]): Promise<string> =>
  new Promise((resolve) => {
    execFile(bin, args, { timeout: 20_000, encoding: 'utf8' }, (_err, stdout, stderr) =>
      resolve(String(stdout || stderr).trim())
    );
  });

async function main(): Promise<void> {
  await loadSecrets();

  const bin = resolveBin();
  console.log('binary          :', bin || 'NOT FOUND');

  if (!bin) {
    console.log('\n' + CLI_NOT_FOUND);
    await prisma.$disconnect();
    process.exit(1);
  }

  // A shim would have been rejected by resolveBin, but say so explicitly —
  // this is the failure that produces a baffling "invalid JSON schema" later.
  console.log('is a real exe   :', !/\.(cmd|ps1|bat)$/i.test(bin) ? 'yes' : 'NO — this will break');

  try {
    console.log('version         :', await run(bin, ['--version']));
  } catch (err) {
    console.log('version         : FAILED —', (err as Error).message);
  }

  const token = getSecret('CLAUDE_CODE_OAUTH_TOKEN');
  console.log('oauth token     :', token ? `set (${token.slice(0, 12)}…)` : 'not set');

  // Free — spends nothing. `auth status` is the difference between "the engine
  // is broken" and "nobody has logged this box in", which are very different
  // problems and produce the same opaque failure at spawn time otherwise.
  let loggedIn = false;
  try {
    const raw = await runTolerant(bin, ['auth', 'status']);
    const parsed = JSON.parse(raw);
    loggedIn = !!parsed.loggedIn;
    console.log('auth status     :', loggedIn ? `logged in (${parsed.authMethod})` : 'NOT logged in');
  } catch (err) {
    console.log('auth status     : could not read —', (err as Error).message);
  }

  if (!loggedIn) {
    console.log('');
    console.log('  This box cannot run the CLI engine yet. On the machine that will run the');
    console.log('  worker, run:   claude setup-token');
    console.log('  then put the printed sk-ant-oat01-… value in CLAUDE_CODE_OAUTH_TOKEN');
    console.log('  (Variables & Secrets). Until then the engine will refuse every turn with');
    console.log('  a clear message rather than failing silently.');
  }

  // NOTE: `auth status` reporting loggedIn:true only proves a credential is
  // present, not that it still works — an expired token reports the same. The
  // only real proof is one turn through src/wa/cliTurnTest.ts.

  console.log('max concurrent  :', getSecretNumber('WA_CLI_MAX_CONCURRENT', 2), '(for the WHOLE worker, not per account)');
  console.log('timeout         :', getSecretNumber('WA_CLI_TIMEOUT_MS', 120_000), 'ms');

  const models = await prisma.aiModel.findMany({
    where: { provider: 'claude-cli' },
    select: { modelId: true, label: true, isEnabled: true, adminOnly: true },
  });

  console.log('\ncatalogue:');
  for (const m of models) {
    console.log(`  ${m.modelId.padEnd(8)} enabled=${String(m.isEnabled).padEnd(5)} adminOnly=${m.adminOnly}`);
  }

  const assigned = await prisma.whatsappAgent.findMany({
    where: { brainModel: { provider: 'claude-cli' } },
    select: { userId: true, user: { select: { email: true } } },
  });

  console.log('\naccounts currently on the CLI engine:', assigned.length || 'none');
  for (const a of assigned) console.log(`  user ${a.userId} — ${a.user?.email}`);

  // The check that actually matters: no ordinary tenant has ended up on it.
  console.log(
    '\nNOTE: an account can only be on this engine if an ADMIN put it there',
    '\n      (PATCH /api/v1/admin/ai/accounts/:uuid/agent). Accounts cannot select it.'
  );

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('cliCheck failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
