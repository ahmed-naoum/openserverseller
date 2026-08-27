/**
 * Functional smoke test for the WhatsApp agent's money and catalogue paths.
 *
 * Run with:  npx tsx src/wa/smoke.ts
 *
 * Exercises the things that are expensive to get wrong and cheap to check:
 * the catalogue seeds, an agent is created with working defaults, the prompt
 * compiles, and — the important one — a turn cannot be charged twice. Every row
 * it writes is removed again at the end.
 */

import { prisma } from '../lib/prisma.js';
import { loadSecrets } from '../lib/secretStore.js';
import { ensureCatalogue, resolveModel, listModels, DEFAULT_TTS_CHAIN, DEFAULT_MODELS } from './catalogue.js';
import { isLiveModel, readVerbatim } from './speech.js';
import { getOrCreateAgent } from './agentStore.js';
import { recompilePrompt } from './kb.js';
import { chargeTurn, grantCredits, getWaCreditStats } from '../services/waCredits.service.js';
import { replyPriceCents } from '../lib/waPricing.js';

let failures = 0;

function check(label: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function main(): Promise<void> {
  await loadSecrets();

  console.log('\n1. catalogue');
  await ensureCatalogue();
  const brain = await resolveModel('BRAIN');
  const stt = await resolveModel('STT');
  const tts = await resolveModel('TTS');
  const voices = await prisma.aiVoice.count({ where: { isEnabled: true } });

  check('a default BRAIN model resolves', !!brain, brain?.modelId);
  check('the default brain is Opus 5', brain?.modelId === 'claude-opus-5');
  check('Opus 5 declares mid-conversation system support', !!brain?.supportsMidSystem);
  check('Opus 5 declares adaptive thinking', !!brain?.supportsThinking);
  check('Opus 5 pricing is 500/2500 cents per MTok', brain?.inputCostPerMTokCents === 500 && brain?.outputCostPerMTokCents === 2500);
  check('an STT model resolves', !!stt, stt?.modelId);
  check('a TTS model resolves', !!tts, tts?.modelId);
  check('voices are seeded', voices >= 35, `${voices} enabled`);

  const sonnet = await prisma.aiModel.findFirst({ where: { modelId: 'claude-sonnet-5', role: 'BRAIN' } });
  check('Sonnet 5 is correctly marked as NOT accepting mid-conversation system', sonnet?.supportsMidSystem === false);

  const moroccan = await prisma.aiVoice.findUnique({
    where: { provider_voiceId: { provider: 'edge', voiceId: 'ar-MA-MounaNeural' } },
  });
  check('the Moroccan voice exists and supports prosody (speed)', !!moroccan?.supportsProsody);

  console.log('\n1b. voice strategy — Gemini Live + Sulafat + fallback chain');
  check('the default TTS model is the Live/native-audio one', tts?.modelId === 'gemini-2.5-flash-native-audio-preview-12-2025', tts?.modelId);
  check('isLiveModel() routes it to the WebSocket path', isLiveModel(tts?.modelId));
  check('isLiveModel() does NOT route the REST TTS models there', !isLiveModel('gemini-2.5-flash-preview-tts'));

  const ttsDefaults = await prisma.aiModel.count({ where: { role: 'TTS', isDefault: true } });
  check('exactly one TTS default exists', ttsDefaults === 1, `${ttsDefaults}`);

  const sulafat = await prisma.aiVoice.findUnique({
    where: { provider_voiceId: { provider: 'gemini', voiceId: 'Sulafat' } },
  });
  check('Sulafat is the default voice', !!sulafat?.isDefault);
  check('Sulafat is steerable by style, not by prosody', sulafat?.supportsStyle === true && sulafat?.supportsProsody === false);

  const voiceDefaults = await prisma.aiVoice.count({ where: { isDefault: true } });
  check('exactly one default voice exists', voiceDefaults === 1, `${voiceDefaults}`);

  // Product invariant: every link names a model the catalogue actually knows.
  // Whether an admin has ENABLED it is their configuration, not a defect —
  // asserting on that made this suite fail because of a legitimate admin
  // choice, which is how a test earns a habit of being ignored.
  const chainKnown = await Promise.all(
    DEFAULT_TTS_CHAIN.map(async (link) => {
      const [provider, modelId] = link.split(':');
      return !!(await prisma.aiModel.findFirst({ where: { provider, modelId, role: 'TTS' } }));
    })
  );
  check('every link of the default chain names a real catalogue model', chainKnown.every(Boolean), `${chainKnown.filter(Boolean).length}/${DEFAULT_TTS_CHAIN.length}`);

  // Configuration, reported rather than asserted: a chain whose fallbacks are
  // all disabled still works until the primary fails, and then sends nothing.
  const chainEnabled = await Promise.all(
    DEFAULT_TTS_CHAIN.map(async (link) => {
      const [provider, modelId] = link.split(':');
      return !!(await prisma.aiModel.findFirst({ where: { provider, modelId, role: 'TTS', isEnabled: true } }));
    })
  );
  const live = chainEnabled.filter(Boolean).length;
  if (live < DEFAULT_TTS_CHAIN.length) {
    console.log(`  note  only ${live}/${DEFAULT_TTS_CHAIN.length} chain links are enabled — the rest cannot catch a failure of the primary`);
  }

  // The guard that stops a conversational model answering the text instead of
  // reading it. This is the check that keeps a wrong voice note off WhatsApp.
  check(
    'readVerbatim accepts a faithful reading',
    readVerbatim('واش بغيتي نأكدو الطلب ديالك', 'واش بغيتي نأكدو الطلب ديالك')
  );
  check(
    'readVerbatim accepts minor transcription drift',
    readVerbatim('Votre commande est confirmée, livraison demain', 'Votre commande est confirmee livraison demain')
  );
  check(
    'readVerbatim REJECTS the model answering instead of reading',
    !readVerbatim(
      'Votre commande est confirmée, livraison demain',
      'Bonjour ! Merci beaucoup pour votre message, je suis ravi de pouvoir vous aider aujourd hui avec votre demande'
    )
  );

  console.log('\n1c. Claude CLI engine — admin-only gate');
  const cliModels = await prisma.aiModel.findMany({ where: { provider: 'claude-cli' } });
  check('the CLI engine is in the catalogue', cliModels.length === 2, cliModels.map((m) => m.modelId).join(', '));
  check('every CLI model is adminOnly', cliModels.every((m) => m.adminOnly));

  // The invariant is what a FRESH INSTALL seeds, not what this database now
  // holds — an admin enabling the engine is the intended workflow, and
  // asserting on the live row made the suite fail for using the feature.
  const cliSeeds = DEFAULT_MODELS.filter((m) => m.provider === 'claude-cli');
  check('CLI models SEED as disabled (they need a binary and a token)', cliSeeds.length > 0 && cliSeeds.every((m) => m.isEnabled === false));
  if (cliModels.some((m) => m.isEnabled)) {
    console.log('  note  the CLI engine is enabled on this install — still adminOnly, so no account can select it');
  }

  // The account-facing picker must never show one.
  const accountChoices = await listModels('BRAIN');
  check(
    'listModels() hides adminOnly models from accounts',
    accountChoices.every((m) => !m.adminOnly),
    `${accountChoices.length} offered`
  );

  // The nastier case: an ENABLED adminOnly model. Tested on a throwaway row
  // rather than by flipping a seeded one — mutating shared catalogue state made
  // two concurrent runs of this suite fail each other, and a test that is only
  // correct when nothing else is running is not much of a test.
  const cli = await prisma.aiModel.create({
    data: {
      provider: 'claude-cli',
      modelId: `smoke-${Date.now()}`,
      label: 'smoke test — admin-only',
      role: 'BRAIN',
      isEnabled: true,
      adminOnly: true,
    },
  });

  {
    try {
      const stillHidden = await listModels('BRAIN');
      check(
        'an ENABLED adminOnly model is still hidden from accounts',
        stillHidden.every((m) => m.provider !== 'claude-cli')
      );

      // An UNPREFERRED resolve is what a fresh agent and a disabled-model
      // fallback both take. It must never land on the CLI engine.
      const unpreferred = await resolveModel('BRAIN');
      check(
        'resolveModel never FALLS BACK to the CLI engine',
        unpreferred?.provider !== 'claude-cli',
        `resolved to ${unpreferred?.modelId}`
      );

      // A PREFERRED resolve must honour it — this is the admin assignment
      // actually taking effect, and the only door the CLI comes through.
      const assigned = await resolveModel('BRAIN', cli.id);
      check(
        'resolveModel honours an explicit admin assignment of the CLI engine',
        assigned?.provider === 'claude-cli',
        `resolved to ${assigned?.modelId}`
      );

      // What the account config route runs before accepting a model id.
      const asAccount = await prisma.aiModel.findFirst({
        where: { id: cli.id, role: 'BRAIN', isEnabled: true, adminOnly: false },
      });
      check('the config route query rejects a directly-POSTed CLI model id', asAccount === null);
    } finally {
      await prisma.aiModel.delete({ where: { id: cli.id } });
    }
  }

  console.log('\n2. a throwaway account');
  const role = await prisma.role.findUnique({ where: { name: 'VENDOR' } });
  if (!role) throw new Error('VENDOR role missing — run the seed first.');

  const user = await prisma.user.create({
    data: {
      email: `wa-smoke-${Date.now()}@example.invalid`,
      password: 'x',
      roleId: role.id,
      whatsappAgentEnabled: true,
      whatsappAgentGateFrom: new Date(),
    },
  });
  check('test account created', !!user.id, `#${user.id}`);

  try {
    const agent = await getOrCreateAgent(user.id);
    check('agent row created', !!agent.id);
    check('agent picked a brain model by default', !!agent.brainModelId);
    check('agent picked a voice preset by default', !!agent.activeVoiceId);

    const presets = await prisma.whatsappAgentVoice.findMany({ where: { userId: user.id } });
    check('three shipped voice presets exist', presets.length === 3, presets.map((p) => p.name).join(', '));
    check('the shipped presets lead with Gemini/Sulafat', presets.filter((p) => p.provider === 'gemini' && p.voiceId === 'Sulafat').length === 2);
    check('one keyless Edge preset is shipped as a safety net', presets.some((p) => p.provider === 'edge'));
    check('the Darija delivery prompt is set on the Gemini presets', presets.filter((p) => p.provider === 'gemini').every((p) => /DARIJA/i.test(p.stylePrompt || '')));

    const agentRow = await prisma.whatsappAgent.findUniqueOrThrow({ where: { userId: user.id } });
    check('the fallback chain is seeded on a new agent', agentRow.ttsChain.length === DEFAULT_TTS_CHAIN.length, agentRow.ttsChain.join(' -> '));
    check('verify defaults to live_only', agentRow.ttsVerify === 'live_only');
    check('failure defaults to text_only (never a silent voice swap)', agentRow.ttsOnFailure === 'text_only');
    check('shipped presets are marked isSystem', presets.every((p) => p.isSystem));

    const slow = presets.find((p) => p.rate < 0);
    check('one shipped preset is slower than natural (the speed control works)', !!slow, `rate ${slow?.rate}%`);

    console.log('\n3. prompt compilation');
    const prompt = await recompilePrompt(user.id);
    check('prompt compiles', prompt.length > 500, `${prompt.length} chars`);
    check('prompt names the tools', prompt.includes('save_lead') && prompt.includes('confirm_order'));
    check('prompt forbids inventing prices', prompt.toLowerCase().includes('never invent a price'));

    const after = await prisma.whatsappAgent.findUniqueOrThrow({ where: { userId: user.id } });
    check('promptVersion was bumped', after.promptVersion > 0, String(after.promptVersion));

    console.log('\n4. credits — the double-charge guard');
    const price = replyPriceCents();
    await grantCredits(user.id, price * 3, 'smoke test', null as unknown as number);

    let stats = await getWaCreditStats(user.id);
    check('grant lands', stats.balance === price * 3, `${stats.balance} cents`);
    check('affordable computed', stats.affordable === 3, `${stats.affordable} replies`);

    const contact = await prisma.whatsappContact.create({
      data: { userId: user.id, jid: '212600000000@s.whatsapp.net', phone: '212600000000' },
    });
    const turn = await prisma.whatsappAgentTurn.create({
      data: { userId: user.id, contactId: contact.id, triggerMessageId: `smoke-${Date.now()}` },
    });

    const first = await chargeTurn(user.id, turn.id);
    check('first charge succeeds', first.ok === true);
    check('first charge is not flagged as already charged', first.ok && first.alreadyCharged === false);

    // THE point of the test: the same turn must never be billed twice, however
    // many times a failed send is retried.
    const second = await chargeTurn(user.id, turn.id);
    check('second charge is idempotent', second.ok === true && second.alreadyCharged === true);

    stats = await getWaCreditStats(user.id);
    check('balance fell exactly once', stats.balance === price * 2, `${stats.balance} cents`);

    const ledger = await prisma.waCreditTransaction.count({
      where: { account: { userId: user.id }, type: 'CONSUME' },
    });
    check('exactly one CONSUME row exists', ledger === 1, `${ledger} rows`);

    // Drain the balance and confirm the agent is refused rather than going
    // negative.
    const t2 = await prisma.whatsappAgentTurn.create({
      data: { userId: user.id, contactId: contact.id, triggerMessageId: `smoke2-${Date.now()}` },
    });
    const t3 = await prisma.whatsappAgentTurn.create({
      data: { userId: user.id, contactId: contact.id, triggerMessageId: `smoke3-${Date.now()}` },
    });
    await chargeTurn(user.id, t2.id);
    await chargeTurn(user.id, t3.id);

    const t4 = await prisma.whatsappAgentTurn.create({
      data: { userId: user.id, contactId: contact.id, triggerMessageId: `smoke4-${Date.now()}` },
    });
    const broke = await chargeTurn(user.id, t4.id);
    check('an empty balance refuses the charge', broke.ok === false && broke.reason === 'INSUFFICIENT');

    stats = await getWaCreditStats(user.id);
    check('balance never goes negative', stats.balance === 0, `${stats.balance} cents`);
  } finally {
    console.log('\n5. cleanup');
    // Cascades take the agent, contacts, turns, credit account and ledger.
    await prisma.user.delete({ where: { id: user.id } });
    const left = await prisma.user.count({ where: { id: user.id } });
    check('test account removed', left === 0);
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('\nsmoke test crashed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
