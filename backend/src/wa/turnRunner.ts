/**
 * Drains the inbound outbox: one customer message in, one agent reply out.
 *
 * WHY THIS IS AN OUTBOX AND NOT A CALLBACK. In the standalone project the model
 * call happened inside the Baileys `messages.upsert` handler. That is fine for
 * one number on a laptop and wrong here for three reasons: a slow model call
 * blocks the socket's event loop for every other account on the worker, a crash
 * mid-call loses the message entirely, and nothing stops the same message being
 * processed twice after a reconnect. Writing a `WhatsappAgentTurn` row with a
 * UNIQUE `triggerMessageId` and draining it separately fixes all three — a
 * double-run becomes a Postgres constraint violation rather than a second
 * charge and a second reply to the customer.
 *
 * The claim/attempts/nextAttemptAt shape is copied field-for-field from
 * SheetPushJob, and the drain follows services/sheetPush.service.ts: claim a
 * batch under a token, re-read by that token, work it, mark it. Without the
 * token two overlapping drains re-read by status alone and both answer.
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { buildContext, runTurn, type BrainIntents, type BrainMessage } from './brain.js';
import { asksForVoice, shouldSpeak, synthesize } from './speech.js';
import { canAffordReply, chargeTurn, isWaAgentActive, WA_GATE_SELECT } from '../services/waCredits.service.js';
import { tokenCostCents } from '../lib/waPricing.js';
import { resolveModel } from './catalogue.js';
import { getSecret } from '../lib/secretStore.js';
import { promoteContactToLead } from '../services/waLeadPromotion.service.js';
import { waLog, type WaLogRef } from '../services/waLogs.service.js';
import { getIO } from '../lib/realtime.js';

const BATCH = 5;
const MAX_ATTEMPTS = 3;

const mediaRoot = (): string => getSecret('WA_MEDIA_ROOT') || path.join(process.cwd(), 'wa-media');

/**
 * The agent row as this file reads it. `sttModel` is included for the voice
 * verify pass only — it transcribes the produced audio back, so it needs the
 * account's STT engine and not the brain's.
 */
type AgentRow = Prisma.WhatsappAgentGetPayload<{
  include: { brainModel: true; ttsModel: true; sttModel: true; activeVoice: true };
}>;

