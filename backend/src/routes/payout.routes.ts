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
            include: { profile: true, wallet: true } 
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
        payouts: payouts.map(p => {
          const plain = JSON.parse(JSON.stringify(p));
          return {
            ...plain,
            vendor: plain.vendor,
            ribAccount: decrypt(p.ribAccount)
          };
        }),
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
  '/:id/status',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status: targetStatus } = req.body;
    
    const payout = await prisma.payoutRequest.findUnique({ where: { id: Number(id) } });
    if (!payout) throw new AppException(404, 'Payout not found');
    
    const currentStatus = payout.status;
    if (currentStatus === targetStatus) {
      res.json({ status: 'success', message: 'Status is already set' });
      return;
    }

    const updatedPayout = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: payout.vendorId } });
      if (!wallet) throw new AppException(400, 'Wallet not found');

      // --- 1. HANDLE BALANCE REVERSAL/DEDUCTION ---
      // If we are moving FROM a state where money was refunded (REJECTED) 
      // TO a state where it should be deducted (PENDING, COMPLETED, RECEIVED)
      if (currentStatus === 'REJECTED' && ['PENDING', 'COMPLETED', 'RECEIVED'].includes(targetStatus)) {
        const updatedWallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: { balanceMad: { decrement: payout.amountMad } }
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'WITHDRAWAL_RE_REQUEST',
            amountMad: -payout.amountMad,
            balanceAfterMad: updatedWallet.balanceMad,
            description: `Re-débit pour changement de statut du retrait #${payout.id} (${currentStatus} -> ${targetStatus})`
          }
        });
      }
      
      // If we are moving TO REJECTED from a state where money was deducted (PENDING, COMPLETED, RECEIVED)
      if (targetStatus === 'REJECTED' && ['PENDING', 'COMPLETED', 'RECEIVED'].includes(currentStatus)) {
        const updatedWallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: { balanceMad: { increment: payout.amountMad } }
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'WITHDRAWAL_REFUND',
            amountMad: payout.amountMad,
            balanceAfterMad: updatedWallet.balanceMad,
            description: `Remboursement pour changement de statut du retrait #${payout.id} (${currentStatus} -> ${targetStatus})`
          }
        });
      }

      // --- 2. HANDLE TOTAL WITHDRAWN STATISTICS ---
      // Moving TO a completed state (COMPLETED, RECEIVED) from a non-completed one (PENDING, REJECTED)
      if (['COMPLETED', 'RECEIVED'].includes(targetStatus) && !['COMPLETED', 'RECEIVED'].includes(currentStatus)) {
        await tx.wallet.update({
          where: { userId: payout.vendorId },
          data: { totalWithdrawnMad: { increment: payout.amountMad } }
        });
      }
      // Moving FROM a completed state to a non-completed one
      if (['COMPLETED', 'RECEIVED'].includes(currentStatus) && !['COMPLETED', 'RECEIVED'].includes(targetStatus)) {
        await tx.wallet.update({
          where: { userId: payout.vendorId },
          data: { totalWithdrawnMad: { decrement: payout.amountMad } }
        });
      }

      return tx.payoutRequest.update({
        where: { id: payout.id },
        data: {
          status: targetStatus,
          processedAt: ['COMPLETED', 'RECEIVED', 'REJECTED'].includes(targetStatus) ? new Date() : null
        }
      });
    });

    res.json({ status: 'success', message: `Status mis à jour vers ${targetStatus}`, data: updatedPayout });
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
        where: { 
          id: { in: ids.map(id => Number(id)) }, 
          status: { in: ['PENDING', 'RECEIVED'] } 
        },
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

