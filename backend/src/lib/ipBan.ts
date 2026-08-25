/**
 * IP ban matching for `ipFilter`.
 *
 * Three things this has to get right, each of which the previous string-array
 * implementation got wrong:
 *
 *   1. WHICH IP. silacod.com sits behind Cloudflare, so the address a visitor
 *      controls (`X-Forwarded-For`) is not the address Cloudflare vouches for
 *      (`CF-Connecting-IP`). Matching on the former let a banned visitor walk
 *      straight back in by sending one header. Callers pass the value from
 *      utils/clientIp.ts, which prefers the CDN header, and that is also the
 *      value stored on a lead — so banning the IP shown on an order bans the
 *      person who placed it.
 *
 *   2. RANGES. A fraudster on a mobile network gets a fresh address on every
 *      reconnect, which makes exact-match bans nearly useless against the case
 *      they were added for. A ban value may be a CIDR block.
 *
 *   3. COST. This runs on every request, including ad traffic hitting landing
 *      pages. The ban list is small and changes rarely, so it is cached whole
 *      and matched in memory; a request never touches the database unless the
 *      cache has expired.
 */

import { prisma } from './prisma.js';

export interface BanMatch {
  id: number;
  value: string;
  reason: string | null;
  source: string;
}

/** Precompiled range so the per-request path never re-parses a CIDR string. */
interface CompiledBan extends BanMatch {
  /** Set for an exact address ban. */
  exact: string | null;
  /** Set for a CIDR ban: the network bits as a BigInt, plus the mask width. */
  net: bigint | null;
  bits: number;
  /** 4 or 6 — a v4 ban can never match a v6 address, so this short-circuits. */
  family: 4 | 6 | 0;
}

let cache: CompiledBan[] | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL = 30_000; // matches fetchSecuritySettings, so both refresh together

export const clearIpBanCache = () => {
  cache = null;
  cacheExpiresAt = 0;
};

/**
 * Normalize an address the way both the store and the matcher expect it:
 * lowercased, whitespace trimmed, and with the IPv4-mapped IPv6 prefix removed
 * so `::ffff:41.248.3.9` and `41.248.3.9` are the same ban.
 */
export function normalizeBanValue(raw: string): string {
  let v = String(raw || '').trim().toLowerCase();
  if (v.startsWith('::ffff:')) v = v.slice(7);
  return v;
}

/** Reject input that would silently never match rather than storing a dud ban. */
export function isValidBanValue(raw: string): boolean {
  const v = normalizeBanValue(raw);
  if (!v) return false;

  const [addr, prefix] = v.split('/');
  const family = familyOf(addr);
  if (!family) return false;

  if (prefix !== undefined) {
    if (!/^\d{1,3}$/.test(prefix)) return false;
    const bits = Number(prefix);
    if (bits < 0 || bits > (family === 4 ? 32 : 128)) return false;
  }
  return true;
}

function familyOf(addr: string): 4 | 6 | 0 {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(addr)) {
    return addr.split('.').every((o) => Number(o) <= 255) ? 4 : 0;
  }
  // Deliberately loose: enough to tell a v6 literal from junk without
  // reimplementing inet_pton. toBigInt below does the real parse and returns
  // null on anything it cannot read.
  if (addr.includes(':') && /^[0-9a-f:]+$/.test(addr)) return 6;
  return 0;
}

/** Address -> integer, so a CIDR test is one mask and one compare. */
function toBigInt(addr: string, family: 4 | 6): bigint | null {
  try {
    if (family === 4) {
      const parts = addr.split('.');
      if (parts.length !== 4) return null;
      let n = 0n;
      for (const p of parts) {
        const o = Number(p);
        if (!Number.isInteger(o) || o < 0 || o > 255) return null;
        n = (n << 8n) | BigInt(o);
      }
      return n;
    }

    // IPv6, including the "::" run-length compression.
    const halves = addr.split('::');
    if (halves.length > 2) return null;
    const head = halves[0] ? halves[0].split(':') : [];
    const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    const missing = 8 - head.length - tail.length;
    if (halves.length === 2 ? missing < 0 : missing !== 0) return null;

    const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
    if (groups.length !== 8) return null;

    let n = 0n;
    for (const g of groups) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
      n = (n << 16n) | BigInt(parseInt(g, 16));
    }
    return n;
  } catch {
    return null;
  }
}

function compile(row: { id: number; value: string; reason: string | null; source: string }): CompiledBan | null {
  const v = normalizeBanValue(row.value);
  const [addr, prefix] = v.split('/');
  const family = familyOf(addr);
  if (!family) return null;

  const base: BanMatch = { id: row.id, value: row.value, reason: row.reason, source: row.source };

  if (prefix === undefined) {
    return { ...base, exact: v, net: null, bits: 0, family };
  }

  const bits = Number(prefix);
  const total = family === 4 ? 32 : 128;
  const n = toBigInt(addr, family);
  if (n === null || !Number.isInteger(bits) || bits < 0 || bits > total) return null;

  // Mask off the host bits once, here, so a sloppily written range like
  // 105.66.3.7/16 still matches everything in 105.66.0.0/16.
  const mask = bits === 0 ? 0n : ((1n << BigInt(bits)) - 1n) << BigInt(total - bits);
  return { ...base, exact: null, net: n & mask, bits, family };
}

