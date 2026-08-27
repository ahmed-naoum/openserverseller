/**
 * `silacod-wa` — the second pm2 app. Entry point for the WhatsApp workers.
 *
 * WHY A SEPARATE PROCESS. `backend/ecosystem.config.cjs` pins `silacod-api` to
 * instances:1 with max_memory_restart:'500M', and deploy.sh restarts it on
 * every deploy. A pool of long-lived Baileys sockets in that heap would be
 * OOM-restarted in the middle of customer conversations and killed on every
 * push, and each restart costs every connected seller a reconnect. So the
 * sockets live here, with their own memory ceiling, and the two processes share
 * nothing but Postgres and the encrypted secret store.
 *
 * The API never calls into this process for anything load-bearing. It writes
 * `WhatsappSession.desiredState` and the outbox tables, then optionally nudges
 * the loopback control server to skip the polling delay. A nudge that never
 * arrives — worker restarting, request dropped — costs latency and nothing
 * else, because the reconcile tick converges on desiredState regardless.
 *
 * THE CONTROL SERVER BINDS 127.0.0.1 ONLY. It is protected by a shared token
 * and nothing else; it must never be reachable from outside the box, and no
 * nginx location should ever proxy it.
 */

import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { loadSecrets, getSecret, getSecretNumber } from '../lib/secretStore.js';
import { ensureCatalogue, resolveModel } from './catalogue.js';
import {
  BaileysTransport,
  isIgnorableJid,
  isSandboxJid,
  QR_TTL_MS,
  SANDBOX_DOMAIN,
  type InboundMessage,
  type WaStatus,
} from './transport.js';
import { transcribe } from './speech.js';
import { drainTurns } from './turnRunner.js';
import { isWaAgentActive } from '../services/waCredits.service.js';
import { waLog, setWaLogSource, pruneWaLogs, flushWaLogs } from '../services/waLogs.service.js';

/** This worker's identity, so its claims are distinguishable from another's. */
const WORKER_ID = randomUUID();

const RECONCILE_MS = 10_000;
const TURN_DRAIN_MS = 2_000;
const OUTBOUND_DRAIN_MS = 1_500;

const mediaRoot = (): string => getSecret('WA_MEDIA_ROOT') || path.join(process.cwd(), 'wa-media');

/** userId -> live transport. The only in-memory state that matters. */
const live = new Map<number, BaileysTransport>();

/**
 * userId -> earliest time we may open another socket for it.
 *
 * A pairing QR that nobody scans closes the connection, and the reconcile tick
 * would otherwise reopen it immediately — a socket to WhatsApp every 10 seconds
 * for as long as the seller leaves the connect screen open, which is exactly
 * the pattern that gets an IP rate-limited.
 */
const retryAfter = new Map<number, number>();
const RECONNECT_COOLDOWN_MS = 20_000;

/**
 * How long another worker's claim is honoured without a heartbeat.
 *
 * Comfortably more than RECONCILE_MS, so a healthy worker always refreshes its
 * own claims before they look abandoned, but short enough that a worker killed
 * mid-session does not strand its accounts for long.
 */
const STALE_CLAIM_MS = 45_000;

/**
 * How late a queued message may be and still get an automatic reply.
 *
 * Only applies to messages delivered from WhatsApp's offline queue, where the
 * gap between "sent" and "received by us" can be arbitrary. Thirty minutes is
 * roughly how long a customer waits before deciding nobody is coming: inside
 * that, a reply still reads as slow; outside it, it reads as a machine
 * answering yesterday's question.
 *
 * The message itself is stored either way — this only governs the agent.
 */
const OFFLINE_REPLY_WINDOW_MS = 30 * 60_000;

let stopping = false;

/* ------------------------------------------------------------------ */
/* session lifecycle                                                   */
/* ------------------------------------------------------------------ */

/** What each socket state means to whoever is reading the activity log. */
const STATUS_TEXT: Record<string, string> = {
  DISCONNECTED: 'WhatsApp déconnecté.',
  QR: 'En attente du scan du QR code.',
  CONNECTING: 'Connexion à WhatsApp en cours…',
  CONNECTED: 'WhatsApp connecté.',
  LOGGED_OUT: 'Session fermée depuis le téléphone — il faudra rescanner un QR code.',
  BANNED: 'Numéro bloqué par WhatsApp.',
};

async function setStatus(
  userId: number,
  status: WaStatus,
  meta: { phone?: string | null; pushName?: string | null; error?: string | null } = {}
): Promise<void> {
  waLog({
    userId,
    level: meta.error || status === 'BANNED' ? 'ERROR' : status === 'LOGGED_OUT' ? 'WARN' : 'INFO',
    category: 'SESSION',
    event: `session.${status.toLowerCase()}`,
    message: STATUS_TEXT[status] || `État de session : ${status}.`,
    meta: { status, phone: meta.phone ?? null, pushName: meta.pushName ?? null, worker: WORKER_ID },
    error: meta.error || undefined,
  });

  await prisma.whatsappSession.updateMany({
    where: { userId },
    data: {
      status,
      phoneNumber: meta.phone ?? undefined,
      pushName: meta.pushName ?? undefined,
      lastError: meta.error ?? (status === 'CONNECTED' ? null : undefined),
      lastConnectedAt: status === 'CONNECTED' ? new Date() : undefined,
      lastDisconnectAt: status === 'DISCONNECTED' || status === 'LOGGED_OUT' ? new Date() : undefined,
      // A connected session has no pending QR. Leaving a stale one would let
      // the connect screen keep showing a code that can no longer be scanned.
      qr: status === 'CONNECTED' || status === 'LOGGED_OUT' ? null : undefined,
    },
  });
}