/** The account's local day, as YYYY-MM-DD. Never the server's. */
function localDay(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'Africa/Casablanca' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Minutes since midnight, in the account's zone. */
function localMinutes(timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone || 'Africa/Casablanca',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
  const [h, m] = parts.split(':').map(Number);
  return h * 60 + m;
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

/**
 * Whether the account is inside its stated working hours.
 * A window whose end is before its start crosses midnight (22:00 -> 02:00).
 */
function withinHours(timezone: string, start: string, end: string): boolean {
  const now = localMinutes(timezone);
  const from = toMinutes(start);
  const to = toMinutes(end);
  return from <= to ? now >= from && now < to : now >= from || now < to;
}

export interface DrainStats {
  claimed: number;
  replied: number;
  skipped: number;
  failed: number;
}

/**
 * One pass over the pending turns.
 *
 * Turns are claimed across all accounts in one query rather than per account:
 * the drain runs every couple of seconds and a per-account loop would issue one
 * query per entitled account whether or not it had work.
 */
export async function drainTurns(): Promise<DrainStats> {
  const stats: DrainStats = { claimed: 0, replied: 0, skipped: 0, failed: 0 };
  const claimToken = randomUUID();

  const pending = await prisma.whatsappAgentTurn.findMany({
    where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
    orderBy: { id: 'asc' },
    take: BATCH,
    select: { id: true },
  });
  if (!pending.length) return stats;

  await prisma.whatsappAgentTurn.updateMany({
    where: { id: { in: pending.map((p) => p.id) }, status: 'PENDING' },
    data: { status: 'CLAIMED', claimToken, attempts: { increment: 1 } },
  });

  // Re-read by the token, not by the ids: another runner may have claimed some
  // of them between the SELECT and the UPDATE, and those are not ours to work.
  const turns = await prisma.whatsappAgentTurn.findMany({
    where: { claimToken, status: 'CLAIMED' },
  });
  stats.claimed = turns.length;

  for (const turn of turns) {
    try {
      const outcome = await runOneTurn(turn.id);
      if (outcome === 'replied') stats.replied++;
      else stats.skipped++;
    } catch (err) {
      stats.failed++;
      const message = (err as Error).message?.slice(0, 500) || 'Erreur inconnue';
      const attempts = turn.attempts;
      const dead = attempts >= MAX_ATTEMPTS;

      await prisma.whatsappAgentTurn.update({
        where: { id: turn.id },
        data: dead
          ? { status: 'FAILED', lastError: message, finishedAt: new Date() }
          : {
              status: 'PENDING',
              lastError: message,
              claimToken: null,
              // Backoff, so a provider outage does not burn every attempt in
              // six seconds and hand the customer silence.
              nextAttemptAt: new Date(Date.now() + attempts * 30_000),
            },
      });

      waLog({
        userId: turn.userId,
        contactId: turn.contactId,
        turnId: turn.id,
        messageWaId: turn.triggerMessageId,
        level: dead ? 'ERROR' : 'WARN',
        category: 'WORKER',
        event: dead ? 'turn.failed' : 'turn.retry',
        message: dead
          ? "La réponse de l'agent a échoué après 3 tentatives — le client n'aura pas de réponse."
          : `Échec du traitement de la réponse (tentative ${attempts}) — nouvelle tentative programmée.`,
        meta: { turnId: turn.id, attempts },
        error: err,
      });

      console.error(`[wa/turn] turn ${turn.id} failed (attempt ${attempts}):`, message);
    }
  }

  return stats;
}

type TurnOutcome = 'replied' | 'skipped';

async function runOneTurn(turnId: number): Promise<TurnOutcome> {
  const turn = await prisma.whatsappAgentTurn.findUniqueOrThrow({ where: { id: turnId } });

  const [agent, contact, gate] = await Promise.all([
    prisma.whatsappAgent.findUnique({
      where: { userId: turn.userId },
      include: { brainModel: true, ttsModel: true, sttModel: true, activeVoice: true },
    }),
    prisma.whatsappContact.findUnique({ where: { id: turn.contactId } }),
    prisma.user.findUnique({ where: { id: turn.userId }, select: WA_GATE_SELECT }),
  ]);

  // Every row this turn writes carries the same identity, so a support question
  // about one conversation filters down to one thread.
  const ref: WaLogRef = {
    userId: turn.userId,
    contactId: turn.contactId,
    contactJid: contact?.jid ?? null,
    contactName: contact?.pushName ?? null,
    turnId,
    messageWaId: turn.triggerMessageId,
  };

  const skip = async (reason: string): Promise<TurnOutcome> => {
    await prisma.whatsappAgentTurn.update({
      where: { id: turnId },
      data: { status: 'SKIPPED', skipReason: reason, finishedAt: new Date() },
    });
    waLog({
      ...ref,
      level: 'DEBUG',
      category: 'WORKER',
      event: 'turn.skipped',
      message: `Aucune réponse envoyée : ${reason}`,
      meta: { turnId, reason },
    });
    return 'skipped';
  };

  if (!agent || !contact) return skip('Agent ou conversation introuvable.');

  // Re-checked here and not only at ingest: an admin can revoke the entitlement
  // mid-conversation, and a queued turn must not still be answered afterwards.
  if (!isWaAgentActive(gate)) return skip('Agent désactivé par la plateforme.');

  if (!agent.enabled) return skip('Agent en pause.');
  if (!contact.aiEnabled) return skip('IA en pause sur cette conversation (reprise humaine).');
  if (contact.status === 'REJECTED') return skip('Conversation marquée refusée.');
  if (contact.status === 'CONFIRMED' && agent.afterConfirmed === 'stop') {
    return skip('Commande confirmée, agent réglé sur silence après confirmation.');
  }
  if (agent.replyTo === 'ads_only' && contact.source !== 'AD') {
    return skip('Réglé pour ne répondre qu’aux conversations issues de publicités.');
  }

  // Per-contact and per-day ceilings, and the minimum gap that kills the
  // double-reply loop the standalone project hit when two messages arrived
  // within a second of each other.
  if (contact.aiReplyCount >= agent.maxRepliesPerContact) {
    return skip(`Limite de ${agent.maxRepliesPerContact} réponses atteinte sur cette conversation.`);
  }
  if (
    contact.lastReplyAt &&
    Date.now() - contact.lastReplyAt.getTime() < agent.minSecondsBetweenReplies * 1000
  ) {
    return skip('Réponse trop rapprochée de la précédente.');
  }

  const day = localDay(agent.timezone);
  const today = await prisma.whatsappAgentUsage.aggregate({
    where: { userId: turn.userId, day },
    _sum: { turns: true, inputTokens: true, outputTokens: true },
  });

  if ((today._sum.turns ?? 0) >= agent.maxRepliesPerDay) {
    return skip(`Limite quotidienne de ${agent.maxRepliesPerDay} réponses atteinte.`);
  }
  if (
    agent.dailyTokenBudget > 0 &&
    (today._sum.inputTokens ?? 0) + (today._sum.outputTokens ?? 0) >= agent.dailyTokenBudget
  ) {
    return skip('Budget quotidien de jetons atteint.');
  }

  // Outside working hours the agent says so once and stops. Sent as a normal
  // outbound job so it obeys the same retry and idempotency rules as a reply.
  if (agent.workingHoursEnabled && !withinHours(agent.timezone, agent.workingHoursStart, agent.workingHoursEnd)) {
    if (agent.afterHoursMessage) {
      await enqueueText(turn.userId, contact.id, agent.afterHoursMessage, `afterhours:${turn.triggerMessageId}`);
    }
    return skip('Hors des horaires d’ouverture.');
  }

  if (!(await canAffordReply(turn.userId))) {
    await prisma.whatsappAgentTurn.update({
      where: { id: turnId },
      data: { status: 'BLOCKED_NO_CREDITS', skipReason: 'Crédits IA épuisés.', finishedAt: new Date() },
    });
    waLog({
      ...ref,
      level: 'WARN',
      category: 'CREDITS',
      event: 'turn.no_credits',
      message: "Crédits IA épuisés : l'agent ne peut plus répondre à ce client.",
      meta: { turnId },
    });
    emit(turn.userId, 'wa:credits-exhausted', { contactId: contact.id });
    return 'skipped';
  }

  const model = agent.brainModel?.isEnabled ? agent.brainModel : await resolveModel('BRAIN', agent.brainModelId);
  if (!model) return skip('Aucun modèle de cerveau activé sur la plateforme.');

  // The trigger message: escalation keywords are checked against the actual
  // text the customer just sent, not the whole history.
  const trigger = await prisma.whatsappMessage.findFirst({
    where: { userId: turn.userId, waId: turn.triggerMessageId },
  });

  const triggerText = `${trigger?.body || ''} ${trigger?.transcript || ''}`.toLowerCase();
  const handoff = agent.handoffKeywords
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);

  if (handoff.some((k) => triggerText.includes(k))) {
    await prisma.whatsappContact.update({
      where: { id: contact.id },
      data: { status: 'HUMAN', aiEnabled: false },
    });
    waLog({
      ...ref,
      level: 'WARN',
      category: 'WORKER',
      event: 'turn.handoff',
      message: 'Le client demande un humain : la conversation passe en reprise manuelle.',
      request: { text: trigger?.body || trigger?.transcript || null },
      meta: { turnId },
    });
    emit(turn.userId, 'wa:needs-human', { contactId: contact.id, reason: 'Mot-clé de transfert détecté.' });
    return skip('Transfert à un humain demandé par mot-clé.');
  }

  const { history, mediaDirs } = await loadHistory(turn.userId, contact.id, agent);

  // Decided BEFORE the model writes, because the model has to know. It cannot
  // observe its own audio, and a reply written as text and then spoken is how
  // the agent ends up telling a customer, out loud, that it cannot speak.
  const customerSpoke = trigger?.kind === 'AUDIO';
  const customerAskedForVoice = asksForVoice(triggerText);
  const voiceEnabled = agent.ttsMode !== 'never' && !!agent.activeVoice;
  const willSpeak = voiceEnabled && (agent.ttsMode === 'always' || customerSpoke || customerAskedForVoice);

  const context = buildContext({
    phone: contact.phone,
    pushName: contact.pushName,
    source: contact.source,
    adHeadline: contact.adHeadline,
    adBody: contact.adBody,
    adSourceUrl: contact.adSourceUrl,
    draft: (contact.draft || {}) as Record<string, unknown>,
    status: contact.status,
    timezone: agent.timezone,
    voice: voiceEnabled
      ? { enabled: true, mode: agent.ttsMode, willSpeak, maxChars: agent.ttsMaxChars }
      : null,
  });

  const result = await runTurn({
    // compiledPrompt is rendered on save. Falling back to an empty string would
    // let a mis-saved agent sell with no rules at all, so refuse instead.
    systemPrompt:
      agent.compiledPrompt ||
      (() => {
        throw new Error('Prompt non compilé — enregistrez la base de connaissances.');
      })(),
    context,
    history,
    model: {
      provider: model.provider,
      modelId: model.modelId,
      supportsEffort: model.supportsEffort,
      supportsThinking: model.supportsThinking,
      supportsMidSystem: model.supportsMidSystem,
      supportsFallbacks: model.supportsFallbacks,
      maxOutputTokens: model.maxOutputTokens,
    },
    effort: agent.effort,
    maxOutputTokens: agent.maxOutputTokens,
    // Only the CLI engine uses these, and only to look at an attachment the
    // customer sent: it reads a text transcript and cannot take inline base64.
    readableDirs: mediaDirs,
    log: ref,
  });

  const costCents = tokenCostCents(result.usage, model);

  await prisma.whatsappAgentTurn.update({
    where: { id: turnId },
    data: {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cacheReadTokens: result.usage.cacheReadTokens,
      cacheWriteTokens: result.usage.cacheWriteTokens,
      costCents,
    },
  });

  await recordUsage(turn.userId, day, model.id, result.usage, costCents);

  // A refusal that no fallback rescued leaves nothing to send. Escalate rather
  // than inventing a reply or leaving the customer on read.
  if (result.refusal) {
    await prisma.whatsappContact.update({
      where: { id: contact.id },
      data: { status: 'HUMAN', aiEnabled: false },
    });
    emit(turn.userId, 'wa:needs-human', { contactId: contact.id, reason: result.refusal });
    return skip(`Réponse refusée : ${result.refusal}`);
  }

  await applyIntents(turn.userId, contact.id, result.intents, agent, ref);

  if (!result.reply.trim()) return skip('Le modèle n’a produit aucun message.');

  // Charged for the reply that was produced, before it is queued to send. The
  // unique turnId means a retried send cannot bill twice.
  const charge = await chargeTurn(turn.userId, turnId);
  if (!charge.ok) {
    await prisma.whatsappAgentTurn.update({
      where: { id: turnId },
      data: { status: 'BLOCKED_NO_CREDITS', skipReason: 'Crédits IA épuisés.', finishedAt: new Date() },
    });
    emit(turn.userId, 'wa:credits-exhausted', { contactId: contact.id });
    return 'skipped';
  }

  /**
   * ONE reply reaches the customer, never two.
   *
   * The order here is load-bearing and it used to be the other way round: the
   * text was enqueued first, then a voice note was added on top, so every
   * spoken reply arrived twice — the same sentence to read, then to listen to.
   * On WhatsApp that reads as a bot talking over itself.
   *
   * So synthesis now runs FIRST and the text is the FALLBACK. The cost is
   * latency: nothing reaches the customer until the voice chain finishes or
   * gives up, which is bounded by WhatsappAgent.ttsTimeoutMs (90 s by default)
   * per engine in the chain. That is the account's dial to turn — the previous
   * behaviour bought its speed by sending a duplicate every time.
   *
   * When the reply is not going to be spoken at all, nothing changes: the text
   * goes out immediately, as it always did.
   */
  const speaking =
    voiceEnabled &&
    !!agent.activeVoice &&
    shouldSpeak(agent.ttsMode, agent.ttsMaxChars, result.reply, customerSpoke, customerAskedForVoice);

  let spokenPath: string | null = null;

  if (speaking && agent.activeVoice) {
    try {
      const spoken = await synthesize(
        result.reply,
        {
          provider: agent.activeVoice.provider,
          voiceId: agent.activeVoice.voiceId,
          rate: agent.activeVoice.rate,
          pitch: agent.activeVoice.pitch,
          volume: agent.activeVoice.volume,
          style: agent.activeVoice.style,
          styleDegree: agent.activeVoice.styleDegree,
          stylePrompt: agent.activeVoice.stylePrompt,
        },
        {
          modelId: agent.ttsModel?.modelId,
          outDir: path.join(mediaRoot(), String(turn.userId), 'tts'),
          basename: `tts-${turn.triggerMessageId}`,
          policy: {
            chain: agent.ttsChain,
            retries: agent.ttsRetries,
            verify: agent.ttsVerify as 'never' | 'live_only' | 'always',
            onFailure: agent.ttsOnFailure as 'text_only' | 'fallback_edge',
            timeoutMs: agent.ttsTimeoutMs,
            sttProvider: agent.sttModel?.provider,
            sttModelId: agent.sttModel?.modelId,
          },
          log: ref,
        }
      );
      spokenPath = spoken.filePath;
    } catch (err) {
      // synthesize() has already written the TTS row saying which engines were
      // tried and why each refused. This row says what the CUSTOMER gets as a
      // result, which is the half a seller cares about.
      waLog({
        ...ref,
        level: 'WARN',
        category: 'TTS',
        event: 'voice.fell_back_to_text',
        message: "Note vocale impossible : la réponse part en texte à la place.",
        meta: { turnId },
        error: err,
      });
      console.error(`[wa/turn] TTS failed for turn ${turnId}:`, (err as Error).message);
    }
  }

  if (spokenPath) {
    await prisma.whatsappOutboundJob.create({
      data: {
        userId: turn.userId,
        contactId: contact.id,
        kind: 'VOICE',
        // The spoken text travels with the job so the sent message records what
        // was said rather than a file path.
        payload: { filePath: spokenPath, text: result.reply },
        idempotencyKey: `voice:${turn.triggerMessageId}`,
      },
    });
  } else {
    await enqueueText(turn.userId, contact.id, result.reply, `reply:${turn.triggerMessageId}`);
  }

  await enqueueRequestedMedia(turn.userId, contact.id, result.intents.media, agent, turn.triggerMessageId);

  await prisma.whatsappContact.update({
    where: { id: contact.id },
    data: {
      aiReplyCount: { increment: 1 },
      lastReplyAt: new Date(),
      status: contact.status === 'NEW' ? 'QUALIFIED' : undefined,
    },
  });

  await prisma.whatsappAgentTurn.update({
    where: { id: turnId },
    data: { status: 'DONE', finishedAt: new Date() },
  });

  return 'replied';
}

/**
 * The conversation as the model should see it.
 *
 * Images are attached inline as base64 blocks, capped at maxMediaPerTurn and
 * taken from the MOST RECENT messages: an old photo is rarely what the customer
 * is asking about, and every extra image is real money.
 *
 * The folders those images came from are returned alongside, because the CLI
 * engine cannot read a base64 block and has to be handed readable paths.
 */
async function loadHistory(
  userId: number,
  contactId: number,
  agent: AgentRow
): Promise<{ history: BrainMessage[]; mediaDirs: string[] }> {
  const rows = await prisma.whatsappMessage.findMany({
    where: { contactId },
    orderBy: { createdAt: 'desc' },
    take: Math.max(4, agent.historyMessages),
  });
  rows.reverse();

  let imagesLeft = agent.readImages ? agent.maxMediaPerTurn : 0;
  const out: BrainMessage[] = [];
  const dirs = new Set<string>();

  for (let i = rows.length - 1; i >= 0; i--) {
    const m = rows[i];
    const role: 'user' | 'assistant' = m.direction === 'IN' ? 'user' : 'assistant';

    let text = (m.body || '').slice(0, agent.maxInputChars);
    if (m.transcript) text = `${text ? `${text}\n` : ''}${m.transcript}`.slice(0, agent.maxInputChars);
    if (m.kind === 'AUDIO' && !m.transcribed) {
      text = text || '[voice note — transcription unavailable]';
    }

    const wantsImage =
      role === 'user' && imagesLeft > 0 && (m.kind === 'IMAGE' || m.kind === 'STICKER') && !!m.mediaPath;

    if (wantsImage && fs.existsSync(m.mediaPath!)) {
      imagesLeft--;
      dirs.add(path.dirname(m.mediaPath!));
      const data = fs.readFileSync(m.mediaPath!).toString('base64');
      const mediaType = (m.mediaMime || 'image/jpeg').split(';')[0];
      const blocks: Anthropic.ContentBlockParam[] = [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType as 'image/jpeg', data },
        },
        ...(text ? [{ type: 'text' as const, text }] : []),
      ];
      out.unshift({ role, content: blocks });
      continue;
    }

    if (!text.trim()) {
      // A message with neither text nor a usable attachment still has to appear,
      // or the model sees a gap where the customer clearly said something.
      text = m.kind === 'TEXT' ? '' : `[${m.kind.toLowerCase()} attachment]`;
      if (!text) continue;
    }

    out.unshift({ role, content: text });
  }

  // The API requires the conversation to start with a user turn.
  while (out.length && out[0].role !== 'user') out.shift();

  return { history: out, mediaDirs: [...dirs] };
}