async function load(): Promise<CompiledBan[]> {
  const now = Date.now();
  if (cache && cacheExpiresAt > now) return cache;

  try {
    const rows = await prisma.bannedIp.findMany({
      // An expired ban is kept as history but must stop matching.
      where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      select: { id: true, value: true, reason: true, source: true },
    });
    cache = rows.map(compile).filter((b): b is CompiledBan => b !== null);
  } catch (err) {
    // A database hiccup must not turn into a site-wide 403 or a site-wide
    // bypass. Keep whatever was last known good; fall back to banning nothing.
    console.error('[ipBan] failed to load ban list:', err);
    if (!cache) cache = [];
  }

  cacheExpiresAt = now + CACHE_TTL;
  return cache;
}

/**
 * The ban covering this address, or null. `ip` should come from getClientIp.
 */
export async function findBan(ip: string | null): Promise<BanMatch | null> {
  if (!ip) return null;

  const bans = await load();
  if (!bans.length) return null;

  const v = normalizeBanValue(ip);
  const family = familyOf(v);
  let n: bigint | null = null;

  for (const ban of bans) {
    if (ban.exact !== null) {
      if (ban.exact === v) return ban;
      continue;
    }
    if (!family || ban.family !== family) continue;

    // Parsed at most once per request, and only if a range ban of the right
    // family actually exists.
    if (n === null) {
      n = toBigInt(v, family);
      if (n === null) return null;
    }

    const total = family === 4 ? 32 : 128;
    const mask = ban.bits === 0 ? 0n : ((1n << BigInt(ban.bits)) - 1n) << BigInt(total - ban.bits);
    if ((n & mask) === ban.net) return ban;
  }

  return null;
}

export interface BanInput {
  value: string;
  reason?: string | null;
  source?: 'MANUAL' | 'AUTO';
  bannedById?: number | null;
  bannedByEmail?: string | null;
  leadId?: number | null;
  expiresAt?: Date | null;
}

/**
 * Add or refresh a ban. The single write path — the admin endpoint, the
 * checkout guard and the honeypot all come through here so normalization,
 * validation and cache invalidation cannot drift between them.
 *
 * Re-banning an address that is already banned updates the reason and expiry
 * rather than failing, which is what "ban this again, permanently this time"
 * should do.
 */
export async function banIp(input: BanInput) {
  const value = normalizeBanValue(input.value);
  if (!isValidBanValue(value)) {
    throw new Error(`Not a valid IP address or CIDR range: ${input.value}`);
  }

  const data = {
    reason: input.reason ?? null,
    source: input.source ?? 'MANUAL',
    bannedById: input.bannedById ?? null,
    bannedByEmail: input.bannedByEmail ?? null,
    leadId: input.leadId ?? null,
    expiresAt: input.expiresAt ?? null,
  };

  const row = await prisma.bannedIp.upsert({
    where: { value },
    update: data,
    create: { value, ...data },
  });

  clearIpBanCache();
  return row;
}

/** Lift a ban. Returns false when nothing was banned under that value. */
export async function unbanIp(rawValue: string): Promise<boolean> {
  const value = normalizeBanValue(rawValue);
  const deleted = await prisma.bannedIp.deleteMany({ where: { value } });
  if (deleted.count > 0) clearIpBanCache();
  return deleted.count > 0;
}

/**
 * Ban an address that has placed too many landing-page orders in a day.
 *
 * The checkout rate limiter caps orders per IP already, but it forgets on a
 * rolling window and the same person walks back in tomorrow. This turns a
 * repeat offender into a standing block.
 *
 * Guards, in order, because a false positive here refuses a real customer:
 *   * the feature is off unless a threshold is configured;
 *   * whitelisted addresses are never banned;
 *   * an address that is already banned is left alone, so an admin's permanent
 *     ban is not quietly downgraded to a 24-hour one;
 *   * only orders that actually carry this IP count.
 */
export async function maybeAutoBanForOrders(ip: string | null, leadId: number): Promise<void> {
  if (!ip) return;

  const { fetchSecuritySettings } = await import('../middleware/security.js');
  const settings = await fetchSecuritySettings();

  const threshold = settings.autoBanOrderThreshold;
  if (!threshold || threshold <= 0) return;
  if (settings.whitelistedIPs.includes(ip)) return;

  const value = normalizeBanValue(ip);
  const existing = await prisma.bannedIp.findUnique({ where: { value } });
  if (existing) return;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await prisma.lead.count({
    where: { ipAddress: ip, createdAt: { gte: since } },
  });
  if (count < threshold) return;

  const hours = settings.autoBanDurationHours;
  await banIp({
    value,
    reason: `Automatic: ${count} orders from this IP in 24h (threshold ${threshold})`,
    source: 'AUTO',
    leadId,
    expiresAt: hours > 0 ? new Date(Date.now() + hours * 60 * 60 * 1000) : null,
  });

  console.warn(`[AutoBan] banned ${value} after ${count} orders in 24h`);
}

/**
 * Record that a ban stopped a request.
 *
 * Fire-and-forget and throttled to once a minute per ban: this sits on a
 * rejection path that a determined bot may hit thousands of times a minute, and
 * an exact hit count is worth far less than not writing to the database on every
 * one of them.
 */
const lastHitWrite = new Map<number, number>();
export function recordBanHit(banId: number): void {
  const now = Date.now();
  const last = lastHitWrite.get(banId) || 0;
  if (now - last < 60_000) return;
  lastHitWrite.set(banId, now);

  prisma.bannedIp
    .update({
      where: { id: banId },
      data: { hitCount: { increment: 1 }, lastHitAt: new Date() },
    })
    .catch(() => {
      /* best-effort telemetry; never let it surface on the request path */
    });
}
