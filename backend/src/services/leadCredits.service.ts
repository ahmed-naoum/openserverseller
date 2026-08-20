/**
 * Lead visibility gated by Google Sheets credits — a RESERVATION model.
 *
 * When an admin enables `googleSheetsOutboundEnabled`, every lead the account
 * captures from then on needs a credit behind it. Crucially the credit is NOT spent
 * on arrival: each lead that has not yet been written to the sheet RESERVES one, and
 * the balance only drops when a row is actually appended.
 *
 *   capacity = balance − (leads captured but not yet sent)
 *
 * While capacity is >= 0 every lead is visible. Once more leads arrive than the
 * balance can cover, the NEWEST ones lock: the seller still sees the row, but not the
 * customer's phone. Leads they were already working never lock out from under them.
 *
 * Sending does not free capacity — the balance and the un-sent count fall together —
 * which is the point: the reservation is what guarantees a visible lead can actually
 * be sent. Only buying credits raises capacity and unlocks the newest leads.
 *
 * WHAT COUNTS AS SENT. A lead has been paid for exactly when a `SheetCreditTransaction`
 * of type CONSUME carries its id. That column is UNIQUE, so "charged once" is enforced
 * by Postgres, and it is the same row the Google Sheets push already writes — there is
 * no second bookkeeping to keep in step.
 *
 * GRANDFATHERING. Only leads created at or after `user.googleSheetsGateFrom` count,
 * so switching the feature on never retroactively locks existing leads.
 */

import { prisma } from '../lib/prisma.js';
import { LEAD_PRICE_CENTS, centsToLeads } from '../lib/sheetPricing.js';

/** The vendor fields every gate decision needs. */
export interface GateConfig {
  googleSheetsOutboundEnabled: boolean;
  googleSheetsGateFrom: Date | null;
}

export const GATE_SELECT = {
  googleSheetsOutboundEnabled: true,
  googleSheetsGateFrom: true,
} as const;

/** What the seller is shown: the three numbers behind the reservation. */
export interface GateStats {
  active: boolean;
  /** Money held, in CENTS. */
  balance: number;
  /** How many leads that money could pay for, ignoring what is reserved. */
  affordable: number;
  /** Captured under the gate and not yet written to the sheet. */
  unsent: number;
  /** balance − unsent. Negative means that many leads are locked. */
  capacity: number;
  /** How many leads are currently locked (0 when capacity >= 0). */
  locked: number;
  /** Cents charged per lead, so the client never hardcodes the tariff. */
  priceCents: number;
}

/**
 * Masks a phone for a seller who has no credit behind the lead.
 *
 * Keeps the first two and last two characters so the row still reads as a real
 * contact and two leads look different, without being dialable.
 */
export function maskPhone(phone: unknown): string {
  const raw = String(phone ?? '').trim();
  if (!raw) return '';
  if (raw.length <= 4) return '••••';
  return `${raw.slice(0, 2)}${'•'.repeat(Math.max(4, raw.length - 4))}${raw.slice(-2)}`;
}

export function isGateActive(config: GateConfig | null | undefined): boolean {
  return !!config?.googleSheetsOutboundEnabled && !!config?.googleSheetsGateFrom;
}

export function isLeadGated(config: GateConfig | null | undefined, createdAt: Date | string | null): boolean {
  if (!isGateActive(config)) return false;
  if (!createdAt) return false;
  return new Date(createdAt).getTime() >= new Date(config!.googleSheetsGateFrom as Date).getTime();
}

async function loadGate(vendorId: number): Promise<GateConfig | null> {
  return prisma.user.findUnique({ where: { id: vendorId }, select: GATE_SELECT });
}

async function balanceOf(vendorId: number): Promise<number> {
  const a = await prisma.sheetCreditAccount.findUnique({
    where: { userId: vendorId },
    select: { balance: true },
  });
  return a?.balance ?? 0;
}

/** Predicate for "captured under the gate, never written to the sheet". */
function unsentWhere(vendorId: number, gateFrom: Date) {
  return {
    vendorId,
    createdAt: { gte: gateFrom },
    // No CONSUME row -> no credit has ever been spent on this lead.
    sheetCreditCharge: null,
  };
}

