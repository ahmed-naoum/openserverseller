/**
 * The WhatsApp transport boundary.
 *
 * Everything above this file talks to `WaTransport`, never to Baileys. That is
 * a deliberate seam, and the reason is that Baileys is an UNOFFICIAL WhatsApp
 * Web client: Meta can ban a number for automated volume, and the library
 * breaks whenever the protocol moves. The official Meta Cloud API is the
 * eventual escape hatch — the platform already carries a dead
 * services/whatsapp.service.ts for it — but it needs a verified Business
 * account and a dedicated number per seller, which almost none of them will
 * complete. So: Baileys now, one small interface, and a Cloud API
 * implementation can be slotted in per account later without touching the turn
 * runner, the inbox, or the routes.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  getContentType,
  jidNormalizedUser,
  isJidGroup,
  isJidBroadcast,
  isJidStatusBroadcast,
  isJidNewsletter,
} from '@whiskeysockets/baileys';
import type { WASocket, proto } from '@whiskeysockets/baileys';
import { usePrismaAuthState } from './authStore.js';
import { waLog } from '../services/waLogs.service.js';

export type WaStatus = 'DISCONNECTED' | 'QR' | 'CONNECTING' | 'CONNECTED' | 'LOGGED_OUT' | 'BANNED';

/**
 * How long a pairing QR stays scannable.
 *
 * Exported and passed to Baileys as `qrTimeout` so the two CANNOT drift: the
 * session row stamps `qrExpiresAt` from this same number. They were previously
 * independent — 25s stamped against Baileys' 60s default — and the visible
 * result was the connect screen reporting "code expired" for most of every
 * minute while the code on screen was still perfectly valid.
 */
export const QR_TTL_MS = 60_000;

export type InboundKind = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'STICKER';

export interface InboundMessage {
  waId: string;
  jid: string;
  /** Null when WhatsApp masked the number behind a @lid identity. */
  phone: string | null;
  pushName: string | null;
  kind: InboundKind;
  body: string;
  /** Absolute path on the worker's media volume, for non-text messages. */
  mediaPath: string | null;
  mediaMime: string | null;
  mediaSize: number | null;
  /** True when the customer arrived by tapping a Click-to-WhatsApp ad. */
  fromAd: boolean;
  adHeadline: string | null;
  adBody: string | null;
  adSourceUrl: string | null;
  timestamp: Date;
  /**
   * Delivered from WhatsApp's offline queue rather than pushed live.
   *
   * Both are real customer messages and both must be stored. The distinction
   * only decides whether the AGENT should answer: a live message deserves a
   * reply, a batch that has been sitting in a queue may be hours old, and the
   * one thing worse than a late reply is a confident reply to a conversation
   * that has already moved on without it.
   */
  offline: boolean;
}

export interface WaStatusMeta {
  phone?: string | null;
  pushName?: string | null;
  error?: string | null;
  /**
   * The underlying socket is gone. The supervisor MUST drop this transport, or
   * it keeps a dead object in its live map, believes the session is running,
   * and never restarts it — leaving the account stuck on "connecting" forever.
   */
  closed?: boolean;
  /**
   * WhatsApp asked us to reconnect immediately (stream error 515). This is the
   * NORMAL final step of pairing, not a failure: Baileys logs "pairing
   * configured successfully, expect to restart the connection". Reconnect now
   * and bypass any backoff — the seller has just scanned and is watching.
   */
  restartRequired?: boolean;
}

export interface WaTransportHandlers {
  onQr: (qrDataUrl: string) => void | Promise<void>;
  onStatus: (status: WaStatus, meta: WaStatusMeta) => void | Promise<void>;
  onMessage: (msg: InboundMessage) => void | Promise<void>;
}

export interface WaTransport {
  connect(): Promise<void>;
  /** `logout` wipes the credentials; without it the session can be resumed. */
  disconnect(logout?: boolean): Promise<void>;
  sendText(jid: string, text: string): Promise<string | null>;
  sendVoice(jid: string, filePath: string): Promise<string | null>;
  sendMedia(jid: string, source: string, caption: string, kind: 'IMAGE' | 'VIDEO' | 'DOCUMENT'): Promise<string | null>;
  setPresence(jid: string, state: 'composing' | 'paused'): Promise<void>;
  isConnected(): boolean;
  /** For the supervisor's reap: dead, as opposed to merely not ready yet. */
  isReapable(): boolean;
}

