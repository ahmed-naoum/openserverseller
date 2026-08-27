/**
 * Monthly Google Sheets packs — the alternative to paying $0.05 a lead.
 *
 * TWO WAYS TO PAY, ONE WAY TO SPEND. An account either holds a cents balance
 * (SheetCreditAccount, charged per row written) or sits on a pack that covers a
 * fixed number of leads a month — or both. Consumption always draws from the PACK
 * FIRST and only falls through to the balance once the month's quota is used up,
 * so a seller who buys a pack never silently burns cents they also hold.
 *
 * WHY QUOTA IS NOT JUST CREDITS. Granting 2 000 leads' worth of cents ($100 at the
 * tariff) for a $30 pack would work for exactly one month and then be wrong:
 * the leftovers would roll into the next month, which is not what a subscription
 * is, and the ledger would claim the platform had sold $100 of credit for $30.
 * A quota with its own counter resets cleanly, prices independently of the tariff,
 * and leaves `totalGranted` / `totalConsumed` meaning what they have always meant.
 *
 * NO PAYMENT GATEWAY. Nothing in this codebase can take $30 from anyone, so a
 * subscription starts life as a PENDING request the seller creates and an admin
 * approves — approval is the receipt. Everything downstream reads `status` and
 * `endsAt`, never how the money actually arrived.
 *
 * THE CLOCK IS THE AUTHORITY, NOT `status`. A subscription whose `endsAt` has
 * passed stops covering leads on the instant, whether or not the expiry cron has
 * run. `status` catching up is bookkeeping, so a cron that is down cannot hand an
 * account a free month.
 */

import { prisma } from '../lib/prisma.js';
import { AppException } from '../middleware/errorHandler.js';
import { createNotification } from '../utils/notification.js';
import { formatMoney } from '../lib/sheetPricing.js';

export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

/** Every status a SheetSubscription can hold. Anything else is a typo in a query. */
export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'PENDING',
  'ACTIVE',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The catalogue the platform launched with. Seeded once, then owned by the admin —
 * `ensureDefaultPlans` only ever CREATES, so an admin who reprices SHEETS_2K to
 * $35 does not find it back at $30 after the next deploy.
 */
export const DEFAULT_PLANS = [
  {
    code: 'SHEETS_2K',
    /**
     * What this pack was called before the quota was corrected from 20 000 to
     * 2 000. Carried so the migration in scripts/reset-sheet-plans.ts can RENAME
     * the existing row instead of creating a second one beside it — the old row
     * is what live subscriptions point at, and orphaning it would leave sellers
     * attached to a pack that no longer appears in the catalogue.
     */
    legacyCode: 'SHEETS_20K',
    name: 'Pack 2K',
    priceCents: 3000,
    leadQuota: 2_000,
    periodDays: 30,
    sortOrder: 10,
    // The quota is deliberately NOT repeated here. `leadQuota` is the only place
    // it is written, and the picker already prints it directly above this line —
    // a description that also spells it out is a second copy that silently goes
    // stale the first time anyone edits the pack, and then the card argues with
    // itself. Same reason the tariff is never hardcoded in the client.
    description: "Vos leads partent vers votre feuille sans être facturés à l'unité.",
  },
  {
    code: 'SHEETS_5K',
    legacyCode: 'SHEETS_50K',
    name: 'Pack 5K',
    priceCents: 5000,
    leadQuota: 5_000,
    periodDays: 30,
    sortOrder: 20,
    description: 'Le tarif au lead le plus bas, pour les gros volumes.',
  },
] as const;

/** A DEFAULT_PLANS entry as the table actually stores it — `legacyCode` is ours, not a column. */
const planColumns = (plan: (typeof DEFAULT_PLANS)[number]) => {
  const { legacyCode: _legacyCode, ...columns } = plan;
  return columns;
};

