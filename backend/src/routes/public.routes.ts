import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.get(
  '/cities',
  asyncHandler(async (_req: Request, res: Response) => {
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
  asyncHandler(async (_req: Request, res: Response) => {
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
  asyncHandler(async (_req: Request, res: Response) => {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        categories: true,
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
  asyncHandler(async (_req: Request, res: Response) => {
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
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
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
      if (categoryRecord) where.categories = { some: { id: categoryRecord.id } };
    }

    if (search) {
      where.OR = [
        { nameAr: { contains: search as string } },
        { nameFr: { contains: search as string } },
        { sku: { contains: search as string } },
      ];
    }

    const [products, total, userInventory, userClaims, userRequests] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          categories: true,
          images: { orderBy: { sortOrder: 'asc' } },
          owner: { include: { profile: true, brands: true } }
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
      req.user ? prisma.productInventory.findMany({
        where: { userId: req.user.id }
      }) : Promise.resolve([]),
      req.user ? prisma.affiliateClaim.findMany({
        where: { userId: req.user.id, status: 'ACTIVE' }
      }) : Promise.resolve([]),
      req.user ? prisma.supportRequest.findMany({
        where: { userId: req.user.id, status: { in: ['OPEN', 'IN_PROGRESS'] } }
      }) : Promise.resolve([])
    ]);

    const inventoryProductIds = new Set(userInventory.map(i => i.productId));
    const claimProductIds = new Set(userClaims.map(c => c.productId));
    const requestProductIds = new Set((userRequests as any[]).filter(r => r.productId !== null).map(r => r.productId as number));

    res.json({
      status: 'success',
      data: {
        products: products.map(p => ({
          ...p,
          userStatus: {
            isBought: inventoryProductIds.has(p.id),
            isClaimed: claimProductIds.has(p.id),
            isPending: requestProductIds.has(p.id)
          }
        })),
        total,
        page: Number(page),
        limit: Number(limit)
      },
    });
  })
);

router.get(
  '/marketplace/stats',
  asyncHandler(async (_req: Request, res: Response) => {
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

router.post(
  '/leads',
  asyncHandler(async (req: Request, res: Response) => {
    const { referralCode, fullName, phone, city, address } = req.body;

    if (!referralCode || !fullName || !phone) {
      throw new AppException(400, 'referralCode, fullName, and phone are required');
    }

    const link = await prisma.referralLink.findUnique({
      where: { code: referralCode },
      include: { product: true }
    });

    if (!link || !link.isActive || !link.product.isActive) {
      throw new AppException(404, 'Referral link or product not found or inactive');
    }

    // NEW: Check for an APPROVED claim for this influencer and product
    const claim = await prisma.affiliateClaim.findUnique({
      where: {
        userId_productId: {
          userId: link.influencerId,
          productId: link.productId
        }
      }
    });

    if (!claim || claim.status !== 'APPROVED') {
      throw new AppException(403, 'The influencer has not been approved to promote this product');
    }

    let vendorId = link.product.ownerId;

    // If product has no owner, attribute it to the platform admin
    if (!vendorId) {
      const admin = await prisma.user.findFirst({
        where: { role: { name: 'SUPER_ADMIN' } }
      });
      vendorId = admin?.id || null;
    }

    if (!vendorId) {
      throw new AppException(500, 'Product has no owner (vendor) assigned and no fallback admin found');
    }

    // Create the lead for the vendor
    const lead = await prisma.lead.create({
      data: {
        vendorId,
        referralLinkId: link.id,
        fullName,
        phone,
        city,
        address,
        notes: `Generated from influencer link: ${referralCode} for product: ${link.product.sku}`
      }
    });

    // We can increment clicks or conversions. The influencer UI mocks leads from clicks * 0.3.
    // So incrementing clicks when the form is viewed/submitted works for now.
    await prisma.referralLink.update({
      where: { id: link.id },
      data: { clicks: { increment: 1 } }
    });

    res.status(201).json({
      status: 'success',
      data: { leadId: lead.id }
    });
  })
);

export default router;