/** True for a privacy-masked identity whose digits are NOT a phone number. */
export const isLidJid = (jid: string): boolean => /@lid$/i.test(String(jid || ''));

/**
 * The dialable number behind a JID, or null.
 *
 * Returns null for @lid rather than the digits in front of it. Those digits are
 * an opaque WhatsApp identifier that merely LOOKS like a phone number — 15
 * digits, plausible country prefix — which is exactly what makes returning them
 * dangerous: nothing downstream can tell it is fake.
 */
export const phoneFromJid = (jid: string): string | null => {
  if (!jid || isLidJid(jid)) return null;
  return String(jid).split('@')[0].split(':')[0] || null;
};

/**
 * Chats the agent must never answer.
 *
 * Groups and broadcasts are the important ones: an agent replying in a group
 * would sell to an audience that never asked, and a status broadcast is not a
 * conversation at all. The standalone project filtered only on `@g.us`, which
 * missed newsletters and status.
 */
export function isIgnorableJid(jid: string): boolean {
  return isJidGroup(jid) || isJidBroadcast(jid) || isJidStatusBroadcast(jid) || isJidNewsletter(jid);
}

/**
 * The bench conversation: an account talking to its own agent from the
 * dashboard, with no WhatsApp involved.
 *
 * WHY IT NEEDS ITS OWN DOMAIN. Everything downstream of ingest — the turn
 * outbox, the guard rails, the credit debit, the model call, the intents — is
 * exactly the code that has to be tested, so the bench feeds the SAME tables
 * rather than reimplementing any of it. Only the last hop differs, and this
 * predicate is what marks the hop that must not happen: `@sandbox` is not a
 * routable WhatsApp domain, so a reply addressed to one is completed locally
 * instead of being handed to a socket that would reject it.
 *
 * It is also the guard on lead promotion — a test conversation must never bill
 * the account for a real Lead. See services/waLeadPromotion.service.ts.
 */
export const SANDBOX_DOMAIN = '@sandbox';

/** One bench conversation per account. */
export const sandboxJid = (userId: number): string => `bench-${userId}${SANDBOX_DOMAIN}`;

export const isSandboxJid = (jid: string | null | undefined): boolean =>
  String(jid || '').endsWith(SANDBOX_DOMAIN);

/**
 * How long an OPEN socket may receive absolutely nothing before we call it dead.
 *
 * `keepAliveIntervalMs` below is 25s, and WhatsApp answers every one of those
 * queries, so a healthy connection sees an inbound frame roughly three times a
 * minute even when no customer is typing. Silence for four-plus keepalive
 * cycles is therefore not a quiet chat, it is a socket that has stopped
 * delivering.
 *
 * Generous on purpose: a false positive costs a reconnect and the seller's
 * session, so this waits for a signal that cannot be explained by a slow
 * network before declaring anything.
 */
const SOCKET_SILENCE_MS = 120_000;

/**
 * How long a brand-new socket is allowed to finish connecting before the
 * supervisor is entitled to call it dead.
 *
 * Comfortably longer than `connectTimeoutMs` (30s) below, so a socket that is
 * genuinely going to fail reports its own failure through `connection.update`
 * first — which carries a reason — instead of being guessed at from outside.
 */
const CONNECT_GRACE_MS = 45_000;

export class BaileysTransport implements WaTransport {
  private sock: WASocket | null = null;
  private connected = false;
  private closing = false;

  /**
   * When this socket last heard ANYTHING from WhatsApp.
   *
   * Stamped from the raw WebSocket frame event rather than from
   * `messages.upsert`, because it has to tick on a number nobody is messaging.
   * Keepalive responses, receipts and presence all count — the question it
   * answers is "is this pipe alive", not "did a customer write".
   */
  private lastFrameAt = 0;

  /** When connect() built the current socket, for the grace window below. */
  private startedAt = 0;

  /** Whether this socket ever reached `open`. Distinguishes young from dead. */
  private everConnected = false;

  constructor(
    private readonly userId: number,
    private readonly mediaDir: string,
    private readonly handlers: WaTransportHandlers,
    private readonly opts: { maxMediaBytes: number } = { maxMediaBytes: 20 * 1024 * 1024 }
  ) {}