async function startSession(userId: number): Promise<void> {
  if (live.has(userId)) return;

  const transport = new BaileysTransport(
    userId,
    mediaRoot(),
    {
      onQr: async (qr) => {
        waLog({
          userId,
          category: 'SESSION',
          event: 'session.qr',
          message: 'Nouveau QR code émis (valable une minute).',
          meta: { expiresInMs: QR_TTL_MS },
        });
        await prisma.whatsappSession.updateMany({
          where: { userId },
          // Baileys rotates the code every QR_TTL_MS. The expiry is what lets
          // the API report "expired" instead of serving one that cannot be
          // scanned, which is the most confusing failure in this whole flow.
          data: { qr, qrExpiresAt: new Date(Date.now() + QR_TTL_MS), status: 'QR' },
        });
      },
      onStatus: async (status, meta) => {
        await setStatus(userId, status, meta);
        if (status === 'CONNECTED') retryAfter.delete(userId);

        // ANY closed socket leaves the map. Previously only DISCONNECTED and
        // LOGGED_OUT did, so a recoverable close — which reports CONNECTING —
        // left a dead transport behind. reconcile() skips whatever is already
        // in `live`, so that session was never restarted and the account sat on
        // "connexion…" until the worker was restarted by hand.
        if (meta.closed) {
          live.delete(userId);
          // Hand the claim back immediately rather than making a peer wait out
          // STALE_CLAIM_MS for a session we know we are no longer running.
          if (!meta.restartRequired) {
            await prisma.whatsappSession.updateMany({
              where: { userId, claimToken: WORKER_ID },
              data: { claimToken: null, claimedAt: null },
            });
          }
        }

        if (status === 'LOGGED_OUT' || status === 'BANNED') {
          // Do not fight WhatsApp. Stop asking for this session until a human
          // reconnects it, or the reconcile tick would retry forever.
          await prisma.whatsappSession.updateMany({ where: { userId }, data: { desiredState: 'OFF' } });
        }

        // The last step of pairing. Straight back in, no backoff: the seller
        // has just scanned and is watching the screen.
        if (meta.restartRequired) {
          retryAfter.delete(userId);
          setImmediate(() => {
            void startSession(userId).catch((err) =>
              console.error(`[wa/worker] post-pairing restart failed for user ${userId}:`, (err as Error).message)
            );
          });
        }
      },
      onMessage: (msg) => ingest(userId, msg),
    },
    { maxMediaBytes: 20 * 1024 * 1024 }
  );

  live.set(userId, transport);

  try {
    await transport.connect();
  } catch (err) {
    live.delete(userId);
    waLog({
      userId,
      category: 'SESSION',
      event: 'session.start_failed',
      message: "La connexion WhatsApp n'a pas pu être ouverte.",
      meta: { worker: WORKER_ID },
      error: err,
    });
    await setStatus(userId, 'DISCONNECTED', { error: (err as Error).message?.slice(0, 500) });
    throw err;
  }
}

async function stopSession(userId: number, logout = false): Promise<void> {
  const transport = live.get(userId);
  live.delete(userId);
  if (transport) await transport.disconnect(logout);
  await setStatus(userId, logout ? 'LOGGED_OUT' : 'DISCONNECTED');
  // Scoped to this worker: releasing a claim we do not hold would hand another
  // worker's live session to a third one.
  await prisma.whatsappSession.updateMany({
    where: { userId, claimToken: WORKER_ID },
    data: { claimToken: null, claimedAt: null },
  });
}

/**
 * Brings live sockets in line with what the database says should be running.
 *
 * This is the self-healing tick, and it is what makes the loopback nudge
 * optional rather than load-bearing. It also enforces two things a nudge never
 * could: an account whose entitlement was revoked is disconnected even though
 * nobody told this process, and the global session cap is applied at claim time
 * rather than only at the API.
 */