router.patch(
  '/bulk-status',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { ids, status: targetStatus } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppException(400, 'Invalid payout IDs');
    }

    const results = await prisma.$transaction(async (tx) => {
      const payouts = await tx.payoutRequest.findMany({
        where: { id: { in: ids.map(id => Number(id)) } },
      });

      const updatedPayouts = [];
      for (const payout of payouts) {
        if (payout.status === targetStatus) continue;

        const currentStatus = payout.status;
        const wallet = await tx.wallet.findUnique({ where: { userId: payout.vendorId } });
        if (!wallet) continue;

        // --- 1. HANDLE BALANCE REVERSAL/DEDUCTION ---
        if (currentStatus === 'REJECTED' && ['PENDING', 'COMPLETED', 'RECEIVED'].includes(targetStatus)) {
          const updatedWallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: { balanceMad: { decrement: payout.amountMad } }
          });
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'WITHDRAWAL_RE_REQUEST',
              amountMad: -payout.amountMad,
              balanceAfterMad: updatedWallet.balanceMad,
              description: `Re-débit pour changement de statut en masse du retrait #${payout.id} (${currentStatus} -> ${targetStatus})`
            }
          });
        }
        
        if (targetStatus === 'REJECTED' && ['PENDING', 'COMPLETED', 'RECEIVED'].includes(currentStatus)) {
          const updatedWallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: { balanceMad: { increment: payout.amountMad } }
          });
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'WITHDRAWAL_REFUND',
              amountMad: payout.amountMad,
              balanceAfterMad: updatedWallet.balanceMad,
              description: `Remboursement pour changement de statut en masse du retrait #${payout.id} (${currentStatus} -> ${targetStatus})`
            }
          });
        }

        // --- 2. HANDLE TOTAL WITHDRAWN STATISTICS ---
        if (['COMPLETED', 'RECEIVED'].includes(targetStatus) && !['COMPLETED', 'RECEIVED'].includes(currentStatus)) {
          await tx.wallet.update({
            where: { userId: payout.vendorId },
            data: { totalWithdrawnMad: { increment: payout.amountMad } }
          });
        }
        if (['COMPLETED', 'RECEIVED'].includes(currentStatus) && !['COMPLETED', 'RECEIVED'].includes(targetStatus)) {
          await tx.wallet.update({
            where: { userId: payout.vendorId },
            data: { totalWithdrawnMad: { decrement: payout.amountMad } }
          });
        }

        const updated = await tx.payoutRequest.update({
          where: { id: payout.id },
          data: {
            status: targetStatus,
            processedAt: ['COMPLETED', 'RECEIVED', 'REJECTED'].includes(targetStatus) ? new Date() : null
          }
        });
        updatedPayouts.push(updated);
      }
      return updatedPayouts;
    });

    res.json({
      status: 'success',
      message: `${results.length} retraits mis à jour vers ${targetStatus}`,
      data: results
    });
  })
);

router.get(
  '/:id/history',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    // 1. Get current payout
    const currentPayout = await prisma.payoutRequest.findUnique({
      where: { id: Number(id) }
    });
    
    if (!currentPayout) throw new AppException(404, 'Payout not found');
    
    // 2. Find previous payout (completed or pending)
    const previousPayout = await prisma.payoutRequest.findFirst({
      where: {
        vendorId: currentPayout.vendorId,
        createdAt: { lt: currentPayout.createdAt },
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const startDate = previousPayout ? previousPayout.createdAt : new Date(0);
    const endDate = new Date(currentPayout.createdAt.getTime() + 5000); // Buffer to include the transaction itself
    
    // 3. Fetch History Components
    const [invoices, payouts, allTransactions] = await Promise.all([
      // Factures (Earnings from leads)
      prisma.invoice.findMany({
        where: {
          userId: currentPayout.vendorId,
          createdAt: { gte: startDate, lte: endDate }
        },
        orderBy: { createdAt: 'asc' }
      }),
      // Other Payouts in this period
      prisma.payoutRequest.findMany({
        where: {
          vendorId: currentPayout.vendorId,
          createdAt: { gte: startDate, lte: endDate },
          id: { not: currentPayout.id }
        },
        orderBy: { createdAt: 'asc' }
      }),
      // Wallet Transactions (To get balance info)
      prisma.walletTransaction.findMany({
        where: {
          wallet: { userId: currentPayout.vendorId },
          createdAt: { gte: startDate, lte: endDate },
        },
        orderBy: { createdAt: 'asc' }
      })
    ]);
    
    // 4. Merge and Enrich with Balance Info
    const history = [
      ...invoices.map(inv => {
        const matchingTx = allTransactions.find(t => 
          t.type === 'INVOICE_PAYMENT' && 
          t.description?.includes(inv.invoiceNumber)
        );
        return { 
          ...inv, 
          historyType: 'INVOICE', 
          balanceAfter: matchingTx?.balanceAfterMad 
        };
      }),
      ...[currentPayout, ...payouts].map(p => {
        const matchingTx = allTransactions.find(t => 
          (t.type === 'WITHDRAWAL_REQUEST' || t.type === 'WITHDRAWAL_REFUND' || t.type === 'WITHDRAWAL_REJECTED' || t.type === 'WITHDRAWAL_RE_REQUEST') && 
          t.description?.includes(`#${p.id}`)
        );
        return { 
          ...p, 
          historyType: 'PAYOUT', 
          balanceAfter: matchingTx?.balanceAfterMad 
        };
      }),
      ...allTransactions
        .filter(t => !['INVOICE_PAYMENT', 'WITHDRAWAL_REQUEST', 'WITHDRAWAL_REFUND', 'WITHDRAWAL_REJECTED', 'WITHDRAWAL_RE_REQUEST'].includes(t.type))
        .map(t => ({ 
          ...t, 
          historyType: 'TRANSACTION', 
          balanceAfter: t.balanceAfterMad 
        }))
    ].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    res.json({
      status: 'success',
      data: {
        period: { 
          start: startDate, 
          end: endDate,
          isFirstPayout: !previousPayout
        },
        history
      }
    });
  })
);

export default router;
