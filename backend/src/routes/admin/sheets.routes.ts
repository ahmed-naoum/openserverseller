/**
 * Admin control plane for « Envoi des leads » — the outbound Google Sheets pipeline.
 *
 * The seller sees their own queue in GoogleSheetOutboundPanel; nobody could see
 * the pipeline as a whole. This router is that view: every push ever attempted,
 * who paid for it, whose queue is parked for lack of credits, and the two
 * levers that unpark it (sell credits, re-run the drain).
 *
 * IT OWNS NO PIPELINE LOGIC. Retrying goes through pushLeadsNow and draining
 * through drainVendor — the same functions the seller's own buttons call — so
 * the ownership check, the locked-lead gate, the claim token and the
 * charge-after-append ordering all still apply when an admin pushes the button.
 * Re-implementing any of that here would be a second pipeline to keep correct.
 *
 * Selling credits is deliberately NOT here either: POST /admin/sheet-credits/adjust
 * already holds the ledger transaction, the backlog un-parking and the seller
 * notification, and this page calls it.
 *
 * FINANCE_ADMIN is included because this is a billing screen. Every route is a
 * read except the three at the bottom, and none of them can reach a lead's
 * masked number: masking answers only to the owning vendor.
 */

import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { asyncHandler, AppException } from '../../middleware/errorHandler.js';
import { LEAD_PRICE_CENTS, centsToLeads } from '../../lib/sheetPricing.js';
import { drainVendor, pushLeadsNow, reconcileVendorSheet } from '../../services/sheetPush.service.js';
import { getGateStats } from '../../services/leadCredits.service.js';

const router = Router();

router.use(authenticate, authorize('SUPER_ADMIN', 'FINANCE_ADMIN'));

/** Every status SheetPushJob can hold. Anything else is a typo in a query string. */
const JOB_STATUSES = [
  'PENDING',
  'SENDING',
  'SENT',
  'BLOCKED_NO_CREDITS',
  'FAILED',
  'SKIPPED',
  'REMOVED',
] as const;

const TX_TYPES = ['GRANT', 'CONSUME', 'ADMIN_DEBIT', 'REFUND'] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

const pageArgs = (query: any, fallbackLimit = 25) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || fallbackLimit));
  return { page, limit, skip: (page - 1) * limit };
};

const like = (value: string) => ({ contains: value, mode: 'insensitive' as const });

/** Turns a groupBy result into `{ SENT: 12, FAILED: 1, ... }` with every status present. */
function statusMap(rows: { status: string; _count: { _all: number } }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of JOB_STATUSES) out[s] = 0;
  for (const row of rows) out[row.status] = row._count._all;
  return out;
}

/* ------------------------------------------------------------------ */
/* overview                                                            */
/* ------------------------------------------------------------------ */