async function reconcile(): Promise<void> {
  if (stopping) return;

  const wanted = await prisma.whatsappSession.findMany({
    where: { desiredState: 'ON' },
    select: { userId: true, status: true },
  });

  const gates = await prisma.user.findMany({
    where: { id: { in: wanted.map((w) => w.userId) } },
    select: { id: true, whatsappAgentEnabled: true, whatsappAgentGateFrom: true },
  });
  const entitled = new Set(gates.filter((g) => isWaAgentActive(g)).map((g) => g.id));

  const cap = getSecretNumber('WA_MAX_SESSIONS', 0);

  // Revoked mid-conversation: without this the socket stays up and the agent
  // keeps answering customers on an account that no longer has the feature.
  for (const session of wanted) {
    if (!entitled.has(session.userId)) {
      waLog({
        userId: session.userId,
        level: 'WARN',
        category: 'SESSION',
        event: 'session.revoked',
        message: "L'agent a été désactivé pour ce compte : la session est coupée.",
        meta: { wasLive: live.has(session.userId) },
      });
      await prisma.whatsappSession.updateMany({
        where: { userId: session.userId },
        data: { desiredState: 'OFF', lastError: 'Agent désactivé par la plateforme.' },
      });
      if (live.has(session.userId)) await stopSession(session.userId);
    }
  }

  const shouldRun = wanted.filter((w) => entitled.has(w.userId)).map((w) => w.userId);

  // Reap sockets that died without saying so.
  //
  // Baileys does not always emit `connection.update: close` — a query times
  // out, the WebSocket goes quiet, and every one of our own signals still says
  // healthy. The session then sits in the live map recorded as CONNECTED, this
  // tick skips it as already-running, and inbound messages simply stop with
  // nothing reporting a fault. Asking the socket itself is the only reliable
  // check; everything else is our own optimism.
  // isReapable(), not isConnected(): a socket that has not finished connecting
  // yet is not a dead one, and killing it mid-handshake is what turned every
  // startup into a cycle of stalled/reconnect/stalled.
  for (const [userId, transport] of [...live.entries()]) {
    if (!transport.isReapable()) continue;

    console.warn(`[wa/worker] socket for user ${userId} is dead without a close event — reconnecting`);
    waLog({
      userId,
      level: 'WARN',
      category: 'SESSION',
      event: 'session.stalled',
      message: 'Socket WhatsApp muet sans événement de fermeture — reconnexion automatique.',
      meta: { worker: WORKER_ID, cooldownMs: RECONNECT_COOLDOWN_MS },
    });
    live.delete(userId);
    try {
      await transport.disconnect(false);
    } catch {
      /* it is already gone; this is best-effort cleanup */
    }
    await prisma.whatsappSession.updateMany({
      where: { userId },
      data: {
        status: 'CONNECTING',
        lastError: 'Connexion WhatsApp perdue sans notification — reconnexion automatique.',
        claimToken: null,
        claimedAt: null,
      },
    });
    // Reconnect on the next pass rather than immediately: whatever killed the
    // socket is often still true a second later.
    retryAfter.set(userId, Date.now() + RECONNECT_COOLDOWN_MS);
  }

  // Heartbeat the sessions this worker already owns, so a peer never mistakes
  // a healthy claim for an abandoned one.
  if (live.size) {
    await prisma.whatsappSession.updateMany({
      where: { userId: { in: [...live.keys()] }, claimToken: WORKER_ID },
      data: { claimedAt: new Date() },
    });
  }

  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS);

  for (const userId of shouldRun) {
    if (live.has(userId)) continue;

    const notBefore = retryAfter.get(userId) ?? 0;
    if (Date.now() < notBefore) continue;

    // Take ownership, or leave it to whoever holds it. The where-clause IS the
    // lock: Postgres serialises the conditional update, so exactly one worker
    // can win an unclaimed or expired row.
    const claim = await prisma.whatsappSession.updateMany({
      where: {
        userId,
        desiredState: 'ON',
        OR: [{ claimToken: null }, { claimToken: WORKER_ID }, { claimedAt: { lt: staleBefore } }],
      },
      data: { claimToken: WORKER_ID, claimedAt: new Date() },
    });
    if (claim.count === 0) continue;

    if (cap > 0 && live.size >= cap) {
      waLog({
        userId,
        level: 'WARN',
        category: 'WORKER',
        event: 'session.capped',
        message: `Plafond de ${cap} sessions atteint sur ce worker : la connexion attend qu'une place se libère.`,
        meta: { cap, live: live.size, worker: WORKER_ID },
      });
      await prisma.whatsappSession.updateMany({
        where: { userId },
        data: { lastError: 'Capacité maximale de sessions atteinte sur ce worker.' },
      });
      continue;
    }
    retryAfter.set(userId, Date.now() + RECONNECT_COOLDOWN_MS);
    try {
      await startSession(userId);
    } catch (err) {
      console.error(`[wa/worker] failed to start session for user ${userId}:`, (err as Error).message);
    }
  }

  // Anything running that should not be.
  const allowed = new Set(shouldRun);
  for (const userId of [...live.keys()]) {
    if (!allowed.has(userId)) await stopSession(userId);
  }
}

/* ------------------------------------------------------------------ */
/* inbound                                                             */
/* ------------------------------------------------------------------ */

/**
 * Stores a customer message and queues a turn for it.
 *
 * The model is NOT called here. This runs on the Baileys socket callback, and a
 * multi-second model call on that callback would stall every other account
 * sharing this worker.
 */
