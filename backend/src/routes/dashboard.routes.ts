import { prisma } from '../lib/prisma.js';
import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { isModeAllowedForSubAccount } from '../lib/vendorSubAccount.js';
import { SAFE_USER_SELECT } from '../lib/safeUserSelect.js';
import { parseDateRange } from '../lib/dateRange.js';
import {
  productScopeOf,
  applyProductScope,
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

    // Links are keyed by productId directly; leads and clicks reach it through
    // their link, so they take the referral-link form of the same filter.
    const linksWhere = applyProductScope(
      mode === 'SELLER' ? { product: { ownerId: userId } } : { influencerId: userId },
      scope,
    );
    const periodLeadsWhere = applyReferralLinkProductScope(
      {
        ...(mode === 'SELLER' ? { vendorId: userId } : { referralLink: { influencerId: userId } }),
        createdAt: createdAtWindow,
      },
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
        where: linksWhere,
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
      prisma.lead.findMany({
        where: periodLeadsWhere,
        select: {
          status: true,
          order: {
            select: {
              status: true
            }
          }
        }
      }),
      prisma.lead.groupBy({
        by: ['referralLinkId'],
        where: applyReferralLinkProductScope(
          {
            ...(mode === 'SELLER' ? { vendorId: userId } : { referralLink: { influencerId: userId } }),
            createdAt: { gte: dateLimitStart, lte: dateLimitEnd }
          },
          scope,
        ),
        _count: true
      }),
      (prisma as any).referralLinkClick.findMany({
        where: clicksWhere,
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
      where: applyReferralLinkProductScope(
        {
          ...(mode === 'SELLER' ? { referralLink: { product: { ownerId: userId } } } : { influencerId: userId }),
          status: 'APPROVED',
        },
        scope,
      ),
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
          status: true,
          order: {
            select: {
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