router.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const now = Date.now();
    const since24h = new Date(now - DAY_MS);
    const since30d = new Date(now - 30 * DAY_MS);

    const [
      byStatus,
      sent24h,
      sent30d,
      entitled,
      connected,
      autoOn,
      credits,
      consumed30d,
      granted30d,
      oldestPending,
    ] = await Promise.all([
      prisma.sheetPushJob.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.sheetPushJob.count({ where: { status: 'SENT', sentAt: { gte: since24h } } }),
      prisma.sheetPushJob.count({ where: { status: 'SENT', sentAt: { gte: since30d } } }),
      prisma.user.count({ where: { googleSheetsOutboundEnabled: true, deletedAt: null } }),
      prisma.user.count({
        where: {
          googleSheetsOutboundEnabled: true,
          deletedAt: null,
          googleSheetOutId: { not: null },
          googleSheetOutActive: true,
        },
      }),
      prisma.user.count({
        where: { googleSheetsOutboundEnabled: true, deletedAt: null, googleSheetOutAuto: true },
      }),
      prisma.sheetCreditAccount.aggregate({
        _sum: { balance: true, totalGranted: true, totalConsumed: true },
      }),
      // CONSUME rows are negative, so the sum is negated on the way out: what the
      // platform BILLED over the window, in cents.
      prisma.sheetCreditTransaction.aggregate({
        _sum: { amount: true },
        where: { type: 'CONSUME', createdAt: { gte: since30d } },
      }),
      prisma.sheetCreditTransaction.aggregate({
        _sum: { amount: true },
        where: { type: 'GRANT', createdAt: { gte: since30d } },
      }),
      // How far behind the queue is. A PENDING row older than a few minutes means
      // the cron is not draining, not that the seller is out of credits — that
      // backlog sits in BLOCKED_NO_CREDITS instead.
      prisma.sheetPushJob.findFirst({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    res.json({
      status: 'success',
      data: {
        jobs: statusMap(byStatus),
        sent24h,
        sent30d,
        accounts: { entitled, connected, autoOn },
        credits: {
          outstanding: credits._sum.balance ?? 0,
          totalGranted: credits._sum.totalGranted ?? 0,
          totalConsumed: credits._sum.totalConsumed ?? 0,
          billed30d: Math.abs(consumed30d._sum.amount ?? 0),
          granted30d: granted30d._sum.amount ?? 0,
        },
        oldestPendingAt: oldestPending?.createdAt ?? null,
        priceCents: LEAD_PRICE_CENTS,
      },
    });
  })
);

/* ------------------------------------------------------------------ */
/* push history                                                        */
/* ------------------------------------------------------------------ */

/**
 * Every push, newest first, with what it cost.
 *
 * The charge is joined in a second query rather than through the relation: a
 * CONSUME row is unique per lead (SheetCreditTransaction.leadId), so one IN
 * lookup over the page's leads is enough, and it answers the question the
 * status alone cannot — SENT says the row reached the sheet, the charge says
 * the account actually paid for it (a re-sent REMOVED lead is free).
 */
router.get(
  '/jobs',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = pageArgs(req.query);
    const status = String(req.query.status || '').trim().toUpperCase();
    const search = String(req.query.search || '').trim();
    const userId = Number(req.query.userId) || 0;
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    if (status && !JOB_STATUSES.includes(status as any)) {
      throw new AppException(400, 'Statut inconnu.');
    }

    const where: any = {
      ...(status ? { status } : {}),
      ...(userId ? { vendorId: userId } : {}),
    };

    if (from && !Number.isNaN(from.getTime())) where.createdAt = { gte: from };
    if (to && !Number.isNaN(to.getTime())) {
      // `to` arrives as a plain day (YYYY-MM-DD) and would otherwise mean
      // midnight, excluding everything sent during the day the admin picked.
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { ...(where.createdAt || {}), lte: end };
    }

    if (search) {
      where.OR = [
        { lead: { is: { fullName: like(search) } } },
        { lead: { is: { phone: like(search) } } },
        { vendor: { is: { email: like(search) } } },
        { vendor: { is: { profile: { is: { fullName: like(search) } } } } },
      ];
      const asId = Number(search);
      if (Number.isInteger(asId) && asId > 0) where.OR.push({ leadId: asId });
    }

    const [jobs, total] = await Promise.all([
      prisma.sheetPushJob.findMany({
        where,
        // `id` breaks ties: a batch shares createdAt to the millisecond, and
        // without a total order rows swap between pages.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          origin: true,
          attempts: true,
          lastError: true,
          sentAt: true,
          rowRange: true,
          sheetId: true,
          createdAt: true,
          updatedAt: true,
          leadId: true,
          lead: { select: { id: true, fullName: true, phone: true, source: true, createdAt: true } },
          vendor: {
            select: { id: true, uuid: true, email: true, profile: { select: { fullName: true } } },
          },
        },
      }),
      prisma.sheetPushJob.count({ where }),
    ]);

    const charges = jobs.length
      ? await prisma.sheetCreditTransaction.findMany({
          where: { leadId: { in: jobs.map((j) => j.leadId) }, type: 'CONSUME' },
          select: { leadId: true, amount: true, createdAt: true },
        })
      : [];
    const chargeBy = new Map(charges.map((c) => [c.leadId as number, c]));

    res.json({
      status: 'success',
      data: {
        jobs: jobs.map((j) => ({
          id: j.id,
          status: j.status,
          origin: j.origin,
          attempts: j.attempts,
          lastError: j.lastError,
          sentAt: j.sentAt,
          rowRange: j.rowRange,
          sheetId: j.sheetId,
          createdAt: j.createdAt,
          updatedAt: j.updatedAt,
          lead: j.lead,
          vendor: {
            id: j.vendor.id,
            uuid: j.vendor.uuid,
            email: j.vendor.email,
            name: j.vendor.profile?.fullName || j.vendor.email,
          },
          // Cents, positive. Null when nothing was ever charged for this lead.
          chargedCents: chargeBy.has(j.leadId) ? Math.abs(chargeBy.get(j.leadId)!.amount) : null,
          chargedAt: chargeBy.get(j.leadId)?.createdAt ?? null,
        })),
        priceCents: LEAD_PRICE_CENTS,
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      },
    });
  })
);