async function ingest(userId: number, msg: InboundMessage): Promise<void> {
  if (isIgnorableJid(msg.jid)) return;

  const agent = await prisma.whatsappAgent.findUnique({
    where: { userId },
    select: {
      sttEnabled: true,
      sttModelId: true,
      sttPrompt: true,
      sttChain: true,
      sttRetries: true,
      readImages: true,
    },
  });

  const contact = await prisma.whatsappContact.upsert({
    where: { userId_jid: { userId, jid: msg.jid } },
    update: {
      pushName: msg.pushName ?? undefined,
      // Only ever fills a gap. A later message on a @lid chat may carry the
      // number the first one withheld; none of them should clear a known one.
      ...(msg.phone ? { phone: msg.phone } : {}),
      lastMessageAt: msg.timestamp,
      unreadCount: { increment: 1 },
      // An existing organic contact that comes back through an ad is promoted
      // to AD, because the ad creative is the better context for the next reply.
      ...(msg.fromAd
        ? {
            source: 'AD',
            adHeadline: msg.adHeadline ?? undefined,
            adBody: msg.adBody ?? undefined,
            adSourceUrl: msg.adSourceUrl ?? undefined,
          }
        : {}),
    },
    create: {
      userId,
      jid: msg.jid,
      phone: msg.phone,
      pushName: msg.pushName,
      source: msg.fromAd ? 'AD' : 'ORGANIC',
      adHeadline: msg.adHeadline,
      adBody: msg.adBody,
      adSourceUrl: msg.adSourceUrl,
      lastMessageAt: msg.timestamp,
      unreadCount: 1,
    },
  });

  let stored;
  try {
    stored = await prisma.whatsappMessage.create({
      data: {
        userId,
        contactId: contact.id,
        waId: msg.waId,
        direction: 'IN',
        kind: msg.kind,
        body: msg.body || null,
        mediaPath: msg.mediaPath,
        mediaMime: msg.mediaMime,
        mediaSize: msg.mediaSize,
      },
    });
  } catch (err: any) {
    // P2002 on (userId, waId): Baileys redelivered a message we already have.
    // Silently done — this is exactly what the unique index is for.
    if (err?.code === 'P2002') return;
    waLog({
      userId,
      contactId: contact.id,
      contactJid: msg.jid,
      contactName: contact.pushName,
      messageWaId: msg.waId,
      category: 'INBOUND',
      event: 'inbound.store_failed',
      message: "Message client reçu mais impossible à enregistrer — l'agent ne répondra pas.",
      request: { kind: msg.kind, body: msg.body, mime: msg.mediaMime },
      error: err,
    });
    throw err;
  }

  // The customer's side of the conversation, as it entered the system. Paired
  // with brain.answer this is the whole exchange, in one filterable place.
  waLog({
    userId,
    contactId: contact.id,
    contactJid: msg.jid,
    contactName: contact.pushName,
    messageWaId: msg.waId,
    category: 'INBOUND',
    event: 'inbound.received',
    message:
      msg.kind === 'TEXT'
        ? `Message reçu : « ${String(msg.body || '').replace(/\s+/g, ' ').slice(0, 160)} »`
        : `${msg.kind} reçu du client.`,
    request: {
      kind: msg.kind,
      body: msg.body,
      mediaMime: msg.mediaMime,
      mediaSize: msg.mediaSize,
      fromAd: msg.fromAd,
      adHeadline: msg.adHeadline,
    },
    meta: {
      source: contact.source,
      status: contact.status,
      aiEnabled: contact.aiEnabled,
      newContact: contact.aiReplyCount === 0,
    },
  });

  // Voice notes become text before the turn runs, so the model never waits on
  // a transcription and a failed one degrades to "please type it" rather than
  // holding up the reply.
  if (msg.kind === 'AUDIO' && msg.mediaPath && agent?.sttEnabled) {
    try {
      const model = await resolveModel('STT', agent.sttModelId);
      if (model) {
        const { text } = await transcribe(msg.mediaPath, msg.mediaMime || 'audio/ogg', {
          provider: model.provider,
          modelId: model.modelId,
          prompt: agent.sttPrompt,
          // The fallbacks. Without them one rate-limited engine turns a voice
          // note into "[transcription unavailable]" and the agent answers a
          // question it never heard.
          chain: agent.sttChain,
          retries: agent.sttRetries,
          log: {
            userId,
            contactId: contact.id,
            contactJid: msg.jid,
            contactName: contact.pushName,
            messageWaId: msg.waId,
          },
        });
        await prisma.whatsappMessage.update({
          where: { id: stored.id },
          data: { transcript: text, transcribed: true },
        });
      }
    } catch (err) {
      // Visible degradation, never silent data loss: the note is still in the
      // inbox and the reason is on the record.
      console.error(`[wa/worker] transcription failed for ${msg.waId}:`, (err as Error).message);
      await prisma.whatsappMessage.update({
        where: { id: stored.id },
        data: { transcript: null, transcribed: false },
      });
    }
  }

  // STORED ALWAYS, ANSWERED ONLY IF STILL WORTH ANSWERING.
  //
  // Everything above this line has already run: the message is in the inbox and
  // the seller can read it. The only question left is whether the agent should
  // reply, and for a message that came out of WhatsApp's offline queue the
  // answer is "only if it is still fresh".
  //
  // The reason is the reconnect case. A queue that has been accumulating while
  // the worker was down can deliver hours of conversation in one batch, and
  // answering all of it would have the agent replying to questions the customer
  // asked this morning as though they had just arrived — several at once, out
  // of order, to people who have long since given up or been served by a human.
  // Live messages are exempt because `notify` means WhatsApp pushed it to us
  // the moment it was sent.
  if (msg.offline && Date.now() - msg.timestamp.getTime() > OFFLINE_REPLY_WINDOW_MS) {
    waLog({
      userId,
      contactId: contact.id,
      contactJid: msg.jid,
      contactName: contact.pushName,
      messageWaId: msg.waId,
      level: 'INFO',
      category: 'INBOUND',
      event: 'turn.skipped_stale',
      message: `Message enregistré mais trop ancien pour une réponse automatique (${Math.round(
        (Date.now() - msg.timestamp.getTime()) / 60000
      )} min). Répondez à la main si nécessaire.`,
      meta: { ageMinutes: Math.round((Date.now() - msg.timestamp.getTime()) / 60000) },
    });
    return;
  }

  try {
    const turn = await prisma.whatsappAgentTurn.create({
      data: { userId, contactId: contact.id, triggerMessageId: msg.waId },
    });
    waLog({
      userId,
      contactId: contact.id,
      contactJid: msg.jid,
      contactName: contact.pushName,
      messageWaId: msg.waId,
      turnId: turn.id,
      level: 'DEBUG',
      category: 'INBOUND',
      event: 'turn.queued',
      message: "Réponse mise en file d'attente.",
      meta: { turnId: turn.id },
    });
  } catch (err: any) {
    // P2002 means this message already has a turn — a redelivery, and exactly
    // what the unique triggerMessageId is there to absorb.
    if (err?.code !== 'P2002') throw err;
  }
}

