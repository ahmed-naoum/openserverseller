/**
 * The WhatsApp agent activity log — the writer half.
 *
 * WHY IT EXISTS. The agent decides on its own, in a second process, and spends
 * the account's credits doing it. Every question a seller actually asks about
 * it — "why did it answer that", "why did it stop", "why was I charged for a
 * reply nobody received" — is a question about what was sent to the model and
 * what came back. pm2's stdout cannot answer any of them: it rolls over, it is
 * one stream for every tenant on the box, and nobody can read it from the
 * dashboard. So the same events go to Postgres, per account, in order.
 *
 * THREE RULES, and each one is load-bearing:
 *
 *   1. A log write NEVER breaks the thing it is logging. Every failure here is
 *      swallowed to console. A logger that can throw on the turn path would
 *      turn a full disk into "the agent stopped answering".
 *
 *   2. It never blocks either. waLog() returns void, not a promise, and the
 *      insert runs detached. The model call is already the slow part of a turn;
 *      adding a round trip per event to it would be paid on every customer
 *      message.
 *
 *   3. Nothing is trusted to be small. A model response, a Baileys error, an
 *      HTTP body — all of them are truncated here rather than at the call site,
 *      because the one call site that forgets is the one that writes a 2 MB row
 *      on every turn.
 *
 * WHAT IS DELIBERATELY NOT WRITTEN. The compiled system prompt: it is identical
 * on every turn of an account and would multiply this table by its own size,
 * and it is already stored once in WhatsappAgent.compiledPrompt. Credentials
 * are stripped by redact() below regardless of who passes them.
 */

import { prisma } from '../lib/prisma.js';
import { getSecret, getSecretNumber } from '../lib/secretStore.js';

export type WaLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export type WaLogCategory =
  | 'SESSION'
  | 'INBOUND'
  | 'OUTBOUND'
  | 'BRAIN'
  | 'STT'
  | 'TTS'
  | 'CREDITS'
  | 'LEAD'
  | 'API'
  | 'WORKER';

export const WA_LOG_LEVELS: WaLogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

export const WA_LOG_CATEGORIES: WaLogCategory[] = [
  'SESSION',
  'INBOUND',
  'OUTBOUND',
  'BRAIN',
  'STT',
  'TTS',
  'CREDITS',
  'LEAD',
  'API',
  'WORKER',
];

const LEVEL_RANK: Record<WaLogLevel, number> = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 };

/**
 * Which account, conversation and turn a row belongs to.
 *
 * Passed down into the model, speech and transport helpers so a row written
 * three call levels deep still lands on the right conversation — an untagged
 * error is visible in the list and useless in a support conversation.
 */
export interface WaLogRef {
  userId?: number | null;
  contactId?: number | null;
  contactJid?: string | null;
  contactName?: string | null;
  turnId?: number | null;
  messageWaId?: string | null;
}

export interface WaLogEntry {
  level?: WaLogLevel;
  category: WaLogCategory;
  /** Machine slug the UI groups on: "brain.response", "outbound.failed". */
  event: string;
  /** One line, written for whoever reads the screen, not for a developer. */
  message: string;

  userId?: number | null;
  contactId?: number | null;
  contactJid?: string | null;
  contactName?: string | null;
  turnId?: number | null;
  messageWaId?: string | null;

  request?: unknown;
  response?: unknown;
  meta?: unknown;

  /**
   * An Error, or anything with a message. Promotes the row to ERROR unless the
   * call site names a level itself — a 404 on an API route is a failure worth
   * recording and not an incident worth colouring red.
   */
  error?: unknown;

  durationMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costCents?: number | null;
}

/**
 * Which process is writing. Set once at boot by the worker; the API leaves it
 * at the default. Both halves of one action land in the same timeline and this
 * is the only thing that says which side produced a row.
 */
let source: 'worker' | 'api' = 'api';

export function setWaLogSource(value: 'worker' | 'api'): void {
  source = value;
}

