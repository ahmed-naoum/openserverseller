import { prisma } from '../lib/prisma.js';
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import { OcrService } from '../services/ocr.service.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticate, authorize, VENDOR_HELPER_ROLE } from '../middleware/auth.js';
import { SUB_ACCOUNT_PERMISSIONS, describeSubAccountLockout } from '../lib/vendorSubAccount.js';
import { checkAndActivateUser } from '../utils/verification.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { v4 as uuidv4 } from 'uuid';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { OAuth2Client } from 'google-auth-library';
import rateLimit from 'express-rate-limit';
import { encrypt, decrypt } from '../utils/crypto.js';
import { fetchMaintenanceSettings } from '../middleware/maintenance.js';
import { generateContractPdf } from '../services/contract.service.js';
import * as damanesign from '../services/damanesign.service.js';
import { parseCookies } from '../middleware/security.js';
import { sendOtpEmail, verifyTurnstile } from '../services/email.service.js';
import { getSecret } from '../lib/secretStore.js';

// Built per request rather than at module load: the client id can be changed
// from the admin dashboard, and this module is imported before loadSecrets().
const getGoogleClient = () =>
  new OAuth2Client(getSecret('GOOGLE_CLIENT_ID') || 'UNCONFIGURED_CLIENT_ID');
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

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('token', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
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
    body('email').notEmpty().withMessage('email_required').isEmail().withMessage('email_invalid').normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false, outlookdotcom_remove_subaddress: false, yahoo_remove_subaddress: false, icloud_remove_subaddress: false }),
    body('phone').notEmpty().withMessage('Phone number is required').custom((value) => {
      const normalized = normalizePhoneNumber(value);
      if (!normalized) {
        throw new Error('Invalid Moroccan phone number format');
      }
      return true;
    }),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters').custom((value) => {
      const criteria = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(value)).length;
      if (criteria < 3) throw new Error('Password must meet at least 3 of 4 complexity criteria (uppercase, lowercase, number, symbol)');
      return true;
    }),
    // No .escape() here: it ran BEFORE .isLength, so an apostrophe (-> &#x27;) added 5
    // characters and 400'd legitimate names like N'Diaye / El M'Hamdi, and any name that
    // did pass was persisted HTML-encoded. React escapes on output and Prisma
    // parameterises queries, so escaping at this layer was double-encoding, not security.
    body('fullName').trim().isLength({ min: 4, max: 60 }).withMessage('Le nom complet doit contenir entre 4 et 60 caractères').custom((value) => {
      if (/[0-9]/.test(value)) throw new Error('Full name must not contain numbers');
      return true;
    }),
    body('turnstileToken').notEmpty().withMessage('CAPTCHA verification is required'),
    body('cguAccepted').custom((value) => value === true || value === 'true' || value === 1 || value === '1').withMessage("Veuillez accepter les Conditions Générales d'Utilisation (CGU)"),
    body('sellingOnline').optional().isString(),
    body('budget').optional().isString(),
    body('ordersPerDay').optional().isString(),
    body('experienceYears').optional().isString(),
    body('markets').optional().isArray(),
    body('totalSpend').optional().isString(),
    body('niches').optional().isArray(),
    body('biggestAchievement').optional().isString(),
    body('biggestChallenge').optional().isString(),
    body('partnerPriorities').optional().isArray(),
    body('interviewAvailability').optional().isString(),
    body('additionalNotes').optional().isString(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      // Pass the full field list through so the client can highlight the exact input
      // and navigate back to the wizard step that owns it.
      throw new AppException(400, (firstError as any).msg || 'Validation failed', errors.array());
    }

    // Verify Turnstile CAPTCHA
    const isTurnstileValid = await verifyTurnstile(req.body.turnstileToken);
    if (!isTurnstileValid) {
      throw new AppException(400, 'CAPTCHA verification failed. Please try again.');
    }

    const {
      email, phone, password, fullName, language = 'ar',
      sellingOnline, budget, ordersPerDay, experienceYears, markets,
      totalSpend, niches, biggestAchievement, biggestChallenge,
      partnerPriorities, interviewAvailability, additionalNotes
    } = req.body;
    const role = 'VENDOR'; // Hardcoded — only VENDOR can register via this route
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;
    const langCode = ['en', 'fr', 'ar'].includes(language) ? language : 'ar';

    if (!email) {
      throw new AppException(400, 'Email is required');
    }
    if (!phone) {
      throw new AppException(400, 'Phone is required');
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
      // Say WHICH field collided so the client can flag that exact input and send
      // the user back to the step that owns it.
      const isEmailTaken = !!email && existingUser.email === email;
      throw new AppException(
        409,
        isEmailTaken
          ? 'Cet email est deja utilise par un autre compte'
          : 'Ce numero de telephone est deja utilise par un autre compte',
        [{ path: isEmailTaken ? 'email' : 'phone', msg: isEmailTaken ? 'email_already_exists' : 'phone_already_exists' }]
      );
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

    let user;
    try {
      user = (await prisma.user.create({
        data: {
          email,
          phone: normalizedPhone,
          password: hashedPassword,
          roleId: userRole.id,
          isInfluencer: false,
          kycStatus: 'PENDING',
          isActive: false,
          cguAccepted: true,
          cguAcceptedAt: new Date(),
          registrationIp,
          detectedCity,
          language: langCode,
          profile: {
            create: {
              fullName,
              language: langCode,
            } as any,
          },
          ...(sellingOnline !== undefined ? {
            questionnaire: {
              create: {
                sellingOnline,
                budget: budget || '',
                ordersPerDay: ordersPerDay || '',
                experienceYears: experienceYears || '',
                markets: markets || [],
                totalSpend: totalSpend || '',
                niches: niches || [],
                biggestAchievement: biggestAchievement || '',
                biggestChallenge: biggestChallenge || '',
                partnerPriorities: partnerPriorities || [],
                interviewAvailability: interviewAvailability || 'NO',
                additionalNotes: additionalNotes || null
              }
            }
          } : {})
        },
        include: {
          profile: true,
          role: true,
          questionnaire: true,
        },
      })) as any;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new AppException(409, 'User already exists with this email or phone (caught race condition)');
      }
      throw error;
    }

    // Referral Link helper assignment
    const refCode = req.body.ref || req.body.referralCode;
    if (refCode) {
      const cleanRef = String(refCode).trim();
      const referringHelper = await prisma.user.findFirst({
        where: {
          role: { name: 'HELPER' },
          OR: [
            { referralCode: cleanRef },
            { uuid: cleanRef },
            ...(!isNaN(Number(cleanRef)) ? [{ id: Number(cleanRef) }] : [])
          ]
        }
      });
      if (referringHelper) {
        await (prisma as any).helperUserAssignment.upsert({
          where: {
            helperId_targetUserId: {
              helperId: referringHelper.id,
              targetUserId: user.id
            }
          },
          create: {
            helperId: referringHelper.id,
            targetUserId: user.id,
            isAffiliateInvite: true
          },
          update: {
            isAffiliateInvite: true
          }
        }).catch(() => {});
      }
    }

    // Auto-assign new user to helpers with autoAssignHelperUsers or autoAssignHelperVendors enabled
    const globalHelpers = await prisma.user.findMany({
      where: {
        role: { name: 'HELPER' },
        OR: [
          { autoAssignHelperUsers: true },
          { autoAssignHelperVendors: true }
        ]
      }
    });

    if (globalHelpers.length > 0 && !['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(user.role.name)) {
      await (prisma as any).helperUserAssignment.createMany({
        data: globalHelpers.map((helper: any) => ({
          helperId: helper.id,
          targetUserId: user.id
        })),
        skipDuplicates: true,
      });
    }

    // Auto-assign global agents
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
        })),
        skipDuplicates: true,
      });
    }

    // Generate and send OTP email
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await prisma.user.update({
      where: { id: user.id },
      data: { emailOtp: otp, emailOtpExpiry: otpExpiry } as any,
    });

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] OTP for ${email}: ${otp}`);
    }
    // The account exists at this point, so a mail failure must not 500 the request —
    // but it MUST be surfaced, otherwise we tell the user "check your email" when no
    // email was ever sent and they are stuck on the verification screen.
    const otpSent = await sendOtpEmail(email, otp, langCode);
    if (!otpSent) {
      console.error(`[REGISTER] Account created for ${email} but the OTP email FAILED to send.`);
    }

    const { accessToken, refreshToken } = generateTokens(user.uuid);
    setAuthCookies(res, accessToken, refreshToken);

    res.status(201).json({
      status: 'success',
      message: 'Registration successful. Please verify your email.',
      emailSent: otpSent,
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
          emailVerified: !!user.emailVerifiedAt,
          emailVerifiedAt: user.emailVerifiedAt,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
        requiresEmailVerification: true,
      },
    });
  })
);

router.post(
  '/register-influencer',
  authLimiter,
  [
    body('email').notEmpty().withMessage('email_required').isEmail().withMessage('email_invalid').normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false, outlookdotcom_remove_subaddress: false, yahoo_remove_subaddress: false, icloud_remove_subaddress: false }),
    body('phone').notEmpty().withMessage('Phone is required').custom((value, { req }) => {
      const normalized = normalizePhoneNumber(value);
      if (!normalized) {
        throw new Error('Invalid Moroccan phone number format');
      }
      return true;
    }),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters').custom((value) => {
      const criteria = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(value)).length;
      if (criteria < 3) throw new Error('Password must meet at least 3 of 4 complexity criteria');
      return true;
    }),
    // No .escape() here: it ran BEFORE .isLength, so an apostrophe (-> &#x27;) added 5
    // characters and 400'd legitimate names like N'Diaye / El M'Hamdi, and any name that
    // did pass was persisted HTML-encoded. React escapes on output and Prisma
    // parameterises queries, so escaping at this layer was double-encoding, not security.
    body('fullName').trim().isLength({ min: 4, max: 60 }).withMessage('Le nom complet doit contenir entre 4 et 60 caractères').custom((value) => {
      if (/[0-9]/.test(value)) throw new Error('Full name must not contain numbers');
      return true;
    }),
    body('instagramUsername').optional().trim(),
    body('tiktokUsername').optional().trim(),
    body('facebookUsername').optional().trim(),
    body('xUsername').optional().trim(),
    body('youtubeUsername').optional().trim(),
    body('snapchatUsername').optional().trim(),
    body('turnstileToken').notEmpty().withMessage('CAPTCHA verification is required'),
    body('cguAccepted').custom((value) => value === true || value === 'true' || value === 1 || value === '1').withMessage("Veuillez accepter les Conditions Générales d'Utilisation (CGU)"),
    body('followersCount').optional().isString(),
    body('contentType').optional().isArray(),
    body('hasPriorExperience').optional().isString(),
    body('desiredProductTypes').optional().isString(),
    body('initialBudget').optional().isString(),
    body('motivation').optional().isString(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      // Pass the full field list through so the client can highlight the exact input
      // and navigate back to the wizard step that owns it.
      throw new AppException(400, (firstError as any).msg || 'Validation failed', errors.array());
    }

    // Verify Turnstile CAPTCHA
    const isTurnstileValid = await verifyTurnstile(req.body.turnstileToken);
    if (!isTurnstileValid) {
      throw new AppException(400, 'CAPTCHA verification failed. Please try again.');
    }

    const {
      email, phone, password, fullName, instagramUsername, tiktokUsername, facebookUsername, xUsername, youtubeUsername, snapchatUsername,
      instagramUrl, tiktokUrl, facebookUrl, youtubeUrl, snapchatUrl, language = 'ar',
      followersCount, contentType, hasPriorExperience, desiredProductTypes, initialBudget, motivation
    } = req.body;
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;
    const langCode = ['en', 'fr', 'ar'].includes(language) ? language : 'ar';

    if (!email) {
      throw new AppException(400, 'Email is required');
    }
    if (!phone) {
      throw new AppException(400, 'Phone is required');
    }

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
      // Say WHICH field collided so the client can flag that exact input and send
      // the user back to the step that owns it.
      const isEmailTaken = !!email && existingUser.email === email;
      throw new AppException(
        409,
        isEmailTaken
          ? 'Cet email est deja utilise par un autre compte'
          : 'Ce numero de telephone est deja utilise par un autre compte',
        [{ path: isEmailTaken ? 'email' : 'phone', msg: isEmailTaken ? 'email_already_exists' : 'phone_already_exists' }]
      );
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

    let user;
    try {
      user = (await prisma.user.create({
        data: {
          email,
          phone: normalizedPhone || null,
          password: hashedPassword,
          roleId: influencerRole.id,
          isInfluencer: true,
          referralCode: uuidv4().slice(0, 8).toUpperCase(),
          kycStatus: 'PENDING', // Needs admin approval
          isActive: false,
          cguAccepted: true,
          cguAcceptedAt: new Date(),
          registrationIp,
          detectedCity,
          language: langCode,
          profile: {
            create: {
              fullName,
              language: langCode,
              instagramUsername: actualUsername,
              tiktokUsername: actualTiktok,
              facebookUsername: actualFacebook,
              xUsername: actualX,
              youtubeUsername: actualYoutube,
              snapchatUsername: actualSnapchat,
              metadata: {
                instagramUrl: instagramUrl || null,
                tiktokUrl: tiktokUrl || null,
                facebookUrl: facebookUrl || null,
                youtubeUrl: youtubeUrl || null,
                snapchatUrl: snapchatUrl || null,
              }
            },
          },
          ...(followersCount !== undefined ? {
            influencerQuestionnaire: {
              create: {
                followersCount,
                contentType: contentType || [],
                hasPriorExperience: hasPriorExperience || '',
                desiredProductTypes: desiredProductTypes || '',
                initialBudget: initialBudget || '',
                motivation: motivation || '',
              }
            }
          } : {})
        },
        include: {
          profile: true,
          role: true,
          influencerQuestionnaire: true,
        },
      })) as any;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new AppException(409, 'User already exists with this email or phone (caught race condition)');
      }
      throw error;
    }

    // Auto-assign global agents
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

    // Referral Link helper assignment
    const refCode = req.body.ref || req.body.referralCode;
    if (refCode) {
      const cleanRef = String(refCode).trim();
      const referringHelper = await prisma.user.findFirst({
        where: {
          role: { name: 'HELPER' },
          OR: [
            { referralCode: cleanRef },
            { uuid: cleanRef },
            ...(!isNaN(Number(cleanRef)) ? [{ id: Number(cleanRef) }] : [])
          ]
        }
      });
      if (referringHelper) {
        await (prisma as any).helperUserAssignment.upsert({
          where: {
            helperId_targetUserId: {
              helperId: referringHelper.id,
              targetUserId: user.id
            }
          },
          create: {
            helperId: referringHelper.id,
            targetUserId: user.id,
            isAffiliateInvite: true
          },
          update: {
            isAffiliateInvite: true
          }
        }).catch(() => {});
      }
    }

    // Auto-assign new user to helpers with autoAssignHelperUsers or autoAssignHelperInfluencers enabled
    const globalHelpers = await prisma.user.findMany({
      where: {
        role: { name: 'HELPER' },
        OR: [
          { autoAssignHelperUsers: true },
          { autoAssignHelperInfluencers: true }
        ]
      }
    });

    if (globalHelpers.length > 0) {
      await (prisma as any).helperUserAssignment.createMany({
        data: globalHelpers.map((helper: any) => ({
          helperId: helper.id,
          targetUserId: user.id
        })),
        skipDuplicates: true,
      });
    }

    // Generate and send OTP email
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { emailOtp: otp, emailOtpExpiry: otpExpiry } as any,
    });

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] OTP for ${email}: ${otp}`);
    }
    // The account exists at this point, so a mail failure must not 500 the request —
    // but it MUST be surfaced, otherwise we tell the user "check your email" when no
    // email was ever sent and they are stuck on the verification screen.
    const otpSent = await sendOtpEmail(email, otp, langCode);
    if (!otpSent) {
      console.error(`[REGISTER] Account created for ${email} but the OTP email FAILED to send.`);
    }

    const { accessToken, refreshToken } = generateTokens(user.uuid);
    setAuthCookies(res, accessToken, refreshToken);

    res.status(201).json({
      status: 'success',
      message: 'Influencer registration successful. Please verify your email.',
      data: {
        user: {
          id: user.id,
          uuid: user.uuid,
          email: user.email,
          fullName: user.profile?.fullName,
          role: user.role?.name,
          kycStatus: user.kycStatus,
          isActive: user.isActive,
          emailVerified: !!user.emailVerifiedAt,
          emailVerifiedAt: user.emailVerifiedAt,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
        requiresEmailVerification: true,
      },
    });
  })
);

