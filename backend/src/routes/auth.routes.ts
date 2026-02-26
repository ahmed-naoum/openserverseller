import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

const generateTokens = (userId: string) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );

  return { accessToken, refreshToken };
};

const generateOTP = (): string => {
  const length = parseInt(process.env.OTP_LENGTH || '6', 10);
  return Math.floor(Math.pow(10, length - 1) + Math.random() * 9 * Math.pow(10, length - 1)).toString();
};

router.post(
  '/register',
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().matches(/^\+212[0-9]{9}$/),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('fullName').trim().isLength({ min: 2 }),
    body('role').optional().isIn(['VENDOR', 'CALL_CENTER_AGENT']),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed');
    }

    const { email, phone, password, fullName, role = 'VENDOR' } = req.body;

    if (!email && !phone) {
      throw new AppException(400, 'Email or phone is required');
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    if (existingUser) {
      throw new AppException(409, 'User already exists with this email or phone');
    }

    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10));

    const userRole = await prisma.role.findUnique({
      where: { name: role },
    });

    if (!userRole) {
      throw new AppException(400, 'Invalid role specified');
    }

    const user = await prisma.user.create({
      data: {
        email,
        phone,
        password: hashedPassword,
        roleId: userRole.id,
        kycStatus: 'PENDING',
        isActive: false,
        profile: {
          create: {
            fullName,
            language: 'fr',
          },
        },
      },
      include: {
        profile: true,
        role: true,
      },
    });

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10) * 60 * 1000);

    console.log(`[DEV] OTP for ${email || phone}: ${otp}`);

    const { accessToken, refreshToken } = generateTokens(user.uuid);

    res.status(201).json({
      status: 'success',
      message: 'Registration successful. Please verify your email or phone.',
      data: {
        user: {
          uuid: user.uuid,
          email: user.email,
          phone: user.phone,
          fullName: user.profile?.fullName,
          role: user.role.name,
          kycStatus: user.kycStatus,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
        requiresVerification: true,
      },
    });
  })
);

router.post(
  '/login',
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().matches(/^\+212[0-9]{9}$/),
    body('password').notEmpty(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed');
    }

    const { email, phone, password } = req.body;

    if (!email && !phone) {
      throw new AppException(400, 'Email or phone is required');
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
      include: {
        profile: true,
        role: true,
      },
    });

    if (!user) {
      throw new AppException(401, 'Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new AppException(401, 'Invalid credentials');
    }

    if (!user.isActive) {
      throw new AppException(403, 'Account is not activated. Please complete verification.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { accessToken, refreshToken } = generateTokens(user.uuid);

    res.json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          uuid: user.uuid,
          email: user.email,
          phone: user.phone,
          fullName: user.profile?.fullName,
          role: user.role.name,
          kycStatus: user.kycStatus,
          avatarUrl: user.profile?.avatarUrl,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  })
);

router.post(
  '/verify-otp',
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().matches(/^\+212[0-9]{9}$/),
    body('otp').isLength({ min: 6, max: 6 }),
  ],
  asyncHandler(async (req, res) => {
    const { email, phone, otp } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    if (!user) {
      throw new AppException(404, 'User not found');
    }

    console.log(`[DEV] Verifying OTP: ${otp} for ${email || phone}`);

    if (email) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
    } else if (phone) {
      await prisma.user.update({
        where: { id: user.id },
        data: { phoneVerifiedAt: new Date() },
      });
    }

    res.json({
      status: 'success',
      message: 'Verification successful',
    });
  })
);

router.post(
  '/resend-otp',
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().matches(/^\+212[0-9]{9}$/),
  ],
  asyncHandler(async (req, res) => {
    const { email, phone } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    if (!user) {
      throw new AppException(404, 'User not found');
    }

    const otp = generateOTP();
    console.log(`[DEV] New OTP for ${email || phone}: ${otp}`);

    res.json({
      status: 'success',
      message: 'OTP sent successfully',
    });
  })
);

router.post(
  '/forgot-password',
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().matches(/^\+212[0-9]{9}$/),
  ],
  asyncHandler(async (req, res) => {
    const { email, phone } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    if (!user) {
      return res.json({
        status: 'success',
        message: 'If an account exists, a reset code will be sent',
      });
    }

    const otp = generateOTP();
    console.log(`[DEV] Password reset OTP for ${email || phone}: ${otp}`);

    res.json({
      status: 'success',
      message: 'If an account exists, a reset code will be sent',
    });
  })
);

router.post(
  '/reset-password',
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().matches(/^\+212[0-9]{9}$/),
    body('otp').isLength({ min: 6, max: 6 }),
    body('password').isLength({ min: 8 }),
  ],
  asyncHandler(async (req, res) => {
    const { email, phone, otp, password } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    if (!user) {
      throw new AppException(404, 'User not found');
    }

    console.log(`[DEV] Reset password OTP: ${otp}`);

    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10));

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    res.json({
      status: 'success',
      message: 'Password reset successfully',
    });
  })
);

router.post(
  '/kyc',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { documents } = req.body;

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      throw new AppException(400, 'At least one document is required');
    }

    await prisma.$transaction(async (tx) => {
      for (const doc of documents) {
        await tx.kycDocument.create({
          data: {
            userId,
            documentType: doc.type,
            documentUrl: doc.url,
            status: 'PENDING',
          },
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { kycStatus: 'UNDER_REVIEW' },
      });
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, role: true },
    });

    res.json({
      status: 'success',
      message: 'KYC documents submitted successfully',
      data: {
        user: {
          uuid: updatedUser!.uuid,
          kycStatus: updatedUser!.kycStatus,
        },
      },
    });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        profile: true,
        role: true,
        wallet: true,
        brands: {
          where: { status: 'APPROVED' },
          take: 1,
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
          role: user.role.name,
          kycStatus: user.kycStatus,
          isActive: user.isActive,
          emailVerified: !!user.emailVerifiedAt,
          phoneVerified: !!user.phoneVerifiedAt,
          wallet: user.wallet ? {
            balanceMad: user.wallet.balanceMad,
            totalEarnedMad: user.wallet.totalEarnedMad,
            totalWithdrawnMad: user.wallet.totalWithdrawnMad,
          } : null,
          brand: user.brands[0] || null,
        },
      },
    });
  })
);

router.post(
  '/refresh',
  [
    body('refreshToken').notEmpty(),
  ],
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as {
        userId: string;
        type: string;
      };

      if (decoded.type !== 'refresh') {
        throw new AppException(401, 'Invalid refresh token');
      }

      const user = await prisma.user.findUnique({
        where: { uuid: decoded.userId },
      });

      if (!user) {
        throw new AppException(401, 'User not found');
      }

      const tokens = generateTokens(user.uuid);

      res.json({
        status: 'success',
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      });
    } catch {
      throw new AppException(401, 'Invalid or expired refresh token');
    }
  })
);

router.post(
  '/logout',
  authenticate,
  asyncHandler(async (_req, res) => {
    res.json({
      status: 'success',
      message: 'Logged out successfully',
    });
  })
);

export default router;
