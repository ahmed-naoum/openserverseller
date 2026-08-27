/**
 * Admin control plane for Google Sheets packs: the catalogue, and the queue of
 * sellers asking to be put on one.
 *
 * IT OWNS NO BILLING LOGIC. Approving, rejecting and cancelling all go through
 * services/sheetPlans.service.ts — the same functions that snapshot the price,
 * end the previous pack, un-park the blocked push queue and notify the seller. A
 * second copy of that sequence here is how the two would drift.
 *
 * WHY THE CATALOGUE IS EDITABLE. The launch prices ($30 for 2 000 leads, $50 for
 * 5 000) are seeded once at boot and then belong to the admin. A running
 * subscription is unaffected by an edit: it snapshotted its quota and price at
 * approval, so repricing a plan only changes what the NEXT approval costs.
 *
 * FINANCE_ADMIN is included for the same reason as sheets.routes.ts — this is a
 * billing screen — and every route here is either a read or a status change on a
 * subscription. None of them can reach a lead or a customer number.
 */

import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { asyncHandler, AppException } from '../../middleware/errorHandler.js';
import { LEAD_PRICE_CENTS } from '../../lib/sheetPricing.js';
import {
  SUBSCRIPTION_STATUSES,
  approveSubscription,
  cancelSubscription,
  rejectSubscription,
  type SubscriptionStatus,
} from '../../services/sheetPlans.service.js';

const router = Router();

router.use(authenticate, authorize('SUPER_ADMIN', 'FINANCE_ADMIN'));

const pageArgs = (query: any, fallbackLimit = 25) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || fallbackLimit));
  return { page, limit, skip: (page - 1) * limit };
};

/**
 * A `#rrggbb` accent, or null.
 *
 * THE ONLY GATE on a value that ends up inside a `style` attribute on the seller's
 * card. Anything that is not exactly six hex digits is rejected outright rather
 * than sanitised, because there is no legitimate near-miss: a colour is six hex
 * digits or it is somebody trying to close the attribute and open a new one.
 * Three-digit shorthand is expanded rather than refused — it is a normal thing to
 * type, and normalising here means the client only ever sees one shape.
 */
const accentOrNull = (value: unknown): string | null => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  const short = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(raw);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const full = /^#?([0-9a-f]{6})$/.exec(raw);
  return full ? `#${full[1]}` : null;
};

/** A whole number from the body, or null when it is absent / not one. */
const intOrNull = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
};

/* ------------------------------------------------------------------ */
/* catalogue                                                           */
/* ------------------------------------------------------------------ */

/**
 * Every plan, including deactivated ones, with how many accounts are on each.
 *
 * The count is of LIVE subscriptions only — a plan nobody is on can be retired,
 * and that is the number the admin needs to know before they try.
 */
router.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    const plans = await prisma.sheetPlan.findMany({
      orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }],
    });

    const counts = await prisma.sheetSubscription.groupBy({
      by: ['planId'],
      where: { status: 'ACTIVE', endsAt: { gt: new Date() } },
      _count: { _all: true },
    });
    const byPlan = new Map(counts.map((c) => [c.planId, c._count._all]));

    res.json({
      status: 'success',
      data: {
        plans: plans.map((p) => ({
          ...p,
          activeSubscribers: byPlan.get(p.id) ?? 0,
          effectivePricePerLead:
            p.leadQuota > 0 ? Math.round((p.priceCents / p.leadQuota) * 100) / 100 : 0,
        })),
        /** The per-lead tariff a seller pays with no pack — the number packs undercut. */
        priceCents: LEAD_PRICE_CENTS,
      },
    });
  })
);

/**
 * Adds a plan to the catalogue.
 *
 * `code` is immutable once set (there is no PATCH for it) because the seeder and
 * anything that has to name one specific plan match on it.
 */
