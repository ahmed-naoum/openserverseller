import { prisma } from '../lib/prisma.js';
import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { isModeAllowedForSubAccount } from '../lib/vendorSubAccount.js';
import { SAFE_USER_SELECT } from '../lib/safeUserSelect.js';
import { parseDateRange } from '../lib/dateRange.js';
import {
  productScopeOf,
  applyReferralLinkProductScope,
} from '../lib/subAccountProductScope.js';

const router = Router();

router.get(
  '/seller-affiliate',
  authenticate,
  authorize('VENDOR'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { start, end, days } = req.query;
    const mode = req.user!.mode || 'SELLER';

    let dateLimitStart: Date | undefined;
    let dateLimitEnd: Date | undefined = new Date();

    // `start`/`end` are the period bar's bounds and take either a bare date or a
    // `datetime-local` value — that is what lets the bar offer "Hier" (a window
    // that closes before today) and an hour-precise custom range. Either bound
    // alone is valid: "depuis lundi" has no end. The old branch here forced
    // 23:59 on `end` and read a bare date as UTC midnight, so an hour never
    // survived and a whole day could shift. `days` stays for older callers.
    const parsed = parseDateRange(start, end);
    if (parsed) {
      dateLimitStart = parsed.gte;
      dateLimitEnd = parsed.lte;
    } else if (days === 'all') {
      dateLimitStart = undefined; // No lower bound for all time
    } else {
      const numDays = parseInt(days as string) || 7;
      dateLimitStart = new Date();
      dateLimitStart.setDate(dateLimitStart.getDate() - (numDays - 1));
      dateLimitStart.setHours(0, 0, 0, 0);
    }

    const whereBase: any = mode === 'SELLER'
      ? { referralLink: { product: { ownerId: userId } } }
      : { influencerId: userId };

    if (dateLimitStart || dateLimitEnd) {
      whereBase.createdAt = {};
      if (dateLimitStart) whereBase.createdAt.gte = dateLimitStart;
      if (dateLimitEnd) whereBase.createdAt.lte = dateLimitEnd;
    }

    /**
     * Every figure on this screen narrows with the products a sub-account was
     * given. A dashboard is a set of totals, so a half-scoped one is worse than
     * none: the helper would read the vendor's whole revenue next to a product
     * list holding two items and have no way to tell the two apart. The scope is
     * therefore threaded through each query below rather than applied to the
     * response.
     */
    const scope = productScopeOf(req);
    const createdAtWindow =
      dateLimitStart || dateLimitEnd
        ? {
            ...(dateLimitStart ? { gte: dateLimitStart } : {}),
            ...(dateLimitEnd ? { lte: dateLimitEnd } : {}),
          }
        : undefined;

    applyReferralLinkProductScope(whereBase, scope);

    // Deliberately date-unbounded: the dashboard's period bar filters this set
    // client-side, so the server always hands over the whole (scoped) history.
    // The scope, though, is not optional — the Leads page scopes its rows, and
    // an unscoped dashboard next to a scoped leads list shows a sub-account two
    // different totals for the same account.
    const allLeadsWhere = applyReferralLinkProductScope(
      mode === 'SELLER' ? { vendorId: userId } : { referralLink: { influencerId: userId } },
      scope,
    );
    const clicksWhere = applyReferralLinkProductScope(
      {
        ...(mode === 'SELLER'
          ? { referralLink: { product: { ownerId: userId } } }
          : { referralLink: { influencerId: userId } }),
        createdAt: createdAtWindow,
      },
      scope,
    );
    // The click stats are three numbers, but the rows were fetched whole to
    // compute them — every ipAddress/userAgent pair since the account existed,
    // on every dashboard load. Counted in the database instead; the pair listing
    // for the unique-visitor count is bounded by distinct visitors, not clicks.
    const clickViewsWhere = {
      AND: [clicksWhere, { OR: [{ userAgent: null }, { userAgent: { not: 'whatsapp_click' } }] }],
    };
    const clickWhatsappWhere = { AND: [clicksWhere, { userAgent: 'whatsapp_click' }] };

    /**
     * The two ledgers below are the whole weight of this response. A vendor a
     * few months old carries thousands of wallet rows, and they were serialised
     * twice — once nested inside `wallet`, once beside it — for a screen that
     * only ever folds them back down into four numbers. So the ledgers are
     * pages now, and each figure the dashboard used to derive by walking the
     * full array is aggregated in the database and returned alongside the page.
     *
     * The aggregates are deliberately not computed from the page: they describe
     * the whole window, so they read the same whichever page was asked for.
     */
    const intParam = (value: unknown, fallback: number, max: number) => {
      const n = parseInt(String(value ?? ''), 10);
      return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
    };

    const commissionsPage = intParam(req.query.commissionsPage, 1, Number.MAX_SAFE_INTEGER);
    const commissionsPageSize = intParam(req.query.commissionsPageSize, 20, 100);

    // Reached through the relation rather than through a walletId, so the
    // ledger queries do not have to wait on the wallet lookup to know their
    // filter and can stay in the same parallel batch as everything else.
    const txWhere: any = { wallet: { userId } };
    if (createdAtWindow) txWhere.createdAt = createdAtWindow;

    // A page is a window onto an ordered list, so the order has to be total:
    // `createdAt` alone ties on rows written in the same millisecond and lets
    // one drift between pages — appearing twice, or not at all.
    const txOrder = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

    // Only what the vendor dashboard actually renders is fetched. The page was
    // measured reading 7 of this response's former 14 keys — the referral-link
    // list (it uses GET /influencer/links), the commission and ledger row pages,
    // campaigns, notifications, profile and totalEarnings were serialised on
    // every load and never read. The whole-window aggregates stay.
    const [
      commissionsTotal,
      commissionsFirst,
      wallet,
      txTotals,
      txCredits,
      txDebits,
      txClosing,
      periodStats,
      clickViews,
      clickWhatsapp,
      clickViewPairs,
      helperAssignments
    ] = await Promise.all([
      prisma.influencerCommission.count({ where: whereBase }),
      // The dashboard sizes its "tout" chart from the oldest commission, so it
      // is returned as a figure of its own.
      prisma.influencerCommission.aggregate({
        where: whereBase,
        _min: { createdAt: true }
      }),
      // Without the nested `transactions` the ledger is serialised once rather
      // than twice — on its own that halved this response.
      prisma.wallet.findUnique({ where: { userId } }),
      prisma.walletTransaction.aggregate({
        where: txWhere,
        _count: { _all: true },
        _sum: { amountMad: true },
        _min: { createdAt: true },
        _max: { createdAt: true }
      }),
      // Credits and debits are summed apart because the dashboard shows money in
      // and money out as two figures; netting them first loses both.
      prisma.walletTransaction.aggregate({
        where: { ...txWhere, amountMad: { gt: 0 } },
        _count: { _all: true },
        _sum: { amountMad: true }
      }),
      prisma.walletTransaction.aggregate({
        where: { ...txWhere, amountMad: { lt: 0 } },
        _count: { _all: true },
        _sum: { amountMad: true }
      }),
      // The running balance as the window closed. It rides on the newest row,
      // so it is read on its own.
      prisma.walletTransaction.findFirst({
        where: txWhere,
        orderBy: txOrder,
        select: { balanceAfterMad: true, createdAt: true }
      }),
      prisma.lead.findMany({
        where: allLeadsWhere,
        select: {
          createdAt: true,
          status: true,
          referralLinkId: true,
          order: {
            select: {
              createdAt: true,
              status: true
            }
          }
        }
      }),
      (prisma as any).referralLinkClick.count({ where: clickViewsWhere }),
      (prisma as any).referralLinkClick.count({ where: clickWhatsappWhere }),
      (prisma as any).referralLinkClick.groupBy({
        by: ['ipAddress', 'userAgent'],
        where: clickViewsWhere
      }),
      (prisma as any).helperUserAssignment.findMany({
        where: {
          targetUserId: userId,
          helper: {
            canDisplayOnDashboard: true
          }
        },
        include: {
          helper: {
            select: {
              email: true,
              phone: true,
              profile: {
                select: {
                  fullName: true,
                  avatarUrl: true
                }
              }
            }
          }
        }
      })
    ]);

    const totalViews = clickViews;
    const whatsappClicks = clickWhatsapp;
    // Same visitor identity the in-memory fold used: ip + userAgent, a null
    // agent reading as 'unknown' (which also collapses a null/'unknown' pair the
    // database counts as two).
    const uniqueVisitors = new Set(
      (clickViewPairs || []).map((p: any) => `${p.ipAddress}-${p.userAgent || 'unknown'}`)
    ).size;

    const deliveryStatuses = [
      'PENDING', 'PUSHED_TO_DELIVERY', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED', 'CONFIRMED_DELIVERY',
      'NEW_PARCEL', 'WAITING_PICKUP', 'PICKED_UP', 'SENT', 'RECEIVED', 'DISTRIBUTION', 'PROGRAMMER_AUTO', 'POSTPONED',
      'WAITING_PREPARATION', 'PREPARED', 'ENCORE_PREPARED', 'CANCELED_BY_SELLER', 'CANCELED_BY_SYSTEM', 'REFUSE',
      'NOANSWER', 'CANCELED', 'ERR', 'PROGRAMMER', 'INCORRECT_ADDRESS'
    ];

    const periodLeads = (periodStats || []) as any[];
    const conversions = periodLeads.length;
    const confirmed = periodLeads.filter(l => {
      const s = (l.order?.status || l.status || 'UNKNOWN').toUpperCase();
      return s === 'CONFIRMED' || deliveryStatuses.includes(s);
    }).length;
    const delivered = periodLeads.filter(l => (l.order?.status || '').toUpperCase() === 'DELIVERED').length;

    const stats = {
      conversions,
      confirmed,
      delivered,
      totalViews,
      uniqueVisitors,
      whatsappClicks
    };

    const pageMeta = (total: number, page: number, pageSize: number) => ({
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      hasMore: page * pageSize < total
    });

    /**
     * Everything the dashboard used to fold out of the ledger itself. A sum
     * comes back null when the window caught no rows, and `periodWithdrawn` is
     * reported positive because the screen labels it money out rather than a
     * negative change in balance.
     */
    const walletStats = {
      periodEarnedMad: txCredits._sum.amountMad || 0,
      periodWithdrawnMad: Math.abs(txDebits._sum.amountMad || 0),
      periodNetMad: txTotals._sum.amountMad || 0,
      // Falls back to the live balance so an empty window reads as the wallet
      // as it stands, which is what the old `walletTransactions[0]` did.
      closingBalanceMad: txClosing?.balanceAfterMad ?? (wallet?.balanceMad || 0),
      transactionCount: txTotals._count._all,
      creditCount: txCredits._count._all,
      debitCount: txDebits._count._all,
      firstTransactionAt: txTotals._min.createdAt,
      lastTransactionAt: txTotals._max.createdAt
    };

    res.json({
      commissionsMeta: {
        ...pageMeta(commissionsTotal, commissionsPage, commissionsPageSize),
        firstCommissionAt: commissionsFirst._min.createdAt
      },
      stats,
      wallet,
      walletStats,
      periodLeads,
      helpers: (helperAssignments || []).map((ha: any) => ({
        email: ha.helper.email,
        phone: ha.helper.phone,
        fullName: ha.helper.profile?.fullName || 'N/A',
        avatarUrl: ha.helper.profile?.avatarUrl || null
      }))
    });
  })
);

