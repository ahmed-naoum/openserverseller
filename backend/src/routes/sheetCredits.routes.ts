import { prisma } from '../lib/prisma.js';
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getGateStats } from '../services/leadCredits.service.js';

const router = Router();

/**
 * Balance behind the "$" chip in the dashboard header.
 *
 * This endpoint must NEVER answer 403 or 404. The chip lives in the shared
 * header, so it is fetched on every dashboard page by every role — admins,
 * agents, influencers, fulfilment operators — and none of them owns a credit
 * account. A 403/404 there would break the header for all of them, so an
 * account-less caller gets a plain 200 with { enabled: false, balance: 0 }.
 *
 * A GET also deliberately does not create the account: the row is written when
 * an admin grants the first credits, not because someone loaded a page.
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const [user, account, gate] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { googleSheetsOutboundEnabled: true },
      }),
      prisma.sheetCreditAccount.findUnique({
        where: { userId: req.user!.id },
        select: { balance: true, totalGranted: true, totalConsumed: true },
      }),
      // The reservation counters, so the chip can show how much room is left
      // without a second round trip to /google-sheets/outbound/status. Held to the
      // same contract as the rest of this handler: getGateStats swallows its own
      // errors and an account with no gate returns active:false and zeros, so it
      // cannot turn this endpoint into a 403, a 404 or a 500 for anybody.
      getGateStats(req.user!.id),
    ]);

    res.json({
      status: 'success',
      data: {
        enabled: !!user?.googleSheetsOutboundEnabled,
        balance: account?.balance ?? 0,
        currencyLabel: '$',
        totalGranted: account?.totalGranted ?? 0,
        totalConsumed: account?.totalConsumed ?? 0,
        gate,
      },
    });
  })
);

router.get(
  '/transactions',
  authenticate,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const take = Math.min(100, Math.max(1, Number(limit) || 20));

    // The ledger is always the caller's own — there is deliberately no id taken
    // from the query or the body, so no one can read someone else's history.
    const account = await prisma.sheetCreditAccount.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });

    // Same reasoning as /me: never having received credits is not an error.
    // An empty page lets the history panel render instead of failing.
    if (!account) {
      return res.json({
        status: 'success',
        data: {
          transactions: [],
          pagination: { page: pageNum, limit: take, total: 0, totalPages: 0 },
        },
      });
    }

    const where = { accountId: account.id };

    const [transactions, total] = await Promise.all([
      prisma.sheetCreditTransaction.findMany({
        where,
        skip: (pageNum - 1) * take,
        take,
        // The id is the tie-break. A grant and the consumes it unblocks can land
        // in the same millisecond, and without a total order those rows swap
        // between pages — the reader then sees one twice and another never.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
          createdAt: t.createdAt,
        })),
        pagination: {
          page: pageNum,
          limit: take,
          total,
          totalPages: Math.ceil(total / take),
        },
      },
    });
  })
);

export default router;
