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

/* ------------------------------------------------------------------------- *
 * Phone identity
 *
 * The IP signals above are circumstantial: Moroccan carriers put thousands of
 * genuine customers behind one CGNAT address, so a shared IP is evidence of a
 * shared network and nothing more. One phone number wearing two different
 * names is not circumstantial — nobody legitimately has two identities on one
 * line — which makes it the strongest signal this system has.
 *
 * Strongest is still not proof, and nothing here refuses an order. Every signal
 * is scored when a leads list is rendered and attached to the row as a reason,
 * so the people who can actually judge it — the seller and the agent who calls
 * the customer — see both the order and why it looks wrong. The matching below
 * therefore leans toward NOT accusing: a missed fake costs one wasted call, a
 * false accusation costs a real sale.
 * ------------------------------------------------------------------------- */

/** How far back a conflicting identity is still considered relevant. */
export const PHONE_IDENTITY_WINDOW_DAYS = 90;

/**
 * A number reduced to the nine digits that actually identify a Moroccan line.
 *
 * Taking the LAST nine collapses every way the same line gets typed —
 * `0612345678`, `+212612345678`, `00212 6 12 34 56 78`, `612345678` — onto one
 * key, without a table of prefixes to keep current. Two genuinely different
 * numbers can only collide here if they differ solely in their country or trunk
 * prefix, which for this market means they are the same line anyway.
 *
 * Returns null below nine digits: that is not a number we can reason about, and
 * a short key would collide with unrelated lines.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 9) return null;
  return digits.slice(-9);
}

/**
 * A name broken into comparable tokens: accents folded, case dropped,
 * punctuation removed, single characters discarded as initials.
 *
 * Order is deliberately not preserved — "Ahmed Naoum" and "Naoum Ahmed" are one
 * person filling the same form twice, and half the forms on these pages are
 * filled surname-first.
 */
export function nameTokens(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return String(raw)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/** True when `a` and `b` differ by at most one insertion, deletion or substitution. */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a === b) return true;

  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let slack = 1;

  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i++;
      j++;
      continue;
    }
    if (!slack--) return false;
    // On equal lengths this is a substitution, so both advance; otherwise the
    // extra character belongs to the longer string alone.
    if (short.length === long.length) i++;
    j++;
  }
  return true;
}

/**
 * Whether two names plausibly belong to the same person.
 *
 * Every token of the shorter name must appear in the longer one, give or take a
 * single typo. That one rule covers the three ways a real repeat customer
 * differs from themselves — an added surname ("Ahmed" then "Ahmed Naoum"), a
 * reordering, and a misspelling — while still separating "Mohamed Alami" from
 * "Mohamed Bennani".
 *
 * An empty side returns true: an unknown name is not evidence of a second
 * identity, and treating it as one would refuse orders over a blank field.
 */
export function samePerson(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return true;
  const [small, large] = a.length <= b.length ? [a, b] : [b, a];
  return small.every((t) => large.some((u) => t === u || withinOneEdit(t, u)));
}

/* ------------------------------------------------------------------------- *
 * The badge
 *
 * Four signals, scored together when a leads list is rendered, each carried on
 * the row as its own reason so a seller reads "why", not just "suspect".
 *
 * Two of the four are only stated in a form that means something. "Same name"
 * and "same user agent" are close to worthless on their own in this market —
 * Moroccan first names repeat constantly, and one Chrome-on-Android string
 * covers millions of real phones — so neither is reported for merely occurring
 * twice:
 *
 *   NAME_REUSED  is one name across several DIFFERENT numbers, which is an
 *                identity being reused, not a common name.
 *   UA_CLUSTER   is one browser string on one ADDRESS, which is one device, not
 *                one popular browser.
 *
 * Scored on read rather than stored, exactly like `ipOrderCountsFor` above: a
 * verdict written at checkout would be frozen at the moment the system knew
 * least about the number, and the second order on a reused line is what makes
 * the first one legible.
 * ------------------------------------------------------------------------- */

export type FraudSignalCode =
  | 'PHONE_IDENTITY'
  | 'PHONE_REPEAT'
  | 'NAME_REUSED'
  | 'IP_BURST'
  | 'UA_CLUSTER';

