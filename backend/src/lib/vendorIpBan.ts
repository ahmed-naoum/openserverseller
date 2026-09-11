/**
 * Seller-scoped IP bans.
 *
 * The global blocklist in ipBan.ts is an admin tool: a row there 403s the whole
 * platform from `ipFilter`, before any route runs. Sellers get something
 * narrower on purpose — a ban raised from their own leads screen refuses
 * checkout on THEIR pages and nowhere else. One seller must not be able to take
 * a shared carrier NAT address away from every other seller's customers.
 *
 * Consequences of that narrower scope, both deliberate:
 *
 *   * It is enforced at the two places a lead is born for a vendor (the landing
 *     checkout in public.routes.ts and the store checkout in store.service.ts),
 *     not in the global middleware. A banned visitor can still browse the
 *     seller's page; they cannot place an order on it.
 *   * The seller never sees or types an address. The UI bans "the customer
 *     behind this order" and the server reads the IP off the lead — which is
 *     why every entry point here takes a lead, not a string.
 *
 * Matching, normalization and CIDR support are ipBan.ts's, imported rather than
 * reimplemented: the two lists have to agree on what "the same address" means.
 */

import { prisma } from './prisma.js';
import {
  CompiledValue,
  compileValue,
  matchCompiled,
  normalizeBanValue,
  isValidBanValue,
} from './ipBan.js';

export interface VendorBanMatch extends CompiledValue {
  id: number;
  vendorId: number;
  value: string;
  reason: string | null;
}

/**
 * Every seller's bans, in one map, refreshed as a unit.
 *
 * Loaded whole rather than per vendor because the checkout path already knows
 * the vendor and a per-vendor cache would mean a database round trip the first
 * time each seller takes an order — on the hottest path in the system. The
 * whole table is a few rows per seller who has ever used the button.
 */
let cache: Map<number, VendorBanMatch[]> | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL = 30_000; // same as ipBan / fetchSecuritySettings

export const clearVendorIpBanCache = () => {
  cache = null;
  cacheExpiresAt = 0;
};

async function load(): Promise<Map<number, VendorBanMatch[]>> {
  const now = Date.now();
  if (cache && cacheExpiresAt > now) return cache;

  try {
    const rows = await prisma.vendorIpBan.findMany({
      select: { id: true, vendorId: true, value: true, reason: true },
    });

    const next = new Map<number, VendorBanMatch[]>();
    for (const row of rows) {
      const compiled = compileValue(row.value);
      if (!compiled) continue; // junk that could never match; skip rather than throw
      const list = next.get(row.vendorId);
      const entry: VendorBanMatch = { ...row, ...compiled };
      if (list) list.push(entry);
      else next.set(row.vendorId, [entry]);
    }
    cache = next;
  } catch (err) {
    // Same posture as ipBan: a database hiccup must not refuse every checkout,
    // and must not silently drop a working list either. Keep the last good one.
    console.error('[vendorIpBan] failed to load ban list:', err);
    if (!cache) cache = new Map();
  }

  cacheExpiresAt = now + CACHE_TTL;
  return cache;
}

/** The seller's ban covering this address, or null. `ip` comes from getClientIp. */
export async function findVendorBan(
  vendorId: number | null | undefined,
  ip: string | null
): Promise<VendorBanMatch | null> {
  if (!vendorId || !ip) return null;
  const byVendor = await load();
  const list = byVendor.get(vendorId);
  if (!list || !list.length) return null;
  return matchCompiled(list, ip);
}

export interface VendorBanInput {
  vendorId: number;
  value: string;
  reason?: string | null;
  leadId?: number | null;
  createdById?: number | null;
  createdByEmail?: string | null;
}

/**
 * Add or refresh one seller's ban. Re-banning an address the seller already
 * banned updates the reason instead of failing — same call whether the row
 * exists or not, which is what the leads screen's toggle needs.
 */
export async function addVendorBan(input: VendorBanInput) {
  const value = normalizeBanValue(input.value);
  if (!isValidBanValue(value)) {
    throw new Error(`Not a valid IP address or CIDR range: ${input.value}`);
  }

  const data = {
    reason: input.reason ?? null,
    leadId: input.leadId ?? null,
    createdById: input.createdById ?? null,
    createdByEmail: input.createdByEmail ?? null,
  };

  const row = await prisma.vendorIpBan.upsert({
    where: { vendorId_value: { vendorId: input.vendorId, value } },
    update: data,
    create: { vendorId: input.vendorId, value, ...data },
  });

  clearVendorIpBanCache();
  return row;
}

/** Lift one seller's ban. False when they had not banned that address. */
export async function removeVendorBan(vendorId: number, rawValue: string): Promise<boolean> {
  const value = normalizeBanValue(rawValue);
  const deleted = await prisma.vendorIpBan.deleteMany({ where: { vendorId, value } });
  if (deleted.count > 0) clearVendorIpBanCache();
  return deleted.count > 0;
}

/**
 * Which of these addresses this seller has banned, as a Set of normalized
 * values. One query for a whole page of leads — the leads list calls it once to
 * decide which rows render the ban toggle as already on.
 *
 * Exact values only, by design: a row is marked "banned by you" when the seller
 * banned that precise address, not when some CIDR range they own happens to
 * cover it. The toggle undoes what it did, and it cannot undo half a range.
 */
export async function bannedValuesFor(
  vendorId: number,
  ips: (string | null | undefined)[]
): Promise<Set<string>> {
  const values = [...new Set(ips.filter(Boolean).map((ip) => normalizeBanValue(ip as string)))];
  if (!values.length) return new Set();

  const rows = await prisma.vendorIpBan.findMany({
    where: { vendorId, value: { in: values } },
    select: { value: true },
  });
  return new Set(rows.map((r) => r.value));
}

/**
 * Record that a seller's ban turned an order away. Throttled to once a minute
 * per ban, like recordBanHit: this is telemetry sitting on a rejection path, and
 * an exact count is not worth a write per attempt.
 */
const lastHitWrite = new Map<number, number>();
export function recordVendorBanHit(banId: number): void {
  const now = Date.now();
  const last = lastHitWrite.get(banId) || 0;
  if (now - last < 60_000) return;
  lastHitWrite.set(banId, now);

  prisma.vendorIpBan
    .update({
      where: { id: banId },
      data: { hitCount: { increment: 1 }, lastHitAt: new Date() },
    })
    .catch(() => {
      /* best-effort; never surfaces on the request path */
    });
}
