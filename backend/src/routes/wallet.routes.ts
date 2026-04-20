import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

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
    const { page = 1, limit = 20, type, startDate, endDate } = req.query;

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
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
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
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  })
);

export default router;