router.post(
  '/verify-email',
  loginLimiter,
  [
    // MUST use the exact same normalizer as /register (line ~129). Registration
    // stores the normalized address; without this, anyone who typed a capital
    // letter (or googlemail.com) could never verify their account.
    body('email').notEmpty().isEmail().normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false, outlookdotcom_remove_subaddress: false, yahoo_remove_subaddress: false, icloud_remove_subaddress: false }),
    body('otp').notEmpty().isString(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed');
    }

    const { email, otp } = req.body;

    // Case-insensitive as defence in depth: rows created by seeds/admin tools may
    // not have gone through the same normalizer.
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (!user) {
      throw new AppException(404, 'User not found');
    }

    if (user.emailVerifiedAt) {
      throw new AppException(400, 'Email is already verified');
    }

    if (!user.emailOtp || !user.emailOtpExpiry) {
      throw new AppException(400, 'No verification OTP found for this user');
    }

    if (user.emailOtp !== otp) {
      throw new AppException(400, 'Invalid verification code');
    }

    if (new Date() > user.emailOtpExpiry) {
      throw new AppException(400, 'Verification code has expired. Please request a new one.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailOtp: null,
        emailOtpExpiry: null,
      } as any,
    });

    res.json({
      status: 'success',
      message: 'Email verified successfully',
    });
  })
);