router.patch(
  '/seller-affiliate/switch-mode',
  authenticate,
  authorize('VENDOR'),
  asyncHandler(async (req: Request, res: Response) => {
    const { mode } = req.body;
    if (!['SELLER', 'AFFILIATE'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode. Must be SELLER or AFFILIATE' });
    }

    // A sub-account reaches this route under its own id (scope 'self-as-vendor'),
    // so the update below rewrites the helper's mode and never the vendor's. The
    // vendor can still pin a helper to one of the two modes.
    if (req.user!.isVendorHelper && !isModeAllowedForSubAccount(req.user!.subPermissions || {}, mode)) {
      return res.status(403).json({
        status: 'error',
        error: "Le vendeur a restreint ce sous-compte à un seul mode.",
      });
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { mode }
    });

    res.json({ mode: user.mode });
  })
);

router.get(
  '/grosseller',
  authenticate,
  authorize('GROSSELLER'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      profile,
      products,
      pendingProducts,
      approvedProducts,
      wallet,
      payouts,
      recentOrders,
      notifications,
      totalPurchasedInventory,
      recentSales,
      pendingPayoutsAgg,
      lowStockProducts
    ] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.product.findMany({
        where: { ownerId: userId },
        include: { categories: true, images: { where: { isPrimary: true }, take: 1 } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.product.findMany({
        where: { ownerId: userId, status: 'PENDING' },
        include: { categories: true }
      }),
      prisma.product.findMany({
        where: { ownerId: userId, status: 'APPROVED' },
        include: { categories: true }
      }),
      prisma.wallet.findUnique({ where: { userId } }),
      prisma.payoutRequest.findMany({
        where: { vendorId: userId },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.order.findMany({
        where: { vendorId: userId },
        include: { lead: true, items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      // New Stats
      prisma.productInventory.findMany({
        where: { userId },
        include: { product: true }
      }),
      prisma.order.aggregate({
        where: { vendorId: userId, createdAt: { gte: thirtyDaysAgo }, status: { not: 'CANCELLED' } },
        _sum: { vendorEarningMad: true }
      }),
      prisma.payoutRequest.aggregate({
        where: { vendorId: userId, status: 'PENDING' },
        _sum: { amountMad: true }
      }),
      prisma.product.count({
        where: { ownerId: userId, stockQuantity: { lt: 10 }, status: 'APPROVED' }
      })
    ]);

    const totalPurchasedValue = totalPurchasedInventory.reduce((acc, item) => {
      return acc + (item.quantity * (item.product?.baseCostMad || 0));
    }, 0);

    res.json({
      profile,
      products,
      pendingProducts,
      approvedProducts,
      wallet,
      payouts,
      recentOrders,
      notifications,
      stats: {
        totalPurchasedValue,
        recentSalesValue: recentSales._sum.vendorEarningMad || 0,
        pendingPayoutsAmount: pendingPayoutsAgg._sum.amountMad || 0,
        lowStockAlerts: lowStockProducts
      }
    });
  })
);

router.get(
  '/agent',
  authenticate,
  authorize('CALL_CENTER_AGENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const [
      profile,
      assignedLeads,
      recentLeads,
      notifications
    ] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.lead.findMany({
        where: { assignedAgentId: userId },
        include: { vendor: { select: SAFE_USER_SELECT } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.lead.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { vendor: { select: SAFE_USER_SELECT } }
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    res.json({
      profile,
      assignedLeads,
      recentLeads,
      notifications
    });
  })
);

router.get(
  '/confirmation',
  authenticate,
  authorize('CONFIRMATION_AGENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const [
      profile,
      pendingVerifications,
      recentVerifications,
      notifications
    ] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.user.findMany({
        where: { kycStatus: { in: ['PENDING', 'UNDER_REVIEW'] } },
        include: { profile: true, role: true, kycDocuments: true, bankAccounts: true },
        take: 20
      }),
      prisma.user.findMany({
        where: { kycStatus: { in: ['APPROVED', 'REJECTED'] } },
        include: { profile: true, role: true, kycDocuments: true, bankAccounts: true },
        orderBy: { updatedAt: 'desc' },
        take: 20
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    res.json({
      profile,
      pendingVerifications,
      recentVerifications,
      notifications
    });
  })
);

router.get(
  '/influencer',
  authenticate,
  authorize('INFLUENCER'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { start, end, days } = req.query;

    let dateLimitStart: Date | undefined;
    let dateLimitEnd = new Date();

    if (start && end) {
      dateLimitStart = new Date(start as string);
      dateLimitEnd = new Date(end as string);
      dateLimitEnd.setHours(23, 59, 59, 999);
    } else if (days === 'all') {
      dateLimitStart = undefined; // No lower bound for all time
    } else {
      const numDays = parseInt(days as string) || 7;
      dateLimitStart = new Date();
      dateLimitStart.setDate(dateLimitStart.getDate() - (numDays - 1));
      dateLimitStart.setHours(0, 0, 0, 0);
    }

    const whereBase: any = { 
      influencerId: userId,
    };

    if (dateLimitStart || dateLimitEnd) {
      whereBase.createdAt = {};
      if (dateLimitStart) whereBase.createdAt.gte = dateLimitStart;
      if (dateLimitEnd) whereBase.createdAt.lte = dateLimitEnd;
    }

    const [
      profile,
      referralLinks,
      commissions,
      campaigns,
      notifications,
      wallet,
      periodStats,
      periodLeadCounts,
      periodClicks,
      helperAssignments
    ] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.referralLink.findMany({
        where: { influencerId: userId },
        include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.influencerCommission.findMany({
        where: whereBase,
        include: { 
          referralLink: {
            include: { product: true }
          },
          order: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.influencerCampaign.findMany({
        orderBy: { createdAt: 'desc' }
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.wallet.findUnique({ 
        where: { userId },
        include: { 
          transactions: {
            where: { createdAt: { gte: dateLimitStart, lte: dateLimitEnd } },
            orderBy: { createdAt: 'desc' }
          }
        }
      }),
      // Fetch all leads for the period to aggregate stats in memory (due to Lead/Order status sync delay)
      prisma.lead.findMany({
        where: {
          referralLink: {
            influencerId: userId
          },
          createdAt: dateLimitStart || dateLimitEnd ? {
            ...(dateLimitStart ? { gte: dateLimitStart } : {}),
            ...(dateLimitEnd ? { lte: dateLimitEnd } : {})
          } : undefined
        },
        select: {
          createdAt: true,
          status: true,
          order: {
            select: {
              createdAt: true,
              status: true
            }
          }
        }
      }),
      // New: Aggregate lead counts by referral link for the period
      prisma.lead.groupBy({
        by: ['referralLinkId'],
        where: {
          referralLink: {
            influencerId: userId
          },
          createdAt: { gte: dateLimitStart, lte: dateLimitEnd }
        },
        _count: true
      }),
      // New: Fetch all clicks for the period
      (prisma as any).referralLinkClick.findMany({
        where: {
          referralLink: {
            influencerId: userId
          },
          createdAt: dateLimitStart || dateLimitEnd ? {
            ...(dateLimitStart ? { gte: dateLimitStart } : {}),
            ...(dateLimitEnd ? { lte: dateLimitEnd } : {})
          } : undefined
        },
        select: {
          ipAddress: true,
          userAgent: true
        }
      }),
      (prisma as any).helperUserAssignment.findMany({
        where: {
          targetUserId: userId,
          helper: {
            canDisplayOnDashboard: true
          }
        },
        include: {
          helper: {
            select: {
              email: true,
              phone: true,
              profile: {
                select: {
                  fullName: true,
                  avatarUrl: true
                }
              }
            }
          }
        }
      })
    ]);

    const leadCountsByLink = periodLeadCounts || [];
    const periodClicksData = periodClicks || [];

    let totalViews = 0;
    const uniqueIPUAs = new Set<string>();
    let whatsappClicks = 0;

    periodClicksData.forEach((c: any) => {
      if (c.userAgent === 'whatsapp_click') {
        whatsappClicks++;
      } else {
        totalViews++;
        uniqueIPUAs.add(`${c.ipAddress}-${c.userAgent || 'unknown'}`);
      }
    });

    const uniqueVisitors = uniqueIPUAs.size;

    // Calculate funnel counts from retrieved leads (sync with influencer/Leads.tsx logic)
    const deliveryStatuses = [
      'PENDING', 'PUSHED_TO_DELIVERY', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED', 'CONFIRMED_DELIVERY',
      'NEW_PARCEL', 'WAITING_PICKUP', 'PICKED_UP', 'SENT', 'RECEIVED', 'DISTRIBUTION', 'PROGRAMMER_AUTO', 'POSTPONED',
      'WAITING_PREPARATION', 'PREPARED', 'ENCORE_PREPARED', 'CANCELED_BY_SELLER', 'CANCELED_BY_SYSTEM', 'REFUSE',
      'NOANSWER', 'CANCELED', 'ERR', 'PROGRAMMER', 'INCORRECT_ADDRESS'
    ];

    const periodLeads = (periodStats || []) as any[];
    const conversions = periodLeads.length;
    const confirmed = periodLeads.filter(l => {
      const s = (l.order?.status || l.status || 'UNKNOWN').toUpperCase();
      return s === 'CONFIRMED' || deliveryStatuses.includes(s);
    }).length;
    const delivered = periodLeads.filter(l => (l.order?.status || '').toUpperCase() === 'DELIVERED').length;

    const stats = {
      conversions,
      confirmed,
      delivered,
      totalViews,
      uniqueVisitors,
      whatsappClicks
    };

    const totalEarnings = await prisma.influencerCommission.aggregate({
      where: { influencerId: userId, status: 'APPROVED' },
      _sum: { amount: true }
    });

    res.json({
      profile,
      referralLinks,
      commissions,
      campaigns,
      stats,
      totalEarnings: totalEarnings._sum.amount || 0,
      notifications,
      wallet,
      walletTransactions: wallet?.transactions || [],
      leadCountsByLink,
      periodLeads,
      helpers: (helperAssignments || []).map((ha: any) => ({
        email: ha.helper.email,
        phone: ha.helper.phone,
        fullName: ha.helper.profile?.fullName || 'N/A',
        avatarUrl: ha.helper.profile?.avatarUrl || null
      }))
    });
  })
);

router.get(
  '/admin',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const [
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      recentOrders,
      recentLeads,
      pendingProducts,
      pendingPayouts,
      notifications
    ] = await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.order.aggregate({ _sum: { totalAmountMad: true } }),
      prisma.order.findMany({
        include: { lead: true },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.lead.findMany({
        include: { vendor: { select: SAFE_USER_SELECT } },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.product.findMany({
        where: { status: 'PENDING' },
        include: { categories: true, owner: { include: { profile: true } } },
        take: 20
      }),
      prisma.payoutRequest.findMany({
        where: { status: 'PENDING' },
        include: { vendor: { select: SAFE_USER_SELECT } },
        take: 20
      }),
      prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20
      })
    ]);

    res.json({
      stats: {
        totalUsers,
        totalProducts,
        totalOrders,
        totalRevenue: totalRevenue._sum.totalAmountMad || 0
      },
      recentOrders,
      recentLeads,
      pendingProducts,
      pendingPayouts,
      notifications
    });
  })
);

export default router;
