import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { parseDateRange } from '../lib/dateRange.js';
import { phoneQuality } from '../lib/phoneCompleteness.js';
import { enqueueSheetPush, pushLeadsNow, getCreditBalance } from '../services/sheetPush.service.js';
import {
  CART_PRICE_AUTO_CENTS,
  CART_PRICE_MANUAL_CENTS,
  CURRENCY_SYMBOL,
  formatMoney,
} from '../lib/sheetPricing.js';

/**
 * A seller's own abandoned checkouts.
 *
 * Distinct from the call-centre queue at `/leads/abandoned-carts`, which is
 * scoped to an AGENT's assigned sellers and exists so an agent can phone a
 * stranger's cart. This one is scoped to the carts left on the seller's OWN
 * pages and is about what the seller can do with them: push to their sheet,
 * hand to the call centre, or throw away.
 *
 * Mounted on its own path rather than under `/leads` deliberately. The helper
 * access table (lib/vendorSubAccount.ts) carries a broad `/leads(...)` rule
 * whose negative lookahead only excludes `/leads/abandoned-carts`; hanging
 * these off `/leads` would quietly inherit `subCanViewLeads` and hand every
 * lead-reading helper a page of customer phone numbers nobody granted them.
 *
 * EVERY handler here is scoped by `vendorCodes()`. A CheckoutAttempt has no
 * vendor column — it is written by an anonymous visitor before any ownership
 * exists — so ownership is derived each time: referralCode -> ReferralLink ->
 * Product.ownerId. There is no path in this file that reads a cart without
 * going through it.
 */
const router = Router();

/** Only carts holding a phone are ever shown: without one there is nothing to recover. */
const HAS_PHONE = { phone: { not: null } } as const;

/**
 * The referral codes whose product belongs to this vendor.
 *
 * Returned as a plain array because it feeds a `referralCode: { in: [...] }`.
 * A seller with no links at all returns an empty array, and every caller
 * short-circuits on that rather than issuing a query that would match the whole
 * table — an empty `in` is a footgun worth handling once, here.
 */
async function vendorCodes(vendorId: number): Promise<string[]> {
  const links = await prisma.referralLink.findMany({
    where: { product: { ownerId: vendorId } },
    select: { code: true },
  });
  return links.map((l) => l.code);
}

/** The vendor's sheet configuration, as far as cart pricing and pushing care. */
async function cartPushConfig(vendorId: number) {
  const user = await prisma.user.findUnique({
    where: { id: vendorId },
    select: {
      googleSheetsOutboundEnabled: true,
      googleSheetOutActive: true,
      googleSheetOutId: true,
      googleSheetOutCartsAuto: true,
    },
  });
  return {
    connected: !!user?.googleSheetOutId && !!user?.googleSheetOutActive,
    enabled: !!user?.googleSheetsOutboundEnabled,
    autoCarts: !!user?.googleSheetOutCartsAuto,
  };
}

/**
 * What one cart costs this seller to send right now, in cents.
 *
 * Mirrors `priceCentsFor` rather than calling it: this is the quote shown in the
 * UI before anything is spent, and it answers for the seller's CURRENT auto
 * setting, whereas the charge itself is priced from the job's recorded origin.
 * They agree by construction — a seller with auto on pushes AUTO jobs — and the
 * quote is advisory, so the two cannot drift into a billing error.
 */
function quotedCents(autoCarts: boolean): number {
  return autoCarts ? CART_PRICE_AUTO_CENTS : CART_PRICE_MANUAL_CENTS;
}

/** Loads carts by id, refusing any that are not this vendor's. */
async function ownedCarts(vendorId: number, ids: string[]) {
  const codes = await vendorCodes(vendorId);
  if (!codes.length) return [];
  return prisma.checkoutAttempt.findMany({
    where: { id: { in: ids }, referralCode: { in: codes }, ...HAS_PHONE },
  });
}

/** `0612345678` -> `+212612345678`, matching the agent conversion path exactly. */
function normalizePhone(raw: string): string {
  const bare = raw.replace(/\s+|-/g, '');
  return bare.startsWith('0') ? '+212' + bare.slice(1) : bare;
}