router.post(
  '/login',
  loginLimiter,
  [
    body('email').optional().isEmail().normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false, outlookdotcom_remove_subaddress: false, yahoo_remove_subaddress: false, icloud_remove_subaddress: false }),
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

    // A vendor sub-account that has been suspended, has expired, or whose
    // vendor is gone must be told so here. authenticate() already refuses it,
    // but that refusal lands on /auth/me *after* login has handed out tokens
    // and redirected — the client reads the 403 as a dead session and bounces
    // back to the login screen with nothing explained.
    if (user.role.name === VENDOR_HELPER_ROLE) {
      const parentVendor = user.parentVendorId
        ? await prisma.user.findUnique({
            where: { id: user.parentVendorId },
            select: { isActive: true, deletedAt: true },
          })
        : null;
      const blocked = describeSubAccountLockout(user as any, parentVendor);
      if (blocked) throw new AppException(403, blocked);
    }

    if ((user as any).requiresPasswordChange) {
      const tempToken = jwt.sign(
        { userId: user.uuid, type: 'force_password_change' },
        process.env.JWT_SECRET as string,
        { expiresIn: '15m' }
      );
      return res.json({
        status: 'success',
        message: 'Password change required',
        data: {
          requiresPasswordChange: true,
          tempToken,
        },
      });
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
    setAuthCookies(res, accessToken, refreshToken);

    const maintenanceSettings = await fetchMaintenanceSettings();
    let requiresManualApproval = false;
    if (user.role.name === 'VENDOR') {
      requiresManualApproval = maintenanceSettings.registrationBlocked;
    } else if (user.role.name === 'INFLUENCER') {
      requiresManualApproval = maintenanceSettings.influencerRegistrationBlocked;
    }

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
          requiresManualApproval,
          emailVerified: !!user.emailVerifiedAt,
          emailVerifiedAt: user.emailVerifiedAt,
          mode: user.mode,
          subdomain: user.subdomain,
          customDomain: user.customDomain,
          customDomainStatus: user.customDomainStatus,
          language: user.language || user.profile?.language || 'ar',
          isInfluencer: user.isInfluencer || user.role.name === 'INFLUENCER',
          instagramUsername: ((user as any).profile)?.instagramUsername,
          tiktokUsername: ((user as any).profile)?.tiktokUsername,
          facebookUsername: ((user as any).profile)?.facebookUsername,
          xUsername: ((user as any).profile)?.xUsername,
          youtubeUsername: ((user as any).profile)?.youtubeUsername,
          snapchatUsername: ((user as any).profile)?.snapchatUsername,
          referralCode: user.referralCode,
          avatarUrl: user.profile?.avatarUrl,
          isTwoFactorEnabled: (user as any).isTwoFactorEnabled,
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
    setAuthCookies(res, accessToken, refreshToken);

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
          emailVerified: !!user.emailVerifiedAt,
          emailVerifiedAt: user.emailVerifiedAt,
          mode: user.mode,
          language: user.language || user.profile?.language || 'ar',
          isInfluencer: user.isInfluencer || user.role.name === 'INFLUENCER',
          instagramUsername: ((user as any).profile)?.instagramUsername,
          tiktokUsername: ((user as any).profile)?.tiktokUsername,
          facebookUsername: ((user as any).profile)?.facebookUsername,
          xUsername: ((user as any).profile)?.xUsername,
          youtubeUsername: ((user as any).profile)?.youtubeUsername,
          snapchatUsername: ((user as any).profile)?.snapchatUsername,
          referralCode: user.referralCode,
          avatarUrl: user.profile?.avatarUrl,
          isTwoFactorEnabled: (user as any).isTwoFactorEnabled,
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
  '/force-password-change',
  [
    body('tempToken').notEmpty(),
    body('newPassword').notEmpty().isLength({ min: 6 }),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed');
    }

    const { tempToken, newPassword } = req.body;

    let payload: any;
    try {
      payload = jwt.verify(tempToken, process.env.JWT_SECRET as string);
      if (payload.type !== 'force_password_change') throw new Error('Invalid token type');
    } catch (e) {
      throw new AppException(401, 'Invalid or expired token');
    }

    const user = await prisma.user.findUnique({
      where: { uuid: payload.userId },
      include: { profile: true, role: true },
    });

    if (!user || !(user as any).requiresPasswordChange) {
      throw new AppException(400, 'Password change is not required for this user');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { 
        password: hashedPassword,
        requiresPasswordChange: false,
        lastLoginAt: new Date()
      } as any,
    });

    const { accessToken, refreshToken } = generateTokens(user.uuid);
    setAuthCookies(res, accessToken, refreshToken);

    res.json({
      status: 'success',
      message: 'Password updated and logged in successfully',
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
          emailVerified: !!user.emailVerifiedAt,
          emailVerifiedAt: user.emailVerifiedAt,
          mode: user.mode,
          language: user.language || user.profile?.language || 'ar',
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
  '/google',
  asyncHandler(async (req: Request, res: Response) => {
    const { credential, role, language = 'ar' } = req.body; 
    const langCode = ['en', 'fr', 'ar'].includes(language) ? language : 'ar';
    
    if (!credential) {
      throw new AppException(400, 'Google credential is required');
    }

    const ticket = await getGoogleClient().verifyIdToken({
      idToken: credential,
      audience: getSecret('GOOGLE_CLIENT_ID'),
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
      setAuthCookies(res, accessToken, refreshToken);

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
            language: user.language || user.profile?.language || 'ar',
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

    // If user does not exist, check role and phone
    const { 
      phone, 
      fullName,
      instagramUsername,
      tiktokUsername,
      facebookUsername,
      youtubeUsername,
      snapchatUsername,
      instagramUrl,
      tiktokUrl,
      facebookUrl,
      youtubeUrl,
      snapchatUrl,
      // Vendor Questionnaire
      sellingOnline, budget, ordersPerDay, experienceYears, markets,
      totalSpend, niches, biggestAchievement, biggestChallenge,
      partnerPriorities, interviewAvailability, additionalNotes,
      // Influencer Questionnaire
      followersCount, contentType, hasPriorExperience, desiredProductTypes,
      initialBudget, motivation
    } = req.body;

    if (!role) {
      throw new AppException(404, "Votre compte n'existe pas. Veuillez d'abord créer un compte sur la page d'inscription.");
    }

    if (!phone) {
      return res.status(200).json({
        status: 'success',
        data: {
          status: 'needs_completion',
          email: payload.email,
          fullName: payload.name || payload.email,
          avatarUrl: payload.picture,
          googleId: payload.sub,
          role,
        }
      });
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      throw new AppException(400, 'Invalid Moroccan phone number format');
    }

    const existingPhone = await prisma.user.findFirst({
      where: { phone: normalizedPhone },
    });
    if (existingPhone) {
      throw new AppException(409, 'Ce numéro de téléphone est déjà associé à un autre compte');
    }

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
      } catch (e) {}
    }

    const detectedCity = await getGeoLocation(registrationIp);

    const actualUsername = instagramUsername;
    const actualTiktok = tiktokUsername;
    const actualFacebook = facebookUsername;
    const actualYoutube = youtubeUsername;
    const actualSnapchat = snapchatUsername;

    user = await prisma.user.create({
      data: {
        email: payload.email,
        phone: normalizedPhone,
        googleId: payload.sub,
        password: await bcrypt.hash(uuidv4(), 10),
        roleId: userRole.id,
        isInfluencer: role === 'INFLUENCER',
        referralCode: role === 'INFLUENCER' ? uuidv4().slice(0, 8).toUpperCase() : null,
        kycStatus: 'PENDING',
        isActive: false, 
        registrationIp,
        detectedCity,
        emailVerifiedAt: new Date(),
        language: langCode,
        profile: {
          create: {
            fullName: fullName || payload.name || payload.email,
            avatarUrl: payload.picture,
            language: langCode,
            instagramUsername: actualUsername || null,
            tiktokUsername: actualTiktok || null,
            facebookUsername: actualFacebook || null,
            youtubeUsername: actualYoutube || null,
            snapchatUsername: actualSnapchat || null,
            metadata: role === 'INFLUENCER' ? {
              instagramUrl: instagramUrl || null,
              tiktokUrl: tiktokUrl || null,
              facebookUrl: facebookUrl || null,
              youtubeUrl: youtubeUrl || null,
              snapchatUrl: snapchatUrl || null,
            } : null,
          },
        },
        ...(role === 'VENDOR' && sellingOnline !== undefined ? {
          questionnaire: {
            create: {
              sellingOnline,
              budget: budget || '',
              ordersPerDay: ordersPerDay || '',
              experienceYears: experienceYears || '',
              markets: markets || [],
              totalSpend: totalSpend || '',
              niches: niches || [],
              biggestAchievement: biggestAchievement || '',
              biggestChallenge: biggestChallenge || '',
              partnerPriorities: partnerPriorities || [],
              interviewAvailability: interviewAvailability || 'NO',
              additionalNotes: additionalNotes || null
            }
          }
        } : {}),
        ...(role === 'INFLUENCER' && followersCount !== undefined ? {
          influencerQuestionnaire: {
            create: {
              followersCount,
              contentType: contentType || [],
              hasPriorExperience: hasPriorExperience || '',
              desiredProductTypes: desiredProductTypes || '',
              initialBudget: initialBudget || '',
              motivation: motivation || null
            }
          }
        } : {})
      } as any,
      include: { profile: true, role: true },
    });

    // Auto-assign new user to helpers with autoAssignHelperUsers/vendors/influencers enabled
    const isVendor = user.role.name === 'VENDOR';
    const isInfluencer = user.role.name === 'INFLUENCER';
    const globalHelpers = await prisma.user.findMany({
      where: {
        role: { name: 'HELPER' },
        OR: [
          { autoAssignHelperUsers: true },
          ...(isVendor ? [{ autoAssignHelperVendors: true }] : []),
          ...(isInfluencer ? [{ autoAssignHelperInfluencers: true }] : []),
        ]
      }
    });

    if (globalHelpers.length > 0 && !['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(user.role.name)) {
      await (prisma as any).helperUserAssignment.createMany({
        data: globalHelpers.map((helper: any) => ({
          helperId: helper.id,
          targetUserId: user.id
        })),
        skipDuplicates: true,
      });
    }

    // Auto-assign global agents
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
        })),
        skipDuplicates: true,
      });
    }


    const { accessToken, refreshToken } = generateTokens(user.uuid);
    setAuthCookies(res, accessToken, refreshToken);
    
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
  '/impersonate',
  authenticate,
  authorize('SUPER_ADMIN', 'HELPER'),
  asyncHandler(async (req: Request, res: Response) => {
    const currentUser = req.user!;
    
    // Safety: Super admins can impersonate anyone.
    // Others (like Helpers) must have the canImpersonate flag.
    if (currentUser.roleName !== 'SUPER_ADMIN' && currentUser.roleName !== 'FINANCE_ADMIN' && !currentUser.canImpersonate) {
        throw new AppException(403, "Vous n'avez pas la permission d'accéder au mode assistance.");
    }

    const { targetUserId } = req.body;

    if (!targetUserId) {
      throw new AppException(400, 'Target User ID is required');
    }

    // If Helper, verify target user is assigned to them
    if (currentUser.roleName === 'HELPER') {
        const assignment = await (prisma as any).helperUserAssignment.findUnique({
            where: {
                helperId_targetUserId: {
                    helperId: currentUser.id,
                    targetUserId: Number(targetUserId)
                }
            }
        });

        if (!assignment) {
            throw new AppException(403, "Vous n'êtes pas assigné à cet utilisateur.");
        }
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: Number(targetUserId) },
      include: { role: true, profile: true },
    });

    if (!targetUser) {
      throw new AppException(404, 'User not found');
    }

    // Prevent helpers from impersonating administrative, support, or other elevated roles
    if (req.user!.roleName === 'HELPER') {
      const allowedRoles = ['VENDOR', 'SELLER', 'GROSSELLER', 'INFLUENCER', 'CALL_CENTER_AGENT'];
      if (!allowedRoles.includes(targetUser.role.name)) {
        throw new AppException(403, "Permission denied. Helpers are only allowed to impersonate client roles and agents (Vendor, Seller, Grosseller, Influencer, Call Center Agent).");
      }
    }

    // Generate tokens for the target user with isImpersonated claim
    const jwt = require('jsonwebtoken');
    const accessToken = jwt.sign(
      { userId: targetUser.uuid, isImpersonated: true },
      process.env.JWT_SECRET as string,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );

    const refreshToken = jwt.sign(
      { userId: targetUser.uuid, type: 'refresh', isImpersonated: true },
      process.env.JWT_SECRET as string,
      { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as any }
    );

    const cookies = parseCookies(req.headers.cookie);
    const currentToken = cookies['token'] || req.headers.authorization?.split(' ')[1];
    const currentRefreshToken = cookies['refreshToken'];

    if (currentToken) {
      res.cookie('originalToken', currentToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }

    if (currentRefreshToken) {
      res.cookie('originalRefreshToken', currentRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }

    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      status: 'success',
      message: `Impersonating ${targetUser.profile?.fullName || targetUser.email}`,
      data: {
        user: {
          id: targetUser.id,
          uuid: targetUser.uuid,
          email: targetUser.email,
          phone: targetUser.phone,
          fullName: targetUser.profile?.fullName,
          role: targetUser.role.name,
          kycStatus: targetUser.kycStatus,
          isActive: targetUser.isActive,
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
  '/2fa/disable',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        isTwoFactorEnabled: false,
        twoFactorSecret: null,
      } as any,
    });

    res.json({
      status: 'success',
      message: 'L\'authentification à deux facteurs a été désactivée.',
    });
  })
);