/** Creates any launch plan that does not exist yet. Idempotent, safe at every boot. */
export async function ensureDefaultPlans(): Promise<void> {
  try {
    for (const plan of DEFAULT_PLANS) {
      // Not upsert: `update: {}` would still be a write the admin's edits have to
      // survive, and a create-if-absent says exactly what is meant.
      const existing = await prisma.sheetPlan.findUnique({ where: { code: plan.code }, select: { id: true } });
      if (existing) continue;

      // A database still on the old code is NOT missing this plan — it is holding
      // it under its previous name, with live subscriptions pointing at it.
      // Creating the new one here would put two near-identical packs in the
      // seller's picker. Renaming is a deliberate act: scripts/reset-sheet-plans.ts.
      const legacy = await prisma.sheetPlan.findUnique({
        where: { code: plan.legacyCode },
        select: { id: true },
      });
      if (legacy) continue;

      await prisma.sheetPlan.create({ data: planColumns(plan) });
    }
  } catch (err) {
    // A missing catalogue degrades to pay-as-you-go, which is the behaviour that
    // existed before packs. It is not worth failing boot over.
    console.error('[SheetPlans] default plan seeding failed:', err);
  }
}

/** What a subscription is worth right now, from the seller's point of view. */
export interface PlanState {
  /** The pack currently covering leads, or null for pay-as-you-go. */
  subscription: {
    id: number;
    status: SubscriptionStatus;
    planId: number;
    planCode: string;
    planName: string;
    /** The admin's "Couleur de la carte" for this pack — a `#rrggbb` hex, or null. */
    planAccentColor: string | null;
    priceCents: number;
    leadQuota: number;
    leadsUsed: number;
    /** leadQuota − leadsUsed, floored at 0. */
    remaining: number;
    startedAt: Date | null;
    endsAt: Date | null;
    /** Whole days left before it stops covering leads. 0 on its last day. */
    daysLeft: number;
  } | null;
  /** Leads the pack can still cover. 0 when there is no pack. */
  remaining: number;
  /** A request waiting for an admin, so the seller is not shown "subscribe" twice. */
  pending: {
    id: number;
    planId: number;
    planCode: string;
    planName: string;
    planAccentColor: string | null;
    priceCents: number;
    leadQuota: number;
    requestedAt: Date;
  } | null;
}

export const EMPTY_PLAN_STATE: PlanState = { subscription: null, remaining: 0, pending: null };

const SUBSCRIPTION_INCLUDE = {
  // accentColor rides along so every surface that shows a pack — the panel, the
  // header chip — paints it in the admin's chosen colour without a second query
  // against the catalogue.
  plan: { select: { id: true, code: true, name: true, accentColor: true } },
} as const;

function daysLeft(endsAt: Date | null): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / DAY_MS));
}

/**
 * The one row that may cover leads for this account, or null.
 *
 * Filters on `endsAt > now` in the query rather than trusting `status`, so a lapsed
 * pack the cron has not stamped yet is already inert here. `orderBy endsAt desc`
 * because approving a renewal early can legitimately leave two ACTIVE rows for a
 * few minutes and the later one is the one that should be spending.
 */
export async function getActiveSubscriptionRow(userId: number) {
  if (!userId) return null;
  return prisma.sheetSubscription.findFirst({
    where: { userId, status: 'ACTIVE', endsAt: { gt: new Date() } },
    orderBy: [{ endsAt: 'desc' }, { id: 'desc' }],
    include: SUBSCRIPTION_INCLUDE,
  });
}

/** The pack, the quota left on it and any pending request — everything a panel shows. */
export async function getPlanState(userId: number): Promise<PlanState> {
  try {
    if (!userId) return EMPTY_PLAN_STATE;
    const [active, pending] = await Promise.all([
      getActiveSubscriptionRow(userId),
      prisma.sheetSubscription.findFirst({
        where: { userId, status: 'PENDING' },
        orderBy: { id: 'desc' },
        include: SUBSCRIPTION_INCLUDE,
      }),
    ]);

    const remaining = active ? Math.max(0, active.leadQuota - active.leadsUsed) : 0;

    return {
      subscription: active
        ? {
            id: active.id,
            status: active.status as SubscriptionStatus,
            planId: active.planId,
            planCode: active.plan.code,
            planName: active.plan.name,
            planAccentColor: active.plan.accentColor ?? null,
            priceCents: active.priceCents,
            leadQuota: active.leadQuota,
            leadsUsed: active.leadsUsed,
            remaining,
            startedAt: active.startedAt,
            endsAt: active.endsAt,
            daysLeft: daysLeft(active.endsAt),
          }
        : null,
      remaining,
      pending: pending
        ? {
            id: pending.id,
            planId: pending.planId,
            planCode: pending.plan.code,
            planName: pending.plan.name,
            planAccentColor: pending.plan.accentColor ?? null,
            priceCents: pending.priceCents,
            leadQuota: pending.leadQuota,
            requestedAt: pending.requestedAt,
          }
        : null,
    };
  } catch (err) {
    // Same contract as getGateStats: a plan lookup must never be the reason a
    // dashboard panel 500s. Falling back to "no pack" only ever charges the
    // seller the per-lead tariff they would have paid before packs existed.
    console.error('[SheetPlans] state lookup failed for user', userId, err);
    return EMPTY_PLAN_STATE;
  }
}