router.post(
  '/plans',
  asyncHandler(async (req, res) => {
    const code = String(req.body?.code || '').trim().toUpperCase();
    const name = String(req.body?.name || '').trim();
    const priceCents = intOrNull(req.body?.priceCents);
    const leadQuota = intOrNull(req.body?.leadQuota);
    const periodDays = intOrNull(req.body?.periodDays) ?? 30;

    if (!code || !name) throw new AppException(400, 'Code et nom sont obligatoires');
    if (priceCents === null || priceCents < 0) throw new AppException(400, 'Prix invalide');
    if (leadQuota === null || leadQuota <= 0) throw new AppException(400, 'Quota de leads invalide');
    if (periodDays <= 0) throw new AppException(400, 'Durée invalide');

    const existing = await prisma.sheetPlan.findUnique({ where: { code }, select: { id: true } });
    if (existing) throw new AppException(409, 'Un pack porte déjà ce code');

    const plan = await prisma.sheetPlan.create({
      data: {
        code,
        name,
        priceCents,
        leadQuota,
        periodDays,
        sortOrder: intOrNull(req.body?.sortOrder) ?? 0,
        description: String(req.body?.description || '').trim() || null,
        accentColor: accentOrNull(req.body?.accentColor),
        active: req.body?.active !== false,
      },
    });

    res.status(201).json({ status: 'success', data: plan });
  })
);

/**
 * Edits a plan. Only the fields present in the body move.
 *
 * Deliberately does NOT touch live subscriptions: they hold their own snapshot of
 * `leadQuota` and `priceCents`, so a seller mid-month keeps exactly what they were
 * sold. The edit applies from the next approval.
 */
router.patch(
  '/plans/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new AppException(400, 'Pack invalide');

    const plan = await prisma.sheetPlan.findUnique({ where: { id } });
    if (!plan) throw new AppException(404, 'Pack introuvable');

    const data: Record<string, unknown> = {};

    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) throw new AppException(400, 'Nom invalide');
      data.name = name;
    }
    if (req.body?.priceCents !== undefined) {
      const priceCents = intOrNull(req.body.priceCents);
      if (priceCents === null || priceCents < 0) throw new AppException(400, 'Prix invalide');
      data.priceCents = priceCents;
    }
    if (req.body?.leadQuota !== undefined) {
      const leadQuota = intOrNull(req.body.leadQuota);
      if (leadQuota === null || leadQuota <= 0) throw new AppException(400, 'Quota de leads invalide');
      data.leadQuota = leadQuota;
    }
    if (req.body?.periodDays !== undefined) {
      const periodDays = intOrNull(req.body.periodDays);
      if (periodDays === null || periodDays <= 0) throw new AppException(400, 'Durée invalide');
      data.periodDays = periodDays;
    }
    if (req.body?.sortOrder !== undefined) data.sortOrder = intOrNull(req.body.sortOrder) ?? plan.sortOrder;
    if (req.body?.description !== undefined) {
      data.description = String(req.body.description || '').trim() || null;
    }
    if (req.body?.accentColor !== undefined) {
      const accent = accentOrNull(req.body.accentColor);
      // An empty string is how the form says "back to the default", which is a
      // legitimate edit; a malformed colour is not, and must not silently become one.
      if (accent === null && String(req.body.accentColor ?? '').trim()) {
        throw new AppException(400, 'Couleur invalide (format attendu : #RRGGBB)');
      }
      data.accentColor = accent;
    }
    if (req.body?.active !== undefined) data.active = !!req.body.active;

    if (!Object.keys(data).length) throw new AppException(400, 'Aucune modification');

    const updated = await prisma.sheetPlan.update({ where: { id }, data });
    res.json({ status: 'success', data: updated });
  })
);

/* ------------------------------------------------------------------ */
/* subscriptions                                                       */
/* ------------------------------------------------------------------ */