/* ------------------------------------------------------------------ */
/* size and secrecy                                                    */
/* ------------------------------------------------------------------ */

/** Per JSON column, after serialisation. */
const MAX_JSON_CHARS = 20_000;
/** Per individual string inside a payload — a base64 image is one string. */
const MAX_STRING_CHARS = 4_000;
const MAX_ARRAY_ITEMS = 40;
const MAX_DEPTH = 6;

/**
 * Keys whose value never reaches the database, whatever a call site passes.
 *
 * Matched loosely on purpose: `apiKey`, `x-api-key` and `ANTHROPIC_API_KEY` all
 * have to be caught, and a redaction that only catches the spelling someone
 * remembered is not a redaction.
 */
const SECRET_KEY = /(authorization|api[-_]?key|secret|token|password|credential|cookie|signature)/i;

/**
 * Trims one value to something a row can hold: strings capped, arrays capped,
 * depth capped, secret-looking keys replaced.
 *
 * Truncation is always ANNOUNCED — "… [+18 402 caractères]" — because a payload
 * silently cut at the boundary reads as a model that stopped mid-sentence, and
 * that is a bug someone will then go looking for in the wrong place.
 */
function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value ?? null;

  if (typeof value === 'string') {
    return value.length > MAX_STRING_CHARS
      ? `${value.slice(0, MAX_STRING_CHARS)}… [+${value.length - MAX_STRING_CHARS} caractères]`
      : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;

  if (depth >= MAX_DEPTH) return '[…]';

  if (Array.isArray(value)) {
    const kept = value.slice(0, MAX_ARRAY_ITEMS).map((v) => redact(v, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) kept.push(`[+${value.length - MAX_ARRAY_ITEMS} éléments]`);
    return kept;
  }

  if (value instanceof Error) return { name: value.name, message: value.message };

  if (typeof value === 'object') {
    // A Buffer, a stream, a Baileys socket — anything that is not a plain bag
    // of data is described, not walked.
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      if (Buffer.isBuffer(value)) return `[binaire, ${value.length} octets]`;
      const named = (value as any)?.constructor?.name;
      if (named && named !== 'Object') {
        const plain = safePlain(value);
        if (!plain) return `[${named}]`;
        return redact(plain, depth + 1);
      }
    }

    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      // A field the call site did not set is left OUT, not written as null. The
      // payloads are read by a human looking for what is there; a wall of
      // `"body": null` is noise that hides it.
      if (raw === undefined) continue;
      if (SECRET_KEY.test(key)) {
        out[key] = '[masqué]';
        continue;
      }
      const trimmed = redact(raw, depth + 1);
      if (trimmed !== undefined) out[key] = trimmed;
    }
    return out;
  }

  return String(value);
}

/** Best-effort plain view of a class instance, or null if it has none. */
function safePlain(value: object): Record<string, unknown> | null {
  try {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.length ? Object.fromEntries(entries) : null;
  } catch {
    return null;
  }
}

/**
 * Redaction plus a hard ceiling on the serialised size.
 *
 * The second pass is not redundant: a payload can be under every per-value cap
 * and still be enormous by having ten thousand small keys.
 */
function toJsonColumn(value: unknown): any {
  if (value === undefined || value === null) return undefined;
  try {
    const cleaned = redact(value);
    const text = JSON.stringify(cleaned);
    if (text === undefined) return undefined;
    if (text.length <= MAX_JSON_CHARS) return cleaned;
    return {
      truncated: true,
      chars: text.length,
      preview: `${text.slice(0, MAX_JSON_CHARS)}…`,
    };
  } catch (err) {
    // A circular payload is a bug at the call site, not a reason to lose the
    // event: keep the row, say why the body is missing.
    return { unserialisable: (err as Error).message };
  }
}

const clip = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

