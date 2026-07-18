import { prisma } from '../lib/prisma.js';
import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { v4 as uuidv4 } from 'uuid';
import { decrypt, encrypt } from '../utils/crypto.js';

const router = Router();

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
          platformFeeRate: u.platformFeeRate,
          saisieFeeMad: u.saisieFeeMad,
          autoAssignInfluencers: u.autoAssignInfluencers,
          autoAssignHelperUsers: u.autoAssignHelperUsers,
          canManageProducts: u.canManageProducts,
          canManageLeads: u.canManageLeads,
          canManageOrders: u.canManageOrders,
          canManageInfluencerLinks: u.canManageInfluencerLinks,
          canManageTickets: u.canManageTickets,
          canScanReturns: u.canScanReturns,
          canDisplayOnDashboard: u.canDisplayOnDashboard,
          cguAccepted: u.cguAccepted,
          cguAcceptedAt: u.cguAcceptedAt,
          createdAt: u.createdAt,
          subdomain: u.subdomain,
          customDomain: u.customDomain,
          customDomainStatus: u.customDomainStatus,
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

router.get(
  '/role-counts',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN', 'HELPER'),
  asyncHandler(async (req, res) => {
    const where: any = {};
    if (req.user!.roleName === 'HELPER') {
      const assignments = await (prisma as any).helperUserAssignment.findMany({
        where: { helperId: req.user!.id }
      });
      const assignedUserIds = assignments.map((a: any) => a.targetUserId);
      where.id = { in: assignedUserIds };
    }

    const counts = await prisma.user.groupBy({
      by: ['roleId'],
      where,
      _count: { id: true },
    });

    const roles = await prisma.role.findMany();
    const roleMap = roles.reduce((acc: any, r) => {
      acc[r.id] = r.name;
      return acc;
    }, {});

    const statistics: Record<string, number> = {
      TOTAL: await prisma.user.count({ where }),
    };

    counts.forEach((c) => {
      const roleName = roleMap[c.roleId];
      if (roleName) {
        statistics[roleName] = c._count.id;
      }
    });

    res.json({
      status: 'success',
      data: statistics,
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
        isInfluencer: role === 'INFLUENCER',
        referralCode: role === 'INFLUENCER' ? uuidv4().slice(0, 8).toUpperCase() : null,
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

    // Auto-assign global agents if this is an influencer or vendor
    if (role === 'INFLUENCER' || role === 'VENDOR') {
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

    // Auto-assign new user to helpers with autoAssignHelperUsers enabled
    const globalHelpers = await prisma.user.findMany({
      where: {
        role: { name: 'HELPER' },
        autoAssignHelperUsers: true
      }
    });

    if (globalHelpers.length > 0 && !['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(role)) {
      await (prisma as any).helperUserAssignment.createMany({
        data: globalHelpers.map((helper: any) => ({
          helperId: helper.id,
          targetUserId: user.id
        })),
        skipDuplicates: true,
      });
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
    const {
      fullName, email, phone, role, isActive, kycStatus,
      canImpersonate, canManageProducts, canManageLeads, canManageOrders, canManageInfluencerLinks, canManageTickets, canScanReturns, canDisplayOnDashboard,
      city, address, cinNumber, birthDate, language, avatarUrl,
      instagramUsername, tiktokUsername, facebookUsername, xUsername, youtubeUsername, snapchatUsername,
      instagramUrl, tiktokUrl, facebookUrl, youtubeUrl, snapchatUrl,
      ribAccount, bankName, iceNumber, bankStatus, platformFeeRate, saisieFeeMad
    } = req.body;

    const user = await prisma.user.findUnique({
      where: { uuid },
      include: { role: true, profile: true },
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

    // Update bank details
    if (ribAccount !== undefined || bankName !== undefined || iceNumber !== undefined || bankStatus !== undefined) {
      const existingBank = await prisma.userBankAccount.findFirst({
        where: { userId: user.id, isDefault: true }
      });
      if (existingBank) {
        await prisma.userBankAccount.update({
          where: { id: existingBank.id },
          data: {
            ribAccount: ribAccount !== undefined ? (ribAccount ? encrypt(ribAccount) : '') : undefined,
            bankName: bankName !== undefined ? bankName : undefined,
            iceNumber: iceNumber !== undefined ? iceNumber : undefined,
            status: bankStatus !== undefined ? bankStatus : undefined
          }
        });
      } else {
        await prisma.userBankAccount.create({
          data: {
            userId: user.id,
            ribAccount: ribAccount ? encrypt(ribAccount) : '',
            bankName: bankName || '',
            iceNumber: iceNumber || '',
            status: bankStatus || 'PENDING',
            isDefault: true
          }
        });
      }
    }

    // Upsert Profile
    const profileData: any = {};
    if (fullName !== undefined) profileData.fullName = fullName;
    if (city !== undefined) profileData.city = city;
    if (address !== undefined) profileData.address = address;
    if (cinNumber !== undefined) profileData.cinNumber = cinNumber;
    if (birthDate !== undefined) profileData.birthDate = birthDate ? new Date(birthDate) : null;
    if (language !== undefined) profileData.language = language;
    if (avatarUrl !== undefined) profileData.avatarUrl = avatarUrl;
    if (instagramUsername !== undefined) profileData.instagramUsername = instagramUsername;
    if (tiktokUsername !== undefined) profileData.tiktokUsername = tiktokUsername;
    if (facebookUsername !== undefined) profileData.facebookUsername = facebookUsername;
    if (xUsername !== undefined) profileData.xUsername = xUsername;
    if (youtubeUsername !== undefined) profileData.youtubeUsername = youtubeUsername;
    if (snapchatUsername !== undefined) profileData.snapchatUsername = snapchatUsername;

    const existingMeta = user.profile?.metadata ? (user.profile.metadata as any) : {};
    const updatedMeta = {
      ...existingMeta,
      ...(instagramUrl !== undefined ? { instagramUrl: instagramUrl || null } : {}),
      ...(tiktokUrl !== undefined ? { tiktokUrl: tiktokUrl || null } : {}),
      ...(facebookUrl !== undefined ? { facebookUrl: facebookUrl || null } : {}),
      ...(youtubeUrl !== undefined ? { youtubeUrl: youtubeUrl || null } : {}),
      ...(snapchatUrl !== undefined ? { snapchatUrl: snapchatUrl || null } : {}),
    };
    profileData.metadata = updatedMeta;

    if (Object.keys(profileData).length > 0) {
      await prisma.userProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          ...profileData
        },
        update: profileData
      });
    }

    // Update User
    const updatedUser = await prisma.user.update({
      where: { uuid },
      data: {
        email: email !== undefined ? email : undefined,
        phone: phone !== undefined ? phone : undefined,
        role: { connect: { id: roleId } },
        ...(role !== undefined ? {
          isInfluencer: role === 'INFLUENCER',
          ...(role === 'INFLUENCER' && !user.referralCode ? { referralCode: uuidv4().slice(0, 8).toUpperCase() } : {})
        } : {}),
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        kycStatus: kycStatus !== undefined ? kycStatus : undefined,
        canImpersonate: typeof canImpersonate === 'boolean' ? canImpersonate : undefined,
        canManageProducts: typeof canManageProducts === 'boolean' ? canManageProducts : undefined,
        canManageLeads: typeof canManageLeads === 'boolean' ? canManageLeads : undefined,
        canManageOrders: typeof canManageOrders === 'boolean' ? canManageOrders : undefined,
        canManageInfluencerLinks: typeof canManageInfluencerLinks === 'boolean' ? canManageInfluencerLinks : undefined,
        canManageTickets: typeof canManageTickets === 'boolean' ? canManageTickets : undefined,
        canScanReturns: typeof canScanReturns === 'boolean' ? canScanReturns : undefined,
        canDisplayOnDashboard: typeof canDisplayOnDashboard === 'boolean' ? canDisplayOnDashboard : undefined,
        platformFeeRate: platformFeeRate !== undefined ? Number(platformFeeRate) : undefined,
        saisieFeeMad: saisieFeeMad !== undefined ? Number(saisieFeeMad) : undefined,
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
        questionnaire: true,
        influencerQuestionnaire: true,
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
          bankAccounts: user.bankAccounts.map((account: any) => ({
            ...account,
            ribAccount: decrypt(account.ribAccount)
          })),
          instagramUsername: user.profile?.instagramUsername,
          tiktokUsername: user.profile?.tiktokUsername,
          facebookUsername: user.profile?.facebookUsername,
          xUsername: user.profile?.xUsername,
          youtubeUsername: user.profile?.youtubeUsername,
          snapchatUsername: user.profile?.snapchatUsername,
          autoAssignInfluencers: user.autoAssignInfluencers,
          canImpersonate: user.canImpersonate,
          canManageProducts: user.canManageProducts,
          canManageLeads: user.canManageLeads,
          canManageOrders: user.canManageOrders,
          canManageInfluencerLinks: user.canManageInfluencerLinks,
          canManageTickets: user.canManageTickets,
          canScanReturns: user.canScanReturns,
          canDisplayOnDashboard: user.canDisplayOnDashboard,
          platformFeeRate: user.platformFeeRate,
          saisieFeeMad: user.saisieFeeMad,
          cguAccepted: user.cguAccepted,
          cguAcceptedAt: user.cguAcceptedAt,
          createdAt: user.createdAt,
          subdomain: user.subdomain,
          customDomain: user.customDomain,
          customDomainStatus: user.customDomainStatus,
          questionnaire: user.questionnaire,
          influencerQuestionnaire: (user as any).influencerQuestionnaire,
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
            ribAccount: ribAccount ? encrypt(ribAccount) : existingBank.ribAccount,
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
            ribAccount: ribAccount ? encrypt(ribAccount) : '',
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

    if (!user) {
      throw new AppException(404, 'User not found');
    }

    // Generate a random 8-character password
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let tempPassword = '';
    for (let i = 0; i < 8; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      tempPassword += charset[randomIndex];
    }

    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.default.hash(tempPassword, 10);

    await prisma.user.update({
      where: { uuid },
      data: {
        password: hashedPassword,
        requiresPasswordChange: true,
      },
    });

    res.json({
      status: 'success',
      message: 'Mot de passe temporaire généré avec succès.',
      data: { tempPassword },
    });
  })
);

router.delete(
  '/:uuid',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const { uuid } = req.params;

    // Prevent deleting yourself
    if (req.user!.uuid === uuid) {
      throw new AppException(400, 'Vous ne pouvez pas supprimer votre propre compte.');
    }

    const user = await prisma.user.findUnique({
      where: { uuid },
      include: { role: true },
    });

    if (!user) {
      throw new AppException(404, 'Utilisateur introuvable.');
    }

    // Prevent deleting other SUPER_ADMIN accounts
    if (user.role.name === 'SUPER_ADMIN') {
      throw new AppException(403, 'Impossible de supprimer un compte Super Admin.');
    }

    // Delete all related data in a transaction using raw SQL for safety
    await prisma.$transaction(async (tx) => {
      const userId = user.id;

      // Delete helper-user assignments
      await tx.$executeRawUnsafe(`DELETE FROM helper_user_assignments WHERE "helperId" = $1 OR "targetUserId" = $1`, userId);

      // Delete agent-influencer assignments
      await tx.$executeRawUnsafe(`DELETE FROM agent_influencer_assignments WHERE "agentId" = $1 OR "influencerId" = $1`, userId);

      // Delete referral link related data
      await tx.$executeRawUnsafe(`DELETE FROM referral_link_clicks WHERE "referralLinkId" IN (SELECT id FROM referral_links WHERE "influencerId" = $1)`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM referral_link_landing_pages WHERE "referralLinkId" IN (SELECT id FROM referral_links WHERE "influencerId" = $1)`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM influencer_commissions WHERE "referralLinkId" IN (SELECT id FROM referral_links WHERE "influencerId" = $1)`, userId);
      await tx.$executeRawUnsafe(`UPDATE leads SET "referralLinkId" = NULL WHERE "referralLinkId" IN (SELECT id FROM referral_links WHERE "influencerId" = $1)`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM referral_links WHERE "influencerId" = $1`, userId);

      // Delete affiliate claims
      await tx.$executeRawUnsafe(`DELETE FROM affiliate_claims WHERE "userId" = $1`, userId);

      // Delete conversation logs, messages, and participations
      await tx.$executeRawUnsafe(`DELETE FROM conversation_logs WHERE "userId" = $1`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM messages WHERE "senderId" = $1`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM conversation_participants WHERE "userId" = $1`, userId);

      // Unlink conversations from support requests, then delete support requests
      await tx.$executeRawUnsafe(`UPDATE conversations SET "supportRequestId" = NULL WHERE "supportRequestId" IN (SELECT id FROM support_requests WHERE "userId" = $1)`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM support_requests WHERE "userId" = $1`, userId);

      // Delete notifications
      await tx.$executeRawUnsafe(`DELETE FROM notifications WHERE "userId" = $1`, userId);

      // Delete activity logs
      await tx.$executeRawUnsafe(`DELETE FROM activity_logs WHERE "userId" = $1`, userId);

      // Delete lead status history, call logs, lead assignments by this user
      await tx.$executeRawUnsafe(`DELETE FROM lead_status_history WHERE "changedBy" = $1`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM call_logs WHERE "agentId" = $1`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM lead_assignments WHERE "agentId" = $1`, userId);

      // Delete order-related sub-records then orders
      await tx.$executeRawUnsafe(`DELETE FROM order_status_history WHERE "orderId" IN (SELECT id FROM orders WHERE "vendorId" = $1)`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM order_returns WHERE "orderId" IN (SELECT id FROM orders WHERE "vendorId" = $1)`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM influencer_commissions WHERE "orderId" IN (SELECT id FROM orders WHERE "vendorId" = $1)`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM wallet_transactions WHERE "orderId" IN (SELECT id FROM orders WHERE "vendorId" = $1)`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM shipment_tracking_events WHERE "shipmentId" IN (SELECT id FROM shipments WHERE "orderId" IN (SELECT id FROM orders WHERE "vendorId" = $1))`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM shipment_delivery_proofs WHERE "shipmentId" IN (SELECT id FROM shipments WHERE "orderId" IN (SELECT id FROM orders WHERE "vendorId" = $1))`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM shipments WHERE "orderId" IN (SELECT id FROM orders WHERE "vendorId" = $1)`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM production_jobs WHERE "orderId" IN (SELECT id FROM orders WHERE "vendorId" = $1)`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM order_items WHERE "orderId" IN (SELECT id FROM orders WHERE "vendorId" = $1)`, userId);

      // Delete payout requests
      await tx.$executeRawUnsafe(`DELETE FROM payout_requests WHERE "vendorId" = $1`, userId);

      // Delete wallet transactions then wallet
      await tx.$executeRawUnsafe(`DELETE FROM wallet_transactions WHERE "walletId" IN (SELECT id FROM wallets WHERE "userId" = $1)`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM wallets WHERE "userId" = $1`, userId);

      // Nullify lead invoice references, then delete orders
      await tx.$executeRawUnsafe(`UPDATE leads SET "invoiceId" = NULL WHERE "vendorId" = $1`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM orders WHERE "vendorId" = $1`, userId);

      // Delete lead sub-records then leads
      await tx.$executeRawUnsafe(`DELETE FROM lead_status_history WHERE "leadId" IN (SELECT id FROM leads WHERE "vendorId" = $1)`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM call_logs WHERE "leadId" IN (SELECT id FROM leads WHERE "vendorId" = $1)`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM lead_assignments WHERE "leadId" IN (SELECT id FROM leads WHERE "vendorId" = $1)`, userId);
      await tx.$executeRawUnsafe(`DELETE FROM leads WHERE "vendorId" = $1`, userId);

      // Delete lead import batches
      await tx.$executeRawUnsafe(`DELETE FROM lead_import_batches WHERE "vendorId" = $1`, userId);

      // Delete user pixels
      await tx.$executeRawUnsafe(`DELETE FROM user_pixels WHERE "userId" = $1`, userId);

      // Delete product inventory
      await tx.$executeRawUnsafe(`DELETE FROM product_inventory WHERE "userId" = $1`, userId);

      // Delete favorites
      await tx.$executeRawUnsafe(`DELETE FROM favorites WHERE "userId" = $1`, userId);

      // Delete invoices
      await tx.$executeRawUnsafe(`DELETE FROM invoices WHERE "userId" = $1`, userId);

      // Unlink targeted announcements
      await tx.$executeRawUnsafe(`UPDATE announcements SET "targetUserId" = NULL WHERE "targetUserId" = $1`, userId);

      // Delete KYC documents
      await tx.$executeRawUnsafe(`DELETE FROM kyc_documents WHERE "userId" = $1`, userId);

      // Delete bank accounts
      await tx.$executeRawUnsafe(`DELETE FROM user_bank_accounts WHERE "userId" = $1`, userId);

      // Delete profile
      await tx.$executeRawUnsafe(`DELETE FROM user_profiles WHERE "userId" = $1`, userId);

      // Finally, delete the user
      await tx.$executeRawUnsafe(`DELETE FROM users WHERE id = $1`, userId);
    });

    res.json({
      status: 'success',
      message: 'Utilisateur supprimé avec succès.',
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
