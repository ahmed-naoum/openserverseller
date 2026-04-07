import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { v4 as uuidv4 } from 'uuid';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { OAuth2Client } from 'google-auth-library';
import rateLimit from 'express-rate-limit';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'UNCONFIGURED_CLIENT_ID');

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 register requests per windowMs
  message: { status: 'error', message: 'Too many registration attempts from this IP, please try again after an hour' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 20 * 1000, // 20 seconds
  max: 30, // Limit each IP to 30 login requests per windowMs
  message: { status: 'error', message: 'Too many login attempts from this IP, please try again after 20 seconds' },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per windowMs
  message: { status: 'error', message: 'Too many password reset attempts, please try again after an hour' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();
const prisma = new PrismaClient();

const getGeoLocation = async (ip: string): Promise<string | null> => {
  try {
    // Skip local IPs for geolocation API
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return null;
    }
    const response = await fetch(`http://ip-api.com/json/${ip}`);
    if (response.ok) {
      const data = await response.json() as { status: string; city: string };
      if (data.status === 'success') {
        return data.city;
      }
    }
  } catch (error) {
    console.error('GeoLocation Error:', error);
  }
  return null;
};

const generateTokens = (userId: string) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET as string,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_SECRET as string,
    { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as any }
  );

  return { accessToken, refreshToken };
};

const generateTwoFactorToken = (userId: string) => {
  return jwt.sign(
    { userId, type: '2fa' },
    process.env.JWT_SECRET as string,
    { expiresIn: '5m' }
  );
};

const generateOTP = (): string => {
  const length = parseInt(process.env.OTP_LENGTH || '6', 10);
  return Math.floor(Math.pow(10, length - 1) + Math.random() * 9 * Math.pow(10, length - 1)).toString();
};

const normalizePhoneNumber = (phone: string): string | null => {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-]/g, '');
  if (/^\+212[5678][0-9]{8}$/.test(cleaned)) return cleaned;
  if (/^0[5678][0-9]{8}$/.test(cleaned)) return '+212' + cleaned.slice(1);
  if (/^[5678][0-9]{8}$/.test(cleaned)) return '+212' + cleaned;
  return null;
};

