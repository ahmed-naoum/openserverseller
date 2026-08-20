/**
 * Server-side masking of a locked lead's phone.
 *
 * A gated seller (see services/leadCredits.service.ts) still sees every lead
 * they capture, but the customer's phone and WhatsApp stay hidden until a
 * credit has paid for that row. Hiding it in the UI would be worthless — the
 * real number would still sit in the JSON — so it is rewritten here, on the way
 * out, on every response that carries a lead back to its seller.
 *
 * Rows reach the wire in several shapes: a lead row, an order with a nested
 * lead, the synthetic `lead-<id>` rows the customers list builds. They all go
 * through one entry point — hand it the rows and say where the underlying lead
 * and the phone fields live — so the next read path has an obvious thing to
 * call rather than a lock check to reinvent.
 *
 * WHO IS MASKED. Only the seller. An admin, a call-centre agent or a
 * confirmation user reading the same lead gets the real number, because the
 * call centre has to be able to phone the customer. `maskingVendorId()` is the
 * single place that decision is made.
 *
 * WHAT IS NOT MASKED. The number written into the seller's Google Sheet. A lead
 * only reaches the sheet once a credit has paid for it, so by construction it is
 * unlocked — masking there would corrupt data the seller has paid for.
 */

import type { Request } from 'express';
import { prisma } from './prisma.js';
import { GATE_SELECT, getLockedLeadIds, isGateActive, maskPhone } from '../services/leadCredits.service.js';

/** The lead behind a row, whatever shape the row itself has. */
export interface MaskableLead {
  id: number;
  createdAt: Date | string;
  /**
   * Who owns the lead. A lead belonging to somebody else — a product this
   * account only affiliates for — is never gated by THIS account's credits, so
   * it is left alone. Leave `undefined` only when the query genuinely cannot
   * say: an unknown owner is treated as the caller's own and masked.
   */
  vendorId?: number | null;
}

export interface LeadMaskAccessors<T> {
  /** The lead this row is about, or null when the row has none. */
  lead(row: T): MaskableLead | null | undefined;
  /** Rewrite every phone field the row carries. Mutates in place. */
  hide(row: T, mask: (phone: unknown) => string): void;
}

/** Rows that ARE leads: `phone` / `whatsapp` sit on the row itself. */
export const LEAD_ROW_MASK: LeadMaskAccessors<any> = {
  lead: (row) => row ?? null,
  hide: (row, mask) => {
    if (row.phone) row.phone = mask(row.phone);
    if (row.whatsapp) row.whatsapp = mask(row.whatsapp);
  },
};

/**
 * Rows shaped like a customers-list entry: `order.customerPhone` with the lead
 * nested under `order.lead`. Covers the real commission rows and the synthetic
 * ones built out of a lead, which deliberately share that shape.
 */
export const ORDER_ROW_MASK: LeadMaskAccessors<any> = {
  lead: (row) => row?.order?.lead ?? null,
  hide: (row, mask) => {
    const order = row?.order;
    if (!order) return;
    if (order.customerPhone) order.customerPhone = mask(order.customerPhone);
    // The nested lead carries its own copy whenever the query included it
    // rather than selecting a field list.
    const lead = order.lead;
    if (!lead) return;
    if (lead.phone) lead.phone = mask(lead.phone);
    if (lead.whatsapp) lead.whatsapp = mask(lead.whatsapp);
  },
};

/**
 * Which account's lock state applies to this request, or null when the caller
 * must see real numbers.
 *
 * A VENDOR sub-account arrives here as its parent vendor — `authenticate()`
 * swaps the identity over, role included (see lib/vendorSubAccount.ts) — so
 * this one test covers VENDOR and VENDOR_HELPER both, and lets every other role
 * through untouched.
 */
export function maskingVendorId(req: Request): number | null {
  return req.user?.roleName === 'VENDOR' ? req.user!.id : null;
}

/**
 * Masks the phone on every row whose lead the seller has not paid for, and
 * flags those rows `isLocked` so the client can render a lock instead of
 * guessing from bullet characters.
 *
 * One lock lookup for the whole page, never one per row. For an account that is
 * not gated it costs a single indexed read of the two gate flags and returns
 * the rows untouched; for a caller who is not a seller (`vendorId` null) it
 * costs nothing at all.
 */
export async function maskLockedLeads<T>(
  vendorId: number | null,
  rows: T[],
  accessors: LeadMaskAccessors<T>,
): Promise<T[]> {
  if (!vendorId || !rows?.length) return rows;

  // Paired up in one pass so the accessor is not walked twice per row.
  const pairs: { row: T; lead: MaskableLead }[] = [];
  for (const row of rows) {
    const lead = accessors.lead(row);
    if (!lead || !lead.id || !lead.createdAt) continue;
    if (lead.vendorId !== undefined && lead.vendorId !== vendorId) continue;
    pairs.push({ row, lead });
  }
  if (!pairs.length) return rows;

  const locked = await getLockedLeadIds(vendorId, pairs.map((p) => p.lead));
  if (!locked.size) return rows;

  for (const { row, lead } of pairs) {
    if (!locked.has(lead.id)) continue;
    accessors.hide(row, maskPhone);
    (row as any).isLocked = true;
  }

  return rows;
}

/**
 * The extra predicate a phone search needs so it cannot be used as an oracle.
 *
 * Masking the number in the response is not enough on its own: a list that also
 * filters on `phone contains ...` answers "does this account hold a lead whose
 * number starts with 0612?", and ten queries per digit walk a hidden number out
 * one character at a time. So for a gated seller the phone half of a search is
 * ANDed with this, which admits only the leads they may actually read — paid
 * for, or created before the gate was switched on.
 *
 * Returns null when there is nothing to restrict (not a seller, or not gated),
 * and callers then leave their search exactly as it was.
 */
export async function phoneSearchableLeadFilter(vendorId: number | null): Promise<any | null> {
  if (!vendorId) return null;

  const vendor = await prisma.user.findUnique({ where: { id: vendorId }, select: GATE_SELECT });
  if (!isGateActive(vendor)) return null;

  return {
    OR: [
      { createdAt: { lt: vendor.googleSheetsGateFrom as Date } }, // grandfathered
      { sheetCreditCharge: { isNot: null } }, // a CONSUME row means it was paid for
    ],
  };
}