/**
 * Just the number the gate maths needs: leads the pack can still cover.
 *
 * Separate from getPlanState because the gate is on the hot path (every leads page
 * render) and does not need the plan names or the pending request.
 */
export async function getPlanRemaining(userId: number): Promise<number> {
  try {
    if (!userId) return 0;
    const active = await prisma.sheetSubscription.findFirst({
      where: { userId, status: 'ACTIVE', endsAt: { gt: new Date() } },
      orderBy: [{ endsAt: 'desc' }, { id: 'desc' }],
      select: { leadQuota: true, leadsUsed: true },
    });
    if (!active) return 0;
    return Math.max(0, active.leadQuota - active.leadsUsed);
  } catch (err) {
    console.error('[SheetPlans] remaining lookup failed for user', userId, err);
    return 0;
  }
}

/**
 * Books `want` leads against a pack, atomically, and answers how many it got.
 *
 * The guard is in the WHERE clause — `leadsUsed <= leadQuota - want` — so two
 * drains racing for the last hundred leads of a quota cannot both win: the second
 * UPDATE matches zero rows. Never a read-then-write, which is exactly the
 * lost-update shape the cents balance already avoids with an atomic decrement.
 *
 * One retry, because losing the race means the quota moved, not that it is gone:
 * the second pass re-reads what is actually left and claims that instead. Anything
 * it still cannot book falls through to the cents balance, which is the correct
 * outcome rather than an error — the caller has already checked the two together
 * cover the batch.
 *
 * Runs inside the caller's transaction (`tx`) so the claim commits or rolls back
 * with the ledger rows it pays for.
 */
export async function claimPlanQuota(
  tx: { sheetSubscription: any },
  subscriptionId: number,
  want: number
): Promise<number> {
  let target = Math.max(0, Math.trunc(want));
  if (!subscriptionId || target <= 0) return 0;

  for (let attempt = 0; attempt < 2; attempt++) {
    const current = await tx.sheetSubscription.findUnique({
      where: { id: subscriptionId },
      select: { leadQuota: true, leadsUsed: true, status: true, endsAt: true },
    });
    if (!current || current.status !== 'ACTIVE') return 0;
    if (!current.endsAt || new Date(current.endsAt).getTime() <= Date.now()) return 0;

    const available = Math.max(0, current.leadQuota - current.leadsUsed);
    const claim = Math.min(target, available);
    if (claim <= 0) return 0;

    const { count } = await tx.sheetSubscription.updateMany({
      where: {
        id: subscriptionId,
        status: 'ACTIVE',
        // The whole guard: this row still has room for `claim` leads AT THE
        // MOMENT OF THE WRITE, not at the moment we read it.
        leadsUsed: { lte: current.leadQuota - claim },
      },
      data: { leadsUsed: { increment: claim } },
    });
    if (count > 0) return claim;

    // Lost the race. Ask for no more than we know is plausible and try once more.
    target = claim;
  }
  return 0;
}

/**
 * Stamps lapsed subscriptions EXPIRED and tells their sellers.
 *
 * Purely cosmetic for billing — `getActiveSubscriptionRow` already ignores a row
 * whose `endsAt` has passed — so this exists for the notification and for admin
 * screens that group by status.
 */
export async function expireDueSubscriptions(): Promise<number> {
  const due = await prisma.sheetSubscription.findMany({
    where: { status: 'ACTIVE', endsAt: { lte: new Date() } },
    select: { id: true, userId: true, plan: { select: { name: true } } },
    take: 200,
  });
  if (!due.length) return 0;

  const { count } = await prisma.sheetSubscription.updateMany({
    where: { id: { in: due.map((s) => s.id) }, status: 'ACTIVE' },
    data: { status: 'EXPIRED' },
  });

  // createNotification swallows its own failures, so a broken socket cannot undo
  // the expiry that already committed.
  for (const sub of due) {
    await createNotification(
      sub.userId,
      'SHEET_PLAN_EXPIRED',
      'Votre pack Google Sheets a expiré',
      `Le ${sub.plan.name} est arrivé à échéance. Les leads envoyés vers votre feuille repassent au tarif à ` +
        "l'unité jusqu'à ce qu'un nouveau pack soit activé. Vous pouvez le renouveler depuis « Solde Sheets »."
    );
  }
  return count;
}