router.post(
  '/verify-otp',
  [
    body('email').optional().isEmail().normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false, outlookdotcom_remove_subaddress: false, yahoo_remove_subaddress: false, icloud_remove_subaddress: false }),
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

    const targetIdentifier = email || normalizedPhone || user.email || user.phone;

    if (targetIdentifier) {
      const storedOtp = await prisma.passwordReset.findFirst({
        where: {
          email: targetIdentifier as string,
          token: otp,
          expiresAt: { gt: new Date() }
        }
      });

      if (!storedOtp) {
        throw new AppException(400, 'Code de vérification invalide ou expiré');
      }

      // Valid OTP, delete it so it can't be reused
      await prisma.passwordReset.delete({ where: { id: storedOtp.id } });
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
    body('email').optional().isEmail().normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false, outlookdotcom_remove_subaddress: false, yahoo_remove_subaddress: false, icloud_remove_subaddress: false }),
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
    const targetIdentifier = email || normalizedPhone || user.email || user.phone;

    if (targetIdentifier) {
      // Rate-limiting / spam protection: check if an OTP was sent in the last 60 seconds
      const existingOtp = await prisma.passwordReset.findFirst({
        where: { email: targetIdentifier as string },
        orderBy: { createdAt: 'desc' }
      });

      if (existingOtp) {
        const timeSinceLastOtp = Date.now() - new Date(existingOtp.createdAt).getTime();
        const cooldownMs = 60 * 1000; // 60 seconds cooldown
        if (timeSinceLastOtp < cooldownMs) {
          const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastOtp) / 1000);
          res.status(429).json({
            status: 'error',
            message: `Veuillez patienter ${remainingSeconds} secondes avant de demander un nouveau code.`,
            remainingSeconds
          });
          return;
        }
      }
      // Clear old OTPs
      await prisma.passwordReset.deleteMany({
        where: { email: targetIdentifier as string }
      });

      // Save new OTP
      await prisma.passwordReset.create({
        data: {
          email: targetIdentifier as string,
          token: otp,
          expiresAt
        }
      });

      // If user email is not verified, update user table emailOtp
      if (!user.emailVerifiedAt) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            emailOtp: otp,
            emailOtpExpiry: expiresAt
          } as any
        });
      }

      if (email || user.email) {
        const { sendEmail } = await import('../utils/mailer.js');
        try {
          await sendEmail({
            to: targetIdentifier as string,
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
        console.log(`[DEV/SMS] New OTP for ${targetIdentifier}: ${otp}`);
      }
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
    body('email').optional().isEmail().normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false, outlookdotcom_remove_subaddress: false, yahoo_remove_subaddress: false, icloud_remove_subaddress: false }),
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
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }).withMessage('Le nouveau mot de passe doit contenir au moins 8 caractères'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation échouée');
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppException(401, 'Utilisateur non trouvé');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new AppException(400, 'Le mot de passe actuel est incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10));

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.json({
      status: 'success',
      message: 'Mot de passe mis à jour avec succès',
    });
  })
);

const kycExtractionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les formats JPG, PNG, WEBP et PDF sont acceptés pour l\'extraction'));
    }
  },
});

router.post(
  '/kyc/extract',
  authenticate,
  kycExtractionUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppException(400, 'Aucun fichier envoyé');
    }

    const type = (req.body.type as 'recto' | 'verso') || 'recto';
    const data = await OcrService.extractCinData(req.file.buffer, type);

    res.json({
      status: 'success',
      data,
    });
  })
);

router.post(
  '/kyc',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { documents, cinNumber, birthDate, fullName, address, city } = req.body;

    if (!documents || !Array.isArray(documents) || documents.length !== 2) {
      throw new AppException(400, 'Vous devez soumettre exactement 2 documents (Recto et Verso)');
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
            metadata: doc.metadata || null,
          } as any,
        });
      }

      // Update User Profile with verified data
      await tx.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          fullName,
          cinNumber,
          birthDate: birthDate ? new Date(birthDate) : null,
          address,
          city,
        },
        update: {
          fullName: fullName || undefined,
          cinNumber,
          birthDate: birthDate ? new Date(birthDate) : null,
          address,
          city,
        }
      });

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
  '/contract-preview',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, bankAccounts: true },
    });

    if (!user) {
      throw new AppException(404, 'User not found');
    }

    if (!user.profile?.fullName) {
      throw new AppException(400, 'Veuillez renseigner votre nom complet dans votre profil.');
    }
    if (!user.profile?.cinNumber) {
      throw new AppException(400, 'Veuillez renseigner votre numéro de CIN.');
    }

    const defaultBank = user.bankAccounts.find(b => b.isDefault) || user.bankAccounts[0];
    if (!defaultBank) {
      throw new AppException(400, 'Veuillez ajouter un compte bancaire avant de visualiser.');
    }

    const decryptedRib = decrypt(defaultBank.ribAccount);
    const iceNumber = defaultBank.iceNumber || undefined;

    const pdfBuffer = await generateContractPdf({
      fullName: user.profile.fullName,
      cinNumber: user.profile.cinNumber,
      city: user.profile.city || 'Marrakech',
      address: user.profile.address || 'Marrakech',
      iceNumber,
      date: new Date().toLocaleDateString('fr-FR'),
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="contrat.fin.silacod.pdf"');
    res.send(pdfBuffer);
  })
);