router.post(
  '/register',
  authLimiter,
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().custom((value) => {
      const normalized = normalizePhoneNumber(value);
      if (!normalized) {
        throw new Error('Invalid Moroccan phone number format');
      }
      return true;
    }),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('fullName').trim().isLength({ min: 2 }),
    body('role').optional().isIn(['VENDOR', 'CALL_CENTER_AGENT', 'GROSSELLER', 'INFLUENCER', 'CONFIRMATION_AGENT']),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed');
    }

    const { email, phone, password, fullName, role = 'VENDOR' } = req.body;
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;

    if (!email && !phone) {
      throw new AppException(400, 'Email or phone is required');
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
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

    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    let registrationIp = Array.isArray(rawIp) ? rawIp[0] : rawIp.split(',')[0].trim();

    if (registrationIp === '::1' || registrationIp === '127.0.0.1') {
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        if (ipRes.ok) {
          const ipData = (await ipRes.json()) as { ip: string };
          registrationIp = ipData.ip;
        }
      } catch (e) {
        console.error('Failed to resolve local to public IP');
      }
    }

    const detectedCity = await getGeoLocation(registrationIp);

    const user = (await prisma.user.create({
      data: {
        email,
        phone: normalizedPhone,
        password: hashedPassword,
        roleId: userRole.id,
        kycStatus: 'PENDING',
        isActive: false,
        registrationIp,
        detectedCity,
        profile: {
          create: {
            fullName,
            language: 'fr',
            instagramUsername: (req.body as any).instagramUsername || null,
            tiktokUsername: (req.body as any).tiktokUsername || null,
            facebookUsername: (req.body as any).facebookUsername || null,
            xUsername: (req.body as any).xUsername || null,
            youtubeUsername: (req.body as any).youtubeUsername || null,
            snapchatUsername: (req.body as any).snapchatUsername || null,
          } as any,
        },
      },
      include: {
        profile: true,
        role: true,
      },
    })) as any;

    const otp = generateOTP();
    // In a real application, you would store otpExpiry and otp
    // const otpExpiry = new Date(Date.now() + parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10) * 60 * 1000);

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
          isActive: user.isActive,
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
  '/register-influencer',
  authLimiter,
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().custom((value, { req }) => {
      if (!value) return true;
      const normalized = normalizePhoneNumber(value);
      if (!normalized) {
        throw new Error('Invalid Moroccan phone number format');
      }
      return true;
    }),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('fullName').trim().isLength({ min: 2 }),
    body('instagramUsername').optional().trim(),
    body('tiktokUsername').optional().trim(),
    body('facebookUsername').optional().trim(),
    body('xUsername').optional().trim(),
    body('youtubeUsername').optional().trim(),
    body('snapchatUsername').optional().trim(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed');
    }

    const { email, phone, password, fullName, instagramUsername, tiktokUsername, facebookUsername, xUsername, youtubeUsername, snapchatUsername } = req.body;
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;

    // We will do a basic existence check
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
        ],
      },
    });

    if (existingUser) {
      throw new AppException(409, 'User already exists with this email or phone');
    }

    // Manual verification fallback. Skip automated scraping.
    const actualUsername = instagramUsername;
    const actualTiktok = tiktokUsername;
    const actualFacebook = facebookUsername;
    const actualX = xUsername;
    const actualYoutube = youtubeUsername;
    const actualSnapchat = snapchatUsername;

    // Step 2: Create User with PENDING status
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10));

    const influencerRole = await prisma.role.findUnique({
      where: { name: 'INFLUENCER' },
    });

    if (!influencerRole) {
      throw new AppException(500, 'Influencer role not configured in the system');
    }

    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    let registrationIp = Array.isArray(rawIp) ? rawIp[0] : rawIp.split(',')[0].trim();

    if (registrationIp === '::1' || registrationIp === '127.0.0.1') {
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        if (ipRes.ok) {
          const ipData = (await ipRes.json()) as { ip: string };
          registrationIp = ipData.ip;
        }
      } catch (e) {
        console.error('Failed to resolve local to public IP');
      }
    }

    const detectedCity = await getGeoLocation(registrationIp);

    const user = (await prisma.user.create({
      data: {
        email,
        phone: normalizedPhone || null,
        password: hashedPassword,
        roleId: influencerRole.id,
        isInfluencer: true,
        referralCode: uuidv4().slice(0, 8).toUpperCase(),
        kycStatus: 'PENDING', // Needs admin approval
        isActive: false,
        registrationIp,
        detectedCity,
        profile: {
          create: {
            fullName,
            language: 'fr',
            instagramUsername: actualUsername,
            tiktokUsername: actualTiktok,
            facebookUsername: actualFacebook,
            xUsername: actualX,
            youtubeUsername: actualYoutube,
            snapchatUsername: actualSnapchat,
          },
        },
      },
      include: {
        profile: true,
        role: true,
      },
    })) as any;

    const { accessToken, refreshToken } = generateTokens(user.uuid);

    const userProfile = user.profile;

    res.status(201).json({
      status: 'success',
      message: 'Influencer registration successful. Your account is pending admin approval.',
      data: {
        user: {
          uuid: user.uuid,
          email: user.email,
          fullName: userProfile?.fullName,
          role: user.role?.name,
          kycStatus: user.kycStatus,
          instagramFollowers: userProfile?.instagramFollowers,
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
  '/login',
  loginLimiter,
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().matches(/^\+212[5678][0-9]{8}$/),
    body('password').notEmpty(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed');
    }

    const { email, phone, password } = req.body;
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;

    if (!email && !phone) {
      throw new AppException(400, 'Email or phone is required');
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
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

    // Allow inactive users to login (they will see the verification banner)

    if ((user as any).isTwoFactorEnabled) {
      const twoFactorToken = generateTwoFactorToken(user.uuid);
      return res.json({
        status: 'success',
        message: 'Two-factor authentication required',
        data: {
          requiresTwoFactor: true,
          twoFactorToken,
        },
      });
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
          id: user.id,
          uuid: user.uuid,
          email: user.email,
          phone: user.phone,
          fullName: user.profile?.fullName,
          role: user.role.name,
          kycStatus: user.kycStatus,
          isActive: user.isActive,
          mode: user.mode,
          isInfluencer: user.isInfluencer || user.role.name === 'INFLUENCER',
          instagramUsername: ((user as any).profile)?.instagramUsername,
          tiktokUsername: ((user as any).profile)?.tiktokUsername,
          facebookUsername: ((user as any).profile)?.facebookUsername,
          xUsername: ((user as any).profile)?.xUsername,
          youtubeUsername: ((user as any).profile)?.youtubeUsername,
          snapchatUsername: ((user as any).profile)?.snapchatUsername,
          referralCode: user.referralCode,
          avatarUrl: user.profile?.avatarUrl,
          instagramFollowers: (user.profile as any)?.instagramFollowers,
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
  '/login/2fa',
  [
    body('twoFactorToken').notEmpty(),
    body('code').notEmpty(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed');
    }

    const { twoFactorToken, code } = req.body;

    let payload: any;
    try {
      payload = jwt.verify(twoFactorToken, process.env.JWT_SECRET as string);
      if (payload.type !== '2fa') throw new Error('Invalid token type');
    } catch (e) {
      throw new AppException(401, 'Invalid or expired 2FA token');
    }

    const user = await prisma.user.findUnique({
      where: { uuid: payload.userId },
      include: { profile: true, role: true },
    });

    if (!user || (!(user as any).isTwoFactorEnabled) || (!(user as any).twoFactorSecret)) {
      throw new AppException(400, '2FA is not enabled for this user');
    }

    const isValid = speakeasy.totp.verify({
      secret: (user as any).twoFactorSecret,
      encoding: 'base32',
      token: code,
    });

    if (!isValid) {
      throw new AppException(401, 'Invalid 2FA code');
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
          id: user.id,
          uuid: user.uuid,
          email: user.email,
          phone: user.phone,
          fullName: user.profile?.fullName,
          role: user.role.name,
          kycStatus: user.kycStatus,
          isActive: user.isActive,
          mode: user.mode,
          isInfluencer: user.isInfluencer || user.role.name === 'INFLUENCER',
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
  '/google',
  asyncHandler(async (req: Request, res: Response) => {
    const { credential, role } = req.body; 
    
    if (!credential) {
      throw new AppException(400, 'Google credential is required');
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || (!payload.email)) {
      throw new AppException(400, 'Invalid Google token');
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId: payload.sub } as any,
          { email: payload.email }
        ]
      },
      include: { profile: true, role: true },
    });

    if (user) {
      if (!(user as any).googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: payload.sub } as any,
          include: { profile: true, role: true },
        });
      }

      if ((user as any).isTwoFactorEnabled) {
        const twoFactorToken = generateTwoFactorToken(user.uuid);
        return res.json({
          status: 'success',
          message: 'Two-factor authentication required',
          data: {
            requiresTwoFactor: true,
            twoFactorToken,
          },
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const { accessToken, refreshToken } = generateTokens(user.uuid);

      return res.json({
        status: 'success',
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            uuid: user.uuid,
            email: user.email,
            phone: user.phone,
            fullName: user.profile?.fullName,
            role: (user as any).role?.name || 'USER',
            kycStatus: user.kycStatus,
            isActive: user.isActive,
            mode: user.mode,
            isInfluencer: user.isInfluencer || user.role.name === 'INFLUENCER',
            avatarUrl: user.profile?.avatarUrl,
          },
          tokens: {
            accessToken,
            refreshToken,
          },
        },
      });
    }

    const userRole = await prisma.role.findUnique({
      where: { name: role || 'VENDOR' },
    });

    if (!userRole) {
      throw new AppException(400, 'Invalid role specified');
    }

    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    let registrationIp = Array.isArray(rawIp) ? rawIp[0] : rawIp.split(',')[0].trim();
    if (registrationIp === '::1' || registrationIp === '127.0.0.1') {
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        if (ipRes.ok) {
          const ipData = (await ipRes.json()) as { ip: string };
          registrationIp = ipData.ip;
        }
      } catch (e) {}
    }

    const detectedCity = await getGeoLocation(registrationIp);

    user = await prisma.user.create({
      data: {
        email: payload.email,
        googleId: payload.sub,
        password: await bcrypt.hash(uuidv4(), 10),
        roleId: userRole.id,
        isInfluencer: role === 'INFLUENCER',
        kycStatus: 'PENDING',
        isActive: false, 
        registrationIp,
        detectedCity,
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            fullName: payload.name || payload.email,
            avatarUrl: payload.picture,
            language: 'fr',
          },
        },
      } as any,
      include: { profile: true, role: true },
    });

    const { accessToken, refreshToken } = generateTokens(user.uuid);
    
    return res.status(201).json({
      status: 'success',
      message: 'Registration successful. Account pending activation.',
      data: {
        user: {
          uuid: user.uuid,
          email: user.email,
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
  '/2fa/setup',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    
    if ((user as any).isTwoFactorEnabled) {
      throw new AppException(400, '2FA is already enabled');
    }

    const secretObj = speakeasy.generateSecret({ name: `Silacod (${user.email || user.phone || 'User'})` });
    const secret = secretObj.base32;
    const otpauthUrl = secretObj.otpauth_url as string;

    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret } as any,
    });

    res.json({
      status: 'success',
      data: {
        secret,
        qrCodeUrl,
      },
    });
  })
);

