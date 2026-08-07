import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { getSecret } from '../lib/secretStore.js';
import { AppException } from '../middleware/errorHandler.js';

/**
 * Shared, self-throttling Coliaty API client.
 *
 * Coliaty enforces a per-IP rate limit and answers with 429 ("Your IP address is
 * temporarily blocked due to rate limit violations") once it is crossed — which
 * blocks the whole VPS, not just the request that tripped it. The packaging desk
 * handles ~1000 parcels a day, so the tickets page used to fan out one upstream
 * call per parcel/pickup note and reliably got the IP blocked.
 *
 * Everything that talks to Coliaty must go through `coliatyRequest` so the
 * process as a whole respects a single queue:
 *   - hard cap on concurrent upstream calls
 *   - minimum gap between calls (token-bucket style pacing)
 *   - retry with exponential backoff + jitter, honouring `Retry-After`
 *   - a global cooldown when Coliaty says the IP is blocked, so we stop digging
 *   - de-duplication of identical in-flight GETs
 *   - TTL caches for the two hot read paths (labels, pickup-note details)
 */

// ─── Tunables (env-overridable so ops can adapt without a redeploy) ──────────

const num = (key: string, fallback: number): number => {
  const raw = process.env[key];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const MAX_CONCURRENCY = num('COLIATY_MAX_CONCURRENCY', 2);
const MIN_GAP_MS = num('COLIATY_MIN_GAP_MS', 180);
const MAX_RETRIES = num('COLIATY_MAX_RETRIES', 5);
const BASE_BACKOFF_MS = num('COLIATY_BASE_BACKOFF_MS', 1200);
const MAX_BACKOFF_MS = num('COLIATY_MAX_BACKOFF_MS', 20000);
const BLOCK_COOLDOWN_MS = num('COLIATY_BLOCK_COOLDOWN_MS', 30000);

const LABEL_CACHE_TTL_MS = num('COLIATY_LABEL_CACHE_TTL_MS', 12 * 60 * 60 * 1000);
const LABEL_CACHE_MAX_BYTES = num('COLIATY_LABEL_CACHE_MAX_BYTES', 96 * 1024 * 1024);
const DETAIL_CACHE_TTL_MS = num('COLIATY_DETAIL_CACHE_TTL_MS', 60 * 1000);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ─── Credentials ─────────────────────────────────────────────────────────────

export const getColiatyConfig = () => {
  const pub = getSecret('COLIATY_PUBLIC_KEY');
  const sec = getSecret('COLIATY_SECRET_KEY');
  const base = (getSecret('COLIATY_BASE_URL') || 'https://customer-api-v1.coliaty.com').replace(/\/$/, '');
  if (!pub || !sec || pub === 'your_coliaty_public_key') {
    throw new AppException(500, '[Coliaty] Clés API non configurées.');
  }
  return {
    base,
    headers: {
      Authorization: `Bearer ${pub}:${sec}`,
      'Content-Type': 'application/json',
    } as Record<string, string>,
  };
};

// ─── Queue ───────────────────────────────────────────────────────────────────

type QueueTask = () => void;

let active = 0;
let lastDispatchAt = 0;
const waiting: QueueTask[] = [];

/** Timestamp until which every upstream call is held back (set on a 429). */
let cooldownUntil = 0;

const pump = () => {
  if (waiting.length === 0 || active >= MAX_CONCURRENCY) return;

  const now = Date.now();
  const earliest = Math.max(lastDispatchAt + MIN_GAP_MS, cooldownUntil);
  if (now < earliest) {
    setTimeout(pump, earliest - now);
    return;
  }

  const task = waiting.shift();
  if (!task) return;

  active += 1;
  lastDispatchAt = Date.now();
  task();

  // Another slot may still be free — try to fill it after the minimum gap.
  if (waiting.length > 0) setTimeout(pump, MIN_GAP_MS);
};

const schedule = <T>(fn: () => Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    waiting.push(() => {
      fn()
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          pump();
        });
    });
    pump();
  });

// ─── Error shape helpers ─────────────────────────────────────────────────────

