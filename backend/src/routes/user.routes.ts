import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

router.get(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, role, status, search } = req.query;

    const where: any = {};

    if (role) {
      const roleRecord = await prisma.role.findUnique({
        where: { name: role as string },
      });
      if (roleRecord) where.roleId = roleRecord.id;
    }

    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (status === 'pending_kyc') where.kycStatus = 'PENDING';

    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
        { profile: { fullName: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          profile: true,
          role: true,
          wallet: true,
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: {
        users: users.map((u) => ({
          id: u.id,
          uuid: u.uuid,
          email: u.email,
          phone: u.phone,
          fullName: u.profile?.fullName,
          role: u.role.name,
          isActive: u.isActive,
          kycStatus: u.kycStatus,
          walletBalance: u.wallet?.balanceMad || 0,
          createdAt: u.createdAt,
        })), pagination: {
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
  authorize('SUPER_ADMIN'),
  [
    body('email').optional().isEmail(),
    body('phone').optional().isString(),
    body('password').notEmpty().isLength({ min: 6 }),
    body('fullName').notEmpty().isString(),
    body('role').notEmpty().isString(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed', errors.array());
    }

    const { email, phone, password, fullName, role } = req.body;

    if (!email && !phone) {
      throw new AppException(400, 'Email or phone must be provided');
    }

    const roleRecord = await prisma.role.findUnique({
      where: { name: role },
    });

    if (!roleRecord) {
      throw new AppException(400, 'Invalid role');
    }

    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.default.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        phone,
        password: hashedPassword,
        roleId: roleRecord.id,
        isActive: true, // Auto-activate admin-created accounts
        profile: {
          create: {
            fullName,
          },
        },
        wallet: {
          create: {
            balanceMad: 0,
          },
        },
      },
      include: {
        profile: true,
        role: true,
      },
    });

    res.status(201).json({
      status: 'success',
      message: 'User created successfully',
      data: {
        user: {
          uuid: user.uuid,
          email: user.email,
          phone: user.phone,
          fullName: user.profile?.fullName,
          role: user.role.name,
        }
      },
    });
  })
);

router.patch(
  '/:uuid/admin-edit',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req, res) => {
    const { uuid } = req.params;
    const { fullName, email, phone, role } = req.body;

    const user = await prisma.user.findUnique({
      where: { uuid },
      include: { role: true },
    });

    if (!user) {
      throw new AppException(404, 'User not found');
    }

    let roleId = user.roleId;
    if (role && role !== user.role.name) {
      const roleRecord = await prisma.role.findUnique({ where: { name: role } });
      if (!roleRecord) throw new AppException(400, 'Invalid role');
      roleId = roleRecord.id;
    }

    const updatedUser = await prisma.user.update({
      where: { uuid },
      data: {
        email: email || user.email,
        phone: phone || user.phone,
        roleId,
        profile: {
          update: {
            fullName: fullName || undefined,
          },
        },
      },
      include: {
        profile: true,
        role: true,
      },
    });

    res.json({
      status: 'success',
      message: 'User updated successfully',
      data: {
        user: {
          uuid: updatedUser.uuid,
          email: updatedUser.email,
          phone: updatedUser.phone,
          fullName: updatedUser.profile?.fullName,
          role: updatedUser.role.name,
        }
      },
    });
  })
);