/** Orders on one number inside the window before repetition is worth stating. */
export const PHONE_REPEAT_MIN = 3;
/** Distinct numbers one name must appear on before it reads as a reused identity. */
export const NAME_REUSED_MIN = 3;
/** Orders sharing one address AND one browser string in 24h before it is a cluster. */
export const UA_CLUSTER_MIN = 3;

export interface LeadFraudSignals {
  codes: FraudSignalCode[];
  /**
   * STRONG only for PHONE_IDENTITY — the one signal with no innocent reading.
   * Everything else is WATCH: worth a look before confirming, never a verdict.
   */
  severity: 'NONE' | 'WATCH' | 'STRONG';
  counts: {
    phoneLeads: number;
    phoneIdentities: number;
    namePhones: number;
    ipOrders: number;
    uaCluster: number;
  };
}

export interface FraudLeadRef {
  id: number;
  phone?: string | null;
  fullName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date | string;
}

const EMPTY_SIGNALS: LeadFraudSignals = {
  codes: [],
  severity: 'NONE',
  counts: { phoneLeads: 0, phoneIdentities: 0, namePhones: 0, ipOrders: 0, uaCluster: 0 },
};

/**
 * Per number on the page: how many orders it carries, and how many distinct
 * people have used it.
 *
 * The names are grouped here rather than with a `GROUP BY "fullName"`, because
 * `samePerson` is fuzzy — SQL would score every typo and every surname-first
 * spelling as another identity and flag half the page.
 */
async function phoneFacts(
  keys: string[],
  since: Date
): Promise<Map<string, { leads: number; identities: number }>> {
  const rows = await prisma.$queryRaw<{ key: string; fullName: string }[]>`
    SELECT RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 9) AS key, "fullName"
    FROM leads
    WHERE RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 9) IN (${Prisma.join(keys)})
      AND "createdAt" >= ${since}
  `;

  const out = new Map<string, { leads: number; identities: number; people: string[][] }>();
  for (const row of rows) {
    const bucket = out.get(row.key) || { leads: 0, identities: 0, people: [] };
    bucket.leads++;
    const tokens = nameTokens(row.fullName);
    if (tokens.length && !bucket.people.some((p) => samePerson(p, tokens))) {
      bucket.people.push(tokens);
    }
    bucket.identities = bucket.people.length;
    out.set(row.key, bucket);
  }
  return out;
}

/**
 * Per name on the page: how many DIFFERENT numbers have used it.
 *
 * Matched on `lower(btrim())` rather than through `samePerson`, and that is the
 * right semantic as well as the fast one: this looks for an identity being
 * copied verbatim onto new numbers, which is a literal string repeat. Needs the
 * companion index, or it is a sequential scan on every page load:
 *
 *   CREATE INDEX CONCURRENTLY leads_name_lower_idx ON leads (lower(btrim("fullName")));
 */
async function nameFacts(names: string[], since: Date): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ key: string; phones: number }[]>`
    SELECT lower(btrim("fullName")) AS key,
           count(DISTINCT RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 9))::int AS phones
    FROM leads
    WHERE lower(btrim("fullName")) IN (${Prisma.join(names)})
      AND "createdAt" >= ${since}
      AND length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 9
    GROUP BY 1
  `;
  return new Map(rows.map((r) => [r.key, Number(r.phones)]));
}

/**
 * Per lead: orders sharing BOTH its address and its browser string in the 24
 * hours ending at its own creation.
 *
 * Same windowed shape as `ipOrderCountsFor`, and for the same reason — a plain
 * "last 24h" count shrinks as the window slides and would quietly un-flag a
 * burst from yesterday. Partitioned on the pair, because that is the signal:
 * one device, not one network and not one popular browser.
 */