/* ------------------------------------------------------------------ */
/* accounts                                                            */
/* ------------------------------------------------------------------ */

/**
 * One row per account, with its balance and its queue.
 *
 * The per-status counts come from a single grouped query over the page's ids
 * rather than a count per row: at 25 rows and 7 statuses the naive shape is 175
 * queries.
 */
router.get(
  '/accounts',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = pageArgs(req.query);
    const search = String(req.query.search || '').trim();
    const entitlement = String(req.query.entitlement || 'ENABLED').trim().toUpperCase();

    // Only the two roles that own leads. Every other account has nothing to push,
    // so listing them would be noise an admin has to scroll past — including under
    // « tous », which means « every account this feature can apply to ».
    const where: any = { deletedAt: null, role: { name: { in: ['VENDOR', 'INFLUENCER'] } } };
    if (entitlement === 'ENABLED') where.googleSheetsOutboundEnabled = true;
    else if (entitlement === 'DISABLED') where.googleSheetsOutboundEnabled = false;

    if (search) {
      where.OR = [
        { email: like(search) },
        { phone: like(search) },
        { profile: { is: { fullName: like(search) } } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          uuid: true,
          email: true,
          phone: true,
          createdAt: true,
          role: { select: { name: true } },
          profile: { select: { fullName: true } },
          googleSheetsOutboundEnabled: true,
          googleSheetsGateFrom: true,
          googleSheetOutId: true,
          googleSheetOutUrl: true,
          googleSheetOutTab: true,
          googleSheetOutActive: true,
          googleSheetOutAuto: true,
          googleSheetOutConnectedAt: true,
          googleSheetOutLastError: true,
          googleSheetOutLastErrorAt: true,
          sheetCreditAccount: { select: { balance: true, totalGranted: true, totalConsumed: true } },
        },
        orderBy: [{ googleSheetsOutboundEnabled: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const ids = users.map((u) => u.id);
    const [jobGroups, lastSent] = ids.length
      ? await Promise.all([
          prisma.sheetPushJob.groupBy({
            by: ['vendorId', 'status'],
            where: { vendorId: { in: ids } },
            _count: { _all: true },
          }),
          prisma.sheetPushJob.groupBy({
            by: ['vendorId'],
            where: { vendorId: { in: ids }, status: 'SENT' },
            _max: { sentAt: true },
          }),
        ])
      : [[], []];

    const jobsBy = new Map<number, Record<string, number>>();
    for (const row of jobGroups as any[]) {
      const current = jobsBy.get(row.vendorId) || {};
      current[row.status] = row._count._all;
      jobsBy.set(row.vendorId, current);
    }
    const lastSentBy = new Map((lastSent as any[]).map((r) => [r.vendorId, r._max.sentAt]));

    res.json({
      status: 'success',
      data: {
        accounts: users.map((u) => {
          const balance = u.sheetCreditAccount?.balance ?? 0;
          const jobs = jobsBy.get(u.id) || {};
          return {
            id: u.id,
            uuid: u.uuid,
            email: u.email,
            phone: u.phone,
            name: u.profile?.fullName || u.email,
            role: u.role?.name,
            createdAt: u.createdAt,
            entitlement: {
              enabled: u.googleSheetsOutboundEnabled,
              since: u.googleSheetsGateFrom,
            },
            connection: {
              connected: !!u.googleSheetOutId,
              active: u.googleSheetOutActive,
              auto: u.googleSheetOutAuto,
              url: u.googleSheetOutUrl,
              tab: u.googleSheetOutTab,
              connectedAt: u.googleSheetOutConnectedAt,
              lastError: u.googleSheetOutLastError,
              lastErrorAt: u.googleSheetOutLastErrorAt,
            },
            credits: {
              balance,
              // Leads the balance can still pay for — the figure the admin is
              // really selling, since the tariff is per lead.
              affordable: centsToLeads(balance),
              totalGranted: u.sheetCreditAccount?.totalGranted ?? 0,
              totalConsumed: u.sheetCreditAccount?.totalConsumed ?? 0,
            },
            jobs: {
              sent: jobs.SENT ?? 0,
              pending: (jobs.PENDING ?? 0) + (jobs.SENDING ?? 0),
              blocked: jobs.BLOCKED_NO_CREDITS ?? 0,
              failed: jobs.FAILED ?? 0,
              skipped: jobs.SKIPPED ?? 0,
              removed: jobs.REMOVED ?? 0,
            },
            lastSentAt: lastSentBy.get(u.id) ?? null,
          };
        }),
        priceCents: LEAD_PRICE_CENTS,
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      },
    });
  })
);

/** One account in full: connection, credits, the gate, and its recent history. */
router.get(
  '/accounts/:uuid',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { uuid: req.params.uuid },
      select: {
        id: true,
        uuid: true,
        email: true,
        phone: true,
        createdAt: true,
        role: { select: { name: true } },
        profile: { select: { fullName: true } },
        googleSheetsOutboundEnabled: true,
        googleSheetsGateFrom: true,
        googleSheetOutId: true,
        googleSheetOutUrl: true,
        googleSheetOutTab: true,
        googleSheetOutActive: true,
        googleSheetOutAuto: true,
        googleSheetOutConnectedAt: true,
        googleSheetOutLastError: true,
        googleSheetOutLastErrorAt: true,
        sheetCreditAccount: {
          select: { id: true, balance: true, totalGranted: true, totalConsumed: true },
        },
      },
    });
    if (!user) throw new AppException(404, 'Compte introuvable.');

    const accountId = user.sheetCreditAccount?.id ?? 0;

    const [byStatus, transactions, jobs, gate] = await Promise.all([
      prisma.sheetPushJob.groupBy({
        by: ['status'],
        where: { vendorId: user.id },
        _count: { _all: true },
      }),
      accountId
        ? prisma.sheetCreditTransaction.findMany({
            where: { accountId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 20,
            select: {
              id: true,
              type: true,
              amount: true,
              balanceAfter: true,
              description: true,
              leadId: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
      prisma.sheetPushJob.findMany({
        where: { vendorId: user.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
        select: {
          id: true,
          status: true,
          origin: true,
          attempts: true,
          lastError: true,
          sentAt: true,
          createdAt: true,
          lead: { select: { id: true, fullName: true, phone: true } },
        },
      }),
      // The reservation counters — how many leads the seller currently cannot see
      // because no credit covers them. Swallows its own errors by contract.
      getGateStats(user.id),
    ]);

    const balance = user.sheetCreditAccount?.balance ?? 0;

    res.json({
      status: 'success',
      data: {
        account: {
          id: user.id,
          uuid: user.uuid,
          email: user.email,
          phone: user.phone,
          name: user.profile?.fullName || user.email,
          role: user.role?.name,
          createdAt: user.createdAt,
          entitlement: { enabled: user.googleSheetsOutboundEnabled, since: user.googleSheetsGateFrom },
          connection: {
            connected: !!user.googleSheetOutId,
            active: user.googleSheetOutActive,
            auto: user.googleSheetOutAuto,
            url: user.googleSheetOutUrl,
            tab: user.googleSheetOutTab,
            connectedAt: user.googleSheetOutConnectedAt,
            lastError: user.googleSheetOutLastError,
            lastErrorAt: user.googleSheetOutLastErrorAt,
          },
          credits: {
            balance,
            affordable: centsToLeads(balance),
            totalGranted: user.sheetCreditAccount?.totalGranted ?? 0,
            totalConsumed: user.sheetCreditAccount?.totalConsumed ?? 0,
          },
        },
        jobsByStatus: statusMap(byStatus),
        gate,
        transactions,
        jobs,
        priceCents: LEAD_PRICE_CENTS,
      },
    });
  })
);

/* ------------------------------------------------------------------ */
/* credit ledger, all accounts                                         */
/* ------------------------------------------------------------------ */

router.get(
  '/transactions',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = pageArgs(req.query);
    const type = String(req.query.type || '').trim().toUpperCase();
    const userId = Number(req.query.userId) || 0;

    if (type && !TX_TYPES.includes(type as any)) throw new AppException(400, 'Type inconnu.');

    const where: any = {
      ...(type ? { type } : {}),
      ...(userId ? { account: { is: { userId } } } : {}),
    };

    const [transactions, total] = await Promise.all([
      prisma.sheetCreditTransaction.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          amount: true,
          balanceAfter: true,
          description: true,
          leadId: true,
          createdBy: true,
          createdAt: true,
          account: {
            select: {
              user: {
                select: { id: true, uuid: true, email: true, profile: { select: { fullName: true } } },
              },
            },
          },
        },
      }),
      prisma.sheetCreditTransaction.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: {
        transactions: transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          balanceAfter: t.balanceAfter,
          description: t.description,
          leadId: t.leadId,
          createdBy: t.createdBy,
          createdAt: t.createdAt,
          user: {
            id: t.account.user.id,
            uuid: t.account.user.uuid,
            email: t.account.user.email,
            name: t.account.user.profile?.fullName || t.account.user.email,
          },
        })),
        priceCents: LEAD_PRICE_CENTS,
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      },
    });
  })
);