/** Applies what the agent decided. Runs once, after the tool loop. */
export async function applyIntents(
  userId: number,
  contactId: number,
  intents: BrainIntents,
  agent: AgentRow,
  ref: WaLogRef
): Promise<void> {
  const contact = await prisma.whatsappContact.findUniqueOrThrow({ where: { id: contactId } });
  const data: Prisma.WhatsappContactUpdateInput = {};

  if (intents.lead) {
    // Merged, never replaced: save_lead is called repeatedly with partial data
    // and overwriting would lose a field collected three messages ago.
    data.draft = {
      ...((contact.draft || {}) as Record<string, unknown>),
      ...intents.lead,
    } as Prisma.InputJsonValue;
  }

  if (intents.confirm) {
    data.status = 'CONFIRMED';
    data.confirmedAt = new Date();
  } else if (intents.reject) {
    data.status = 'REJECTED';
  } else if (intents.human) {
    // Flag the conversation for a human but keep the AI answering. Pausing it
    // here left customers on read whenever nobody picked up the escalation;
    // the real takeover moment is a human replying from the inbox, and THAT
    // is what sets aiEnabled=false (whatsappInbox.routes.ts send handler).
    data.status = 'HUMAN';
  }

  if (Object.keys(data).length) {
    await prisma.whatsappContact.update({ where: { id: contactId }, data });
  }

  if (intents.human) emit(userId, 'wa:needs-human', { contactId, reason: intents.human });

  if (intents.confirm) {
    emit(userId, 'wa:order-confirmed', { contactId, summary: intents.confirm });

    // The one place agent output crosses into the billed pipeline, and it is
    // opt-in for exactly that reason — see WhatsappAgent.autoCreateLead.
    if (agent.autoCreateLead && !contact.leadId) {
      try {
        const lead = await promoteContactToLead(contactId);
        emit(userId, 'wa:lead-created', { contactId, leadId: lead.id });
      } catch (err) {
        // Never fatal to the turn: the reply is already written, and a draft
        // that could not be promoted is still promotable by hand from the inbox.
        waLog({
          ...ref,
          level: 'WARN',
          category: 'LEAD',
          event: 'lead.auto_create_failed',
          message: "La commande confirmée n'a pas pu être transformée en lead automatiquement.",
          error: err,
        });
        console.error(`[wa/turn] auto lead creation failed for contact ${contactId}:`, err);
      }
    }
  }
}

