/**
 * Repairs conversation history that reads as unreadable audio.
 *
 * Run with:  npx tsx src/wa/sttBackfill.ts <userId>
 *
 * Two distinct repairs, both of which corrupt the model's view of a chat until
 * they are done:
 *
 *   INBOUND notes that were never transcribed — usually because the Gemini key
 *   was missing or rate-limited when they arrived. They render as
 *   "[voice note - transcription unavailable]" forever, so the agent keeps
 *   apologising for something it can now hear perfectly well.
 *
 *   OUTBOUND notes the agent itself spoke. These were recorded with an empty
 *   body before the sender carried the spoken text, so the agent read its OWN
 *   replies back as unreadable attachments, concluded audio does not work on
 *   this channel, and started telling customers so.
 *
 * Safe to re-run: it only touches rows that are still missing a transcript.
 */

import fs from 'node:fs';
import { prisma } from '../lib/prisma.js';
import { loadSecrets } from '../lib/secretStore.js';
import { transcribe } from './speech.js';
import { resolveModel } from './catalogue.js';

async function main(): Promise<void> {
  const userId = Number(process.argv[2]);
  if (!userId) {
    console.error('usage: npx tsx src/wa/sttBackfill.ts <userId>');
    process.exit(1);
  }

  await loadSecrets();

  const agent = await prisma.whatsappAgent.findUniqueOrThrow({
    where: { userId },
    select: { sttModelId: true, sttPrompt: true },
  });

  /* ---- outbound: we already know what these say ------------------------ */
  const outbound = await prisma.whatsappMessage.findMany({
    where: { userId, direction: 'OUT', kind: 'AUDIO', transcribed: false },
    select: { id: true, body: true, contactId: true, createdAt: true },
  });

  let repaired = 0;
  for (const m of outbound) {
    // Newer jobs carry the spoken text on the payload.
    const job = await prisma.whatsappOutboundJob.findFirst({
      where: { userId, contactId: m.contactId, kind: 'VOICE' },
      orderBy: { id: 'desc' },
    });

    let spoken = m.body || String((job?.payload as any)?.text || '').trim();

    // Older ones do not, because the field did not exist. Recover it from the
    // text reply that went out alongside: `mirror` mode always sends the same
    // words as text first, so the nearest preceding outbound text on this
    // conversation IS what the voice note says.
    if (!spoken) {
      const paired = await prisma.whatsappMessage.findFirst({
        where: {
          userId,
          contactId: m.contactId,
          direction: 'OUT',
          kind: 'TEXT',
          createdAt: { lte: m.createdAt },
          body: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        select: { body: true },
      });
      spoken = (paired?.body || '').trim();
    }

    if (!spoken) {
      // Nothing recoverable. Leave it — loadHistory now renders an outbound
      // audio as a plain attachment rather than a failed transcription, which
      // is merely uninformative instead of actively misleading.
      console.log(`  OUT #${m.id} -> no recoverable text, skipped`);
      continue;
    }
    // Only `body`. A transcript is text derived FROM audio; the spoken text is
    // the source. Writing both renders the sentence twice in the inbox.
    await prisma.whatsappMessage.update({
      where: { id: m.id },
      data: { body: spoken, transcript: null, transcribed: false },
    });
    repaired++;
    console.log(`  OUT #${m.id} -> ${JSON.stringify(spoken.slice(0, 60))}`);
  }
  console.log(`outbound repaired : ${repaired}/${outbound.length}`);

  /* ---- inbound: actually transcribe them ------------------------------- */
  const inbound = await prisma.whatsappMessage.findMany({
    where: { userId, direction: 'IN', kind: 'AUDIO', transcribed: false },
    select: { id: true, mediaPath: true, mediaMime: true },
  });

  const model = await resolveModel('STT', agent.sttModelId);
  if (!model) {
    console.log(`inbound            : ${inbound.length} pending, but no STT model is enabled.`);
    await prisma.$disconnect();
    return;
  }

  let done = 0;
  for (const m of inbound) {
    if (!m.mediaPath || !fs.existsSync(m.mediaPath)) {
      console.log(`  IN  #${m.id} -> audio file is gone, cannot transcribe`);
      continue;
    }
    // 503 and 429 from Gemini are transient — the model is busy, not wrong.
    // Worth a few spaced retries here, because this is a one-off repair and a
    // permanent "unavailable" marker costs every future turn on that chat.
    let lastError = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { text } = await transcribe(m.mediaPath, m.mediaMime || 'audio/ogg', {
          provider: model.provider,
          modelId: model.modelId,
          prompt: agent.sttPrompt,
        });
        await prisma.whatsappMessage.update({
          where: { id: m.id },
          data: { transcript: text, transcribed: true },
        });
        done++;
        console.log(`  IN  #${m.id} -> ${JSON.stringify(text.slice(0, 60))}`);
        lastError = '';
        break;
      } catch (err) {
        lastError = (err as Error).message.replace(/\s+/g, ' ').slice(0, 100);
        if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 4000));
      }
    }
    if (lastError) console.log(`  IN  #${m.id} -> FAILED after 3 tries: ${lastError}`);
  }
  console.log(`inbound transcribed: ${done}/${inbound.length}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('sttBackfill failed:', err.message);
  await prisma.$disconnect();
  process.exit(1);
});
