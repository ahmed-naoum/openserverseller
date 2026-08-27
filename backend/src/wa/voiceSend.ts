/**
 * Synthesises one voice note and sends it to a WhatsApp number.
 *
 * Run with:  npx tsx src/wa/voiceSend.ts <userId> <phone> [presetId] ["text"]
 *
 * Exercises the real path end to end rather than a mock: the account's own
 * preset and TTS policy, the fallback chain, ffmpeg's ogg/opus encode, the
 * WhatsappOutboundJob outbox, and the worker's sender. If this works, voice
 * replies work.
 *
 * It goes through the OUTBOX rather than the socket directly, on purpose — the
 * worker owns the only Baileys connection, and a second one for the same number
 * is exactly what WhatsappSession.claimToken exists to prevent.
 */

import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { loadSecrets, getSecret } from '../lib/secretStore.js';
import { synthesize } from './speech.js';

async function main(): Promise<void> {
  const userId = Number(process.argv[2]);
  const phone = String(process.argv[3] || '').replace(/[^0-9]/g, '');
  const presetId = process.argv[4] ? Number(process.argv[4]) : null;
  const text =
    process.argv[5] ||
    'السلام عليكم، هادي رسالة تجريبية من الوكيل ديالكم. إلا سمعتي هاد الصوت مزيان، يعني كلشي خدام.';

  if (!userId || !phone) {
    console.error('usage: npx tsx src/wa/voiceSend.ts <userId> <phone> [presetId] ["text"]');
    process.exit(1);
  }

  await loadSecrets();

  const agent = await prisma.whatsappAgent.findUniqueOrThrow({
    where: { userId },
    include: { activeVoice: true, ttsModel: true, sttModel: true },
  });

  const preset = presetId
    ? await prisma.whatsappAgentVoice.findFirstOrThrow({ where: { id: presetId, userId } })
    : agent.activeVoice;

  if (!preset) throw new Error('No voice preset selected on this agent.');

  console.log('voice     :', preset.name, `(${preset.provider}/${preset.voiceId})`);
  console.log('rate/pitch:', preset.rate + '%', '/', preset.pitch + '%');
  console.log('style     :', (preset.stylePrompt || '(none)').slice(0, 80));
  console.log('tts model :', agent.ttsModel?.modelId || '(none)');
  console.log('chain     :', agent.ttsChain.join(' -> ') || '(none)');

  // Say up front which keys are missing, so a failure below reads as
  // "not configured" rather than "broken".
  if (preset.provider === 'gemini' && !getSecret('GEMINI_API_KEY')) {
    console.log('\n  WARNING: this preset needs GEMINI_API_KEY and it is not set.');
  }

  console.log('\nsynthesising…');
  const started = Date.now();

  const result = await synthesize(
    text,
    {
      provider: preset.provider,
      voiceId: preset.voiceId,
      rate: preset.rate,
      pitch: preset.pitch,
      volume: preset.volume,
      style: preset.style,
      styleDegree: preset.styleDegree,
      stylePrompt: preset.stylePrompt,
    },
    {
      modelId: agent.ttsModel?.modelId,
      outDir: path.join(getSecret('WA_MEDIA_ROOT') || process.cwd(), String(userId), 'tts'),
      basename: `manual-${Date.now()}`,
      policy: {
        chain: agent.ttsChain,
        retries: agent.ttsRetries,
        verify: agent.ttsVerify as 'never' | 'live_only' | 'always',
        onFailure: agent.ttsOnFailure as 'text_only' | 'fallback_edge',
        timeoutMs: agent.ttsTimeoutMs,
        sttProvider: agent.sttModel?.provider,
        sttModelId: agent.sttModel?.modelId,
      },
    }
  );

  const bytes = fs.statSync(result.filePath).size;
  console.log(`\nspoke by  : ${result.provider}/${result.model || 'default'}`);
  console.log('file      :', result.filePath, `(${bytes} bytes ogg/opus)`);
  console.log('elapsed   :', ((Date.now() - started) / 1000).toFixed(1) + 's');
  if (result.fellBackFrom) console.log('fell back :', result.fellBackFrom);
  if (result.attempts.length) result.attempts.forEach((a) => console.log('  tried   :', a));

  if (bytes < 1000) throw new Error(`Audio is suspiciously small (${bytes} bytes) — probably empty.`);

  // ---- queue it for the worker to send -----------------------------------
  const jid = `${phone}@s.whatsapp.net`;

  const contact = await prisma.whatsappContact.upsert({
    where: { userId_jid: { userId, jid } },
    update: {},
    create: { userId, jid, phone, source: 'MANUAL', pushName: 'Test vocal', aiEnabled: false },
  });

  const job = await prisma.whatsappOutboundJob.create({
    data: {
      userId,
      contactId: contact.id,
      kind: 'VOICE',
      payload: { filePath: result.filePath },
      idempotencyKey: `manual-voice:${randomUUID()}`,
    },
  });

  console.log(`\nqueued job #${job.id} -> ${jid}`);
  console.log('The worker sends within a couple of seconds. Watch whatsapp_outbound_jobs.status.');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('\nvoiceSend failed:', err.message);
  await prisma.$disconnect();
  process.exit(1);
});
