import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    const isVendor = req.user!.roleName === 'VENDOR';

    const where: any = {};

    if (isVendor) {
      where.vendorId = req.user!.id;
    }

    if (status) {
      where.status = status;
    }

    const [brands, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        include: {
          vendor: {
            include: { profile: true },
          },
          bankAccounts: true,
          _count: {
            select: {
              leads: true,
              orders: true,
            },
          },
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.brand.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: {
        brands: brands.map((b) => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          logoUrl: b.logoUrl,
          primaryColor: b.primaryColor,
          secondaryColor: b.secondaryColor,
          slogan: b.slogan,
          description: b.description,
          designSettings: b.designSettings,
          isApproved: b.isApproved,
          status: b.status,
          approvedAt: b.approvedAt,
          vendor: {
            uuid: b.vendor.uuid,
            fullName: b.vendor.profile?.fullName,
            email: b.vendor.email,
          },
          bankAccounts: b.bankAccounts,
          stats: {
            leads: (b as any)._count.leads,
            orders: (b as any)._count.orders,
          },
          createdAt: b.createdAt,
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
  '/:slug',
  authenticate,
  asyncHandler(async (req, res) => {
    const { slug } = req.params;

    const brand = await prisma.brand.findUnique({
      where: { slug },
      include: {
        vendor: {
          include: { profile: true },
        },
        bankAccounts: true,
      },
    });

    if (!brand) {
      throw new AppException(404, 'Brand not found');
    }

    const isVendor = req.user!.roleName === 'VENDOR';
    if (isVendor && brand.vendorId !== req.user!.id) {
      throw new AppException(403, 'Access denied');
    }

    res.json({
      status: 'success',
      data: { brand },
    });
  })
);

router.post(
  '/',
  authenticate,
  authorize('VENDOR'),
  [
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('slogan').optional().trim().isLength({ max: 200 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('primaryColor').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('secondaryColor').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('logoUrl').optional().isURL(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed');
    }

    const { name, slogan, description, primaryColor, secondaryColor, logoUrl, designSettings } = req.body;

    const existingBrand = await prisma.brand.findFirst({
      where: {
        vendorId: req.user!.id,
        name,
      },
    });

    if (existingBrand) {
      throw new AppException(409, 'You already have a brand with this name');
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const brand = await prisma.brand.create({
      data: {
        vendorId: req.user!.id,
        name,
        slug: `${slug}-${Date.now().toString(36)}`,
        slogan,
        description,
        primaryColor: primaryColor || '#22c55e',
        secondaryColor: secondaryColor || '#16a34a',
        logoUrl,
        designSettings: designSettings || {},
        status: 'DRAFT',
      },
      include: {
        bankAccounts: true,
      },
    });

    res.status(201).json({
      status: 'success',
      message: 'Brand created successfully',
      data: { brand },
    });
  })
);

router.patch(
  '/:id',
  authenticate,
  authorize('VENDOR'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const brand = await prisma.brand.findFirst({
      where: {
        id: Number(id),
        vendorId: req.user!.id,
      },
    });

    if (!brand) {
      throw new AppException(404, 'Brand not found');
    }

    const { name, slogan, description, primaryColor, secondaryColor, logoUrl, designSettings } = req.body;

    const updatedBrand = await prisma.brand.update({
      where: { id: Number(id) },
      data: {
        ...(name && { name }),
        ...(slogan !== undefined && { slogan }),
        ...(description !== undefined && { description }),
        ...(primaryColor && { primaryColor }),
        ...(secondaryColor && { secondaryColor }),
        ...(logoUrl && { logoUrl }),
        ...(designSettings && { designSettings }),
      },
    });

    res.json({
      status: 'success',
      message: 'Brand updated successfully',
      data: { brand: updatedBrand },
    });
  })
);

router.post(
  '/:id/submit',
  authenticate,
  authorize('VENDOR'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const brand = await prisma.brand.findFirst({
      where: {
        id: Number(id),
        vendorId: req.user!.id,
      },
      include: { bankAccounts: true },
    });

    if (!brand) {
      throw new AppException(404, 'Brand not found');
    }

    if (!brand.logoUrl) {
      throw new AppException(400, 'Brand logo is required');
    }

    if (brand.bankAccounts.length === 0) {
      throw new AppException(400, 'At least one bank account is required');
    }

    const updatedBrand = await prisma.brand.update({
      where: { id: Number(id) },
      data: {
        status: 'PENDING_APPROVAL',
      },
    });

    res.json({
      status: 'success',
      message: 'Brand submitted for approval',
      data: { brand: updatedBrand },
    });
  })
);

router.post(
  '/:id/approve',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const brand = await prisma.brand.update({
      where: { id: Number(id) },
      data: {
        status: 'APPROVED',
        isApproved: true,
        approvedAt: new Date(),
      },
    });

    res.json({
      status: 'success',
      message: 'Brand approved successfully',
      data: { brand },
    });
  })
);

router.post(
  '/:id/reject',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const brand = await prisma.brand.update({
      where: { id: Number(id) },
      data: {
        status: 'REJECTED',
      },
    });

    res.json({
      status: 'success',
      message: 'Brand rejected',
      data: { brand },
    });
  })
);

router.post(
  '/:id/bank-account',
  authenticate,
  authorize('VENDOR'),
  [
    body('bankName').notEmpty(),
    body('ribAccount').matches(/^[0-9]{24}$/),
    body('iceNumber').optional().matches(/^[0-9]{9}$/),
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { bankName, ribAccount, iceNumber, isPrimary } = req.body;

    const brand = await prisma.brand.findFirst({
      where: {
        id: Number(id),
        vendorId: req.user!.id,
      },
    });

    if (!brand) {
      throw new AppException(404, 'Brand not found');
    }

    if (isPrimary) {
      await prisma.brandBankAccount.updateMany({
        where: { brandId: brand.id },
        data: { isPrimary: false },
      });
    }

    const bankAccount = await prisma.brandBankAccount.create({
      data: {
        brandId: brand.id,
        bankName,
        ribAccount,
        iceNumber,
        isPrimary: isPrimary || false,
      },
    });

    res.status(201).json({
      status: 'success',
      message: 'Bank account added successfully',
      data: { bankAccount },
    });
  })
);

router.delete(
  '/:brandId/bank-account/:accountId',
  authenticate,
  authorize('VENDOR'),
  asyncHandler(async (req, res) => {
    const { brandId, accountId } = req.params;

    const brand = await prisma.brand.findFirst({
      where: {
        id: Number(brandId),
        vendorId: req.user!.id,
      },
    });

    if (!brand) {
      throw new AppException(404, 'Brand not found');
    }

    await prisma.brandBankAccount.delete({
      where: {
        id: Number(accountId),
        brandId: brand.id,
      },
    });

    res.json({
      status: 'success',
      message: 'Bank account deleted successfully',
    });
  })
);

export default router;