router.post(
  '/2fa/verify',
  authenticate,
  [
    body('code').notEmpty().withMessage('Verification code is required'),
    body('secret').optional(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const { code, secret: providedSecret } = req.body;

    const dbUser = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!dbUser) throw new AppException(404, 'User not found');

    const secret = providedSecret || (dbUser as any).twoFactorSecret;
    if (!secret) {
      throw new AppException(400, '2FA setup was not initiated');
    }

    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
    });

    if (!isValid) {
      throw new AppException(400, 'Invalid verification code');
    }

    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        twoFactorSecret: secret,
        isTwoFactorEnabled: true,
      } as any,
    });

    res.json({
      status: 'success',
      message: 'Two-factor authentication has been enabled successfully.',
    });
  })
);

router.post(
  '/verify-otp',
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().matches(/^\+212[5678][0-9]{8}$/),
    body('otp').isLength({ min: 6, max: 6 }),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const { email, phone, otp } = req.body;
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
        ],
      },
    });

    if (!user) {
      throw new AppException(404, 'User not found');
    }

    const targetEmail = email || user.email;

    if (targetEmail) {
      const storedOtp = await prisma.passwordReset.findFirst({
        where: {
          email: targetEmail as string,
          token: otp,
          expiresAt: { gt: new Date() }
        }
      });

      if (!storedOtp) {
        throw new AppException(400, 'Code de vérification invalide ou expiré');
      }

      // Valid OTP, delete it so it can't be reused
      await prisma.passwordReset.delete({ where: { id: storedOtp.id } });
    } else {
      console.log(`[DEV] Phone OTP Verified: ${otp} for ${phone}`);
    }

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
    body('phone').optional().matches(/^\+212[5678][0-9]{8}$/),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const { email, phone } = req.body;
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
        ],
      },
    });

    if (!user) {
      throw new AppException(404, 'User not found');
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry
    const targetEmail = email || user.email;

    if (targetEmail) {
      // Clear old OTPs
      await prisma.passwordReset.deleteMany({
        where: { email: targetEmail as string }
      });

      // Save new OTP
      await prisma.passwordReset.create({
        data: {
          email: targetEmail as string,
          token: otp,
          expiresAt
        }
      });

      const { sendEmail } = await import('../utils/mailer.js');
      
      try {
        await sendEmail({
          to: targetEmail as string,
          subject: 'Votre code de vérification SILACOD',
          text: `Bonjour,\n\nVoici votre code de vérification: ${otp}\nIl expirera dans 15 minutes.`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #4F46E5;">SILACOD - Vérification</h2>
              <p>Bonjour,</p>
              <p>Voici votre code de vérification à 6 chiffres :</p>
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 5px; margin: 20px 0;">
                ${otp}
              </div>
              <p>Ce code expirera dans 15 minutes.</p>
              <p>Si vous n'avez pas demandé ce code, ignorez cet email.</p>
              <p>Cordialement,<br>L'équipe SILACOD</p>
            </div>
          `
        });
      } catch (err) {
        console.error('Failed to send OTP email:', err);
        throw new AppException(500, 'Erreur lors de l\'envoi de l\'email');
      }
    } else {
      console.log(`[DEV] New OTP for ${phone}: ${otp}`);
    }

    res.json({
      status: 'success',
      message: 'OTP sent successfully',
    });
  })
);

router.post(
  '/forgot-password',
  passwordResetLimiter,
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().matches(/^\+212[5678][0-9]{8}$/),
  ],
  asyncHandler(async (req, res) => {
    const { email, phone } = req.body;
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
        ],
      },
    });

    if (!user || (!email && !user.email)) {
      // Return success even if not found to prevent email enumeration
      return res.json({
        status: 'success',
        message: 'If an account exists, a reset code will be sent to your email.',
      });
    }

    const targetEmail = email || user.email;

    // Remove any existing reset tokens for this email
    await prisma.passwordReset.deleteMany({
      where: { email: targetEmail as string }
    });

    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordReset.create({
      data: {
        email: targetEmail as string,
        token: resetToken,
        expiresAt
      }
    });

    // Instead of importing at the top (which might cause circular deps or issues if not compiled yet)
    // We can directly require our new mailer
    const { sendEmail } = await import('../utils/mailer.js');

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    const emailSent = await sendEmail({
      to: targetEmail as string,
      subject: 'Réinitialisation de votre mot de passe SILACOD',
      text: `Bonjour,\n\nVous avez demandé la réinitialisation de votre mot de passe. Veuillez cliquer sur ce lien: ${resetLink}\n\nCe lien expirera dans une heure.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #6366f1; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">SILACOD</h1>
          </div>
          <div style="padding: 24px;">
            <h2 style="color: #333; margin-top: 0;">Réinitialisation de mot de passe</h2>
            <p style="color: #555; line-height: 1.6;">Bonjour,</p>
            <p style="color: #555; line-height: 1.6;">Nous avons reçu une demande de réinitialisation de votre mot de passe pour votre compte SILACOD.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetLink}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Réinitialiser mon mot de passe</a>
            </div>
            <p style="color: #555; line-height: 1.6;">Si vous n'avez pas demandé de réinitialisation de mot de passe, vous pouvez ignorer cet e-mail. Ce lien expirera dans 1 heure.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #888; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} SILACOD. Tous droits réservés.</p>
          </div>
        </div>
      `
    });

    if (!emailSent) {
      console.error(`[AUTH] Failed to send password reset email to ${targetEmail}`);
      // In a real app we might throw a 500 error here, but to prevent enumeration 
      // we'll just log it.
    }

    res.json({
      status: 'success',
      message: 'If an account exists, a reset code will be sent to your email.',
    });
  })
);

router.post(
  '/reset-password',
  [
    body('token').isString().notEmpty(),
    body('password').isString().isLength({ min: 8 }),
  ],
  asyncHandler(async (req, res) => {
    const { token, password } = req.body;

    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token }
    });

    if (!resetRecord) {
      throw new AppException(400, 'Invalid or expired reset token');
    }

    if (resetRecord.expiresAt < new Date()) {
      await prisma.passwordReset.delete({ where: { id: resetRecord.id } });
      throw new AppException(400, 'Reset token has expired');
    }

    const user = await prisma.user.findFirst({
      where: { email: resetRecord.email }
    });

    if (!user) {
      throw new AppException(404, 'User not found');
    }

    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10));

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      prisma.passwordReset.delete({
        where: { id: resetRecord.id },
      })
    ]);

    res.json({
      status: 'success',
      message: 'Password reset successfully',
    });
  })
);

router.get(
  '/verify-reset-token/:token',
  asyncHandler(async (req, res) => {
    const { token } = req.params;

    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token }
    });

    if (!resetRecord) {
      throw new AppException(400, 'Invalid or expired reset token');
    }

    if (resetRecord.expiresAt < new Date()) {
      await prisma.passwordReset.delete({ where: { id: resetRecord.id } });
      throw new AppException(400, 'Reset token has expired');
    }

    res.json({
      status: 'success',
      message: 'Token is valid',
    });
  })
);

router.post(
  '/kyc',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { documents } = req.body;

    if (!documents || !Array.isArray(documents) || documents.length !== 3) {
      throw new AppException(400, 'Vous devez soumettre exactement 3 documents (Recto, Verso, Liveness)');
    }

    await prisma.$transaction(async (tx) => {      
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        await tx.kycDocument.create({
          data: {
            userId,
            documentType: doc.type || 'ID',
            documentUrl: doc.url,
            status: 'PENDING',
          } as any,
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

router.post(
  '/sign-contract',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        contractAccepted: true,
        contractSignedAt: new Date(),
      },
    });

    res.json({
      status: 'success',
      message: 'Contract signed successfully',
      data: {
        contractAccepted: updatedUser.contractAccepted,
        contractSignedAt: updatedUser.contractSignedAt,
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
          take: 1,
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
          id: user.id,
          uuid: user.uuid,
          email: user.email,
          phone: user.phone,
          fullName: user.profile?.fullName,
          avatarUrl: user.profile?.avatarUrl,
          city: user.profile?.city,
          address: user.profile?.address,
          language: (user.profile as any)?.language,
          role: user.role.name,
          mode: user.mode,
          contractAccepted: user.contractAccepted,
          contractSignedAt: user.contractSignedAt,
          kycStatus: user.kycStatus,
          isActive: user.isActive,
          isInfluencer: user.isInfluencer || user.role.name === 'INFLUENCER',
          instagramUsername: ((user as any).profile)?.instagramUsername,
          tiktokUsername: ((user as any).profile)?.tiktokUsername,
          facebookUsername: ((user as any).profile)?.facebookUsername,
          xUsername: ((user as any).profile)?.xUsername,
          youtubeUsername: ((user as any).profile)?.youtubeUsername,
          snapchatUsername: ((user as any).profile)?.snapchatUsername,
          referralCode: user.referralCode,
          brand: user.brands?.[0] || null,
          emailVerified: !!user.emailVerifiedAt,
          phoneVerified: !!user.phoneVerifiedAt,
          wallet: user.wallet ? {
            balanceMad: user.wallet.balanceMad,
            totalEarnedMad: user.wallet.totalEarnedMad,
            totalWithdrawnMad: user.wallet.totalWithdrawnMad,
          } : null,
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
  asyncHandler(async (req: Request, res: Response) => {
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
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      status: 'success',
      message: 'Logged out successfully',
    });
  })
);

export default router;