async function uaClusterCounts(leads: FraudLeadRef[]): Promise<Map<number, number>> {
  const usable = leads.filter((l) => l.ipAddress && l.userAgent);
  if (!usable.length) return new Map();

  const ips = [...new Set(usable.map((l) => l.ipAddress as string))];
  const ids = usable.map((l) => l.id);
  const times = usable.map((l) => new Date(l.createdAt).getTime());
  const floor = new Date(Math.min(...times) - FRAUD_WINDOW_HOURS * 60 * 60 * 1000);
  const ceil = new Date(Math.max(...times));

  const rows = await prisma.$queryRaw<{ id: number; c: number }[]>`
    SELECT t.id, t.c FROM (
      SELECT l.id AS id,
             COUNT(*) OVER (
               PARTITION BY l."ipAddress", l."userAgent"
               ORDER BY l."createdAt"
               RANGE BETWEEN INTERVAL '${Prisma.raw(String(FRAUD_WINDOW_HOURS))} hours' PRECEDING AND CURRENT ROW
             )::int AS c
      FROM leads l
      WHERE l."ipAddress" IN (${Prisma.join(ips)})
        AND l."userAgent" IS NOT NULL
        AND l."createdAt" >= ${floor}
        AND l."createdAt" <= ${ceil}
    ) t
    WHERE t.id IN (${Prisma.join(ids)})
  `;
  return new Map(rows.map((r) => [Number(r.id), Number(r.c)]));
}

/**
 * Every signal for a page of leads, in one pass.
 *
 * Returns a Map; an id missing from it carries no signals at all. Never throws
 * and never partially fails a list: if the scoring cannot complete, the page
 * renders exactly as it did before any of this existed.
 */
export async function leadFraudSignalsFor(
  leads: FraudLeadRef[],
  ipThreshold: number
): Promise<Map<number, LeadFraudSignals>> {
  if (!leads.length) return new Map();

  const since = new Date(Date.now() - PHONE_IDENTITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const phoneKeyOf = new Map<number, string>();
  const nameKeyOf = new Map<number, string>();
  for (const l of leads) {
    const pk = normalizePhone(l.phone);
    if (pk) phoneKeyOf.set(l.id, pk);
    const nk = (l.fullName || '').trim().toLowerCase();
    if (nk) nameKeyOf.set(l.id, nk);
  }

  const phoneKeys = [...new Set(phoneKeyOf.values())];
  const nameKeys = [...new Set(nameKeyOf.values())];

  try {
    const [phones, names, ipCounts, uaCounts] = await Promise.all([
      phoneKeys.length
        ? phoneFacts(phoneKeys, since)
        : Promise.resolve(new Map<string, { leads: number; identities: number }>()),
      nameKeys.length ? nameFacts(nameKeys, since) : Promise.resolve(new Map<string, number>()),
      ipOrderCountsFor(leads),
      uaClusterCounts(leads),
    ]);

    const out = new Map<number, LeadFraudSignals>();

    for (const l of leads) {
      const phone = phones.get(phoneKeyOf.get(l.id) ?? '');
      const namePhones = names.get(nameKeyOf.get(l.id) ?? '') ?? 0;
      const ipOrders = ipCounts.get(l.id) ?? 0;
      const uaCluster = uaCounts.get(l.id) ?? 0;

      const counts = {
        phoneLeads: phone?.leads ?? 0,
        phoneIdentities: phone?.identities ?? 0,
        namePhones,
        ipOrders,
        uaCluster,
      };

      const codes: FraudSignalCode[] = [];
      if (counts.phoneIdentities > 1) codes.push('PHONE_IDENTITY');
      if (counts.phoneLeads >= PHONE_REPEAT_MIN) codes.push('PHONE_REPEAT');
      if (counts.namePhones >= NAME_REUSED_MIN) codes.push('NAME_REUSED');
      // Gated on the admin threshold, like the badge it replaces: 0 has always
      // meant "do not judge orders by their address", and still does.
      if (ipThreshold > 0 && counts.ipOrders >= ipThreshold) codes.push('IP_BURST');
      if (counts.uaCluster >= UA_CLUSTER_MIN) codes.push('UA_CLUSTER');

      // Every lead gets an entry, clean ones included: callers read the raw
      // counts off this map too, and skipping the quiet rows would report a
      // lead with two orders on its address as having none.
      out.set(l.id, {
        codes,
        severity: !codes.length ? 'NONE' : codes.includes('PHONE_IDENTITY') ? 'STRONG' : 'WATCH',
        counts,
      });
    }

    return out;
  } catch (err) {
    console.error('[leadFraud] signal scoring failed:', err);
    return new Map();
  }
}

/** Convenience for callers holding a single lead. */
export async function fraudSignalsForLead(
  lead: FraudLeadRef,
  ipThreshold: number
): Promise<LeadFraudSignals> {
  return (await leadFraudSignalsFor([lead], ipThreshold)).get(lead.id) ?? EMPTY_SIGNALS;
}