/**
 * Queues the product photos the agent asked to send.
 *
 * Only files listed on an ENABLED profile for a product the account actually
 * has. The model names a product in free text, so it is matched against the
 * catalogue rather than trusted — otherwise a hallucinated product name would
 * send nothing and the customer would be left waiting for a photo.
 */
async function enqueueRequestedMedia(
  userId: number,
  contactId: number,
  requests: BrainIntents['media'],
  agent: AgentRow,
  triggerId: string
): Promise<void> {
  if (!agent.sendCatalogueMedia || !requests.length) return;

  const profiles = await prisma.whatsappProductProfile.findMany({
    where: { userId, enabled: true },
    include: {
      product: {
        select: {
          nameFr: true,
          nameAr: true,
          images: { select: { imageUrl: true }, orderBy: { sortOrder: 'asc' } },
        },
      },
    },
  });

  for (const [i, request] of requests.entries()) {
    const wanted = request.product.trim().toLowerCase();
    if (!wanted) continue;

    const match = profiles.find(
      (p) =>
        p.product.nameFr?.toLowerCase() === wanted ||
        p.product.nameAr?.toLowerCase() === wanted ||
        p.product.nameFr?.toLowerCase().includes(wanted) ||
        wanted.includes((p.product.nameFr || '').toLowerCase())
    );
    if (!match) continue;

    const urls = match.mediaUrls.length ? match.mediaUrls : match.product.images.map((im) => im.imageUrl);

    // Capped: a customer asking "photo?" should get a few, not a catalogue dump.
    for (const [j, url] of urls.slice(0, 3).entries()) {
      await prisma.whatsappOutboundJob.create({
        data: {
          userId,
          contactId,
          kind: 'MEDIA',
          payload: {
            source: url,
            caption: j === 0 ? request.note || '' : '',
            mediaKind: /\.(mp4|mov|webm)$/i.test(url) ? 'VIDEO' : 'IMAGE',
          },
          idempotencyKey: `media:${triggerId}:${i}:${j}`,
        },
      });
    }
  }
}

