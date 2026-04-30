import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

// Get all invoices for the authenticated user
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { page = 1, limit = 20 } = req.query;

    const where = { userId };

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