/**
 * Turns a cart into a real Lead, once.
 *
 * `convertedLeadId` is the idempotency key: a cart already converted returns its
 * existing lead rather than creating a second one, so a double-clicked button or
 * a cart sent to the sheet and then to the call centre cannot mint duplicates —
 * which would each reserve a sheet credit and each be phoned by an agent.
 */
async function convertCart(
  attempt: { id: string; referralCode: string | null; phone: string | null; fullName: string | null; city: string | null; address: string | null; convertedLeadId: number | null },
  vendorId: number,
): Promise<{ leadId: number; created: boolean }> {
  if (attempt.convertedLeadId) return { leadId: attempt.convertedLeadId, created: false };

  const link = await prisma.referralLink.findUnique({
    where: { code: attempt.referralCode || '' },
    select: { id: true, productId: true },
  });
  if (!link) throw new AppException(404, 'Le lien de ce panier est introuvable.');

  const incomplete = phoneQuality(attempt.phone) === 'incomplete';

  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        vendorId,
        referralLinkId: link.id,
        fullName: attempt.fullName || 'Client X',
        phone: normalizePhone(attempt.phone!),
        whatsapp: normalizePhone(attempt.phone!),
        city: attempt.city,
        address: attempt.address,
        // NEW, not ASSIGNED: the seller is not an agent, so the lead joins the
        // pool for the call centre to pick up rather than going to a named
        // person. The agent-side convert (lead.routes.ts) assigns because an
        // agent is claiming it for themselves; a seller is handing it over.
        status: 'NEW',
        source: 'ABANDONED_CART',
        sourceMode: 'AFFILIATE',
        notes: incomplete
          ? `Panier abandonné récupéré par le vendeur. ⚠️ NUMÉRO INCOMPLET tel que saisi par le client ("${attempt.phone}") — à compléter avant toute expédition.`
          : 'Panier abandonné récupéré par le vendeur.',
      },
    });

    await tx.leadStatusHistory.create({
      data: { leadId: lead.id, oldStatus: 'ABANDONED_CART', newStatus: 'NEW', changedBy: vendorId },
    });

    await tx.checkoutAttempt.update({
      where: { id: attempt.id },
      data: { convertedLeadId: lead.id, convertedAt: new Date() },
    });

    return { leadId: lead.id, created: true };
  });
}

// ─────────────────────────────────────────────────────────────── list ─────