router.post(
  '/sign-contract',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    // Fetch user details including profile and bank accounts
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, bankAccounts: true },
    });

    if (!user) {
      throw new AppException(404, 'User not found');
    }

    if (!user.profile?.fullName) {
      throw new AppException(400, 'Veuillez renseigner votre nom complet dans votre profil.');
    }
    if (!user.profile?.cinNumber) {
      throw new AppException(400, 'Veuillez renseigner votre numéro de CIN.');
    }

    // Get the default or first bank account
    const defaultBank = user.bankAccounts.find(b => b.isDefault) || user.bankAccounts[0];
    if (!defaultBank) {
      throw new AppException(400, 'Veuillez ajouter un compte bancaire avant de signer.');
    }

    const decryptedRib = decrypt(defaultBank.ribAccount);
    const iceNumber = defaultBank.iceNumber || undefined;

    // Directly sign/accept the contract in the database and activate the user.
    await prisma.user.update({
      where: { id: userId },
      data: {
        contractAccepted: true,
        contractSignedAt: new Date(),
      },
    });

    await checkAndActivateUser(userId);

    res.json({
      status: 'success',
      message: 'Contrat signé et validé avec succès',
      data: {
        signed: true,
      },
    });
  })
);

router.get(
  '/mock-signature',
  asyncHandler(async (req, res) => {
    const { uuid } = req.query;
    if (!uuid || typeof uuid !== 'string') {
      return res.status(400).send('Invalid UUID');
    }

    const user = await prisma.user.findUnique({
      where: { uuid },
      include: { profile: true, bankAccounts: true },
    });

    if (!user || !user.profile) {
      return res.status(404).send('User or profile not found');
    }

    const defaultBank = user.bankAccounts.find(b => b.isDefault) || user.bankAccounts[0];
    const decryptedRib = defaultBank ? decrypt(defaultBank.ribAccount) : 'Aucun compte bancaire';

    res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Silacod Sandbox - Signature de Contrat</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #0f172a, #1e1b4b);
      font-family: 'Outfit', sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      color: #f1f5f9;
    }
    .card {
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 40px;
      max-width: 480px;
      width: 90%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      text-align: center;
    }
    .badge {
      display: inline-block;
      padding: 6px 12px;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: #a5b4fc;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 24px;
      font-weight: 800;
      margin: 0 0 10px 0;
      background: linear-gradient(to right, #e2e8f0, #94a3b8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p.desc {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 30px;
    }
    .details {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 30px;
      text-align: left;
      border: 1px solid rgba(255, 255, 255, 0.04);
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 13px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      color: #64748b;
      font-weight: 600;
    }
    .detail-val {
      color: #cbd5e1;
      font-weight: 800;
    }
    button {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      border: none;
      color: white;
      padding: 16px 32px;
      font-size: 15px;
      font-weight: 800;
      border-radius: 16px;
      cursor: pointer;
      width: 100%;
      box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.3);
      transition: all 0.2s ease;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 20px 25px -5px rgba(99, 102, 241, 0.4);
    }
    button:active {
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Sandbox / Test Environment</div>
    <h1>Signer le Contrat</h1>
    <p class="desc">Vous êtes sur le point de signer électroniquement votre contrat d'adhésion Silacod en mode de test sécurisé.</p>
    
    <div class="details">
      <div class="detail-row">
        <span class="detail-label">Nom Complet</span>
        <span class="detail-val">${user.profile.fullName || 'Non spécifié'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">CIN</span>
        <span class="detail-val">${user.profile.cinNumber || 'Non spécifié'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Ville / Adresse</span>
        <span class="detail-val">${user.profile.city || ''}, ${user.profile.address || ''}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Compte Bancaire (RIB)</span>
        <span class="detail-val">${decryptedRib}</span>
      </div>
    </div>

    <form method="POST" action="/api/v1/auth/mock-signature?uuid=${uuid}">
      <button type="submit">Signer le contrat numériquement</button>
    </form>
  </div>
</body>
</html>
    `);
  })
);

router.post(
  '/mock-signature',
  asyncHandler(async (req, res) => {
    const { uuid } = req.query;
    if (!uuid || typeof uuid !== 'string') {
      return res.status(400).send('Invalid UUID');
    }

    const user = await prisma.user.findUnique({
      where: { uuid },
    });

    if (!user) {
      return res.status(404).send('User not found');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        contractAccepted: true,
        contractSignedAt: new Date(),
      },
    });

    await checkAndActivateUser(user.id);

    res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Signature Réussie</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #022c22, #064e3b);
      font-family: 'Outfit', sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      color: #f1f5f9;
      text-align: center;
    }
    .card {
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 40px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .icon {
      font-size: 48px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 24px;
      font-weight: 800;
      color: #34d399;
      margin: 0 0 10px 0;
    }
    p {
      color: #a7f3d0;
      font-size: 14px;
      line-height: 1.6;
    }
  </style>
  <script>
    setTimeout(() => {
      window.close();
    }, 2000);
  </script>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Contrat Signé !</h1>
    <p>Votre contrat a été signé avec succès. Cette fenêtre va se fermer automatiquement.</p>
  </div>
</body>
</html>
    `);
  })
);

router.get(
  '/contract-status',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppException(404, 'User not found');
    }

    if (user.contractAccepted) {
      return res.json({
        status: 'success',
        data: {
          signed: true,
          signedAt: user.contractSignedAt,
        },
      });
    }

    if (!user.damanesignTransactionId) {
      return res.json({
        status: 'success',
        data: {
          signed: false,
          hasTransaction: false,
        },
      });
    }

    if (user.damanesignTransactionId && user.damanesignTransactionId.startsWith('mock-tx-')) {
      return res.json({
        status: 'success',
        data: {
          signed: user.contractAccepted,
          signedAt: user.contractSignedAt,
          hasTransaction: true,
          transactionId: user.damanesignTransactionId,
        },
      });
    }

    try {
      const txDetails = await damanesign.getTransaction(user.damanesignTransactionId);
      const isSigned = txDetails.status === 'finished' || 
                       txDetails.members.every(m => m.status === 'finished' || m.status === 'signed');
      
      if (isSigned) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            contractAccepted: true,
            contractSignedAt: new Date(),
          },
        });
        await checkAndActivateUser(userId);

        return res.json({
          status: 'success',
          data: {
            signed: true,
            signedAt: new Date(),
          },
        });
      }
    } catch (err) {
      console.error('Error fetching DamaneSign status:', err);
    }

    res.json({
      status: 'success',
      data: {
        signed: false,
        hasTransaction: true,
        transactionId: user.damanesignTransactionId,
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
        bankAccounts: true,
        parentVendor: { include: { profile: true } },
      },
    });

    if (!user) {
      throw new AppException(404, 'User not found');
    }

    const maintenanceSettings = await fetchMaintenanceSettings();
    let requiresManualApproval = false;
    if (user.role.name === 'VENDOR') {
      requiresManualApproval = maintenanceSettings.registrationBlocked;
    } else if (user.role.name === 'INFLUENCER') {
      requiresManualApproval = maintenanceSettings.influencerRegistrationBlocked;
    }

    if (user.bankAccounts) {
      user.bankAccounts = user.bankAccounts.map((account: any) => ({
        ...account,
        ribAccount: decrypt(account.ribAccount)
      }));
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
          language: user.language || (user.profile as any)?.language || 'ar',
          role: user.role.name,
          mode: user.mode,
          // A sub-account has no storefront of its own. Report the vendor's, or
          // every referral link and QR code it copies would point at the bare
          // platform host instead of the vendor's branded domain.
          subdomain: (user as any).parentVendor?.subdomain ?? user.subdomain,
          customDomain: (user as any).parentVendor?.customDomain ?? user.customDomain,
          customDomainStatus:
            (user as any).parentVendor?.customDomainStatus ?? user.customDomainStatus,
          contractAccepted: user.contractAccepted,
          contractSignedAt: user.contractSignedAt,
          kycStatus: user.kycStatus,
          isActive: user.isActive,
          requiresManualApproval,
          isInfluencer: user.isInfluencer || user.role.name === 'INFLUENCER',
          canImpersonate: user.canImpersonate,
          canManageProducts: user.canManageProducts,
          canManageLeads: user.canManageLeads,
          canManageOrders: user.canManageOrders,
          canManageInfluencerLinks: user.canManageInfluencerLinks,
          canManageTickets: user.canManageTickets,
          canScanReturns: user.canScanReturns,
          // Drives whether the Affiliation nav item and route are reachable at all
          canManageAffiliateInvites: user.canManageAffiliateInvites,
          isTwoFactorEnabled: (user as any).isTwoFactorEnabled,
          instagramUsername: ((user as any).profile)?.instagramUsername,
          tiktokUsername: ((user as any).profile)?.tiktokUsername,
          facebookUsername: ((user as any).profile)?.facebookUsername,
          xUsername: ((user as any).profile)?.xUsername,
          youtubeUsername: ((user as any).profile)?.youtubeUsername,
          snapchatUsername: ((user as any).profile)?.snapchatUsername,
          referralCode: user.referralCode,
          // The account whose data this session actually operates on. Identical
          // to `id` for everyone except a vendor sub-account, where it is the
          // parent vendor — pages that pass a vendor id to the API must use it.
          vendorId: user.parentVendorId || user.id,
          ...(user.role.name === VENDOR_HELPER_ROLE
            ? {
                isVendorHelper: true,
                parentVendorId: user.parentVendorId,
                parentVendorName:
                  (user as any).parentVendor?.profile?.fullName ||
                  (user as any).parentVendor?.email ||
                  null,
                subAllowedModes: user.subAllowedModes,
                subReadOnly: user.subReadOnly,
                subAccessExpiresAt: user.subAccessExpiresAt,
                ...Object.fromEntries(
                  SUB_ACCOUNT_PERMISSIONS.map((key) => [key, (user as any)[key]]),
                ),
              }
            : {}),
          bankAccounts: user.bankAccounts || [],
          emailVerified: !!user.emailVerifiedAt,
          emailVerifiedAt: user.emailVerifiedAt,
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
    res.clearCookie('token', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    res.clearCookie('originalToken', { path: '/' });
    res.clearCookie('originalRefreshToken', { path: '/' });
    res.json({
      status: 'success',
      message: 'Logged out successfully',
    });
  })
);