/* ------------------------------------------------------------------ */
/* controls                                                            */
/* ------------------------------------------------------------------ */

/**
 * Re-sends one lead, through the seller's own manual path.
 *
 * pushLeadsNow re-queues whatever is retryable and drains it in this request,
 * so the response carries real counts. It also keeps the rules that make a
 * re-send safe: a lead that already carries a CONSUME row is not charged twice,
 * and a locked lead is parked rather than written.
 */
router.post(
  '/jobs/:id/retry',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const job = await prisma.sheetPushJob.findUnique({
      where: { id },
      select: { id: true, vendorId: true, leadId: true, status: true },
    });
    if (!job) throw new AppException(404, 'Envoi introuvable.');

    // SENDING means a drain holds the claim right now. Re-queueing under it is
    // how the same lead ends up in the sheet twice.
    if (job.status === 'SENDING') {
      throw new AppException(400, 'Cet envoi est en cours — réessayez dans quelques secondes.');
    }
    if (job.status === 'SENT') {
      throw new AppException(400, 'Ce lead est déjà dans la feuille du vendeur.');
    }

    const stats = await pushLeadsNow(job.vendorId, [job.leadId]);
    res.json({ status: 'success', data: stats });
  })
);

/**
 * Runs the drain for one account now, instead of waiting for the cron tick.
 *
 * `reconcile` re-reads the seller's sheet first, which is what flips rows they
 * deleted by hand back to REMOVED — the only way this pipeline ever learns that
 * a row it wrote is gone.
 */
