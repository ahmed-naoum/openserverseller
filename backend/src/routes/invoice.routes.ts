import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

// Get invoice stats for the authenticated user
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const allInvoices = await prisma.invoice.findMany({
      where: { userId },
      include: { 
        leads: {
          select: {
            order: {
              select: { totalAmountMad: true }
            }
          }
        }
      }
    });

    let totalEarningsGross = 0;
    let totalNetInvoiced = 0;
    let totalDeductions = 0;
    let totalColis = 0;
    let validInvoicesCount = 0;

    allInvoices.forEach(inv => {
      if (inv.leads.length === 0) return; // Skip empty invoices

      validInvoicesCount++;
      totalColis += inv.leads.length;
      totalNetInvoiced += inv.totalAmountMad;

      if (!inv.invoiceNumber.startsWith('RET-')) {
        // Delivery invoice: sum the gross order amounts
        const invoiceGross = inv.leads.reduce((sum, l) => sum + (Number(l.order?.totalAmountMad) || 0), 0);
        totalEarningsGross += invoiceGross;
      } else {
        // Return invoice: these are deductions
        totalDeductions += Math.abs(inv.totalAmountMad);
      }
    });

    // Get manual debits (fees/adjustments)
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    let totalManualDebits = 0;
    if (wallet) {
      const debits = await prisma.walletTransaction.aggregate({
        where: {
          walletId: wallet.id,
          type: 'DEBIT',
          // Optionally exclude payout transactions if they shouldn't count as "fees"
          // but usually all debits that aren't payouts are fees
          NOT: {
            description: { contains: 'Retrait' }
          }
        },
        _sum: { amountMad: true }
      });
      totalManualDebits = Math.abs(debits._sum.amountMad || 0);
    }

    res.json({
      status: 'success',
      data: {
        totalEarnings: totalEarningsGross,
        totalDeductions: totalDeductions + totalManualDebits,
        manualFees: totalManualDebits,
        netBalance: totalNetInvoiced - totalManualDebits,
        totalColis,
        totalFactures: validInvoicesCount
      }
    });
  })
);

// Get all invoices for the authenticated user
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { page = 1, limit = 20 } = req.query;

    const where = { 
      userId,
      leads: { some: {} } // Filter out invoices with 0 colis
    };

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          _count: {
            select: { leads: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit)
      }),
      prisma.invoice.count({ where })
    ]);

    res.json({
      status: 'success',
      data: {
        invoices: invoices.map(inv => ({
          ...inv,
          leadsCount: inv._count.leads
        })),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        }
      }
    });
  })
);

// Get specific invoice details for the user
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const invoiceId = Number(req.params.id);

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
      include: {
        user: {
          include: { profile: true }
        },
        leads: {
          include: {
            order: {
              include: { items: { include: { product: true } } }
            },
            referralLink: {
              include: { product: true }
            }
          }
        }
      }
    });

    if (!invoice) {
      throw new AppException(404, 'Facture introuvable');
    }

    res.json({
      status: 'success',
      data: invoice
    });
  })
);

export default router;