router.get(
  '/',
  authenticate,
  authorize('VENDOR', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const vendorId = req.user!.id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const search = (req.query.search as string)?.trim();

    const codes = await vendorCodes(vendorId);
    const config = await cartPushConfig(vendorId);
    const empty = {
      attempts: [], total: 0, page, totalPages: 0,
      counts: { all: 0, complete: 0, incomplete: 0, sent: 0, pending: 0 },
    };
    if (!codes.length) {
      return res.json({ status: 'success', data: { ...empty, ...(await meta(vendorId, config)) } });
    }

    const and: any[] = [{ referralCode: { in: codes } }, HAS_PHONE];

    // A cart the customer went on to order from is not abandoned. Excluded by
    // default rather than filtered in the UI, because a seller paying per row
    // must never be shown an order they already have as something to recover.
    if (req.query.includeCompleted !== '1') and.push({ completed: false });

    const status = req.query.status as string;
    if (status === 'sent') and.push({ convertedLeadId: { not: null } });
    else if (status === 'pending') and.push({ convertedLeadId: null });

    const range = parseDateRange(req.query.dateFrom, req.query.dateTo);
    if (range) and.push({ [(req.query.dateField as string) === 'updatedAt' ? 'updatedAt' : 'createdAt']: range });

    if (search) {
      and.push({
        OR: [
          { phone: { contains: search, mode: 'insensitive' } },
          { fullName: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } },
          { productName: { contains: search, mode: 'insensitive' } },
          { referralCode: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where = { AND: and };

    // Phone quality cannot be expressed in SQL — it is a Moroccan-number shape
    // test in TypeScript — so it is applied after the fetch. The page is fetched
    // whole for that reason and then sliced here; at the volumes one seller's
    // carts reach this is one query, not a scan.
    const all = await prisma.checkoutAttempt.findMany({ where, orderBy: { updatedAt: 'desc' } });
    const withQuality = all.map((a) => ({ ...a, phoneComplete: phoneQuality(a.phone) === 'complete' }));

    const quality = req.query.phoneQuality as string;
    const filtered =
      quality === 'complete' ? withQuality.filter((a) => a.phoneComplete)
      : quality === 'incomplete' ? withQuality.filter((a) => !a.phoneComplete)
      : withQuality;

    const total = filtered.length;
    const slice = filtered.slice((page - 1) * limit, page * limit);

    res.json({
      status: 'success',
      data: {
        attempts: slice.map((a) => ({
          id: a.id,
          referralCode: a.referralCode,
          productName: a.productName,
          fullName: a.fullName,
          phone: a.phone,
          city: a.city,
          address: a.address,
          fieldsFilled: a.fieldsFilled,
          phoneComplete: a.phoneComplete,
          sentLeadId: a.convertedLeadId,
          sentAt: a.convertedAt,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
        counts: {
          all: withQuality.length,
          complete: withQuality.filter((a) => a.phoneComplete).length,
          incomplete: withQuality.filter((a) => !a.phoneComplete).length,
          sent: withQuality.filter((a) => a.convertedLeadId !== null).length,
          pending: withQuality.filter((a) => a.convertedLeadId === null).length,
        },
        ...(await meta(vendorId, config)),
      },
    });
  }),
);

/** Balance, tariff and sheet state — everything the page needs to price a button. */
async function meta(vendorId: number, config: { connected: boolean; enabled: boolean; autoCarts: boolean }) {
  const balanceCents = await getCreditBalance(vendorId);
  const unit = quotedCents(config.autoCarts);
  return {
    sheet: {
      connected: config.connected,
      enabled: config.enabled,
      autoCarts: config.autoCarts,
    },
    pricing: {
      currency: CURRENCY_SYMBOL,
      autoCents: CART_PRICE_AUTO_CENTS,
      manualCents: CART_PRICE_MANUAL_CENTS,
      unitCents: unit,
      unitLabel: formatMoney(unit),
      balanceCents,
      balanceLabel: formatMoney(balanceCents),
      // What the seller can still afford at today's rate. A pack covers rows
      // before the balance is touched, so this is a floor, never a ceiling.
      affordable: unit > 0 ? Math.floor(balanceCents / unit) : 0,
    },
  };
}

// ───────────────────────────────────────────────────────────── settings ────

router.patch(
  '/settings',
  authenticate,
  authorize('VENDOR', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const autoCarts = req.body?.autoCarts;
    if (typeof autoCarts !== 'boolean') throw new AppException(400, 'autoCarts doit être un booléen.');

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { googleSheetOutCartsAuto: autoCarts },
    });

    const config = await cartPushConfig(req.user!.id);
    res.json({ status: 'success', data: await meta(req.user!.id, config) });
  }),
);

// ─────────────────────────────────────────────────────────────── delete ────

router.delete(
  '/:id',
  authenticate,
  authorize('VENDOR', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const owned = await ownedCarts(req.user!.id, [String(req.params.id)]);
    if (!owned.length) throw new AppException(404, 'Panier introuvable.');

    await prisma.checkoutAttempt.delete({ where: { id: owned[0].id } });
    res.json({ status: 'success', message: 'Panier supprimé.' });
  }),
);

router.post(
  '/bulk-delete',
  authenticate,
  authorize('VENDOR', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    if (!ids.length) throw new AppException(400, 'Aucun panier sélectionné.');

    const owned = await ownedCarts(req.user!.id, ids);
    // deleteMany on the OWNED ids only — never on what the client sent, so a
    // forged id in the list cannot delete another seller's cart.
    const result = await prisma.checkoutAttempt.deleteMany({
      where: { id: { in: owned.map((o) => o.id) } },
    });
    res.json({ status: 'success', data: { deleted: result.count, skipped: ids.length - result.count } });
  }),
);

// ──────────────────────────────────────────────────────── send to sheet ────

/**
 * Converts the carts, then pushes them and charges for them.
 *
 * The push is deliberately the SAME path a normal lead takes — enqueue, drain,
 * charge — so a cart row lands in the same sheet, in the same columns, with the
 * same idempotency. All that differs is the tariff, and that is decided inside
 * `chargeCredits` from the lead's source and the job's origin, not here.
 */
async function sendToSheet(vendorId: number, ids: string[]) {
  const config = await cartPushConfig(vendorId);
  if (!config.enabled) throw new AppException(403, "L'envoi vers Google Sheets n'est pas activé sur votre compte.");
  if (!config.connected) throw new AppException(400, "Aucune feuille Google connectée. Connectez-en une dans Intégrations.");

  const owned = await ownedCarts(vendorId, ids);
  if (!owned.length) throw new AppException(404, 'Aucun panier valide sélectionné.');

  const leadIds: number[] = [];
  const failures: Array<{ id: string; reason: string }> = [];
  for (const cart of owned) {
    try {
      const { leadId } = await convertCart(cart, vendorId);
      leadIds.push(leadId);
    } catch (err: any) {
      failures.push({ id: cart.id, reason: err?.message || 'Conversion impossible' });
    }
  }
  if (!leadIds.length) throw new AppException(400, failures[0]?.reason || 'Aucun panier convertible.');

  const stats = await pushLeadsNow(vendorId, leadIds);
  return { ...stats, converted: leadIds.length, failures };
}

router.post(
  '/:id/send-to-sheet',
  authenticate,
  authorize('VENDOR', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await sendToSheet(req.user!.id, [String(req.params.id)]);
    res.json({ status: 'success', message: 'Panier envoyé vers Google Sheets.', data: result });
  }),
);

