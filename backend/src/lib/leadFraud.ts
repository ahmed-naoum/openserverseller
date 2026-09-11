/**
 * "How many orders came from this address?" — the one number both the fraud
 * badge and the automatic ban are decided on.
 *
 * The rule is: N orders from the same IP inside a rolling 24 hours, counted
 * across the whole platform. Platform-wide rather than per seller because the
 * behaviour it catches — one person spraying fake orders — is usually spread
 * over several sellers' pages precisely so no single seller sees a pattern.
 *
 * Two callers, and they must agree or the UI lies:
 *
 *   * the checkout, which counts backwards from the order being placed and bans
 *     the address when the count reaches the threshold (lib/ipBan.ts);
 *   * the lead lists, which need the same count for rows that were created days
 *     ago. That is NOT "orders from this IP in the last 24h" — that number
 *     shrinks as the window slides forward and would quietly un-flag yesterday's
 *     fraud. It is the count as it stood when the lead was created, which is
 *     what `ipOrderCountsFor` recomputes with a window function.
 */

import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

/** The rolling window both counts use. */
export const FRAUD_WINDOW_HOURS = 24;

/** Threshold when the platform has never been configured. */
export const DEFAULT_FRAUD_THRESHOLD = 3;

/**
 * Orders from `ip` in the 24 hours up to now, platform-wide.
 * Used at checkout time, where "now" is the order being placed.
 */
export async function countRecentOrdersFromIp(ip: string): Promise<number> {
  const since = new Date(Date.now() - FRAUD_WINDOW_HOURS * 60 * 60 * 1000);
  return prisma.lead.count({ where: { ipAddress: ip, createdAt: { gte: since } } });
}

interface LeadRef {
  id: number;
  ipAddress?: string | null;
  createdAt: Date | string;
}

/**
 * For each lead passed in, how many orders had come from its IP in the 24 hours
 * ending at its own creation — itself included, so the first order of a run
 * counts 1.
 *
 * One query for the whole page. The subquery has to see every lead sharing
 * those addresses, not just the ones being rendered, or the counts come out
 * short; it is bounded to the window actually needed (24h before the oldest row
 * on the page, up to the newest) so a long-lived shared address does not drag
 * its entire history in.
 *
 * Returns a Map; an id missing from it means zero known orders, which only
 * happens for leads with no recorded IP.
 */
export async function ipOrderCountsFor(leads: LeadRef[]): Promise<Map<number, number>> {
  const withIp = leads.filter((l) => l.ipAddress);
  if (!withIp.length) return new Map();

  const ips = [...new Set(withIp.map((l) => l.ipAddress as string))];
  const ids = withIp.map((l) => l.id);
  const times = withIp.map((l) => new Date(l.createdAt).getTime());
  const floor = new Date(Math.min(...times) - FRAUD_WINDOW_HOURS * 60 * 60 * 1000);
  const ceil = new Date(Math.max(...times));

  try {
    const rows = await prisma.$queryRaw<{ id: number; c: number }[]>`
      SELECT t.id, t.c FROM (
        SELECT l.id AS id,
               COUNT(*) OVER (
                 PARTITION BY l."ipAddress"
                 ORDER BY l."createdAt"
                 RANGE BETWEEN INTERVAL '${Prisma.raw(String(FRAUD_WINDOW_HOURS))} hours' PRECEDING AND CURRENT ROW
               )::int AS c
        FROM leads l
        WHERE l."ipAddress" IN (${Prisma.join(ips)})
          AND l."createdAt" >= ${floor}
          AND l."createdAt" <= ${ceil}
      ) t
      WHERE t.id IN (${Prisma.join(ids)})
    `;
    return new Map(rows.map((r) => [Number(r.id), Number(r.c)]));
  } catch (err) {
    // A badge is not worth failing a list over. No counts means no badges,
    // which reads as "nothing suspicious" — the same as before this existed.
    console.error('[leadFraud] ip order counts failed:', err);
    return new Map();
  }
}

/**
 * The configured threshold, or the default. 0 turns the whole feature off —
 * badges and automatic bans together, since a badge nobody acts on is worse
 * than no badge.
 */
export async function fraudThreshold(): Promise<number> {
  const { fetchSecuritySettings } = await import('../middleware/security.js');
  const settings = await fetchSecuritySettings();
  return settings.fraudIpThreshold;
}
