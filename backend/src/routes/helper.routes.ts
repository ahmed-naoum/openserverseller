import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * GET /api/v1/helper/affiliate/stats
 * Fetch Helper's affiliate link, invited accounts count, delivered leads count, earnings, and withdrawal history.
 */
router.get(
  '/affiliate/stats',
  authenticate,
  authorize('HELPER', 'SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    // Get current helper user
    let user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true, profile: true }
    });

    if (!user) {
      throw new AppException(404, 'User not found');
    }

    // Ensure helper has a referral code
    if (!user.referralCode) {
      const newRefCode = `HELP-${user.uuid.slice(0, 6).toUpperCase()}`;
      user = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: newRefCode },
        include: { role: true, profile: true }
      });
    }

    // Fetch all users invited by this helper via referral link
    const assignments = await (prisma as any).helperUserAssignment.findMany({
      where: { helperId: userId, isAffiliateInvite: true },
      include: {
        targetUser: {
          include: {
            role: true,
            profile: true
          }
        }
      },
      orderBy: { assignedAt: 'desc' }
    });

    const targetUserIds = assignments.map((a: any) => a.targetUserId);

    // Calculate lead stats for target users
    let totalLeads = 0;
    let deliveredLeads = 0;
    let userLeadStats: Record<number, { totalLeads: number; deliveredLeads: number }> = {};

    if (targetUserIds.length > 0) {
      const leadsGroup = await prisma.lead.groupBy({
        by: ['vendorId', 'status'],
        where: {
          vendorId: { in: targetUserIds }
        },
        _count: { id: true }
      });

      leadsGroup.forEach(group => {
        const vId = group.vendorId;
        if (!userLeadStats[vId]) {
          userLeadStats[vId] = { totalLeads: 0, deliveredLeads: 0 };
        }
        userLeadStats[vId].totalLeads += group._count.id;
        totalLeads += group._count.id;

        if (group.status === 'DELIVERED') {
          userLeadStats[vId].deliveredLeads += group._count.id;
          deliveredLeads += group._count.id;
        }
      });
    }

    const commissionRate = user.helperCommissionPerDeliveredLead ?? 5.0;
    const totalEarnings = deliveredLeads * commissionRate;

    // Fetch Helper payout requests
    const payoutRequests = await prisma.payoutRequest.findMany({
      where: { vendorId: userId },
      orderBy: { createdAt: 'desc' }
    });

    let withdrawnEarnings = 0;
    let pendingEarnings = 0;

    payoutRequests.forEach((p) => {
      if (['COMPLETED', 'RECEIVED'].includes(p.status)) {
        withdrawnEarnings += p.amountMad;
      } else if (p.status === 'PENDING') {
        pendingEarnings += p.amountMad;
      }
    });

    const availableEarnings = Math.max(0, totalEarnings - withdrawnEarnings - pendingEarnings);

    const invitedUsers = assignments.map((a: any) => {
      const u = a.targetUser;
      const stats = userLeadStats[u.id] || { totalLeads: 0, deliveredLeads: 0 };
      return {
        id: u.id,
        uuid: u.uuid,
        fullName: u.profile?.fullName || 'N/A',
        email: u.email,
        phone: u.phone,
        role: u.role?.name || 'VENDOR',
        isActive: u.isActive,
        isAffiliateInvite: !!a.isAffiliateInvite,
        createdAt: a.assignedAt || u.createdAt,
        totalLeads: stats.totalLeads,
        deliveredLeads: stats.deliveredLeads,
        earningsGenerated: stats.deliveredLeads * commissionRate
      };
    });

    const safeProfileRib = user.profile?.ribAccount ? decrypt(user.profile.ribAccount) : '';

    res.json({
      status: 'success',
      data: {
        referralCode: user.referralCode,
        canManageAffiliateInvites: user.canManageAffiliateInvites,
        commissionPerDeliveredLead: commissionRate,
        totalInvitedUsers: invitedUsers.length,
        totalLeads,
        deliveredLeads,
        totalEarnings,
        withdrawnEarnings,
        pendingEarnings,
        availableEarnings,
        defaultBankName: user.profile?.bankName || '',
        defaultRibAccount: safeProfileRib,
        payoutHistory: payoutRequests.map(p => ({
          id: p.id,
          amountMad: p.amountMad,
          bankName: p.bankName,
          ribAccount: decrypt(p.ribAccount),
          status: p.status,
          createdAt: p.createdAt,
          processedAt: p.processedAt
        })),
        invitedUsers
      }
    });
  })
);

/**
 * POST /api/v1/helper/affiliate/withdraw
 * Submit a withdrawal request for Helper affiliate earnings.
 */
router.post(
  '/affiliate/withdraw',
  authenticate,
  authorize('HELPER', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { amountMad, bankName, ribAccount } = req.body;

    if (!amountMad || Number(amountMad) < 50) {
      throw new AppException(400, 'Le montant minimum de retrait est de 50 DH');
    }
    if (!bankName || !ribAccount) {
      throw new AppException(400, 'Veuillez renseigner la banque et le RIB');
    }

    const cleanRib = String(ribAccount).replace(/\D/g, '');
    if (cleanRib.length !== 24) {
      throw new AppException(400, 'Le numéro RIB doit comporter exactement 24 chiffres');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });
    if (!user) throw new AppException(404, 'Helper user not found');

    if (!user.canManageAffiliateInvites) {
      throw new AppException(403, 'Accès au programme d\'affiliation désactivé');
    }

    // 1. Calculate Helper total earnings
    const assignments = await (prisma as any).helperUserAssignment.findMany({
      where: { helperId: userId, isAffiliateInvite: true }
    });

    const targetUserIds = assignments.map((a: any) => a.targetUserId);

    let deliveredLeads = 0;
    if (targetUserIds.length > 0) {
      deliveredLeads = await prisma.lead.count({
        where: {
          vendorId: { in: targetUserIds },
          status: 'DELIVERED'
        }
      });
    }

    const commissionRate = user.helperCommissionPerDeliveredLead ?? 5.0;
    const totalEarnings = deliveredLeads * commissionRate;

    // 2. Existing payouts
    const existingPayouts = await prisma.payoutRequest.findMany({
      where: { vendorId: userId }
    });

    let committedAmount = 0;
    existingPayouts.forEach((p) => {
      if (['PENDING', 'COMPLETED', 'RECEIVED'].includes(p.status)) {
        committedAmount += p.amountMad;
      }
    });

    const availableEarnings = Math.max(0, totalEarnings - committedAmount);
    const requestedAmount = Number(amountMad);

    if (requestedAmount > availableEarnings) {
      throw new AppException(
        400,
        `Montant demandé (${requestedAmount} DH) supérieur aux gains disponibles (${availableEarnings} DH)`
      );
    }

    // 3. Create PayoutRequest
    const payout = await prisma.payoutRequest.create({
      data: {
        vendorId: userId,
        amountMad: requestedAmount,
        bankName: String(bankName).trim(),
        ribAccount: encrypt(cleanRib),
        status: 'PENDING'
      }
    });

    // Update bank info on profile if empty
    if (user.profile && (!user.profile.bankName || !user.profile.ribAccount)) {
      await prisma.userProfile.update({
        where: { userId },
        data: {
          bankName: String(bankName).trim(),
          ribAccount: encrypt(cleanRib)
        }
      }).catch(() => {});
    }

    res.status(201).json({
      status: 'success',
      message: 'Demande de retrait d\'affiliation soumise avec succès',
      data: { payoutId: payout.id, amountMad: payout.amountMad }
    });
  })
);

export default router;
