import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

router.get(
  '/',
  authenticate,
  authorize('SELLER', 'GROSSELLER', 'SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, status } = req.query;

    const where: any = {};
    if (req.user!.roleName !== 'SUPER_ADMIN' && req.user!.roleName !== 'FINANCE_ADMIN') {
      where.vendorId = req.user!.id;
    }
    if (status) where.status = status;

    const [payouts, total] = await Promise.all([
      prisma.payoutRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.payoutRequest.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: {
        payouts,
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

router.post(
  '/',
  authenticate,
  authorize('SELLER', 'GROSSELLER'),
  [
    body('amountMad').isFloat({ min: 100 }),
    body('bankName').notEmpty(),
    body('ribAccount').matches(/^[0-9]{24}$/),
    body('iceNumber').optional().matches(/^[0-9]{9}$/),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed');
    }

    const { amountMad, bankName, ribAccount, iceNumber } = req.body;

    const minPayout = parseFloat(process.env.MIN_PAYOUT_AMOUNT_MAD || '500');
    if (amountMad < minPayout) {
      throw new AppException(400, `Minimum payout amount is ${minPayout} MAD`);
    }

    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user!.id },
    });

    if (!wallet || Number(wallet.balanceMad) < amountMad) {
      throw new AppException(400, 'Insufficient wallet balance');
    }

    const payout = await prisma.payoutRequest.create({
      data: {
        vendorId: req.user!.id,
        amountMad,
        bankName,
        ribAccount,
        iceNumber,
        status: 'PENDING',
      },
    });

    res.status(201).json({
      status: 'success',
      message: 'Payout request submitted successfully',
      data: { payout },
    });
  })
);

router.patch(
  '/:id/approve',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { receiptUrl } = req.body;

    const payout = await prisma.payoutRequest.findUnique({
      where: { id: Number(id) },
      include: { vendor: { include: { wallet: true } } },
    });

    if (!payout) {
      throw new AppException(404, 'Payout request not found');
    }

    if (payout.status !== 'PENDING') {
      throw new AppException(400, 'Payout is not in pending status');
    }

    const updatedPayout = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId: payout.vendorId },
      });

      if (!wallet || Number(wallet.balanceMad) < Number(payout.amountMad)) {
        throw new AppException(400, 'Insufficient wallet balance');
      }

      const updatedWallet = await tx.wallet.update({
        where: { userId: payout.vendorId },
        data: {
          balanceMad: { decrement: payout.amountMad },
          totalWithdrawnMad: { increment: payout.amountMad },
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'PAYOUT',
          amountMad: -payout.amountMad,
          balanceAfterMad: updatedWallet.balanceMad,
          description: `Payout request #${payout.id} processed`,
        },
      });

      return tx.payoutRequest.update({
        where: { id: payout.id },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
          receiptUrl,
        },
      });
    });

    res.json({
      status: 'success',
      message: 'Payout approved and processed',
      data: { payout: updatedPayout },
    });
  })
);

router.patch(
  '/:id/reject',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const payout = await prisma.payoutRequest.update({
      where: { id: Number(id) },
      data: {
        status: 'REJECTED',
        processedAt: new Date(),
      },
    });

    res.json({
      status: 'success',
      message: 'Payout rejected',
      data: { payout },
    });
  })
);

export default router;