  /**
   * Whether this transport can actually send right now.
   *
   * Asks the underlying WebSocket, not just our own flag. Baileys can lose the
   * connection WITHOUT emitting `connection.update: close` — a query times out,
   * the socket goes quiet, and nothing tells us. Trusting the flag alone left
   * the session recorded as CONNECTED forever: the supervisor saw it in its
   * live map, skipped it as already-running, and messages silently stopped
   * arriving with nothing anywhere reporting a problem.
   */
  isConnected(): boolean {
    if (!this.connected || !this.sock) return false;
    const ws = (this.sock as any).ws;
    // Older/mocked clients may not expose the getter; absence is not evidence
    // of death, so fall back to the flag rather than declaring it dead.
    if (ws && typeof ws.isOpen === 'boolean' && !ws.isOpen) return false;

    // AN OPEN SOCKET IS NOT A LIVE ONE.
    //
    // `ws.isOpen` only reports that the WebSocket was never closed, and that is
    // a weaker claim than it looks. The failure it misses is the one that
    // actually happens: the connection stays open at the transport level and
    // simply stops delivering. Sending keeps working — frames go out, WhatsApp
    // accepts them, every outbound job is marked SENT — while nothing at all
    // comes back, so the seller sees replies leave and no messages arrive.
    //
    // Session 212660179303 sat in exactly that state for eighteen hours:
    // status CONNECTED, claim heartbeating every ten seconds, three manual
    // sends delivered without an error, and not one inbound message. Because
    // isOpen was true the supervisor's reap skipped it on every tick, so the
    // thing designed to catch a silently-dead socket never looked at it.
    //
    // Receiving is the only honest evidence that the pipe works, so that is
    // what gets checked.
    if (this.lastFrameAt && Date.now() - this.lastFrameAt > SOCKET_SILENCE_MS) return false;

    return true;
  }

  /**
   * Whether the supervisor should tear this socket down and build a new one.
   *
   * NOT the same question as isConnected(), and conflating the two is what
   * produced the reconnect churn all over this account's history. A socket
   * takes a second or two to reach `open`, and for that window isConnected()
   * correctly reports false — it cannot send yet. The reap read that false as
   * "dead", killed a session that was in the middle of being born, waited out
   * the twenty-second cooldown, started another, and killed that one too. Every
   * one of those cycles logged `session.stalled`, which made a healthy startup
   * look like a fault and buried the real ones.
   *
   * So a socket that has never opened is given the connect window to do it in.
   * After that, or once it has opened at least once, dead is dead.
   */
  isReapable(): boolean {
    // Being shut down on purpose. The supervisor asked for this; it is not a
    // fault and must not be reported as one.
    if (this.closing) return false;
    if (!this.everConnected && Date.now() - this.startedAt < CONNECT_GRACE_MS) return false;
    return !this.isConnected();
  }