/* ------------------------------------------------------------------ */
/* outbound                                                            */
/* ------------------------------------------------------------------ */

async function drainOutbound(): Promise<void> {
  if (stopping) return;

  const claimToken = randomUUID();

  const pending = await prisma.whatsappOutboundJob.findMany({
    where: {
      status: 'PENDING',
      nextAttemptAt: { lte: new Date() },
      // A bench reply has no socket to wait for, and requiring one would mean
      // the dashboard test only works for accounts that have already paired a
      // phone — which is the opposite of what a bench is for.
      OR: [
        { userId: { in: [...live.keys()] } },
        { contact: { jid: { endsWith: SANDBOX_DOMAIN } } },
      ],
    },
    orderBy: { id: 'asc' },
    take: 10,
    select: { id: true },
  });
  if (!pending.length) return;

  await prisma.whatsappOutboundJob.updateMany({
    where: { id: { in: pending.map((p) => p.id) }, status: 'PENDING' },
    data: { status: 'SENDING', claimToken, attempts: { increment: 1 } },
  });

  const jobs = await prisma.whatsappOutboundJob.findMany({
    where: { claimToken, status: 'SENDING' },
    include: { contact: { select: { jid: true, id: true, pushName: true } } },
  });

  for (const job of jobs) {
    const transport = live.get(job.userId);

    if (!transport?.isConnected()) {
      waLog({
        userId: job.userId,
        contactId: job.contactId,
        contactJid: job.contact.jid,
        contactName: job.contact.pushName,
        level: 'WARN',
        category: 'OUTBOUND',
        event: 'outbound.deferred',
        message: 'WhatsApp non connecté : la réponse reste en file et repartira à la reconnexion.',
        meta: { jobId: job.id, kind: job.kind, attempts: job.attempts },
      });
      await prisma.whatsappOutboundJob.update({
        where: { id: job.id },
        data: {
          status: 'PENDING',
          claimToken: null,
          lastError: 'WhatsApp non connecté.',
          nextAttemptAt: new Date(Date.now() + 15_000),
        },
      });
      continue;
    }

    const jobStartedAt = Date.now();

    // The bench: everything above this line ran exactly as it does for a real
    // customer — the turn, the guard rails, the debit, the model. Only the hop
    // to WhatsApp is replaced, because @sandbox is not a routable domain.
    if (isSandboxJid(job.contact.jid)) {
      await deliverToBench(job, jobStartedAt);
      continue;
    }

    try {
      const payload = job.payload as Record<string, any>;
      const agent = await prisma.whatsappAgent.findUnique({
        where: { userId: job.userId },
        select: { typingDelayMs: true, replyDelayMs: true },
      });

      let waId: string | null = null;

      if (job.kind === 'TEXT') {
        // Typing indicator then a pause, so a reply does not land the
        // millisecond the customer hits send and read as a machine.
        await transport.setPresence(job.contact.jid, 'composing');
        await sleep(Math.min(6000, (agent?.typingDelayMs ?? 1200) + (agent?.replyDelayMs ?? 800)));
        await transport.setPresence(job.contact.jid, 'paused');
        waId = await transport.sendText(job.contact.jid, String(payload.text || ''));
      } else if (job.kind === 'VOICE') {
        waId = await transport.sendVoice(job.contact.jid, String(payload.filePath));
      } else {
        waId = await transport.sendMedia(
          job.contact.jid,
          String(payload.source),
          String(payload.caption || ''),
          (payload.mediaKind || 'IMAGE') as 'IMAGE' | 'VIDEO' | 'DOCUMENT'
        );
      }

      await prisma.whatsappOutboundJob.update({
        where: { id: job.id },
        data: { status: 'SENT', sentAt: new Date(), lastError: null },
      });

      const manual = job.idempotencyKey.startsWith('manual:');
      waLog({
        userId: job.userId,
        contactId: job.contactId,
        contactJid: job.contact.jid,
        contactName: job.contact.pushName,
        messageWaId: waId,
        category: 'OUTBOUND',
        event: 'outbound.sent',
        message: manual
          ? `Message envoyé à la main : « ${outboundPreview(job.kind, payload)} »`
          : `Réponse de l'agent envoyée : « ${outboundPreview(job.kind, payload)} »`,
        response: {
          kind: job.kind,
          waId,
          text: payload.text ?? null,
          caption: payload.caption ?? null,
          filePath: payload.filePath ?? null,
        },
        meta: {
          jobId: job.id,
          kind: job.kind,
          attempts: job.attempts,
          by: manual ? 'human' : 'agent',
        },
        durationMs: Date.now() - jobStartedAt,
      });

      if (waId) {
        await prisma.whatsappMessage.create({
          data: {
            userId: job.userId,
            contactId: job.contactId,
            waId,
            direction: 'OUT',
            kind: job.kind === 'TEXT' ? 'TEXT' : job.kind === 'VOICE' ? 'AUDIO' : 'IMAGE',
            // A voice job carries the text it speaks, so the sent message
            // records what was actually said rather than an empty body.
            body:
              job.kind === 'TEXT'
                ? String(payload.text || '')
                : String(payload.text || payload.caption || '') || null,
            // NOT set for a voice note we sent. A transcript is text derived
            // FROM audio; for an outbound note the text is the SOURCE, and it
            // already lives in `body`. Storing it in both made the inbox render
            // the same sentence twice — once as the message, once again under a
            // TRANSCRIT label.
            transcript: null,
            transcribed: false,
            mediaPath: job.kind === 'VOICE' ? String(payload.filePath) : null,
            // A manual takeover message is queued with a `manual:` key; anything
            // else came from the model. This is what the inbox uses to tag a
            // bubble "Agent" versus "Vous".
            fromAgent: !job.idempotencyKey.startsWith('manual:'),
          },
        }).catch((err: any) => {
          if (err?.code !== 'P2002') throw err;
        });
      }

      await prisma.whatsappContact.update({
        where: { id: job.contactId },
        data: { lastMessageAt: new Date() },
      });
    } catch (err) {
      const message = (err as Error).message?.slice(0, 500) || 'Erreur inconnue';
      await prisma.whatsappOutboundJob.update({
        where: { id: job.id },
        data:
          job.attempts >= 4
            ? { status: 'FAILED', lastError: message }
            : {
                status: 'PENDING',
                claimToken: null,
                lastError: message,
                nextAttemptAt: new Date(Date.now() + job.attempts * 20_000),
              },
      });
      const dead = job.attempts >= 4;
      waLog({
        userId: job.userId,
        contactId: job.contactId,
        contactJid: job.contact.jid,
        contactName: job.contact.pushName,
        level: dead ? 'ERROR' : 'WARN',
        category: 'OUTBOUND',
        event: dead ? 'outbound.failed' : 'outbound.retry',
        message: dead
          ? "La réponse n'a pas pu être envoyée après 5 tentatives — le client ne la recevra pas."
          : `Échec d'envoi (tentative ${job.attempts}) — nouvelle tentative programmée.`,
        request: job.payload,
        meta: { jobId: job.id, kind: job.kind, attempts: job.attempts },
        error: err,
        durationMs: Date.now() - jobStartedAt,
      });
      console.error(`[wa/worker] outbound job ${job.id} failed:`, message);
    }
  }
}

