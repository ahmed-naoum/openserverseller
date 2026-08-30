import crypto from 'crypto';
import axios from 'axios';
import { prisma } from '../lib/prisma.js';
import { pixelRowsForCode } from './landingCompiler/head.js';

/**
 * Meta Conversions API (server-side events).
 *
 * The browser pixel on a landing page misses a growing share of conversions —
 * iOS ATT, ad blockers, and the checkout's own navigation racing the beacon.
 * This service reports the same Lead/Purchase event from the server, tied to
 * the browser event by a shared `event_id` so Meta deduplicates rather than
 * double-counts: pages fire `fbq('track', ev, data, {eventID})` and POST the
 * same id alongside the lead, and this file sends it as `event_id`.
 *
 * Everything here is called from the lead-capture hot path, so the contract is
 * the same as every other post-lead hook in public.routes.ts: never throw, and
 * never make the customer wait — callers invoke `reportLeadToMetaCapi` without
 * awaiting it.
 *
 * The access token lives on UserPixel and is a server-side secret. It is read
 * here and in pixel.controller.ts and nowhere else; every payload that leaves
 * for a browser strips it (see sanitizePublicPixel / selectActivePixels).
 */

/**
 * Graph API version, overridable without a deploy for the day Meta retires it.
 * v23.0 was current mid-2025 and versions get ~2 years of support.
 */
function graphVersion(): string {
  return process.env.META_GRAPH_VERSION || 'v23.0';
}

const GRAPH_TIMEOUT_MS = 8000;

/** SHA-256 hex, the hashing Meta requires for every user_data PII field. */
function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Phone → E.164 digits without '+', per Meta's `ph` spec.
 *
 * Accepts the shapes the checkout lets through (0..., +212..., 00212..., 212...,
 * separators, Eastern Arabic digits) and returns "2126XXXXXXXX". A number that
 * is not recognisably Moroccan still hashes as its bare digits — a wrong-format
 * hash simply fails to match, it does not break the event.
 */
export function normalizePhoneForCapi(raw: string): string | null {
  if (!raw) return null;
  const ascii = String(raw).replace(/[٠-٩]/g, (d) =>
    String(d.charCodeAt(0) - 0x0660)
  );
  const digits = ascii.replace(/[^0-9]/g, '');
  if (!digits) return null;

  let m = digits.match(/^0([5-7][0-9]{8})$/);
  if (m) return `212${m[1]}`;
  m = digits.match(/^(?:00)?212([5-7][0-9]{8})$/);
  if (m) return `212${m[1]}`;
  return digits;
}

/**
 * Lowercase, trimmed, whitespace collapsed — Meta's normalization for names and
 * cities. Arabic text is left intact: the spec is UTF-8 and hashing a
 * transliteration nobody else produces would never match anything.
 */
function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim().toLowerCase().replace(/\s+/g, ' ');
  return s || null;
}

/** First token → fn, the rest → ln. A single-word name has no ln at all. */
export function splitFullName(fullName: string): { fn: string | null; ln: string | null } {
  const s = normalizeText(fullName);
  if (!s) return { fn: null, ln: null };
  const idx = s.indexOf(' ');
  if (idx === -1) return { fn: s, ln: null };
  return { fn: s.slice(0, idx), ln: s.slice(idx + 1).trim() || null };
}

export interface CapiLeadInput {
  /** Seller or affiliate whose pixels apply. */
  influencerId?: number | null;
  /** Product owner vendorId. */
  vendorId?: number | null;
  /** Referral code, for the SINGLE/GLOBAL pixel precedence. */
  code: string;
  leadId: number;
  fullName: string;
  phone: string;
  city?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  /** Browser identifiers forwarded by the page. Passed through unhashed. */
  fbp?: string | null;
  fbc?: string | null;
  /** Shared with the browser's fbq call so Meta dedupes the pair. */
  eventId?: string | null;
  /** Price as displayed at checkout (unit/pack, never multiplied). */
  value?: number | null;
  currency?: string;
  productName?: string | null;
  /** Landing page URL the order was placed on. */
  sourceUrl?: string | null;
}

