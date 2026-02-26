import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

router.get(
  '/',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const couriers = await prisma.courier.findMany({
      include: {
        _count: { select: { shipments: true } },
      },
    });

    res.json({
      status: 'success',
      data: { couriers },
    });
  })
);

router.get(
  '/shipments',
  authenticate,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, trackingNumber } = req.query;

    const where: any = {};

    if (status) where.status = status;
    if (trackingNumber) where.trackingNumber = { contains: trackingNumber as string };

    if (req.user!.roleName === 'VENDOR') {
      where.order = { vendorId: req.user!.id };
    }

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        include: {
          order: {
            include: { brand: true },
          },
          courier: true,
          trackingEvents: { orderBy: { eventTime: 'desc' }, take: 5 },
          deliveryProof: true,
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.shipment.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: {
        shipments,
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