  async connect(): Promise<void> {
    if (this.sock) return;
    this.closing = false;
    this.startedAt = Date.now();
    this.everConnected = false;

    const { state, saveCreds, clear } = await usePrismaAuthState(this.userId);
    const { version } = await fetchLatestBaileysVersion();

    // Has this number EVER been paired? It decides how a `loggedOut` close is
    // read, and getting that wrong is very visible: Baileys reports 401 both
    // when the seller unlinks the device from their phone AND when a pairing QR
    // simply expires because nobody scanned it. Treating the second as the
    // first tells the seller "the session was closed from your phone" about a
    // phone that was never connected, and switches the session off so the QR
    // never comes back.
    const wasRegistered = !!state.creds.registered;

    const sock = makeWASocket({
      version,
      auth: state,
      // The agent answers on its own; marking chats online would also mark the
      // seller's real phone as online and steal notifications from it.
      markOnlineOnConnect: false,
      // Nothing here reads old conversations, and a full history sync on a busy
      // number is a large download and a large heap spike in a shared worker.
      syncFullHistory: false,
      browser: ['Silacod', 'Chrome', '1.0.0'],
      // Stated explicitly rather than left to the library default, because the
      // session row's `qrExpiresAt` is derived from the same constant.
      qrTimeout: QR_TTL_MS,
      // Ping often enough that a dead connection is noticed in tens of seconds
      // rather than minutes. The supervisor reaps a silently-dead socket on its
      // own tick regardless, but a library-level close is the cleaner path:
      // it carries a disconnect reason, which the reap has to guess at.
      keepAliveIntervalMs: 25_000,
      connectTimeoutMs: 30_000,
    });

    this.sock = sock;

    // Start the clock at connect rather than at 0. A socket that has been open
    // for two seconds has not "been silent for two minutes", and treating it
    // that way would make isConnected() report every fresh connection dead.
    this.lastFrameAt = Date.now();

    // The receive heartbeat. Baileys' socket client re-emits the underlying
    // ws events verbatim, so 'message' fires for every frame WhatsApp sends —
    // keepalive answers included, which is what makes this work on an idle
    // number. Guarded because a mocked or future client may not expose `ws`;
    // when it does not, lastFrameAt stays at its connect-time value and the
    // silence check in isConnected() is simply never the thing that fails.
    const ws = (sock as any).ws;
    if (ws && typeof ws.on === 'function') {
      const stamp = () => {
        this.lastFrameAt = Date.now();
      };
      ws.on('message', stamp);
      ws.on('pong', stamp);
    }

    // WHICH EVENTS ARE ACTUALLY REACHING US.
    //
    // Diagnostic, and it earns its place: this account reached a state where
    // the socket connected, stayed open, sent successfully and received frames
    // continuously, while `messages.upsert` never fired once in over an hour —
    // not for a customer, not for a group, not for a status broadcast. From
    // inside the transport that is indistinguishable from nobody writing.
    //
    // Naming the events that DO arrive is what separates "WhatsApp is routing
    // nothing to this device" — a pairing problem, fixed by re-linking — from
    // "messages arrive and we drop them", which is a bug in this file.
    for (const probe of [
      'messages.upsert',
      'messages.update',
      'message-receipt.update',
      'messaging-history.set',
      'chats.upsert',
      'chats.update',
      'contacts.upsert',
      'presence.update',
      'groups.upsert',
    ] as const) {
      sock.ev.on(probe as any, (payload: any) => {
        waLog({
          userId: this.userId,
          // DEBUG so a healthy connection stays quiet — on a busy number these
          // fire constantly. Set WA_LOG_LEVEL=DEBUG to turn the probe on when
          // a session is connected and inexplicably silent.
          level: 'DEBUG',
          category: 'INBOUND',
          event: `probe.${probe}`,
          message: `Événement Baileys reçu : ${probe}`,
          meta: {
            event: probe,
            size: Array.isArray(payload) ? payload.length : typeof payload === 'object' ? 1 : 0,
            // `messages.upsert` carries its batch kind here; for the others it
            // is simply absent, which is fine — the event name is the signal.
            batchType: payload?.type ?? null,
          },
        });
      });
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const QRCode = await import('qrcode');
          const dataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
          await this.handlers.onQr(dataUrl);
          await this.handlers.onStatus('QR', {});
        } catch (err) {
          console.error(`[wa/transport] QR render failed for user ${this.userId}:`, err);
        }
      }

      if (connection === 'connecting') {
        await this.handlers.onStatus('CONNECTING', {});
      }

      if (connection === 'open') {
        this.connected = true;
        this.everConnected = true;
        const me = sock.user;
        await this.handlers.onStatus('CONNECTED', {
          phone: me?.id ? phoneFromJid(jidNormalizedUser(me.id)) : null,
          pushName: me?.name || null,
        });
      }