// In-memory OTP store for bank account verification
const bankOtpStore = new Map<number, { otp: string; expiresAt: Date; bankName: string; ribAccount: string; iceNumber?: string }>();

// Step 1: Send OTP to user's email before adding bank account
router.post(
  '/bank-accounts/send-otp',
  authenticate,
  [
    body('bankName').notEmpty().trim(),
    body('ribAccount').isLength({ min: 24, max: 24 }).withMessage('RIB must be 24 digits'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed');
    }

    const { bankName, ribAccount, iceNumber } = req.body;
    const userId = req.user!.id;
    const email = req.user!.email;

    if (!email) {
      throw new AppException(400, 'Aucun email associé à votre compte');
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    bankOtpStore.set(userId, { otp, expiresAt, bankName, ribAccount, iceNumber });

    // Send email
    const { sendEmail } = await import('../utils/mailer.js');
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    const userName = user?.profile?.fullName || email;

    await sendEmail({
      to: email,
      subject: '🏦 Vérification - Ajout de compte bancaire',
      html: `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="width: 60px; height: 60px; background: #dbeafe; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
              <span style="font-size: 28px;">🏦</span>
            </div>
            <h2 style="color: #1e293b; margin: 0; font-size: 22px;">Nouveau Compte Bancaire</h2>
          </div>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
            Bonjour <strong>${userName}</strong>,<br><br>
            Une demande d'ajout de compte bancaire a été initiée sur votre espace :
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0; color: #475569; font-size: 13px;"><strong>Banque :</strong> ${bankName}</p>
            <p style="margin: 8px 0 0; color: #475569; font-size: 13px;"><strong>RIB :</strong> ${ribAccount.substring(0, 4)} **** **** **** **** ****</p>
          </div>
          <p style="color: #64748b; font-size: 14px;">Voici votre code de vérification :</p>
          <div style="text-align: center; margin: 24px 0;">
            <div style="display: inline-block; background: #f1f5f9; padding: 16px 40px; border-radius: 16px; border: 2px dashed #cbd5e1;">
              <span style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #0f172a;">${otp}</span>
            </div>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            ⏱ Ce code expire dans <strong>10 minutes</strong>.<br>
            Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
          </p>
        </div>
      `
    });

    // Mask email for frontend
    const [localPart, domain] = email.split('@');
    const maskedEmail = `${localPart.slice(0, 2)}***@${domain}`;

    res.json({
      status: 'success',
      message: 'OTP sent',
      data: { maskedEmail }
    });
  })
);

// Step 2: Verify OTP and add the bank account
router.post(
  '/bank-accounts/verify-otp',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { otp } = req.body;
    const userId = req.user!.id;

    if (!otp) {
      throw new AppException(400, 'Le code de vérification est requis');
    }

    const stored = bankOtpStore.get(userId);
    if (!stored) {
      throw new AppException(400, 'Aucun code de vérification trouvé. Veuillez en demander un nouveau.');
    }

    if (new Date() > stored.expiresAt) {
      bankOtpStore.delete(userId);
      throw new AppException(400, 'Le code de vérification a expiré. Veuillez en demander un nouveau.');
    }

    if (stored.otp !== otp) {
      throw new AppException(400, 'Code de vérification incorrect.');
    }

    // OTP verified — create bank account
    bankOtpStore.delete(userId);

    const bankAccount = await prisma.userBankAccount.create({
      data: {
        userId,
        bankName: stored.bankName,
        ribAccount: encrypt(stored.ribAccount),
        iceNumber: stored.iceNumber,
        isDefault: (await prisma.userBankAccount.count({ where: { userId } })) === 0,
      },
    });

    res.status(201).json({
      status: 'success',
      data: { bankAccount },
    });
  })
);

// Set bank account as default
router.patch(
  '/bank-accounts/:id/default',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    // Reset all others
    await prisma.userBankAccount.updateMany({
      where: { userId },
      data: { isDefault: false },
    });

    // Set this one
    const updated = await prisma.userBankAccount.update({
      where: { id: parseInt(String(id)), userId },
      data: { isDefault: true },
    });

    res.json({
      status: 'success',
      data: updated,
    });
  })
);

// Delete bank account
router.delete(
  '/bank-accounts/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;
    const password = req.body.password || req.query.password;

    if (!password) {
      throw new AppException(400, 'Veuillez saisir votre mot de passe pour confirmer la suppression');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppException(401, 'Utilisateur non trouvé');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppException(400, 'Mot de passe incorrect');
    }

    const bankAccount = await prisma.userBankAccount.findFirst({
      where: { id: parseInt(String(id)), userId },
    });

    if (!bankAccount) {
      throw new AppException(404, 'Bank account not found');
    }

    // Only allow deleting if not APPROVED or if admin
    await prisma.userBankAccount.delete({
      where: { id: parseInt(String(id)) },
    });

    res.json({
      status: 'success',
      message: 'Bank account deleted',
    });
  })
);

const RESERVED_SUBDOMAINS = [
  'admin', 'api', 'www', 'app', 'mail', 'blog', 'cdn', 'static',
  'support', 'help', 'helper', 'auth', 'login', 'register', 'root',
  'status', 'portal', 'billing', 'pay', 'checkout', 'shop', 'store',
  'dev', 'test', 'prod', 'localhost', 'system', 'secure', 'web',
  'damanesign', 'youcan', 'silacod', 'silacod-dev', 'custom'
];

