/**
 * The seller's side of Google Sheets packs: what is on offer, what they are on,
 * and the one action they can take — asking to be put on a pack.
 *
 * NOTHING HERE ACTIVATES ANYTHING. There is no payment gateway in this codebase,
 * so POST /subscribe only ever writes a PENDING row; an admin turns it into a live
 * subscription from /admin/sheet-plans. A seller who could activate their own pack
 * would be handing themselves a month of free leads.
 *
 * GET / holds the same contract as /sheet-credits/me and /whatsapp-agent/status: it
 * answers 200 `{ enabled: false }` for an account without the entitlement rather
 * than 403, because the dashboard calls it to decide whether to render the packs
 * section at all and a 403 would be an error toast on every page load.
 */

import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { LEAD_PRICE_CENTS } from '../lib/sheetPricing.js';
import { getPlanState, requestSubscription } from '../services/sheetPlans.service.js';

const router = Router();

/**
 * Who may hold a pack. A VENDOR_HELPER is deliberately absent: the sub-account
 * spends the vendor's quota but does not get to commit them to $50 a month.
 */
const PLAN_ROLES = ['VENDOR'];

/** The catalogue as the seller sees it — active plans only, cheapest first. */
async function listPlans() {
  const plans = await prisma.sheetPlan.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }],
    select: {
      id: true,
      code: true,
      name: true,
      priceCents: true,
      leadQuota: true,
      periodDays: true,
      description: true,
      accentColor: true,
    },
  });

  return plans.map((plan) => ({
    ...plan,
    // What one lead works out at on this pack, in cents, so the picker can show
    // the saving against the tariff without the client knowing the arithmetic.
    // Rounded to a hundredth of a cent, because a pack can price a lead below one:
    // $100 / 30 000 is a third of a cent, and an integer would print it as free.
    effectivePricePerLead:
      plan.leadQuota > 0 ? Math.round((plan.priceCents / plan.leadQuota) * 100) / 100 : 0,
  }));
}

/**
 * Everything the packs panel renders in one call: the catalogue, the pack the
 * seller is on, any request waiting on an admin, and the fallback tariff.
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { googleSheetsOutboundEnabled: true, role: { select: { name: true } } },
    });

    const entitled = !!user?.googleSheetsOutboundEnabled && PLAN_ROLES.includes(user?.role?.name || '');

    // Same reason as /sheet-credits/me: not being entitled is not an error, and
    // the catalogue is still worth sending so the panel can explain what exists.
    if (!entitled) {
      return res.json({
        status: 'success',
        data: { enabled: false, plans: [], state: { subscription: null, remaining: 0, pending: null }, priceCents: LEAD_PRICE_CENTS },
      });
    }

    const [plans, state] = await Promise.all([listPlans(), getPlanState(req.user!.id)]);

    res.json({
      status: 'success',
      data: {
        enabled: true,
        plans,
        state,
        /** The per-lead tariff that applies whenever no pack is covering a lead. */
        priceCents: LEAD_PRICE_CENTS,
      },
    });
  })
);

/**
 * "Put me on this pack." Creates a PENDING request for an admin to approve.
 *
 * Refuses for an account without the entitlement even though the admin would catch
 * it at approval: a request that can never be granted is noise in their queue.
 */
router.post(
  '/subscribe',
  authenticate,
  asyncHandler(async (req, res) => {
    const planId = Number(req.body?.planId);
    if (!Number.isInteger(planId) || planId <= 0) {
      throw new AppException(400, 'Pack invalide');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { googleSheetsOutboundEnabled: true, role: { select: { name: true } } },
    });
    if (!user?.googleSheetsOutboundEnabled || !PLAN_ROLES.includes(user?.role?.name || '')) {
      throw new AppException(403, "La fonctionnalité Google Sheets n'est pas activée sur ce compte");
    }

    const subscription = await requestSubscription(req.user!.id, planId, req.body?.note);

    res.status(201).json({
      status: 'success',
      message: 'Votre demande a été envoyée. Un administrateur va la valider.',
      data: {
        id: subscription.id,
        planId: subscription.planId,
        planName: subscription.plan.name,
        priceCents: subscription.priceCents,
        leadQuota: subscription.leadQuota,
        status: subscription.status,
        requestedAt: subscription.requestedAt,
      },
    });
  })
);

/**
 * The seller withdraws a request an admin has not looked at yet.
 *
 * Scoped by `userId` in the WHERE clause rather than by reading the row and
 * comparing — there is no id in the body at all, so no one can cancel someone
 * else's request. Only PENDING rows match, so this can never touch a live pack.
 */
router.post(
  '/cancel-request',
  authenticate,
  asyncHandler(async (req, res) => {
    const { count } = await prisma.sheetSubscription.updateMany({
      where: { userId: req.user!.id, status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: new Date(), adminNote: 'Annulée par le vendeur' },
    });

    if (!count) throw new AppException(404, 'Aucune demande en attente');

    res.json({ status: 'success', message: 'Demande annulée' });
  })
);

export default router;
