import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { encrypt, decrypt } from '../utils/crypto.js';

const router = Router();
const prisma = new PrismaClient();

router.get(
  '/',
  authenticate,
  authorize('SELLER', 'GROSSELLER', 'INFLUENCER', 'SUPER_ADMIN', 'FINANCE_ADMIN'),
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
        include: { 
          vendor: { 
            include: { profile: true } 
          } 
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.payoutRequest.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: {
        payouts: payouts.map(p => ({
          ...p,
          ribAccount: decrypt(p.ribAccount)
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

router.post(
  '/',
  authenticate,
  authorize('SELLER', 'GROSSELLER', 'INFLUENCER'),
  [
    body('amountMad').isFloat({ min: 10 }),
    body('bankName').notEmpty(),
    body('ribAccount').notEmpty(), // Allow spaces since frontend sends with spaces sometimes
    body('iceNumber').optional({ checkFalsy: true }),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed');
    }

    const { amountMad, bankName, ribAccount, iceNumber } = req.body;

    const minPayout = parseFloat(process.env.MIN_PAYOUT_AMOUNT_MAD || '10');
    if (amountMad < minPayout) {
      throw new AppException(400, `Minimum payout amount is ${minPayout} MAD`);
    }

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId: req.user!.id },
      });

      if (!wallet || Number(wallet.balanceMad) < amountMad) {
        throw new AppException(400, 'Insufficient wallet balance');
      }

      // 1. Deduct immediately from wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceMad: { decrement: amountMad } }
      });

      // 2. Create the Payout Request
      const payout = await tx.payoutRequest.create({
        data: {
          vendorId: req.user!.id,
          amountMad,
          bankName,
          ribAccount: encrypt(ribAccount),
          iceNumber,
          status: 'PENDING',
        },
      });

      // 3. Log the WalletTransaction for the withdrawal request
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'WITHDRAWAL_REQUEST',
          amountMad: -amountMad,
          balanceAfterMad: updatedWallet.balanceMad,
          description: `Demande de retrait #${payout.id}`,
        }
      });

      return payout;
    });

    res.status(201).json({
      status: 'success',
      message: 'Payout request submitted successfully',
      data: { payout: result },
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

      if (!wallet) {
        throw new AppException(400, 'Wallet not found');
      }

      // Balance was already deducted at request time. 
      // Just increase the totalWithdrawnMad.
      await tx.wallet.update({
        where: { userId: payout.vendorId },
        data: {
          totalWithdrawnMad: { increment: payout.amountMad },
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

    const payoutInfo = await prisma.payoutRequest.findUnique({ where: { id: Number(id) } });
    if (!payoutInfo || payoutInfo.status !== 'PENDING') {
      throw new AppException(400, 'Invalid or already processed payout request');
    }

    const payout = await prisma.$transaction(async (tx) => {
      // Refund the money back to the wallet
      const wallet = await tx.wallet.findUnique({ where: { userId: payoutInfo.vendorId } });
      if (wallet) {
        const updatedWallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: { balanceMad: { increment: payoutInfo.amountMad } }
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'WITHDRAWAL_REFUND',
            amountMad: payoutInfo.amountMad,
            balanceAfterMad: updatedWallet.balanceMad,
            description: `Remboursement suite au rejet de la demande #${payoutInfo.id}`
          }
        });
      }

      return tx.payoutRequest.update({
        where: { id: Number(id) },
        data: {
          status: 'REJECTED',
          processedAt: new Date(),
        },
      });
    });

    res.json({
      status: 'success',
      message: 'Payout rejected',
      data: { payout },
    });
  })
);

router.post(
  '/bulk-approve',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppException(400, 'Invalid payout IDs');
    }

    const results = await prisma.$transaction(async (tx) => {
      const payouts = await tx.payoutRequest.findMany({
        where: { id: { in: ids.map(id => Number(id)) }, status: 'PENDING' },
      });

      const updatedPayouts = [];
      for (const payout of payouts) {
        // Just increment totalWithdrawnMad
        await tx.wallet.update({
          where: { userId: payout.vendorId },
          data: {
            totalWithdrawnMad: { increment: payout.amountMad },
          },
        });

        const updated = await tx.payoutRequest.update({
          where: { id: payout.id },
          data: {
            status: 'COMPLETED',
            processedAt: new Date(),
          },
        });
        updatedPayouts.push(updated);
      }
      return updatedPayouts;
    });

    res.json({
      status: 'success',
      message: `${results.length} payouts approved successfully`,
      data: results
    });
  })
);

export default router;
