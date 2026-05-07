import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

router.get(
  '/seller-affiliate',
  authenticate,
  authorize('VENDOR'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const [
      profile,
      inventory,
      leads,
      wallet,
      recentOrders,
      notifications
    ] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.productInventory.findMany({
        where: { userId },
        include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } },
        orderBy: { updatedAt: 'desc' },
        take: 20
      }),
      prisma.lead.findMany({
        where: { vendorId: userId },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.wallet.findUnique({ where: { userId } }),
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
      })
    ]);

    res.json({
      mode: req.user!.mode,
      profile,
      inventory,
      leads,
      wallet,
      recentOrders,
      notifications
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
        include: { vendor: { include: { profile: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.lead.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { vendor: { include: { profile: true } } }
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
      periodLeadCounts
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
      // Aggregate stats for the period
      prisma.lead.groupBy({
        by: ['status'],
        where: {
          referralLink: {
            influencerId: userId
          },
          createdAt: { gte: dateLimitStart, lte: dateLimitEnd }
        },
        _count: true
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
      })
    ]);

    const leadCountsByLink = periodLeadCounts || [];

    // Calculate funnel counts from grouped leads (sync with influencer/Leads.tsx logic)
    const deliveryStatuses = ['PENDING', 'PUSHED_TO_DELIVERY', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED', 'CONFIRMED_DELIVERY'];
    
    const stats = {
      conversions: periodStats.reduce((sum, s) => sum + s._count, 0),
      confirmed: periodStats.filter(s => 
        s.status === 'CONFIRMED' || deliveryStatuses.includes(s.status)
      ).reduce((sum, s) => sum + s._count, 0),
      delivered: periodStats.filter(s => s.status === 'DELIVERED').reduce((sum, s) => sum + s._count, 0),
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
      leadCountsByLink
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
        include: { vendor: { include: { profile: true } } },
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
        include: { vendor: { include: { profile: true } } },
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