/** Coliaty answers errors as JSON, but we request arraybuffers for PDF routes. */
export const decodeColiatyError = (raw: any): any => {
  if (!raw) return raw;
  if (Buffer.isBuffer(raw) || raw instanceof Uint8Array) {
    try {
      return JSON.parse(Buffer.from(raw).toString('utf-8'));
    } catch {
      return Buffer.from(raw).toString('utf-8').slice(0, 500);
    }
  }
  return raw;
};

const retryAfterMs = (headers: any): number | null => {
  const header = headers?.['retry-after'] ?? headers?.['Retry-After'];
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(String(header));
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
};

const isRetriableStatus = (status?: number) =>
  status === 429 || status === 408 || status === 425 || status === 500 || status === 502 || status === 503 || status === 504;

const isTransportError = (error: any) =>
  !error?.response &&
  ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EAI_AGAIN', 'ENOTFOUND'].includes(error?.code);

// ─── Public request entry point ──────────────────────────────────────────────

export interface ColiatyRequestOptions extends AxiosRequestConfig {
  /** Label used in logs so a 429 is traceable back to the feature that caused it. */
  context?: string;
}

export const coliatyRequest = async <T = any>(options: ColiatyRequestOptions): Promise<AxiosResponse<T>> => {
  const { context = 'Coliaty', ...config } = options;
  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await schedule(() => axios.request<T>({ timeout: 20000, ...config }));
    } catch (error: any) {
      const status = error?.response?.status;
      const canRetry = attempt < MAX_RETRIES && (isRetriableStatus(status) || isTransportError(error));

      if (status === 429) {
        // Freeze the whole queue, not just this call: the block is per-IP.
        const hinted = retryAfterMs(error?.response?.headers);
        const pause = hinted ?? BLOCK_COOLDOWN_MS;
        cooldownUntil = Math.max(cooldownUntil, Date.now() + pause);
        console.warn(`[Coliaty] 429 on ${context} — pausing all upstream calls for ${pause}ms`);
      }

      if (!canRetry) throw error;

      const jitter = Math.floor(Math.random() * 400);
      const backoff = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS) + jitter;
      const hinted = status === 429 ? retryAfterMs(error?.response?.headers) : null;
      const wait = Math.max(backoff, hinted ?? 0);

      attempt += 1;
      console.warn(`[Coliaty] ${context} failed (status ${status ?? error?.code ?? '?'}) — retry ${attempt}/${MAX_RETRIES} in ${wait}ms`);
      await sleep(wait);
    }
  }
};

/** True while we are backing off from a Coliaty IP block. */
export const isColiatyCoolingDown = () => Date.now() < cooldownUntil;

export const coliatyQueueStats = () => ({
  active,
  queued: waiting.length,
  cooldownMsRemaining: Math.max(0, cooldownUntil - Date.now()),
  maxConcurrency: MAX_CONCURRENCY,
  minGapMs: MIN_GAP_MS,
});

// ─── In-flight de-duplication ────────────────────────────────────────────────

const inFlight = new Map<string, Promise<any>>();

const coalesce = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fn().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
};

// ─── Label cache (parcel + pickup-note PDFs) ─────────────────────────────────

interface LabelEntry {
  pdf: string; // base64
  bytes: number;
  expiresAt: number;
  lastUsedAt: number;
}

const labelCache = new Map<string, LabelEntry>();
let labelCacheBytes = 0;

const evictLabels = () => {
  if (labelCacheBytes <= LABEL_CACHE_MAX_BYTES) return;
  const entries = [...labelCache.entries()].sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt);
  for (const [key, entry] of entries) {
    labelCache.delete(key);
    labelCacheBytes -= entry.bytes;
    if (labelCacheBytes <= LABEL_CACHE_MAX_BYTES * 0.8) break;
  }
};

const readLabelCache = (key: string): string | null => {
  const entry = labelCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    labelCache.delete(key);
    labelCacheBytes -= entry.bytes;
    return null;
  }
  entry.lastUsedAt = Date.now();
  return entry.pdf;
};