router.post(
  '/bulk-send-to-sheet',
  authenticate,
  authorize('VENDOR', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    if (!ids.length) throw new AppException(400, 'Aucun panier sélectionné.');
    const result = await sendToSheet(req.user!.id, ids);
    res.json({ status: 'success', data: result });
  }),
);

// ─────────────────────────────────────────────────── send to call centre ───

/**
 * Hands carts to the call centre as ordinary leads.
 *
 * No sheet credit is charged here: nothing is written to a sheet. If the seller
 * also runs auto-push, the lead reaches the queue through `enqueueSheetPush`
 * exactly as a form-submitted lead does and is charged then — at the AUTO cart
 * tariff, because that is the origin the job is stamped with.
 */
async function sendToCallCenter(vendorId: number, ids: string[]) {
  const owned = await ownedCarts(vendorId, ids);
  if (!owned.length) throw new AppException(404, 'Aucun panier valide sélectionné.');

  const created: number[] = [];
  const skipped: string[] = [];
  for (const cart of owned) {
    const { leadId, created: isNew } = await convertCart(cart, vendorId);
    if (isNew) created.push(leadId);
    else skipped.push(cart.id);

    // Best-effort, exactly like the public lead path: a sheet-queue failure must
    // never cost the seller the recovery they just asked for.
    try {
      await enqueueSheetPush(leadId, vendorId, 'ABANDONED_CART');
    } catch (err) {
      console.error('[VendorCarts] sheet enqueue failed for lead', leadId, err);
    }
  }
  return { sent: created.length, alreadySent: skipped.length, leadIds: created };
}

router.post(
  '/:id/send-to-call-center',
  authenticate,
  authorize('VENDOR', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await sendToCallCenter(req.user!.id, [String(req.params.id)]);
    res.json({ status: 'success', message: 'Panier envoyé au call center.', data: result });
  }),
);

router.post(
  '/bulk-send-to-call-center',
  authenticate,
  authorize('VENDOR', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    if (!ids.length) throw new AppException(400, 'Aucun panier sélectionné.');
    const result = await sendToCallCenter(req.user!.id, ids);
    res.json({ status: 'success', data: result });
  }),
);

export default router;
