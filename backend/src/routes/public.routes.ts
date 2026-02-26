import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

router.get(
  '/cities',
  asyncHandler(async (req, res) => {
    const cities = await prisma.moroccanCity.findMany({
      orderBy: [{ isMajor: 'desc' }, { nameFr: 'asc' }],
    });

    res.json({
      status: 'success',
      data: { cities },
    });
  })
);

router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { nameFr: 'asc' },
    });

    res.json({
      status: 'success',
      data: { categories },
    });
  })
);

router.get(
  '/products/featured',
  asyncHandler(async (req, res) => {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: true,
        images: { where: { isPrimary: true }, take: 1 },
      },
      take: 12,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      status: 'success',
      data: { products },
    });
  })
);

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const [vendorsCount, productsCount, ordersCount] = await Promise.all([
      prisma.user.count({ where: { role: { name: 'VENDOR' }, isActive: true } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
    ]);

    res.json({
      status: 'success',
      data: {
        stats: {
          vendors: vendorsCount,
          products: productsCount,
          orders: ordersCount,
        },
      },
    });
  })
);

export default router;
