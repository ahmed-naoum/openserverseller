import { prisma } from '../lib/prisma.js';
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { resolvePage, resolvePageSize } from '../lib/pagination.js';

const router = Router();

router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user!.id },
      include: {
        transactions: {
          include: {
            order: {
              include: { 
                vendor: {
                  include: { profile: true }
                } 
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!wallet) {
      const newWallet = await prisma.wallet.create({
        data: { userId: req.user!.id },
        include: { transactions: true },
      });
      return res.json({ status: 'success', data: { wallet: newWallet } });
    }

    res.json({
      status: 'success',
      data: { wallet },
    });
  })
);

router.get(
  '/transactions',
  authenticate,
  asyncHandler(async (req, res) => {
    const { type, startDate, endDate } = req.query;
    // Clamped rather than trusted: `take: Number(limit)` accepted anything the
    // caller sent, NaN included.
    const page = resolvePage(req.query.page);
    const limit = resolvePageSize(req.query.limit, 20, 200);

    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user!.id },
    });

    if (!wallet) {
      throw new AppException(404, 'Wallet not found');
    }

    const where: any = { walletId: wallet.id };

    if (type) where.type = type;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        include: {
          order: {
            include: { 
              vendor: {
                include: { profile: true }
              } 
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: {
        transactions: transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amountMad: t.amountMad,
          balanceAfterMad: t.balanceAfterMad,
          description: t.description,
          order: t.order
            ? {
                orderNumber: t.order.orderNumber,
                brand: t.order.vendor?.profile?.fullName || t.order.vendor?.youcanStoreDomain || 'N/A',
              }
            : null,
          createdAt: t.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  })
);

export default router;
