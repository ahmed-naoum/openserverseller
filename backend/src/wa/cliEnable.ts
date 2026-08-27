/**
 * Switches the Claude CLI engine on and assigns it to one account.
 *
 * Run with:  npx tsx src/wa/cliEnable.ts <userId|email>
 *
 * This is the scripted equivalent of what an admin does through
 * PATCH /api/v1/admin/ai/accounts/:uuid/agent — the only door adminOnly models
 * come through. It exists because the first account to go on the CLI engine is
 * usually the platform's own, before anyone has built an admin UI habit.
 *
 * It deliberately does NOT touch WhatsappAgent.enabled. Turning the agent on
 * makes it answer real customers on a live number; that stays a human decision.
 */

import { prisma } from '../lib/prisma.js';
import { loadSecrets, getSecret } from '../lib/secretStore.js';
import { ensureCatalogue } from './catalogue.js';
import { resolveBin } from './cliProvider.js';

async function main(): Promise<void> {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: npx tsx src/wa/cliEnable.ts <userId|email>');
    process.exit(1);
  }

  await loadSecrets();
  await ensureCatalogue();

  // ---- enable the CLI models in the catalogue ----------------------------
  const enabled = await prisma.aiModel.updateMany({
    where: { provider: 'claude-cli' },
    data: { isEnabled: true },
  });
  console.log(`catalogue : enabled ${enabled.count} CLI model(s)`);

  const model = await prisma.aiModel.findFirst({
    where: { provider: 'claude-cli', modelId: 'sonnet', role: 'BRAIN' },
  });
  if (!model) throw new Error('CLI sonnet model missing from the catalogue.');

  // They stay adminOnly. Enabling makes them assignable BY AN ADMIN; it does
  // not put them in the account-facing picker.
  console.log(`model     : ${model.label} (adminOnly=${model.adminOnly})`);

  // ---- find the account --------------------------------------------------
  const user = /^\d+$/.test(target)
    ? await prisma.user.findUnique({ where: { id: Number(target) } })
    : await prisma.user.findUnique({ where: { email: target } });

  if (!user) throw new Error(`No account matching "${target}".`);

  const agent = await prisma.whatsappAgent.findUnique({ where: { userId: user.id } });
  if (!agent) throw new Error(`Account ${user.id} has not opened its agent yet — load the page once first.`);

  await prisma.whatsappAgent.update({
    where: { userId: user.id },
    data: { brainModelId: model.id },
  });

  console.log(`account   : ${user.id} (${user.email}) now uses the CLI engine`);
  console.log(`agent     : enabled=${agent.enabled} (unchanged — turn it on yourself when ready)`);

  // ---- what is still missing --------------------------------------------
  const bin = resolveBin();
  const token = getSecret('CLAUDE_CODE_OAUTH_TOKEN');

  console.log('');
  console.log('binary    :', bin ? 'found' : 'NOT FOUND — npm install -g @anthropic-ai/claude-code');
  console.log('token     :', token ? 'set' : 'NOT SET — run `claude setup-token`, then add CLAUDE_CODE_OAUTH_TOKEN');

  if (bin && token) {
    console.log('\nReady. Prove it with:  npx tsx src/wa/cliTurnTest.ts');
  } else {
    console.log('\nNot ready yet — the agent would refuse every turn with a clear message.');
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('cliEnable failed:', err.message);
  await prisma.$disconnect();
  process.exit(1);
});