/**
 * The seller asks to be put on a pack.
 *
 * Refuses a second pending request rather than queueing one, so an admin never has
 * two rows for the same account to reconcile. Requesting while already on a pack is
 * allowed on purpose — that is how a renewal or an upgrade is asked for.
 */
export async function requestSubscription(userId: number, planId: number, requestNote?: string | null) {
  const plan = await prisma.sheetPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.active) {
    throw new AppException(404, 'Pack introuvable ou indisponible');
  }

  const existing = await prisma.sheetSubscription.findFirst({
    where: { userId, status: 'PENDING' },
    select: { id: true },
  });
  if (existing) {
    throw new AppException(409, 'Une demande est déjà en attente de validation');
  }

  const created = await prisma.sheetSubscription.create({
    data: {
      userId,
      planId: plan.id,
      status: 'PENDING',
      // Snapshotted again at approval; kept here so the admin's list shows what
      // the seller was actually looking at when they asked.
      leadQuota: plan.leadQuota,
      priceCents: plan.priceCents,
      requestNote: requestNote?.slice(0, 500) || null,
    },
    include: SUBSCRIPTION_INCLUDE,
  });

  await notifyReviewers(created, plan.leadQuota);

  return created;
}

/**
 * Tells the people who can actually approve that a request is waiting.
 *
 * Without this the queue is a page nobody has a reason to open, and a seller who
 * has already paid out of band waits until an admin happens to look — the one part
 * of this flow where a human is the bottleneck deserves a push, not a poll.
 *
 * Addressed to SUPER_ADMIN and FINANCE_ADMIN and nobody else, because that is
 * exactly the pair `authorize()` lets into /admin/sheet-plans. Notifying anyone
 * else would be telling them about a button they do not have.
 */
export async function notifyReviewers(
  subscription: { id: number; userId: number; priceCents: number; plan: { name: string } },
  leadQuota: number
): Promise<void> {
  try {
    const [seller, reviewers] = await Promise.all([
      // The display name lives on UserProfile, not User — same lookup every other
      // admin screen does, falling back to the e-mail when no profile was filled in.
      prisma.user.findUnique({
        where: { id: subscription.userId },
        select: { email: true, profile: { select: { fullName: true } } },
      }),
      prisma.user.findMany({
        where: { role: { name: { in: ['SUPER_ADMIN', 'FINANCE_ADMIN'] } } },
        select: { id: true },
      }),
    ]);

    const who = seller?.profile?.fullName || seller?.email || `Utilisateur #${subscription.userId}`;
    const title = 'Nouvelle demande de pack Google Sheets';
    const body =
      `${who} demande le ${subscription.plan.name} — ${formatMoney(subscription.priceCents)}/mois pour ` +
      `${leadQuota.toLocaleString('fr-FR')} leads. À valider dans « Envoi des leads » › « Packs & abonnements » ` +
      "APRÈS encaissement : la validation crédite le quota immédiatement.";

    for (const reviewer of reviewers) {
      await createNotification(reviewer.id, 'SHEET_PLAN_REQUESTED', title, body);
    }
  } catch (err) {
    // The request itself is already committed and visible in the admin queue. A
    // failed notification must not turn that into a 500 the seller retries, which
    // would then hit the one-pending-request guard and look like a broken button.
    console.error('[SheetPlans] reviewer notification failed for subscription', subscription.id, err);
  }
}

/**
 * The admin activates a pending request.
 *
 * Ends any pack already running for that account first — an account holds exactly
 * one live subscription, so an upgrade replaces rather than stacks. The old row is
 * kept CANCELLED with its `leadsUsed` intact rather than deleted, because it is the
 * only record of what last month covered.
 *
 * Quota and price are re-snapshotted HERE, from the plan as it stands at approval:
 * a request that sat in the queue across a price change is honoured at the price
 * the admin is looking at, not the one the seller saw a week ago.
 */