/** Shape every subscription list and mutation answers with. */
const SUBSCRIPTION_SELECT = {
  id: true,
  status: true,
  leadQuota: true,
  leadsUsed: true,
  priceCents: true,
  requestedAt: true,
  startedAt: true,
  endsAt: true,
  reviewedAt: true,
  reviewedBy: true,
  cancelledAt: true,
  adminNote: true,
  requestNote: true,
  plan: { select: { id: true, code: true, name: true, periodDays: true } },
  // A seller's display name lives on UserProfile; `User` has no name column at all.
  // Flattened to `user.name` before it leaves this router (see the mapping below),
  // so the client never has to know that or repeat the fallback.
  user: {
    select: {
      id: true,
      email: true,
      googleSheetsOutboundEnabled: true,
      profile: { select: { fullName: true } },
    },
  },
} as const;

/**
 * The queue and the register in one endpoint.
 *
 * Ordering puts PENDING first regardless of the filter — this page exists to get
 * requests approved, and burying today's three under a year of expired rows is how
 * a seller waits a week for a pack they already paid for.
 */
router.get(
  '/subscriptions',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = pageArgs(req.query);

    const status = String(req.query.status || '').toUpperCase();
    const userId = Number(req.query.userId);
    const search = String(req.query.search || '').trim();

    const where: any = {};
    if (SUBSCRIPTION_STATUSES.includes(status as SubscriptionStatus)) where.status = status;
    if (Number.isInteger(userId) && userId > 0) where.userId = userId;
    if (search) {
      // Same two columns the accounts tab searches: the profile's full name, and
      // the e-mail that stands in for it when no profile was ever filled in.
      where.user = {
        is: {
          OR: [
            { profile: { is: { fullName: { contains: search, mode: 'insensitive' } } } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
      };
    }

    const [rows, total, pendingCount] = await Promise.all([
      prisma.sheetSubscription.findMany({
        where,
        skip,
        take: limit,
        // PENDING first, then newest. `id` is the tie-break for the same reason the
        // credit ledger has one: two requests can land in the same millisecond.
        orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }, { id: 'desc' }],
        select: SUBSCRIPTION_SELECT,
      }),
      prisma.sheetSubscription.count({ where }),
      prisma.sheetSubscription.count({ where: { status: 'PENDING' } }),
    ]);

    res.json({
      status: 'success',
      data: {
        subscriptions: rows.map((row) => ({
          ...row,
          user: {
            id: row.user.id,
            // One flat name, resolved here rather than in three places on screen.
            name: row.user.profile?.fullName || row.user.email || `#${row.user.id}`,
            email: row.user.email,
            googleSheetsOutboundEnabled: row.user.googleSheetsOutboundEnabled,
          },
          remaining: Math.max(0, row.leadQuota - row.leadsUsed),
        })),
        /** Drives the badge on the tab, independent of the current filter. */
        pendingCount,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  })
);

/** Activates a pending request: the seller is on the pack from this instant. */
router.post(
  '/subscriptions/:id/approve',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new AppException(400, 'Demande invalide');

    const subscription = await approveSubscription(id, req.user!.id, req.body?.note);
    res.json({ status: 'success', message: 'Pack activé', data: subscription });
  })
);

/** Turns a pending request down, with a reason the seller is notified with. */
router.post(
  '/subscriptions/:id/reject',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new AppException(400, 'Demande invalide');

    const subscription = await rejectSubscription(id, req.user!.id, req.body?.note);
    res.json({ status: 'success', message: 'Demande refusée', data: subscription });
  })
);

/**
 * Stops a live pack now. The account falls back to the per-lead tariff on the next
 * read; `leadsUsed` is left intact so the month stays auditable.
 */
router.post(
  '/subscriptions/:id/cancel',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new AppException(400, 'Abonnement invalide');

    const subscription = await cancelSubscription(id, req.user!.id, req.body?.note);
    res.json({ status: 'success', message: 'Abonnement annulé', data: subscription });
  })
);

export default router;