/** One entry of the Graph payload's `data` array. Exported for tests. */
export function buildCapiEvent(input: CapiLeadInput, eventName: string): Record<string, any> {
  const { fn, ln } = splitFullName(input.fullName || '');
  const phone = normalizePhoneForCapi(input.phone || '');
  const city = normalizeText(input.city ?? null);

  const userData: Record<string, any> = {};
  if (phone) userData.ph = [sha256(phone)];
  if (fn) userData.fn = [sha256(fn)];
  if (ln) userData.ln = [sha256(ln)];
  if (city) userData.ct = [sha256(city.replace(/\s+/g, ''))];
  // Every checkout is Moroccan COD; the country signal is nearly free match
  // quality. Hashed like the rest, per spec.
  userData.country = [sha256('ma')];
  userData.external_id = [sha256(`lead-${input.leadId}`)];
  if (input.ipAddress) userData.client_ip_address = input.ipAddress;
  if (input.userAgent) userData.client_user_agent = input.userAgent;
  // Cookie-shaped or dropped: junk here lowers the match instead of helping it.
  if (input.fbp && /^fb\.[0-9]\./.test(input.fbp)) userData.fbp = input.fbp;
  if (input.fbc && /^fb\.[0-9]\./.test(input.fbc)) userData.fbc = input.fbc;

  const customData: Record<string, any> = {
    currency: input.currency || 'MAD',
  };
  const value = Number(input.value);
  // Purchase events are rejected without currency+value, so the caller falls
  // back to the product's retail price before this ever sees null.
  if (Number.isFinite(value) && value >= 0) customData.value = value;
  if (input.productName) customData.content_name = String(input.productName).slice(0, 200);
  customData.order_id = String(input.leadId);

  const event: Record<string, any> = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    user_data: userData,
    custom_data: customData,
  };
  if (input.eventId) event.event_id = String(input.eventId).slice(0, 100);
  if (input.sourceUrl) event.event_source_url = String(input.sourceUrl).slice(0, 1024);
  return event;
}

interface CapiSendResult {
  ok: boolean;
  eventsReceived?: number;
  error?: string;
}

/** POSTs one events payload to one pixel. Token travels in the body, never the URL. */
async function postToGraph(
  pixelId: string,
  accessToken: string,
  events: Record<string, any>[],
  testEventCode?: string | null
): Promise<CapiSendResult> {
  const url = `https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(pixelId)}/events`;
  const body: Record<string, any> = {
    data: events,
    access_token: accessToken,
  };
  if (testEventCode) body.test_event_code = testEventCode;

  try {
    const res = await axios.post(url, body, {
      timeout: GRAPH_TIMEOUT_MS,
      // Resolve everything: a 4xx must become a readable result, not a throw
      // with the request (token included) attached to the error object.
      validateStatus: () => true,
    });
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, eventsReceived: res.data?.events_received };
    }
    const graphError = res.data?.error;
    return {
      ok: false,
      error: graphError
        ? `${graphError.message || 'Graph error'} (code ${graphError.code}, trace ${graphError.fbtrace_id || 'n/a'})`
        : `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { ok: false, error: err?.code || err?.message || 'network error' };
  }
}

/**
 * Reports a captured lead to every Meta pixel active for this link that has a
 * CAPI token.
 */
export async function reportLeadToMetaCapi(input: CapiLeadInput): Promise<void> {
  try {
    const userIds = Array.from(
      new Set([input.influencerId, input.vendorId].filter((id): id is number => typeof id === 'number' && id > 0))
    );
    if (!userIds.length) return;

    const all = await prisma.userPixel.findMany({ where: { userId: { in: userIds } } });
    const active = pixelRowsForCode(all, input.code).filter(
      (p: any) => String(p.platform || 'META').toUpperCase() === 'META' && p.accessToken
    );
    if (!active.length) return;

    for (const pixel of active) {
      const eventName = String(pixel.conversionEvent || 'Purchase').trim() === 'Lead' ? 'Lead' : 'Purchase';
      const event = buildCapiEvent(input, eventName);
      const result = await postToGraph(
        pixel.pixelId,
        pixel.accessToken as string,
        [event],
        pixel.testEventCode
      );
      if (result.ok) {
        console.log(
          `[MetaCAPI] ${eventName} sent for lead ${input.leadId} to pixel ${pixel.pixelId} (received: ${result.eventsReceived ?? '?'})`
        );
      } else {
        // A dead token is a seller-configuration problem, not ours to retry —
        // but it must be findable in the logs when they ask where events went.
        console.warn(
          `[MetaCAPI] ${eventName} FAILED for lead ${input.leadId}, pixel ${pixel.pixelId}: ${result.error}`
        );
      }
    }
  } catch (err) {
    console.error('[MetaCAPI] report failed:', err);
  }
}

/**
 * Fires a synthetic Lead at the pixel's Test Events tab so the seller can see
 * their token working before any real order rides on it. Refusing to run
 * without a testEventCode is deliberate: without one the event would land in
 * production data as a fake lead.
 */
export async function sendMetaCapiTestEvent(pixel: {
  pixelId: string;
  accessToken: string;
  testEventCode?: string | null;
}): Promise<CapiSendResult> {
  if (!pixel.testEventCode) {
    return { ok: false, error: 'TEST_CODE_REQUIRED' };
  }
  const event = buildCapiEvent(
    {
      influencerId: 0,
      code: 'test',
      leadId: 0,
      fullName: 'Test Silacod',
      phone: '0612345678',
      city: 'Casablanca',
      eventId: `test-${Date.now()}`,
      value: 1,
      sourceUrl: 'https://silacod.com/capi-test',
    },
    'Lead'
  );
  return postToGraph(pixel.pixelId, pixel.accessToken, [event], pixel.testEventCode);
}