export async function approveSubscription(subscriptionId: number, adminId: number, adminNote?: string | null) {
  const sub = await prisma.sheetSubscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });
  if (!sub) throw new AppException(404, 'Demande introuvable');
  if (sub.status !== 'PENDING') {
    throw new AppException(409, 'Cette demande a déjà été traitée');
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + Math.max(1, sub.plan.periodDays) * DAY_MS);

  const activated = await prisma.$transaction(async (tx) => {
    await tx.sheetSubscription.updateMany({
      where: { userId: sub.userId, status: 'ACTIVE', id: { not: sub.id } },
      data: { status: 'CANCELLED', cancelledAt: now, adminNote: 'Remplacé par un nouveau pack' },
    });

    const row = await tx.sheetSubscription.update({
      where: { id: sub.id },
      data: {
        status: 'ACTIVE',
        leadQuota: sub.plan.leadQuota,
        priceCents: sub.plan.priceCents,
        // A renewal starts from zero. Quota does not roll over: that is what makes
        // this a subscription rather than a slow credit grant.
        leadsUsed: 0,
        startedAt: now,
        endsAt,
        reviewedAt: now,
        reviewedBy: adminId,
        adminNote: adminNote?.slice(0, 500) || null,
      },
      include: SUBSCRIPTION_INCLUDE,
    });

    // The quota is capacity, exactly like a top-up: whatever stopped for lack of
    // credit leaves on the next tick instead of waiting for a new lead to nudge it.
    await tx.sheetPushJob.updateMany({
      where: { vendorId: sub.userId, status: 'BLOCKED_NO_CREDITS' },
      data: { status: 'PENDING', nextAttemptAt: now },
    });

    return row;
  });

  await createNotification(
    sub.userId,
    'SHEET_PLAN_ACTIVE',
    'Votre pack Google Sheets est actif',
    `${activated.plan.name} activé : ${activated.leadQuota.toLocaleString('fr-FR')} leads inclus jusqu'au ` +
      `${endsAt.toLocaleDateString('fr-FR')}. Les envois vers votre feuille ne sont plus facturés à l'unité.`
  );

  return activated;
}

/** The admin turns a request down, with a reason the seller will read. */
export async function rejectSubscription(subscriptionId: number, adminId: number, adminNote?: string | null) {
  const sub = await prisma.sheetSubscription.findUnique({
    where: { id: subscriptionId },
    include: SUBSCRIPTION_INCLUDE,
  });
  if (!sub) throw new AppException(404, 'Demande introuvable');
  if (sub.status !== 'PENDING') {
    throw new AppException(409, 'Cette demande a déjà été traitée');
  }

  const updated = await prisma.sheetSubscription.update({
    where: { id: sub.id },
    data: {
      status: 'REJECTED',
      reviewedAt: new Date(),
      reviewedBy: adminId,
      adminNote: adminNote?.slice(0, 500) || null,
    },
    include: SUBSCRIPTION_INCLUDE,
  });

  await createNotification(
    sub.userId,
    'SHEET_PLAN_REJECTED',
    'Demande de pack refusée',
    `Votre demande pour le ${sub.plan.name} (${formatMoney(sub.priceCents)}/mois) n'a pas été validée.` +
      (adminNote ? ` Motif : ${adminNote}` : '')
  );

  return updated;
}

/**
 * Stops a running pack immediately.
 *
 * `leadsUsed` is left as it stands — the row is a record of what was consumed, and
 * zeroing it would make the month unauditable. From the next read the account is
 * back on the per-lead tariff.
 */
export async function cancelSubscription(
  subscriptionId: number,
  adminId: number | null,
  adminNote?: string | null
) {
  const sub = await prisma.sheetSubscription.findUnique({
    where: { id: subscriptionId },
    include: SUBSCRIPTION_INCLUDE,
  });
  if (!sub) throw new AppException(404, 'Abonnement introuvable');
  if (!['ACTIVE', 'PENDING'].includes(sub.status)) {
    throw new AppException(409, "Cet abonnement n'est pas actif");
  }

  return prisma.sheetSubscription.update({
    where: { id: sub.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: adminId,
      adminNote: adminNote?.slice(0, 500) || null,
    },
    include: SUBSCRIPTION_INCLUDE,
  });
}