/**
 * Completes a bench reply without touching WhatsApp.
 *
 * Writes the same WhatsappMessage row the real path writes, so the bench
 * conversation renders through the ordinary inbox queries and the model reads
 * its own replies back as history on the next turn — which is the point: a
 * bench that stored its answers somewhere else would test a conversation shape
 * no customer ever produces.
 */
async function deliverToBench(
  job: { id: number; userId: number; contactId: number; kind: string; payload: unknown; idempotencyKey: string },
  startedAt: number
): Promise<void> {
  const payload = (job.payload || {}) as Record<string, any>;
  // Derived from the job id, which is unique, so the (userId, waId) index still
  // absorbs a retried delivery exactly as it does for a real message.
  const waId = `bench-out-${job.id}`;

  try {
    await prisma.whatsappOutboundJob.update({
      where: { id: job.id },
      data: { status: 'SENT', sentAt: new Date(), lastError: null },
    });

    await prisma.whatsappMessage
      .create({
        data: {
          userId: job.userId,
          contactId: job.contactId,
          waId,
          direction: 'OUT',
          kind: job.kind === 'TEXT' ? 'TEXT' : job.kind === 'VOICE' ? 'AUDIO' : 'IMAGE',
          body: String(payload.text || payload.caption || '') || null,
          mediaPath: job.kind === 'VOICE' ? String(payload.filePath || '') || null : null,
          fromAgent: !job.idempotencyKey.startsWith('manual:'),
        },
      })
      .catch((err: any) => {
        if (err?.code !== 'P2002') throw err;
      });

    await prisma.whatsappContact.update({
      where: { id: job.contactId },
      data: { lastMessageAt: new Date() },
    });

    waLog({
      userId: job.userId,
      contactId: job.contactId,
      messageWaId: waId,
      level: 'DEBUG',
      category: 'OUTBOUND',
      event: 'bench.delivered',
      message: `Réponse remise au banc d'essai : « ${outboundPreview(job.kind, payload)} »`,
      response: { kind: job.kind, text: payload.text ?? null },
      meta: { jobId: job.id, kind: job.kind, bench: true },
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    await prisma.whatsappOutboundJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', lastError: (err as Error).message?.slice(0, 500) || 'Erreur inconnue' },
    });
    waLog({
      userId: job.userId,
      contactId: job.contactId,
      category: 'OUTBOUND',
      event: 'bench.failed',
      message: "La réponse du banc d'essai n'a pas pu être enregistrée.",
      meta: { jobId: job.id },
      error: err,
    });
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One readable line for what actually left for the customer.
 *
 * A voice job carries the spoken text in `text`, so a voice note reads as its
 * words rather than as a file path — which is the only form anyone reading the
 * log can compare against what the model wrote.
 */
function outboundPreview(kind: string, payload: Record<string, any>): string {
  const text = String(payload?.text || payload?.caption || '').replace(/\s+/g, ' ').trim();
  if (text) return text.length > 160 ? `${text.slice(0, 160)}…` : text;
  return kind === 'VOICE' ? '[note vocale]' : '[média]';
}

/* ------------------------------------------------------------------ */
/* loopback control server                                             */
/* ------------------------------------------------------------------ */

function startControlServer(): http.Server {
  const port = Number(new URL(getSecret('WA_WORKER_URL') || 'http://127.0.0.1:3101').port || 3101);
  const token = getSecret('WA_WORKER_TOKEN');

  const server = http.createServer((req, res) => {
    const reply = (code: number, body: unknown) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    // No token configured means no control plane. Refusing everything is the
    // safe default: an open endpoint here can start and stop any seller's
    // WhatsApp session.
    if (!token || req.headers.authorization !== `Bearer ${token}`) {
      return reply(401, { error: 'unauthorized' });
    }

    if (req.method !== 'POST') return reply(405, { error: 'method not allowed' });

    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 10_000) req.destroy();
    });

    req.on('end', async () => {
      try {
        const { userId } = JSON.parse(raw || '{}');
        const action = (req.url || '').split('/').filter(Boolean).pop();
        if (!userId) return reply(400, { error: 'userId required' });

        if (action === 'connect') await reconcile();
        else if (action === 'disconnect') await stopSession(Number(userId));
        else if (action === 'logout') await stopSession(Number(userId), true);
        else if (action === 'drain') await drainOutbound();
        // A real bounce, not a "connect" on something already in the live map.
        //
        // `connect` runs reconcile(), and reconcile() skips anything already
        // running — which is precisely the session a seller wants to fix. The
        // socket that stops delivering keeps `ws.isOpen` true and stays in the
        // map, so the one button they would reach for did nothing at all. This
        // drops the transport first, so the reconcile that follows has to build
        // a new one.
        else if (action === 'reconnect') {
          const id = Number(userId);
          await stopSession(id);
          // The cooldown is there to stop an unscanned QR reopening a socket
          // every ten seconds. A person clicked a button and is watching the
          // screen; making them wait out a timer they cannot see is how the
          // button earns a reputation for not working.
          retryAfter.delete(id);
          await reconcile();
        }
        // The bench asks for this one. The tick would get there within two
        // seconds anyway, but two seconds of nothing is what makes a test
        // chat feel broken, so the dashboard is allowed to say "now".
        else if (action === 'turns') await guarded(drainTurns, 'turns');
        else return reply(404, { error: 'unknown action' });

        // What the dashboard asked this process to do. The API logs the request
        // it received; this is the half that says whether the worker acted on
        // it, and the two rows sit next to each other in the timeline.
        waLog({
          userId: Number(userId) || null,
          level: 'DEBUG',
          category: 'WORKER',
          event: `control.${action}`,
          message: `Ordre « ${action} » reçu du tableau de bord.`,
          meta: { action, worker: WORKER_ID },
        });

        reply(200, { ok: true });
      } catch (err) {
        waLog({
          category: 'WORKER',
          event: 'control.failed',
          message: "Un ordre du tableau de bord n'a pas pu être exécuté.",
          request: { url: req.url },
          error: err,
        });
        reply(500, { error: (err as Error).message });
      }
    });
  });

  // An unhandled 'error' event on an http.Server is fatal in Node. A busy port
  // usually means a second worker is already running, which is worth shouting
  // about — but the control server is only a latency optimisation, so losing it
  // must not stop this process from reconciling sessions and draining outboxes.
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `[wa/worker] control port ${port} is already in use — another worker is probably running. ` +
          'Continuing without the control server; reconcile still works, control calls will not.'
      );
      return;
    }
    console.error('[wa/worker] control server error:', err);
  });

  // 127.0.0.1 ONLY. This port is protected by a shared token and nothing else.
  server.listen(port, '127.0.0.1', () => {
    console.log(`[wa/worker] control server on http://127.0.0.1:${port} (loopback only)`);
  });

  return server;
}