function errorText(error: unknown): string {
  if (!error) return '';
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/* ------------------------------------------------------------------ */
/* writing                                                             */
/* ------------------------------------------------------------------ */

/**
 * The floor. DEBUG rows are the per-iteration model traffic, which is by far
 * the highest-volume thing here, so the default keeps them off and an admin
 * turns them on from Variables & Secrets while chasing a specific complaint.
 */
function minLevel(): number {
  const configured = String(getSecret('WA_LOG_LEVEL') || 'INFO').toUpperCase() as WaLogLevel;
  return LEVEL_RANK[configured] ?? LEVEL_RANK.INFO;
}

/** Whether request/response bodies are stored at all, or only their shape. */
const payloadsEnabled = (): boolean =>
  String(getSecret('WA_LOG_PAYLOADS') || 'true').toLowerCase() !== 'false';

/* ------------------------------------------------------------------ */
/* repeat suppression                                                  */
/* ------------------------------------------------------------------ */

/**
 * A fault on a timer repeats on that timer.
 *
 * This is not hypothetical: the turn drain ticks every two seconds, so one
 * broken import writes thirty identical rows a minute for as long as nobody
 * notices — burying the rows that say something and pushing everything else
 * past the retention window. Identical failures inside the window are counted
 * instead of written, and the count is carried on the next row that IS written,
 * so nothing is silently lost.
 *
 * ONLY WARN AND ERROR. Two customers can legitimately send "ok" in the same
 * minute, and collapsing those would be destroying data, not de-duplicating it.
 */
const REPEAT_WINDOW_MS = 60_000;
const REPEAT_MAP_MAX = 500;

const repeats = new Map<string, { lastAt: number; suppressed: number }>();

/** Same fault, same account, same conversation. */
const repeatKey = (level: WaLogLevel, entry: WaLogEntry, failure: string | null): string =>
  [level, entry.category, entry.event, entry.userId ?? '-', entry.contactId ?? '-', failure ?? entry.message].join(
    '|'
  );

/**
 * Returns how many identical rows were swallowed since the last one written,
 * or null when this one must be swallowed too.
 */
function repeatCheck(level: WaLogLevel, entry: WaLogEntry, failure: string | null): number | null {
  if (level !== 'WARN' && level !== 'ERROR') return 0;

  const key = repeatKey(level, entry, failure);
  const now = Date.now();
  const seen = repeats.get(key);

  if (seen && now - seen.lastAt < REPEAT_WINDOW_MS) {
    seen.suppressed += 1;
    return null;
  }

  // Bounded: a process that produces thousands of distinct faults must not also
  // leak memory doing it. Oldest first — Map keeps insertion order.
  if (repeats.size >= REPEAT_MAP_MAX) {
    const oldest = repeats.keys().next().value;
    if (oldest !== undefined) repeats.delete(oldest);
  }

  repeats.set(key, { lastAt: now, suppressed: 0 });
  return seen?.suppressed ?? 0;
}

/**
 * Records one event. Returns immediately; the insert is detached.
 *
 * Never await this, and never make anything conditional on it having happened.
 */
export function waLog(entry: WaLogEntry): void {
  try {
    const level: WaLogLevel = entry.level || (entry.error ? 'ERROR' : 'INFO');
    if (LEVEL_RANK[level] < minLevel()) return;

    const withPayloads = payloadsEnabled();
    const failure = entry.error ? clip(errorText(entry.error), 2000) : null;

    const repeated = repeatCheck(level, entry, failure);
    if (repeated === null) return;

    const data = {
      level,
      category: entry.category,
      event: clip(entry.event, 100),
      // The suppression count rides on the message rather than only in meta, so
      // a repeating fault is visible in the list without opening the row.
      message: clip(
        repeated > 0
          ? `${entry.message || entry.event} (+${repeated} répétition(s) en une minute)`
          : entry.message || entry.event,
        1000
      ),
      userId: entry.userId ?? null,
      contactId: entry.contactId ?? null,
      contactJid: entry.contactJid ? clip(entry.contactJid, 120) : null,
      contactName: entry.contactName ? clip(entry.contactName, 120) : null,
      turnId: entry.turnId ?? null,
      messageWaId: entry.messageWaId ? clip(entry.messageWaId, 160) : null,
      request: withPayloads ? toJsonColumn(entry.request) : undefined,
      response: withPayloads ? toJsonColumn(entry.response) : undefined,
      meta: toJsonColumn(repeated > 0 ? { ...(entry.meta as object), repeatedSinceLastRow: repeated } : entry.meta),
      errorText: failure,
      durationMs: entry.durationMs ?? null,
      inputTokens: entry.inputTokens ?? null,
      outputTokens: entry.outputTokens ?? null,
      costCents: entry.costCents ?? null,
      source,
    };

    const insert = prisma.whatsappAgentLog
      .create({ data })
      .then(() => undefined)
      .catch((err: unknown) =>
        // The last resort, and the reason rule 1 above holds: if the log table
        // is unreachable the event still reaches stdout instead of vanishing.
        console.error(`[wa/logs] could not record "${entry.event}":`, (err as Error).message)
      )
      .finally(() => pending.delete(insert));

    pending.add(insert);
  } catch (err) {
    console.error('[wa/logs] logger fault:', (err as Error).message);
  }
}

/**
 * Inserts still in flight.
 *
 * Rule 2 says waLog() never blocks, which means a process can exit with rows
 * still on the wire. In the worker and the API that is invisible — they outlive
 * every insert. In a short-lived CLI (sttBackfill, smoke, the turn tests) it is
 * not: the script finishes, the process exits, and the last few rows — usually
 * including the error the script was run to investigate — are lost. Anything
 * that exits deliberately awaits flushWaLogs() first.
 */
const pending = new Set<Promise<unknown>>();

/**
 * Waits for the outstanding inserts, but never longer than `timeoutMs`.
 *
 * Bounded on purpose: this is called on the way out, including from the fatal
 * handler, and a logger that can hang a shutdown is worse than a logger that
 * drops a row.
 */
export async function flushWaLogs(timeoutMs = 2000): Promise<void> {
  if (!pending.size) return;
  await Promise.race([
    Promise.allSettled([...pending]),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/** Sugar for the two levels that are always written. */
export const waLogError = (entry: Omit<WaLogEntry, 'level'>): void => waLog({ ...entry, level: 'ERROR' });
export const waLogWarn = (entry: Omit<WaLogEntry, 'level'>): void => waLog({ ...entry, level: 'WARN' });

/**
 * Times an operation and records it as one row per outcome.
 *
 * The success row carries whatever `describe` returns, so a caller can log the
 * interesting part of a result without keeping a stopwatch itself.
 */
export async function waLogged<T>(
  entry: Omit<WaLogEntry, 'durationMs' | 'error'>,
  run: () => Promise<T>,
  describe?: (result: T) => Partial<WaLogEntry>
): Promise<T> {
  const started = Date.now();
  try {
    const result = await run();
    waLog({ ...entry, ...(describe ? describe(result) : {}), durationMs: Date.now() - started });
    return result;
  } catch (err) {
    waLog({ ...entry, level: 'ERROR', error: err, durationMs: Date.now() - started });
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* retention                                                           */
/* ------------------------------------------------------------------ */

/**
 * Drops rows past their retention window.
 *
 * This table grows with customer traffic and carries customer messages, so it
 * expires by default rather than on request. Deleting in bounded batches keeps
 * the statement off a long lock on a busy table.
 */
export async function pruneWaLogs(): Promise<number> {
  const days = getSecretNumber('WA_LOG_RETENTION_DAYS', 30);
  if (days <= 0) return 0;

  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000);
  let removed = 0;

  for (let batch = 0; batch < 20; batch++) {
    const doomed = await prisma.whatsappAgentLog.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      take: 1000,
    });
    if (!doomed.length) break;

    const { count } = await prisma.whatsappAgentLog.deleteMany({
      where: { id: { in: doomed.map((d) => d.id) } },
    });
    removed += count;
    if (doomed.length < 1000) break;
  }

  return removed;
}