/** The three numbers the panel and the header chip display. */
export async function getGateStats(vendorId: number): Promise<GateStats> {
  const idle: GateStats = { active: false, balance: 0, affordable: 0, unsent: 0, capacity: 0, locked: 0, priceCents: LEAD_PRICE_CENTS };
  try {
    if (!vendorId) return idle;
    const gate = await loadGate(vendorId);
    const balance = await balanceOf(vendorId);
    if (!isGateActive(gate)) return { ...idle, balance, affordable: centsToLeads(balance) };

    const unsent = await prisma.lead.count({
      where: unsentWhere(vendorId, gate!.googleSheetsGateFrom as Date),
    });
    // Capacity is counted in LEADS, not money: the balance is cents, so divide by
    // the tariff first. Anything the balance cannot pay a whole lead for does not
    // count as capacity.
    const affordable = centsToLeads(balance);
    const capacity = affordable - unsent;
    return { active: true, balance, affordable, unsent, capacity, locked: Math.max(0, -capacity), priceCents: LEAD_PRICE_CENTS };
  } catch (err) {
    console.error('[LeadCredits] stats failed for vendor', vendorId, err);
    return idle;
  }
}

/**
 * Which of the given leads the seller may not see the number for.
 *
 * A lead's lock state depends on its rank among ALL of the account's un-sent leads,
 * not just the page being rendered, so the boundary is found by offsetting into that
 * ordered set. Fetching every locked id instead would mean pulling thousands of rows
 * to render twenty.
 *
 * Ordering is oldest-first, so the leads beyond the boundary — the NEWEST ones — are
 * the locked ones. `id` breaks ties because a batch import writes many rows in the
 * same millisecond, and without a total order the boundary would wobble between calls.
 */
export async function getLockedLeadIds(
  vendorId: number,
  leads: { id: number; createdAt: Date | string }[]
): Promise<Set<number>> {
  const locked = new Set<number>();
  try {
    if (!vendorId || !leads.length) return locked;

    const gate = await loadGate(vendorId);
    if (!isGateActive(gate)) return locked;
    const gateFrom = gate!.googleSheetsGateFrom as Date;

    const gated = leads.filter((l) => isLeadGated(gate, l.createdAt));
    if (!gated.length) return locked;

    const balance = await balanceOf(vendorId);

    // The first un-sent lead the balance cannot cover. Nothing past `balance` rows
    // exists -> every un-sent lead is covered -> nothing is locked.
    const boundary = await prisma.lead.findMany({
      where: unsentWhere(vendorId, gateFrom),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      // Offset in LEADS the balance can pay for, not in cents.
      skip: Math.max(0, centsToLeads(balance)),
      take: 1,
      select: { id: true, createdAt: true },
    });
    if (!boundary.length) return locked;
    const cutAt = new Date(boundary[0].createdAt).getTime();
    const cutId = boundary[0].id;

    // Of the rows on this page, which have never been paid for.
    const paid = await prisma.sheetCreditTransaction.findMany({
      where: { leadId: { in: gated.map((l) => l.id) }, type: 'CONSUME' },
      select: { leadId: true },
    });
    const paidSet = new Set(paid.map((p) => p.leadId));

    for (const lead of gated) {
      if (paidSet.has(lead.id)) continue; // already written to the sheet
      const t = new Date(lead.createdAt).getTime();
      // At or after the boundary, using the same (createdAt, id) total order.
      if (t > cutAt || (t === cutAt && lead.id >= cutId)) locked.add(lead.id);
    }
    return locked;
  } catch (err) {
    console.error('[LeadCredits] lock lookup failed for vendor', vendorId, err);
    // Fails OPEN. Hiding every number on a transient database error would be a
    // worse outage for the seller than a brief over-disclosure.
    return locked;
  }
}

/** True when this one lead is locked for its owner. */
export async function isLeadLocked(vendorId: number, leadId: number): Promise<boolean> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, createdAt: true } });
  if (!lead) return false;
  const locked = await getLockedLeadIds(vendorId, [lead]);
  return locked.has(leadId);
}