/* ------------------------------------------------------------------ */
/* boot and shutdown                                                   */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  console.log(`[wa/worker] starting, id=${WORKER_ID}`);

  await loadSecrets();
  // Before anything else writes a row: this process is the worker, and the
  // activity log has to be able to tell its rows from the API's.
  setWaLogSource('worker');
  await ensureCatalogue();

  waLog({
    category: 'WORKER',
    event: 'worker.started',
    message: 'Worker WhatsApp démarré.',
    meta: { worker: WORKER_ID, pid: process.pid, node: process.version },
  });

  const server = startControlServer();

  const timers = [
    setInterval(() => void reconcile().catch((e) => {
      waLog({
        category: 'WORKER',
        event: 'reconcile.failed',
        message: "Le tick de réconciliation des sessions a échoué ; il sera rejoué dans 10 secondes.",
        error: e,
      });
      console.error('[wa/worker] reconcile:', e);
    }), RECONCILE_MS),
    setInterval(() => void guarded(drainTurns, 'turns'), TURN_DRAIN_MS),
    setInterval(() => void guarded(drainOutbound, 'outbound'), OUTBOUND_DRAIN_MS),
    // Retention. Hourly rather than per tick: this table only has to stay
    // bounded, and a delete sweep on the turn path would compete with it.
    setInterval(() => void guarded(prune, 'prune'), 3600_000),
  ];

  await reconcile();

  /**
   * The first SIGTERM/SIGINT handler in this codebase.
   *
   * It matters more here than anywhere else: pm2 sends SIGTERM on every deploy,
   * and without this the sockets are killed uncleanly and every session's
   * claimToken is left stamped, so a restarted worker sees rows it thinks
   * another worker owns. sock.end() and never logout() — logout would unlink
   * the device and cost every seller a QR re-scan on every deploy.
   */
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`[wa/worker] ${signal} received, draining...`);
    waLog({
      level: 'WARN',
      category: 'WORKER',
      event: 'worker.stopping',
      message: `Arrêt du worker (${signal}) : les sessions sont fermées proprement.`,
      meta: { worker: WORKER_ID, sessions: live.size },
    });

    timers.forEach(clearInterval);
    server.close();

    // Hard ceiling: pm2 kills us anyway after its own timeout, and a hung
    // socket close must not stop the rest from being released.
    const hard = setTimeout(() => {
      console.error('[wa/worker] shutdown timed out, exiting');
      process.exit(1);
    }, 20_000);

    try {
      await Promise.all([...live.keys()].map((userId) => stopSession(userId)));
      await prisma.whatsappSession.updateMany({ where: { claimToken: WORKER_ID }, data: { claimToken: null } });
      // Before $disconnect, or the session rows written on the way down are
      // cancelled by the client closing under them.
      await flushWaLogs();
      await prisma.$disconnect();
    } catch (err) {
      console.error('[wa/worker] shutdown error:', err);
    }

    clearTimeout(hard);
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // A rejected promise anywhere in a Baileys callback would otherwise take the
  // whole worker down and disconnect every account on it.
  process.on('unhandledRejection', (reason) => {
    waLog({
      category: 'WORKER',
      event: 'worker.unhandled_rejection',
      message: 'Erreur non rattrapée dans le worker (la session concernée peut être bloquée).',
      error: reason,
    });
    console.error('[wa/worker] unhandled rejection:', reason);
  });
}