const writeLabelCache = (key: string, pdf: string) => {
  const existing = labelCache.get(key);
  if (existing) labelCacheBytes -= existing.bytes;

  const bytes = Math.ceil((pdf.length * 3) / 4);
  labelCache.set(key, {
    pdf,
    bytes,
    expiresAt: Date.now() + LABEL_CACHE_TTL_MS,
    lastUsedAt: Date.now(),
  });
  labelCacheBytes += bytes;
  evictLabels();
};

export const invalidateLabel = (key: string) => {
  const entry = labelCache.get(key);
  if (entry) {
    labelCache.delete(key);
    labelCacheBytes -= entry.bytes;
  }
};

/**
 * Fetches a Coliaty endpoint that returns a PDF (or a JSON envelope holding one)
 * and normalises it to base64. Cached — a printed label never changes.
 */
const fetchPdf = async (url: string, context: string): Promise<string> => {
  const cfg = getColiatyConfig();
  const response = await coliatyRequest({
    method: 'GET',
    url,
    headers: cfg.headers,
    responseType: 'arraybuffer',
    timeout: 30000,
    context,
  });

  const contentType = String(response.headers?.['content-type'] || '');
  const buffer = Buffer.from(response.data as any);

  if (contentType.includes('application/pdf')) {
    return buffer.toString('base64');
  }

  // Some routes answer JSON with the PDF nested inside.
  try {
    const parsed = JSON.parse(buffer.toString('utf-8'));
    const nested = parsed?.data?.pdf ?? parsed?.pdf ?? (typeof parsed?.data === 'string' ? parsed.data : null);
    if (typeof nested === 'string' && nested.length > 0) return nested;
  } catch {
    // Not JSON — fall through and treat the body as raw PDF bytes.
  }

  return buffer.toString('base64');
};

/** Base64 PDF for a single parcel label, served from cache when possible. */
export const getParcelLabelPdf = async (code: string): Promise<string> => {
  const key = `parcel:${code}`;
  const cached = readLabelCache(key);
  if (cached) return cached;

  return coalesce(key, async () => {
    const cfg = getColiatyConfig();
    const pdf = await fetchPdf(`${cfg.base}/parcel/generate-label/${encodeURIComponent(code)}`, `Étiquette ${code}`);
    writeLabelCache(key, pdf);
    return pdf;
  });
};

/** Base64 PDF holding every label of a pickup note. */
export const getPickupNoteLabelsPdf = async (reference: string, force = false): Promise<string> => {
  const key = `pickup:${reference}`;
  if (!force) {
    const cached = readLabelCache(key);
    if (cached) return cached;
  } else {
    invalidateLabel(key);
  }

  return coalesce(key, async () => {
    const cfg = getColiatyConfig();
    const pdf = await fetchPdf(
      `${cfg.base}/pickup-note/${encodeURIComponent(reference)}/generate-labels`,
      `Bon ${reference}`
    );
    writeLabelCache(key, pdf);
    return pdf;
  });
};

// ─── Pickup-note detail cache ────────────────────────────────────────────────

interface DetailEntry {
  data: any;
  expiresAt: number;
}

const detailCache = new Map<string, DetailEntry>();

export const invalidatePickupNoteDetail = (reference: string) => {
  detailCache.delete(reference);
};

export const getPickupNoteDetail = async (reference: string, force = false): Promise<any> => {
  if (force) {
    detailCache.delete(reference);
  } else {
    const cached = detailCache.get(reference);
    if (cached && Date.now() < cached.expiresAt) return cached.data;
  }

  return coalesce(`detail:${reference}`, async () => {
    const cfg = getColiatyConfig();
    const response = await coliatyRequest({
      method: 'GET',
      url: `${cfg.base}/pickup-note/detail/${encodeURIComponent(reference)}`,
      headers: cfg.headers,
      timeout: 20000,
      context: `Détail bon ${reference}`,
    });
    const data = (response.data as any)?.data ?? response.data;
    detailCache.set(reference, { data, expiresAt: Date.now() + DETAIL_CACHE_TTL_MS });
    return data;
  });
};

export const coliatyCacheStats = () => ({
  labels: labelCache.size,
  labelBytes: labelCacheBytes,
  details: detailCache.size,
  inFlight: inFlight.size,
});
