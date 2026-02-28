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

router.get(
  '/marketplace/products',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, category, search, view = 'REGULAR' } = req.query;

    const where: any = {
      isActive: true,
      status: 'APPROVED',
      visibility: view as string
    };

    if (category) {
      const categoryRecord = await prisma.category.findUnique({
        where: { slug: category as string },
      });
      if (categoryRecord) where.categoryId = categoryRecord.id;
    }

    if (search) {
      where.OR = [
        { nameAr: { contains: search as string } },
        { nameFr: { contains: search as string } },
        { sku: { contains: search as string } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          images: { where: { isPrimary: true }, take: 1 },
          owner: { include: { profile: true, brands: true } }
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: { products, total, page: Number(page), limit: Number(limit) },
    });
  })
);

router.get(
  '/marketplace/stats',
  asyncHandler(async (req, res) => {
    const [regularCount, affiliateCount] = await Promise.all([
      prisma.product.count({ where: { isActive: true, status: 'APPROVED', visibility: 'REGULAR' } }),
      prisma.product.count({ where: { isActive: true, status: 'APPROVED', visibility: 'AFFILIATE' } })
    ]);

    res.json({
      status: 'success',
      data: {
        regularProducts: regularCount,
        affiliateProducts: affiliateCount
      }
    });
  })
);

export default router;