/** Runs a tick, never letting one failure stop the interval. */
let inFlight = new Set<string>();
async function guarded(fn: () => Promise<unknown>, name: string): Promise<void> {
  if (stopping || inFlight.has(name)) return;
  inFlight.add(name);
  try {
    await fn();
  } catch (err) {
    waLog({
      category: 'WORKER',
      event: `tick.${name}.failed`,
      message: `Le cycle « ${name} » a échoué ; le suivant repartira normalement.`,
      error: err,
    });
    console.error(`[wa/worker] ${name} tick failed:`, err);
  } finally {
    inFlight.delete(name);
  }
}

/** Applies WA_LOG_RETENTION_DAYS. Announces itself only when it removed rows. */
async function prune(): Promise<void> {
  const removed = await pruneWaLogs();
  if (!removed) return;
  waLog({
    level: 'DEBUG',
    category: 'WORKER',
    event: 'logs.pruned',
    message: `${removed} ligne(s) de journal expirée(s) supprimée(s).`,
    meta: { removed },
  });
}

main().catch(async (err) => {
  waLog({
    category: 'WORKER',
    event: 'worker.fatal',
    message: "Le worker WhatsApp n'a pas pu démarrer.",
    error: err,
  });
  console.error('[wa/worker] fatal:', err);
  // Awaited, not slept on. Without this the one row that explains a crash-loop
  // is the one row that never reaches Postgres.
  await flushWaLogs();
  process.exit(1);
});

