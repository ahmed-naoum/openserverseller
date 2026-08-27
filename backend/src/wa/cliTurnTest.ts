/**
 * One real turn through the Claude CLI engine.
 *
 * Run with:  npx tsx src/wa/cliTurnTest.ts
 *
 * Spends one request against whatever Claude subscription the CLI is logged in
 * as. It exists because a "supported" engine that has never actually been run
 * is a claim, not a feature — this proves the spawn, the JSON schema contract,
 * and the intent mapping all work end to end.
 */

import { loadSecrets } from '../lib/secretStore.js';
import { runCliTurn } from './cliProvider.js';
import { buildContext } from './brain.js';

const SYSTEM = `You are the WhatsApp sales agent for "Atlas Store", a Moroccan shop.

# Products and prices (the only prices you may quote)
- Montre Classic | price: 249 MAD | was: 399 MAD
    Montre homme, bracelet cuir, étanche.

# How you write
Short WhatsApp messages, 1-3 sentences. Reply in the customer's language.
Never invent a price or a delivery time that is not written above.

# Your goal
Collect full_name, phone, city, address, product, quantity, then read the order
back and ask them to confirm.`;

async function main(): Promise<void> {
  await loadSecrets();

  const context = buildContext({
    phone: '212600000000',
    pushName: 'Yassine',
    source: 'AD',
    adHeadline: 'Montre Classic -40%',
    adBody: 'Livraison gratuite partout au Maroc',
    adSourceUrl: null,
    draft: {},
    status: 'NEW',
    timezone: 'Africa/Casablanca',
  });

  console.log('sending one turn through the CLI engine...\n');
  const started = Date.now();

  const result = await runCliTurn({
    systemPrompt: SYSTEM,
    context,
    history: [{ role: 'user', content: 'salam, chhal taman dyal la montre?' }],
    modelId: 'sonnet',
    effort: 'low',
  });

  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  console.log('reply     :', result.reply || '(EMPTY)');
  console.log('intents   :', JSON.stringify(result.intents));
  console.log('usage     :', JSON.stringify(result.usage));
  console.log('elapsed   :', seconds + 's');

  let failures = 0;
  const check = (label: string, ok: boolean, detail = '') => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures++;
  };

  console.log('\nchecks:');
  check('produced a non-empty reply', result.reply.trim().length > 0);
  check('the reply is not raw JSON', !result.reply.trim().startsWith('{'));
  check('the reply mentions the only price it may quote', /249/.test(result.reply), 'expects 249');
  check('no spurious action on a first price question', result.intents.confirm === null && result.intents.reject === null);
  check(
    'latency is in the expected 5-20s band for a spawned process',
    Number(seconds) < 120,
    seconds + 's'
  );

  console.log(`\n${failures === 0 ? 'CLI ENGINE WORKS' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nCLI turn failed:', err.message);
  process.exit(1);
});