router.post(
  '/accounts/:uuid/drain',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { uuid: req.params.uuid },
      select: { id: true, googleSheetsOutboundEnabled: true },
    });
    if (!user) throw new AppException(404, 'Compte introuvable.');
    if (!user.googleSheetsOutboundEnabled) {
      throw new AppException(400, "La fonctionnalité Google Sheets n'est pas activée sur ce compte.");
    }

    const reconciled = req.body?.reconcile ? await reconcileVendorSheet(user.id, { force: true }) : null;
    const stats = await drainVendor(user.id);

    res.json({ status: 'success', data: { stats, reconciled } });
  })
);

/**
 * Switches the entitlement credits are sold against.
 *
 * `googleSheetsGateFrom` is stamped ONLY on the null->set transition: it is the
 * line before which leads are never gated, and moving it forward would re-lock
 * leads the seller has already been working.
 *
 * Turning it off leaves the queue alone on purpose. The drain retires what can
 * no longer move to SKIPPED the next time it looks at the account, and doing it
 * here would also throw away the backlog of an admin who mis-clicked.
 */
router.patch(
  '/accounts/:uuid/entitlement',
  asyncHandler(async (req, res) => {
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') throw new AppException(400, 'enabled doit être un booléen.');

    const user = await prisma.user.findUnique({
      where: { uuid: req.params.uuid },
      select: {
        id: true,
        googleSheetsOutboundEnabled: true,
        googleSheetsGateFrom: true,
        role: { select: { name: true } },
      },
    });
    if (!user) throw new AppException(404, 'Compte introuvable.');
    if (!['VENDOR', 'INFLUENCER'].includes(user.role?.name || '')) {
      throw new AppException(400, "L'envoi des leads ne concerne que les vendeurs et les influenceurs.");
    }

    const startsGateNow = enabled && !user.googleSheetsOutboundEnabled && !user.googleSheetsGateFrom;

    const updated = await prisma.user.update({
      where: { uuid: req.params.uuid },
      data: {
        googleSheetsOutboundEnabled: enabled,
        googleSheetsGateFrom: startsGateNow ? new Date() : undefined,
      },
      select: { googleSheetsOutboundEnabled: true, googleSheetsGateFrom: true },
    });

    res.json({
      status: 'success',
      data: { enabled: updated.googleSheetsOutboundEnabled, since: updated.googleSheetsGateFrom },
    });
  })
);

export default router;