router.get(
  '/check-subdomain',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.query;
    if (!name || typeof name !== 'string') {
      return res.json({ available: false, message: 'Nom invalide' });
    }

    const subdomain = name.trim().toLowerCase();
    if (subdomain.length < 3 || subdomain.length > 30) {
      return res.json({ available: false, message: 'Le sous-domaine doit contenir entre 3 et 30 caractères' });
    }

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(subdomain)) {
      return res.json({ available: false, message: 'Le sous-domaine ne doit contenir que des lettres minuscules, chiffres et tirets, sans tirets consécutifs ou aux extrémités' });
    }

    if (RESERVED_SUBDOMAINS.includes(subdomain)) {
      return res.json({ available: false, message: 'Ce nom de sous-domaine est réservé' });
    }

    const { containsBlockedWord } = await import('../utils/blockedWords.js');
    if (containsBlockedWord(subdomain)) {
      return res.json({ available: false, message: 'Ce sous-domaine contient un mot interdit' });
    }

    // Check if another user already has this subdomain
    const existing = await prisma.user.findFirst({
      where: {
        subdomain,
        NOT: { id: req.user!.id }
      }
    });

    if (existing) {
      return res.json({ available: false, message: 'Ce sous-domaine est déjà pris' });
    }

    return res.json({ available: true, message: 'Ce sous-domaine est disponible' });
  })
);

router.post(
  '/save-subdomain',
  authenticate,
  [
    body('subdomain').trim().notEmpty().toLowerCase()
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Format de sous-domaine invalide');
    }

    const subdomain = req.body.subdomain.trim().toLowerCase();
    if (subdomain.length < 3 || subdomain.length > 30) {
      throw new AppException(400, 'Le sous-domaine doit contenir entre 3 et 30 caractères');
    }

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(subdomain)) {
      throw new AppException(400, 'Format invalide (lettres minuscules, chiffres et tirets uniquement)');
    }

    if (RESERVED_SUBDOMAINS.includes(subdomain)) {
      throw new AppException(400, 'Ce nom de sous-domaine est réservé');
    }

    const { containsBlockedWord } = await import('../utils/blockedWords.js');
    if (containsBlockedWord(subdomain)) {
      throw new AppException(400, 'Ce sous-domaine contient un mot interdit');
    }

    // Check uniqueness
    const existing = await prisma.user.findFirst({
      where: {
        subdomain,
        NOT: { id: req.user!.id }
      }
    });

    if (existing) {
      throw new AppException(400, 'Ce sous-domaine est déjà pris');
    }

    // Save
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { subdomain }
    });

    // Check and activate user since subdomain is now set (Step 1)
    await checkAndActivateUser(req.user!.id);

    // Get the final user status
    const finalUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { profile: true, role: true }
    });

    res.json({
      status: 'success',
      message: 'Sous-domaine enregistré avec succès',
      data: {
        user: {
          id: finalUser?.id,
          uuid: finalUser?.uuid,
          email: finalUser?.email,
          phone: finalUser?.phone,
          fullName: finalUser?.profile?.fullName,
          role: finalUser?.role.name,
          kycStatus: finalUser?.kycStatus,
          isActive: finalUser?.isActive,
          subdomain: finalUser?.subdomain,
          customDomain: finalUser?.customDomain,
          customDomainStatus: finalUser?.customDomainStatus,
          mode: finalUser?.mode
        }
      }
    });
  })
);

router.post(
  '/revert-impersonate',
  (req: Request, res: Response) => {
    const cookies = parseCookies(req.headers.cookie);
    const originalToken = cookies['originalToken'];
    const originalRefreshToken = cookies['originalRefreshToken'];

    if (!originalToken || !originalRefreshToken) {
      return res.status(400).json({
        status: 'error',
        message: 'No active impersonation session found'
      });
    }

    // Clear impersonation cookies
    res.clearCookie('originalToken', { path: '/' });
    res.clearCookie('originalRefreshToken', { path: '/' });

    // Restore original tokens
    res.cookie('token', originalToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('refreshToken', originalRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      status: 'success',
      message: 'Reverted impersonation successfully',
      data: {
        token: originalToken,
        refreshToken: originalRefreshToken
      }
    });
  }
);

// ─── POST /auth/subdomain/send-otp ───────────────────────────────────────────
router.post(
  '/subdomain/send-otp',
  authenticate,
  [
    body('subdomain')
      .notEmpty()
      .withMessage('Subdomain is required')
      .trim()
      .toLowerCase()
      .custom((value) => {
        const cleaned = value.trim().toLowerCase();
        const regex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
        if (!regex.test(cleaned) || cleaned.length < 3 || cleaned.length > 30) {
          throw new Error('Only lowercase letters, numbers, and hyphens are allowed (3-30 chars).');
        }
        return true;
      }),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, errors.array()[0].msg, errors.array());
    }

    const { subdomain } = req.body;
    const cleanedSubdomain = subdomain.trim().toLowerCase();
    const userId = req.user!.id;

    // Check if the subdomain is already taken by another user
    const existing = await prisma.user.findFirst({
      where: {
        subdomain: cleanedSubdomain,
        NOT: { id: userId }
      }
    });

    if (existing) {
      throw new AppException(400, 'This subdomain is already taken. Please try another.');
    }

    // Generate and save OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.user.update({
      where: { id: userId },
      data: {
        emailOtp: otp,
        emailOtpExpiry: otpExpiry
      } as any
    });

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Subdomain OTP for ${req.user!.email}: ${otp}`);
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { language: true }
    });
    const langCode = dbUser?.language || 'fr';
    await sendOtpEmail(req.user!.email, otp, langCode);

    res.json({
      status: 'success',
      message: 'Verification OTP sent to your email.'
    });
  })
);

// ─── POST /auth/subdomain/verify-otp ────────────────────────────────────────
router.post(
  '/subdomain/verify-otp',
  authenticate,
  [
    body('subdomain')
      .notEmpty()
      .withMessage('Subdomain is required')
      .trim()
      .toLowerCase(),
    body('otp')
      .notEmpty()
      .withMessage('OTP is required')
      .trim()
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, errors.array()[0].msg, errors.array());
    }

    const { subdomain, otp } = req.body;
    const cleanedSubdomain = subdomain.trim().toLowerCase();
    const userId = req.user!.id;

    // Verify user otp
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new AppException(404, 'User not found');
    }

    if (!user.emailOtp || !user.emailOtpExpiry) {
      throw new AppException(400, 'No verification OTP found. Please send a new code.');
    }

    if (new Date() > user.emailOtpExpiry) {
      throw new AppException(400, 'The verification code has expired. Please send a new one.');
    }

    if (user.emailOtp !== otp) {
      throw new AppException(400, 'Invalid verification code.');
    }

    // Double check if the subdomain has been taken in the meantime
    const existing = await prisma.user.findFirst({
      where: {
        subdomain: cleanedSubdomain,
        NOT: { id: userId }
      }
    });

    if (existing) {
      throw new AppException(400, 'This subdomain is already taken. Please try another.');
    }

    // Update user subdomain
    await prisma.user.update({
      where: { id: userId },
      data: {
        subdomain: cleanedSubdomain,
        emailOtp: null,
        emailOtpExpiry: null
      } as any
    });

    res.json({
      status: 'success',
      message: 'Subdomain updated successfully!',
      data: { subdomain: cleanedSubdomain }
    });
  })
);

export default router;