router.get(
  '/:uuid',
  authenticate,
  asyncHandler(async (req, res) => {
    const { uuid } = req.params;

    const isAdmin = ['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(req.user!.roleName);
    const isOwnProfile = req.user!.uuid === uuid;

    if (!isAdmin && !isOwnProfile) {
      throw new AppException(403, 'Access denied');
    }

    const user = await prisma.user.findUnique({
      where: { uuid },
      include: {
        profile: true,
        role: true,
        wallet: true,
        kycDocuments: true,
        brands: {
          include: {
            bankAccounts: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppException(404, 'User not found');
    }

    res.json({
      status: 'success',
      data: {
        user: {
          uuid: user.uuid,
          email: user.email,
          phone: user.phone,
          fullName: user.profile?.fullName,
          avatarUrl: user.profile?.avatarUrl,
          city: user.profile?.city,
          address: user.profile?.address,
          language: user.profile?.language,
          metadata: user.profile?.metadata,
          role: user.role.name,
          isActive: user.isActive,
          kycStatus: user.kycStatus,
          emailVerifiedAt: user.emailVerifiedAt,
          phoneVerifiedAt: user.phoneVerifiedAt,
          lastLoginAt: user.lastLoginAt,
          wallet: user.wallet,
          kycDocuments: user.kycDocuments,
          brands: user.brands,
          createdAt: user.createdAt,
        },
      },
    });
  })
);

router.patch(
  '/:uuid',
  authenticate,
  asyncHandler(async (req, res) => {
    const { uuid } = req.params;

    if (req.user!.uuid !== uuid && !['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(req.user!.roleName)) {
      throw new AppException(403, 'Access denied');
    }

    const { fullName, city, address, language, avatarUrl, metadata } = req.body;

    const user = await prisma.user.findUnique({
      where: { uuid },
    });

    if (!user) {
      throw new AppException(404, 'User not found');
    }

    await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        fullName,
        city,
        address,
        language: language || 'fr',
        avatarUrl,
        metadata,
      },
      update: {
        fullName,
        city,
        address,
        language,
        avatarUrl,
        metadata,
      },
    });

    const updatedUser = await prisma.user.findUnique({
      where: { uuid },
      include: { profile: true },
    });

    res.json({
      status: 'success',
      message: 'Profile updated successfully',
      data: {
        user: {
          uuid: updatedUser!.uuid,
          ...updatedUser!.profile,
        },
      },
    });
  })
);

router.patch(
  '/:uuid/activate',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const { uuid } = req.params;

    const user = await prisma.user.update({
      where: { uuid },
      data: { isActive: true },
    });

    res.json({
      status: 'success',
      message: 'User activated successfully',
      data: { uuid: user.uuid, isActive: user.isActive },
    });
  })
);

router.patch(
  '/:uuid/deactivate',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const { uuid } = req.params;

    const user = await prisma.user.update({
      where: { uuid },
      data: { isActive: false },
    });

    res.json({
      status: 'success',
      message: 'User deactivated successfully',
      data: { uuid: user.uuid, isActive: user.isActive },
    });
  })
);

router.post(
  '/:uuid/reset-2fa',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const { uuid } = req.params;

    const user = await prisma.user.update({
      where: { uuid },
      data: {
        isTwoFactorEnabled: false,
        twoFactorSecret: null,
      } as any,
    });

    res.json({
      status: 'success',
      message: '2FA has been disabled for this user.',
    });
  })
);

router.post(
  '/:uuid/send-password-reset',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const { uuid } = req.params;

    const user = await prisma.user.findUnique({
      where: { uuid },
    });

    if (!user || (!user.email && !user.phone)) {
      throw new AppException(404, 'User not found or lacks contact info');
    }

    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await prisma.passwordReset.create({
      data: {
        email: user.email || user.phone || 'unknown',
        token: resetToken,
        expiresAt,
      },
    });

    // In a real application, you would send an email or SMS here
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV ONLY] Password reset link for ${user.email || user.phone}: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`);
    }

    res.json({
      status: 'success',
      message: 'Password reset link logic initiated (check console in Dev Mode).',
    });
  })
);

router.patch(
  '/:uuid/kyc-status',
  authenticate,
  authorize('SUPER_ADMIN', 'CONFIRMATION_AGENT'),
  asyncHandler(async (req, res) => {
    const { uuid } = req.params;
    const { status } = req.body;

    if (!['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(status)) {
      throw new AppException(400, 'Invalid KYC status');
    }

    const user = await prisma.user.update({
      where: { uuid },
      data: {
        kycStatus: status,
        ...(status === 'APPROVED' && { isActive: true }),
      },
    });

    res.json({
      status: 'success',
      message: 'KYC status updated successfully',
      data: { uuid: user.uuid, kycStatus: user.kycStatus },
    });
  })
);

export default router;
