import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, category, search, status, myProducts, visibility } = req.query;

    const where: any = { isActive: true };

    // Filter by visibility: REGULAR, AFFILIATE, or both
    const userRole = req.user?.roleName;
    if (visibility && visibility !== 'ALL') {
      where.visibility = visibility;
    } else if (!req.user || (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN' && userRole !== 'INFLUENCER')) {
      // Public/regular users see REGULAR products
      where.visibility = 'REGULAR';
    }

    if (myProducts === 'true' && req.user) {
      where.ownerId = req.user.id;
      if (status && status !== 'ALL') {
        where.status = status;
      }
    } else if (req.user?.roleName === 'SUPER_ADMIN' && status) {
      if (status !== 'ALL') {
        where.status = status;
      }
    } else {
      where.status = 'APPROVED';
    }

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
          images: {
            where: { isPrimary: true },
            take: 1,
          },
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: {
        products: products.map((p) => ({
          id: p.id,
          sku: p.sku,
          nameAr: p.nameAr,
          nameFr: p.nameFr,
          description: p.description,
          baseCostMad: p.baseCostMad,
          retailPriceMad: p.retailPriceMad,
          isCustomizable: p.isCustomizable,
          minProductionDays: p.minProductionDays,
          visibility: p.visibility,
          status: p.status,
          ownerId: p.ownerId,
          category: p.category,
          primaryImage: p.images[0]?.imageUrl,
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

router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const [product, inventory, claim, pendingRequest] = await Promise.all([
      prisma.product.findUnique({
        where: { id: Number(id) },
        include: {
          category: true,
          images: { orderBy: { sortOrder: 'asc' } },
        },
      }),
      req.user ? prisma.productInventory.findFirst({
        where: { userId: req.user.id, productId: Number(id) }
      }) : Promise.resolve(null),
      req.user ? prisma.affiliateClaim.findFirst({
        where: { userId: req.user.id, productId: Number(id), status: 'ACTIVE' }
      }) : Promise.resolve(null),
      req.user ? prisma.supportRequest.findFirst({
        where: {
          userId: req.user.id,
          productId: Number(id),
          status: { in: ['OPEN', 'IN_PROGRESS'] }
        }
      }) : Promise.resolve(null)
    ]);

    if (!product) {
      throw new AppException(404, 'Product not found');
    }

    res.json({
      status: 'success',
      data: {
        product,
        userStatus: {
          isBought: !!inventory,
          isClaimed: !!claim,
          isPending: !!pendingRequest,
          pendingRequestId: pendingRequest?.id
        }
      },
    });
  })
);

router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'GROSSELLER'),
  [
    body('sku').notEmpty().trim(),
    body('nameAr').notEmpty().trim(),
    body('nameFr').notEmpty().trim(),
    body('categoryId').isInt(),
    body('baseCostMad').isFloat({ min: 0 }),
    body('retailPriceMad').isFloat({ min: 0 }),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation Errors:', errors.array());
      throw new AppException(400, 'Validation failed', errors.array());
    }

    const { sku, nameAr, nameFr, nameEn, description, categoryId, baseCostMad, retailPriceMad, isCustomizable, minProductionDays, stockQuantity, imageUrl, isActive, visibility, status } = req.body;

    const existingProduct = await prisma.product.findUnique({
      where: { sku },
    });

    if (existingProduct) {
      throw new AppException(409, 'Product with this SKU already exists');
    }

    const isGrosseller = req.user!.roleName === 'GROSSELLER';
    const finalStatus = isGrosseller ? 'PENDING' : (status ?? 'APPROVED');

    const finalOwnerId = (req.user!.roleName === 'SUPER_ADMIN' || req.user!.roleName === 'ADMIN') && req.body.ownerId
      ? Number(req.body.ownerId)
      : Number(req.user!.id);

    const product = await prisma.product.create({
      data: {
        sku,
        nameAr,
        nameFr,
        nameEn,
        description,
        categoryId: Number(categoryId),
        baseCostMad,
        retailPriceMad,
        isCustomizable: isCustomizable ?? true,
        minProductionDays: Number(minProductionDays ?? 3),
        stockQuantity: stockQuantity ? Number(stockQuantity) : 0,
        isActive: isActive ?? true,
        visibility: visibility ?? 'REGULAR',
        status: finalStatus,
        ownerId: finalOwnerId,
        ...(imageUrl ? {
          images: {
            create: [{ imageUrl, isPrimary: true, sortOrder: 0 }]
          }
        } : {})
      },
      include: { category: true, images: true },
    });

    res.status(201).json({
      status: 'success',
      message: 'Product created successfully',
      data: { product },
    });
  })
);

router.patch(
  '/:id/status',
  authenticate,
  authorize('SUPER_ADMIN'),
  [body('status').isIn(['APPROVED', 'REJECTED'])],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed');
    }

    const { id } = req.params;
    const { status } = req.body;

    const product = await prisma.product.update({
      where: { id: Number(id) },
      data: { status },
    });

    res.json({
      status: 'success',
      message: `Product ${status.toLowerCase()} successfully`,
      data: { product },
    });
  })
);

router.patch(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    const product = await prisma.product.update({
      where: { id: Number(id) },
      data: updateData,
    });

    res.json({
      status: 'success',
      message: 'Product updated successfully',
      data: { product },
    });
  })
);

router.delete(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    await prisma.product.delete({
      where: { id: Number(id) },
    });

    res.json({
      status: 'success',
      message: 'Product deleted successfully',
    });
  })
);

export default router;