async function enqueueText(
  userId: number,
  contactId: number,
  text: string,
  idempotencyKey: string
): Promise<void> {
  try {
    await prisma.whatsappOutboundJob.create({
      data: { userId, contactId, kind: 'TEXT', payload: { text }, idempotencyKey },
    });
  } catch (err: any) {
    // P2002 means this exact reply is already queued or sent. That is the guard
    // working, not a failure.
    if (err?.code !== 'P2002') throw err;
  }
}

/** Rolls token spend into the daily bucket the budget and the admin read. */
async function recordUsage(
  userId: number,
  day: string,
  modelId: number,
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number },
  costCents: number
): Promise<void> {
  await prisma.whatsappAgentUsage.upsert({
    where: { userId_day_modelId: { userId, day, modelId } },
    update: {
      turns: { increment: 1 },
      inputTokens: { increment: usage.inputTokens },
      outputTokens: { increment: usage.outputTokens },
      cacheReadTokens: { increment: usage.cacheReadTokens },
      cacheWriteTokens: { increment: usage.cacheWriteTokens },
      costCents: { increment: costCents },
    },
    create: {
      userId,
      day,
      modelId,
      turns: 1,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      costCents,
    },
  });
}

/**
 * Realtime nudge to the account's browser tabs.
 *
 * In the worker process there is no Socket.IO server, so getIO() is null and
 * this is a no-op — the UI polls instead. It is still called from here so the
 * same code path works when a turn is run in-process during development.
 */
function emit(userId: number, event: string, payload: unknown): void {
  try {
    getIO()?.to(`user:${userId}`).emit(event, payload);
  } catch {
    /* realtime is never load-bearing */
  }
}
