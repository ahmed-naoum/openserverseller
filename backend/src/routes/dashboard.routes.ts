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
        include: { lead: true, brand: true, items: { include: { product: true } } },
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

    const [
      profile,
      brands,
      products,
      pendingProducts,
      approvedProducts,
      wallet,
      payouts,
      recentOrders,
      notifications
    ] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.brand.findMany({ where: { vendorId: userId } }),
      prisma.product.findMany({
        where: { ownerId: userId },
        include: { category: true, images: { where: { isPrimary: true }, take: 1 } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.product.findMany({
        where: { ownerId: userId, status: 'PENDING' },
        include: { category: true }
      }),
      prisma.product.findMany({
        where: { ownerId: userId, status: 'APPROVED' },
        include: { category: true }
      }),
      prisma.wallet.findUnique({ where: { userId } }),
      prisma.payoutRequest.findMany({
        where: { vendorId: userId },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.order.findMany({
        where: { vendorId: userId },
        include: { lead: true, brand: true, items: { include: { product: true } } },
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
      profile,
      brands,
      products,
      pendingProducts,
      approvedProducts,
      wallet,
      payouts,
      recentOrders,
      notifications
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
        include: { vendor: { include: { profile: true } }, brand: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.lead.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { vendor: { include: { profile: true } }, brand: true }
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
        where: { kycStatus: 'PENDING' },
        include: { profile: true, role: true, kycDocuments: true },
        take: 20
      }),
      prisma.user.findMany({
        where: { kycStatus: { in: ['APPROVED', 'REJECTED'] } },
        include: { profile: true, role: true },
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

    const [
      profile,
      referralLinks,
      commissions,
      campaigns,
      notifications
    ] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.referralLink.findMany({
        where: { influencerId: userId },
        include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.influencerCommission.findMany({
        where: { influencerId: userId },
        include: { referralLink: true },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.influencerCampaign.findMany({
        orderBy: { createdAt: 'desc' }
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    const totalEarnings = await prisma.influencerCommission.aggregate({
      where: { influencerId: userId, status: 'APPROVED' },
      _sum: { amount: true }
    });

    res.json({
      profile,
      referralLinks,
      commissions,
      campaigns,
      totalEarnings: totalEarnings._sum.amount || 0,
      notifications
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
        include: { lead: true, brand: true },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.lead.findMany({
        include: { vendor: { include: { profile: true } }, brand: true },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.product.findMany({
        where: { status: 'PENDING' },
        include: { category: true, owner: { include: { profile: true } } },
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
