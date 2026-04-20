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
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN', 'HELPER'),
  asyncHandler(async (req, res) => {
    // If Helper, check impersonation permission
    if (req.user!.roleName === 'HELPER' && !req.user!.canImpersonate) {
        throw new AppException(403, "Vous n'avez pas la permission de consulter la liste des utilisateurs.");
    }
    const { page = 1, limit = 20, role, status, search } = req.query;

    const where: any = {};

    // If Helper, only show assigned users
    if (req.user!.roleName === 'HELPER') {
      const assignments = await (prisma as any).helperUserAssignment.findMany({
        where: { helperId: req.user!.id }
      });
      const assignedUserIds = assignments.map((a: any) => a.targetUserId);
      where.id = { in: assignedUserIds };
    }

    if (role) {
      where.role = { name: role as string };
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
          canImpersonate: u.canImpersonate,
          autoAssignInfluencers: u.autoAssignInfluencers,
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
    body('email').optional().isEmail().normalizeEmail(),
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

    // Auto-assign global agents if this is an influencer
    if (role === 'INFLUENCER') {
      const globalAgents = await prisma.user.findMany({
        where: {
          role: { name: 'CALL_CENTER_AGENT' },
          autoAssignInfluencers: true
        }
      });

      if (globalAgents.length > 0) {
        await prisma.agentInfluencerAssignment.createMany({
          data: globalAgents.map(agent => ({
            agentId: agent.id,
            influencerId: user.id
          }))
        });
      }
    }

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
    const { fullName, email, phone, role, canImpersonate } = req.body;

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
        canImpersonate: typeof canImpersonate === 'boolean' ? canImpersonate : user.canImpersonate,
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
          canImpersonate: updatedUser.canImpersonate,
          autoAssignInfluencers: updatedUser.autoAssignInfluencers,
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
        bankAccounts: true,
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
          bankAccounts: user.bankAccounts,
          autoAssignInfluencers: user.autoAssignInfluencers,
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

    const { 
      fullName, city, address, language, avatarUrl, metadata, 
      ribAccount, bankName, payoutMethod, iceNumber,
      instagramUsername, tiktokUsername, facebookUsername, 
      xUsername, youtubeUsername, snapchatUsername 
    } = req.body;

    const user = await prisma.user.findUnique({
      where: { uuid },
      include: { profile: true }
    });

    if (!user) {
      throw new AppException(404, 'User not found');
    }

    // Merge payoutMethod into metadata if provided
    let updatedMetadata = metadata || user.profile?.metadata || {};
    if (payoutMethod) {
      if (typeof updatedMetadata === 'string') {
        try {
          updatedMetadata = JSON.parse(updatedMetadata);
        } catch (e) {
          updatedMetadata = {};
        }
      }
      updatedMetadata = { ...(updatedMetadata as any), payoutMethod };
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
        metadata: updatedMetadata,
        instagramUsername,
        tiktokUsername,
        facebookUsername,
        xUsername,
        youtubeUsername,
        snapchatUsername
      },
      update: {
        fullName,
        city,
        address,
        language,
        avatarUrl,
        metadata: updatedMetadata,
        instagramUsername,
        tiktokUsername,
        facebookUsername,
        xUsername,
        youtubeUsername,
        snapchatUsername
      },
    });

    // Handle bank account updates
    if (ribAccount || bankName || iceNumber) {
      const isAdmin = ['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(req.user!.roleName);
      
      const existingBank = await prisma.userBankAccount.findFirst({
        where: { userId: user.id, isDefault: true }
      });

      if (existingBank) {
        // Security Lock: Prevent non-admins from changing APPROVED details
        if (existingBank.status === 'APPROVED' && !isAdmin) {
          const isAttemptingChange = 
            (ribAccount && ribAccount !== existingBank.ribAccount) ||
            (bankName && bankName !== existingBank.bankName) ||
            (iceNumber !== undefined && iceNumber !== existingBank.iceNumber);
          
          if (isAttemptingChange) {
            throw new AppException(403, "Vos coordonnées bancaires ont déjà été approuvées. Veuillez contacter un administrateur pour toute modification.");
          }
        }

        await prisma.userBankAccount.update({
          where: { id: existingBank.id },
          data: {
            ribAccount: ribAccount || existingBank.ribAccount,
            bankName: bankName || existingBank.bankName,
            iceNumber: iceNumber !== undefined ? iceNumber : existingBank.iceNumber,
            // Only reset status if RIB changed and user is NOT admin
            status: (ribAccount && ribAccount !== existingBank.ribAccount && !isAdmin) ? 'PENDING' : existingBank.status
          }
        });
      } else {
        await prisma.userBankAccount.create({
          data: {
            userId: user.id,
            ribAccount: ribAccount || '',
            bankName: bankName || '',
            iceNumber: iceNumber || '',
            isDefault: true,
            status: 'PENDING'
          }
        });
      }
    }


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