      if (connection === 'close') {
        this.connected = false;
        this.sock = null;

        const code = (lastDisconnect?.error as any)?.output?.statusCode;
        const reason = (lastDisconnect?.error as any)?.message || null;

        // An unscanned QR expires with the SAME 401 as a real logout. The only
        // thing that tells them apart is whether we were ever paired: you
        // cannot be logged out of a session you never had. Reported as an
        // ordinary retry so the supervisor produces a fresh code instead of
        // shutting the session down and blaming the seller's phone.
        if (code === DisconnectReason.loggedOut && !wasRegistered) {
          await clear();
          await this.handlers.onStatus('CONNECTING', {
            error: 'Code QR expiré sans être scanné — un nouveau code va être généré.',
            // Without this the supervisor keeps the dead transport, reconcile
            // skips the session as already-running, and no further QR is ever
            // produced — the screen sits on "connexion en cours" forever.
            closed: true,
          });
          return;
        }

        // loggedOut on a session that WAS paired means the seller removed the
        // linked device (or WhatsApp did). Those credentials are dead: keeping
        // them would make every reconnect fail forever.
        if (code === DisconnectReason.loggedOut) {
          await clear();
          await this.handlers.onStatus('LOGGED_OUT', { error: reason, closed: true });
          return;
        }

        if (code === DisconnectReason.forbidden) {
          await clear();
          await this.handlers.onStatus('BANNED', { error: reason, closed: true });
          return;
        }

        // 515, immediately after a successful scan. WhatsApp hands back the
        // pairing and then closes the stream, expecting the client to come
        // straight back on the new credentials. Deferring this to the ordinary
        // reconcile backoff leaves the seller watching "connexion…" seconds
        // after a scan that actually worked.
        if (code === DisconnectReason.restartRequired) {
          await this.handlers.onStatus('CONNECTING', {
            error: null,
            closed: true,
            restartRequired: true,
          });
          return;
        }

        // Anything else — a network blip, a timeout — is recoverable on the
        // supervisor's schedule rather than by a self-reconnect loop here, so a
        // permanently broken session cannot spin in this file unattended.
        await this.handlers.onStatus(this.closing ? 'DISCONNECTED' : 'CONNECTING', {
          error: reason,
          closed: true,
        });
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      // `append` IS REAL CUSTOMER MAIL, AND DISCARDING IT COST THIS ACCOUNT
      // EVERY INBOUND MESSAGE IT HAD.
      //
      // The old rule here was "only `notify` is live, `append` is history
      // backfill". The first half is right. The second is not: Baileys tags a
      // message `append` whenever WhatsApp marks it `offline`, meaning it came
      // out of the delivery queue rather than being pushed live —
      //
      //     upsertMessage(msg, node.attrs.offline ? 'append' : 'notify')
      //         — Socket/messages-recv.js:699
      //
      // and because this socket sets `markOnlineOnConnect: false`, WhatsApp
      // considers the device permanently unavailable and queues EVERYTHING.
      // So every customer message arrived as `append` and was dropped without
      // a trace, while sending kept working perfectly — which is exactly what
      // a seller reports as "the session says connected and I receive nothing".
      // WhatsApp then redelivered each one indefinitely, because nothing ever
      // acknowledged it.
      //
      // Both kinds are stored now. What `offline` still decides is whether the
      // AGENT answers — see ingest() in worker.ts. Storing a stale message is
      // harmless and the seller wants to see it; answering one is not.
      const offline = type !== 'notify';

      if (offline) {
        waLog({
          userId: this.userId,
          level: 'DEBUG',
          category: 'INBOUND',
          event: 'inbound.batch_offline',
          message: `Lot « ${type} » reçu (${messages.length} message(s)) — file d'attente WhatsApp.`,
          meta: { type, count: messages.length },
        });
      }

      for (const msg of messages) {
        try {
          const normalised = await this.normalise(msg);
          if (normalised) {
            await this.handlers.onMessage({ ...normalised, offline });
            continue;
          }

          // A DROPPED MESSAGE MUST NEVER BE A SILENT ONE.
          //
          // normalise() returns null for five different reasons and used to say
          // which one exactly never. That is survivable when the filters are
          // doing their job and invisible when they are not: a customer writes,
          // nothing appears in the inbox, and there is no row, no warning and
          // no log line anywhere to say a message was even seen. The seller is
          // left proving a negative.
          //
          // The one that matters most is `!msg.message`. That is what an
          // undecryptable message looks like from here — Baileys received the
          // envelope, failed to open it, sent a retry receipt, and handed us a
          // message with no content. It is indistinguishable from every other
          // null unless the reason is recorded, and it is the reason a chat can
          // stop delivering while the socket stays perfectly healthy.
          const jid = msg.key?.remoteJid || '';
          const reason = !msg.message
            ? 'undecryptable_or_empty'
            : msg.key?.fromMe
              ? 'from_me'
              : !jid || isIgnorableJid(jid)
                ? 'ignorable_jid'
                : !msg.key?.id
                  ? 'no_wa_id'
                  : 'unsupported_content';

          // `from_me` and `ignorable_jid` are the seller's own traffic and the
          // group/status firehose — constant, expected, and DEBUG so they do
          // not bury anything. The rest are not supposed to happen, so they are
          // audible by default at the standard INFO level.
          const level =
            reason === 'undecryptable_or_empty'
              ? 'WARN'
              : reason === 'from_me' || reason === 'ignorable_jid'
                ? 'DEBUG'
                : 'INFO';

          waLog({
            userId: this.userId,
            contactJid: jid || null,
            contactName: msg.pushName || null,
            messageWaId: msg.key?.id || null,
            level,
            category: 'INBOUND',
            event: `inbound.dropped.${reason}`,
            message:
              reason === 'undecryptable_or_empty'
                ? 'Message reçu mais impossible à déchiffrer — WhatsApp a été relancé, le client devra peut-être renvoyer.'
                : `Message ignoré (${reason}).`,
            meta: {
              reason,
              jid,
              fromMe: !!msg.key?.fromMe,
              stubType: msg.messageStubType ?? null,
              contentType: msg.message ? getContentType(msg.message) ?? null : null,
            },
          });
        } catch (err) {
          console.error(`[wa/transport] inbound handling failed for user ${this.userId}:`, err);
          waLog({
            userId: this.userId,
            contactJid: msg.key?.remoteJid || null,
            messageWaId: msg.key?.id || null,
            category: 'INBOUND',
            event: 'inbound.handler_failed',
            message: "Échec du traitement d'un message entrant.",
            error: err,
          });
        }
      }
    });
  }

  async disconnect(logout = false): Promise<void> {
    this.closing = true;
    const sock = this.sock;
    this.sock = null;
    this.connected = false;
    // Cleared with the socket it belonged to, so a reconnect on this instance
    // starts from a fresh stamp instead of inheriting the dead socket's.
    this.lastFrameAt = 0;
    if (!sock) return;

    try {
      if (logout) {
        await sock.logout();
      } else {
        // end() drops the socket without telling WhatsApp to unlink the device.
        // logout() would force the seller to scan a QR again on every restart.
        sock.end(undefined);
      }
    } catch (err) {
      console.error(`[wa/transport] disconnect failed for user ${this.userId}:`, err);
    }
  }

  async sendText(jid: string, text: string): Promise<string | null> {
    const sent = await this.require().sendMessage(jid, { text });
    return sent?.key?.id || null;
  }

  async sendVoice(jid: string, filePath: string): Promise<string | null> {
    const sent = await this.require().sendMessage(jid, {
      audio: fs.readFileSync(filePath),
      mimetype: 'audio/ogg; codecs=opus',
      // Without ptt the note arrives as a file attachment with a download
      // button instead of a playable waveform, which reads as spam.
      ptt: true,
    });
    return sent?.key?.id || null;
  }

  async sendMedia(
    jid: string,
    source: string,
    caption: string,
    kind: 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  ): Promise<string | null> {
    const isUrl = /^https?:\/\//i.test(source);
    const payload = isUrl ? { url: source } : fs.readFileSync(source);

    const content: Record<string, unknown> =
      kind === 'IMAGE'
        ? { image: payload, caption: caption || undefined }
        : kind === 'VIDEO'
          ? { video: payload, caption: caption || undefined }
          : { document: payload, fileName: path.basename(source), caption: caption || undefined };

    const sent = await this.require().sendMessage(jid, content as any);
    return sent?.key?.id || null;
  }

  async setPresence(jid: string, state: 'composing' | 'paused'): Promise<void> {
    try {
      await this.require().sendPresenceUpdate(state, jid);
    } catch {
      // Presence is cosmetic. Never fail a reply because the typing indicator
      // did not go through.
    }
  }

  private require(): WASocket {
    if (!this.sock || !this.connected) {
      throw new Error('WhatsApp non connecté.');
    }
    return this.sock;
  }

  /** Turns a raw Baileys message into the shape the rest of the system uses. */
  private async normalise(msg: proto.IWebMessageInfo): Promise<InboundMessage | null> {
    if (!msg.message) return null;
    if (msg.key.fromMe) return null;

    const jid = msg.key.remoteJid || '';
    if (!jid || isIgnorableJid(jid)) return null;

    const waId = msg.key.id;
    if (!waId) return null;

    const type = getContentType(msg.message);
    if (!type) return null;

    const inner: any = (msg.message as any)[type];

    // Click-to-WhatsApp ads attach the creative the customer actually saw. It
    // is the single most useful piece of context the agent gets: it can open on
    // the offer the customer already believes in instead of re-pitching.
    const ctx = inner?.contextInfo;
    const ad = ctx?.externalAdReply;
    const fromAd =
      !!ad || ctx?.entryPointConversionSource === 'ctwa_ad' || ctx?.conversionSource === 'FB_Ads';

    // On a @lid chat the real number, when WhatsApp is willing to share it,
    // rides on the message key as senderPn rather than on remoteJid.
    const senderPn = (msg.key as any)?.senderPn || (msg.key as any)?.participantPn || null;

    const base = {
      waId,
      jid,
      phone: phoneFromJid(jid) ?? phoneFromJid(String(senderPn || '')),
      pushName: msg.pushName || null,
      fromAd,
      adHeadline: ad?.title || null,
      adBody: ad?.body || null,
      adSourceUrl: ad?.sourceUrl || ctx?.externalAdReply?.mediaUrl || null,
      timestamp: new Date(Number(msg.messageTimestamp || Date.now() / 1000) * 1000),
      // Overwritten by the upsert handler, which is the only place that knows
      // which batch this message came out of.
      offline: false,
    };

    if (type === 'conversation' || type === 'extendedTextMessage') {
      const body = type === 'conversation' ? String(msg.message.conversation || '') : String(inner?.text || '');
      if (!body.trim()) return null;
      return { ...base, kind: 'TEXT', body, mediaPath: null, mediaMime: null, mediaSize: null };
    }

    const kind: InboundKind =
      type === 'imageMessage'
        ? 'IMAGE'
        : type === 'audioMessage'
          ? 'AUDIO'
          : type === 'videoMessage'
            ? 'VIDEO'
            : type === 'stickerMessage'
              ? 'STICKER'
              : type === 'documentMessage'
                ? 'DOCUMENT'
                : 'TEXT';

    if (kind === 'TEXT') return null; // reactions, protocol messages, polls

    // Size is checked BEFORE downloading. A 60MB video on a shared worker is
    // both a wasted download and a heap spike that can restart every other
    // account's session with it.
    const declared = Number(inner?.fileLength || 0);
    if (declared && declared > this.opts.maxMediaBytes) {
      return {
        ...base,
        kind,
        body: String(inner?.caption || ''),
        mediaPath: null,
        mediaMime: inner?.mimetype || null,
        mediaSize: declared,
      };
    }

    let mediaPath: string | null = null;
    let mediaSize: number | null = null;

    try {
      const buffer = (await downloadMediaMessage(msg, 'buffer', {})) as Buffer;
      if (buffer.length <= this.opts.maxMediaBytes) {
        const dir = path.join(this.mediaDir, String(this.userId));
        fs.mkdirSync(dir, { recursive: true });
        mediaPath = path.join(dir, `${waId}${extensionFor(kind, inner?.mimetype)}`);
        fs.writeFileSync(mediaPath, buffer);
        mediaSize = buffer.length;
      }
    } catch (err) {
      // A failed download must not swallow the message: the account still needs
      // to see that the customer sent something.
      console.error(`[wa/transport] media download failed for ${waId}:`, err);
    }

    return {
      ...base,
      kind,
      body: String(inner?.caption || ''),
      mediaPath,
      mediaMime: inner?.mimetype || null,
      mediaSize,
    };
  }
}

function extensionFor(kind: InboundKind, mime?: string | null): string {
  const m = String(mime || '').toLowerCase();
  if (kind === 'AUDIO') return '.ogg';
  if (kind === 'VIDEO') return m.includes('webm') ? '.webm' : '.mp4';
  if (kind === 'STICKER') return '.webp';
  if (kind === 'IMAGE') return m.includes('png') ? '.png' : m.includes('webp') ? '.webp' : '.jpg';
  if (m.includes('pdf')) return '.pdf';
  return '.bin';
}
