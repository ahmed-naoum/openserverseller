import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { checkAndActivateUser } from '../utils/verification.js';

const router = Router();
const prisma = new PrismaClient();

router.get(
  '/dashboard',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const [
      totalUsers,
      totalVendors,
      totalAgents,
      pendingVerifications,
      totalProducts,
      totalOrders,
      pendingOrders,
      totalRevenue,
      totalPayouts,
      pendingPayouts,
      totalLeads,
      unassignedLeads,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: { name: 'VENDOR' } } }),
      prisma.user.count({ where: { role: { name: 'CALL_CENTER_AGENT' } } }),
      prisma.user.count({ where: { kycStatus: { in: ['PENDING', 'UNDER_REVIEW'] } } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.aggregate({
        _sum: { totalAmountMad: true },
        where: { status: 'DELIVERED' },
      }),
      prisma.wallet.aggregate({ _sum: { totalWithdrawnMad: true } }),
      prisma.payoutRequest.count({ where: { status: 'PENDING' } }),
      prisma.lead.count(),
      prisma.lead.count({ where: { assignedAgentId: null } }),
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ordersByDay = await prisma.$queryRaw`
      SELECT DATE("createdAt") as date, COUNT(*) as count, SUM("totalAmountMad") as revenue
      FROM orders
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("createdAt")
      ORDER BY date DESC
    `;

    const topVendors = await prisma.user.findMany({
      where: { role: { name: 'VENDOR' } },
      include: {
        profile: true,
        orders: {
          where: { status: 'DELIVERED' },
          select: { totalAmountMad: true },
        },
      },
      take: 10,
    });

    res.json({
      status: 'success',
      data: {
        stats: {
          users: { total: totalUsers, vendors: totalVendors, agents: totalAgents },
          verifications: { pending: pendingVerifications },
          products: totalProducts,
          orders: { total: totalOrders, pending: pendingOrders },
          revenue: { total: totalRevenue._sum.totalAmountMad || 0 },
          payouts: {
            total: totalPayouts._sum.totalWithdrawnMad || 0,
            pending: pendingPayouts,
          },
          leads: { total: totalLeads, unassigned: unassignedLeads },
        },
        charts: {
          ordersByDay,
        },
        topVendors: topVendors.map((v) => ({
          uuid: v.uuid,
          fullName: v.profile?.fullName,
          totalRevenue: v.orders.reduce(
            (sum, o) => sum + Number(o.totalAmountMad),
            0
          ),
        })),
      },
    });
  })
);

router.get(
  '/audit-logs',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 50, userId, action } = req.query;

    const where: any = {};
    if (userId) where.userId = BigInt(userId as string);
    if (action) where.action = { contains: action as string, mode: 'insensitive' };

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: { include: { profile: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: {
        logs,
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

// Get all affiliate claims for approval
router.get(
  '/affiliate-claims',
  authenticate,
  authorize('SUPER_ADMIN', 'SYSTEM_SUPPORT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { status = 'PENDING' } = req.query;

    const claims = await prisma.affiliateClaim.findMany({
      where: status !== 'ALL' ? { status: status as string } : {},
      include: {
        user: { include: { profile: true, role: true } },
        product: { include: { images: { where: { isPrimary: true }, take: 1 }, categories: true } }
      },
      orderBy: { claimedAt: 'desc' }
    });

    // Find conversations linked to these claims
    const conversations = await prisma.conversation.findMany({
        where: { type: 'SUPPORT' },
        select: { id: true, metadata: true }
    });

    const claimsWithConv = claims.map(claim => {
        const conv = conversations.find(c => {
            const meta = (c.metadata as any) || {};
            return meta.affiliateClaimId === claim.id;
        });
        return {
            ...claim,
            conversationId: conv?.id || null
        };
    });

    res.json({
      status: 'success',
      data: claimsWithConv
    });
  })
);

// Approve or reject an affiliate claim
router.patch(
  '/affiliate-claims/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'SYSTEM_SUPPORT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, actionType, cloneName, cloneDescription, clonePrice, cloneImageUrls, cloneQuantity } = req.body;

    if (!['APPROVED', 'REJECTED', 'REVOKED', 'CLONED'].includes(status)) {
      res.status(400).json({ status: 'error', message: 'Invalid status' });
      return;
    }

    const claim = await prisma.$transaction(async (tx) => {
        const currentClaim = await tx.affiliateClaim.findUnique({
            where: { id: Number(id) },
        });

        if (!currentClaim) {
            throw new AppException(404, 'Claim not found');
        }

        if (actionType === 'CLONE_PRODUCT') {
            // Fetch original product
            const original = await tx.product.findUnique({
                where: { id: currentClaim.productId },
                include: { categories: true, images: { orderBy: { sortOrder: 'asc' } } },
            });
            if (!original) throw new AppException(404, 'Original product not found');

            // Get user info
            const targetUser = await tx.user.findUnique({
                where: { id: currentClaim.userId },
                include: { profile: true, role: true },
            });
            if (!targetUser) throw new AppException(404, 'User not found');

            const cloneSku = `${original.sku}-U${currentClaim.userId}`;
            
            // Check if clone SKU already exists, add timestamp if needed
            const existingSku = await tx.product.findUnique({ where: { sku: cloneSku } });
            const finalSku = existingSku ? `${cloneSku}-${Date.now()}` : cloneSku;

            const finalCloneName = cloneName || `${original.nameFr} (${targetUser.profile?.fullName || targetUser.email})`;

            // Clone the product
            const clonedProduct = await tx.product.create({
                data: {
                    sku: finalSku,
                    nameAr: cloneName || original.nameAr,
                    nameFr: finalCloneName,
                    nameEn: cloneName || original.nameEn,
                    description: cloneDescription || original.description,
                    longDescription: cloneDescription || original.longDescription,
                    baseCostMad: Number(original.baseCostMad),
                    retailPriceMad: clonePrice ? Number(clonePrice) : Number(original.retailPriceMad),
                    affiliatePriceMad: original.affiliatePriceMad ? Number(original.affiliatePriceMad) : null,
                    influencerPriceMad: original.influencerPriceMad ? Number(original.influencerPriceMad) : null,
                    isCustomizable: original.isCustomizable,
                    minProductionDays: original.minProductionDays,
                    stockQuantity: cloneQuantity ? Number(cloneQuantity) : original.stockQuantity,
                    visibility: ['NONE'],
                    status: 'APPROVED',
                    ownerId: currentClaim.userId,
                    videoUrls: original.videoUrls,
                    landingPageUrls: original.landingPageUrls,
                    commissionMad: Number(original.commissionMad),
                    categories: {
                        connect: (original as any).categories.map((c: any) => ({ id: c.id })),
                    },
                    ...((Array.isArray(cloneImageUrls) && cloneImageUrls.length > 0) ? {
                        images: {
                            create: cloneImageUrls.filter((u: any) => u && typeof u === 'string').map((url: string, idx: number) => ({
                                imageUrl: url,
                                isPrimary: idx === 0,
                                sortOrder: idx,
                            })),
                        },
                    } : ((original as any).images?.length > 0) ? {
                        images: {
                            create: (original as any).images.map((img: any, idx: number) => ({
                                imageUrl: img.imageUrl,
                                isPrimary: idx === 0,
                                sortOrder: idx,
                            })),
                        },
                    } : {}),
                },
            });

            // Point the existing claim to the cloned product and approve it
            return tx.affiliateClaim.update({
                where: { id: Number(id) },
                data: { 
                    status: 'APPROVED', 
                    productId: clonedProduct.id 
                }
            });
        }

        // Standard status update
        return tx.affiliateClaim.update({
            where: { id: Number(id) },
            data: { status }
        });
    });

    res.json({
      status: 'success',
      data: claim
    });
  })
);

// --- Campaign Management ---

// Get all campaigns
router.get(
  '/campaigns',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (_req: Request, res: Response) => {
    const campaigns = await prisma.influencerCampaign.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      status: 'success',
      data: campaigns
    });
  })
);

// Create a campaign
router.post(
  '/campaigns',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, description, productIds, commission, startDate, endDate, status } = req.body;

    const campaign = await prisma.influencerCampaign.create({
      data: {
        name,
        slug: name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '') + '-' + Date.now(),
        description,
        productIds: productIds || [],
        commission: parseFloat(commission),
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: status || 'DRAFT'
      }
    });

    res.status(201).json({
      status: 'success',
      data: campaign
    });
  })
);

// Update a campaign
router.patch(
  '/campaigns/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body;

    if (data.commission) data.commission = parseFloat(data.commission);
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);

    const campaign = await prisma.influencerCampaign.update({
      where: { id: Number(id) },
      data
    });

    res.json({
      status: 'success',
      data: campaign
    });
  })
);

// Delete a campaign
router.delete(
  '/campaigns/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    await prisma.influencerCampaign.delete({
      where: { id: Number(id) }
    });

    res.json({
      status: 'success',
      message: 'Campaign deleted successfully'
    });
  })
);

// Get all customers (aggregated from orders)
router.get(
  '/customers',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, search } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // Using queryRaw for complex aggregation that Prisma's groupBy handles but with limited flexibility for search
    // We'll aggregate by phone number which is our unique identifier for a customer
    const customers = await prisma.$queryRaw`
      SELECT 
        "customerPhone" as phone,
        MAX("customerName") as "fullName",
        MAX("customerCity") as city,
        MAX("customerAddress") as address,
        COUNT(id)::int as "totalOrders",
        SUM("totalAmountMad") as "totalSpent",
        MAX("createdAt") as "lastOrderDate"
      FROM orders
      WHERE 
        (${search}::text IS NULL OR 
         "customerName" ILIKE ${'%' + (search || '') + '%'} OR 
         "customerPhone" ILIKE ${'%' + (search || '') + '%'} OR 
         "customerCity" ILIKE ${'%' + (search || '') + '%'})
      GROUP BY "customerPhone"
      ORDER BY "lastOrderDate" DESC
      LIMIT ${take} OFFSET ${skip}
    `;

    // Get total count for pagination
    const totalCountResult: any = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT "customerPhone")::int as count
      FROM orders
      WHERE 
        (${search}::text IS NULL OR 
         "customerName" ILIKE ${'%' + (search || '') + '%'} OR 
         "customerPhone" ILIKE ${'%' + (search || '') + '%'} OR 
         "customerCity" ILIKE ${'%' + (search || '') + '%'})
    `;

    const total = totalCountResult[0]?.count || 0;

    res.json({
      status: 'success',
      data: {
        customers,
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

// ==========================================
// AGENT-INFLUENCER ASSIGNMENTS
// ==========================================

// List all assignments (optionally filter by agentId)
router.get(
  '/agent-influencer-assignments',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { agentId } = req.query;

    const where: any = {};
    if (agentId) where.agentId = Number(agentId);

    const assignments = await prisma.agentInfluencerAssignment.findMany({
      where,
      include: {
        agent: { include: { profile: true, role: true } },
        influencer: { include: { profile: true, role: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    res.json({
      status: 'success',
      data: assignments.map((a) => ({
        id: a.id,
        agentId: a.agentId,
        agentName: a.agent.profile?.fullName || a.agent.email || `Agent #${a.agentId}`,
        influencerId: a.influencerId,
        influencerName: a.influencer.profile?.fullName || a.influencer.email || `Influencer #${a.influencerId}`,
        assignedAt: a.assignedAt,
      })),
    });
  })
);

// List Helper-User assignments
router.get(
  '/helper-user-assignments',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { helperId } = req.query;

    const where: any = {};
    if (helperId) where.helperId = Number(helperId);

    const assignments = await (prisma as any).helperUserAssignment.findMany({
      where,
      include: {
        helper: { include: { profile: true, role: true } },
        targetUser: { include: { profile: true, role: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    res.json({
      status: 'success',
      data: assignments.map((a: any) => ({
        id: a.id,
        helperId: a.helperId,
        helperName: a.helper.profile?.fullName || a.helper.email || `Helper #${a.helperId}`,
        targetUserId: a.targetUserId,
        targetUserName: a.targetUser.profile?.fullName || a.targetUser.email || `User #${a.targetUserId}`,
        assignedAt: a.assignedAt,
      })),
    });
  })
);

// Set assignments for a helper (replaces all existing)
router.post(
  '/helper-user-assignments',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { helperId, targetUserIds } = req.body;

    if (!helperId || !Array.isArray(targetUserIds)) {
      res.status(400).json({ status: 'error', message: 'helperId and targetUserIds[] are required' });
      return;
    }

    // Verify helper exists and has HELPER role
    const helper = await prisma.user.findFirst({
      where: { id: Number(helperId), role: { name: 'HELPER' } },
    });
    if (!helper) {
      res.status(404).json({ status: 'error', message: 'Helper not found' });
      return;
    }

    // Transaction: delete old assignments, create new ones
    await (prisma as any).$transaction(async (tx: any) => {
      await tx.helperUserAssignment.deleteMany({
        where: { helperId: Number(helperId) },
      });

      if (targetUserIds.length > 0) {
        await tx.helperUserAssignment.createMany({
          data: targetUserIds.map((tid: number) => ({
            helperId: Number(helperId),
            targetUserId: Number(tid),
          })),
        });
      }
    });

    res.json({
      status: 'success',
      message: `Assigned ${targetUserIds.length} user(s) to helper`,
    });
  })
);

// Set assignments for an agent (replaces all existing)
router.post(
  '/agent-influencer-assignments',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { agentId, influencerIds, autoAssign } = req.body;

    if (!agentId || !Array.isArray(influencerIds)) {
      res.status(400).json({ status: 'error', message: 'agentId and influencerIds[] are required' });
      return;
    }

    // Verify agent exists and is CALL_CENTER_AGENT
    const agent = await prisma.user.findFirst({
      where: { id: Number(agentId), role: { name: 'CALL_CENTER_AGENT' } },
    });
    if (!agent) {
      res.status(404).json({ status: 'error', message: 'Agent not found' });
      return;
    }

    let finalInfluencerIds = [...influencerIds];

    // If autoAssign is requested, we fetch all influencers to assign them all
    if (autoAssign) {
      const allInfluencers = await prisma.user.findMany({
        where: {
          role: { name: 'INFLUENCER' },
        },
        select: { id: true }
      });
      finalInfluencerIds = allInfluencers.map(inf => inf.id);
    }

    // Transaction: update autoAssign status, delete old assignments, create new ones
    await prisma.$transaction(async (tx) => {
      // Update autoAssignInfluencers flag on user
      await tx.user.update({
        where: { id: Number(agentId) },
        data: { autoAssignInfluencers: !!autoAssign }
      });

      await tx.agentInfluencerAssignment.deleteMany({
        where: { agentId: Number(agentId) },
      });

      if (finalInfluencerIds.length > 0) {
        await tx.agentInfluencerAssignment.createMany({
          data: finalInfluencerIds.map((infId: number) => ({
            agentId: Number(agentId),
            influencerId: Number(infId),
          })),
        });
      }
    });

    res.json({
      status: 'success',
      message: autoAssign 
        ? `Agent marked for auto-assignment and linked to all ${finalInfluencerIds.length} influencers`
        : `Assigned ${finalInfluencerIds.length} influencer(s) to agent`,
    });
  })
);

// Remove a single assignment
router.delete(
  '/agent-influencer-assignments/:agentId/:influencerId',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { agentId, influencerId } = req.params;

    await prisma.agentInfluencerAssignment.deleteMany({
      where: {
        agentId: Number(agentId),
        influencerId: Number(influencerId),
      },
    });

    res.json({
      status: 'success',
      message: 'Assignment removed',
    });
  })
);

// --- Verification Management ---

// List all verifications
router.get(
  '/verifications',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { filter = 'all' } = req.query;

    const where: any = {
      role: { name: { notIn: ['SUPER_ADMIN', 'FINANCE_ADMIN'] } },
    };

    if (filter === 'pending') {
      where.OR = [
        { kycStatus: { in: ['PENDING', 'UNDER_REVIEW', 'REJECTED'] } },
        { emailVerifiedAt: null },
        { bankAccounts: { some: { status: { in: ['PENDING', 'REJECTED'] } } } },
      ];
    }

    const usersWithVerifications = await prisma.user.findMany({
      where,
      include: {
        profile: true,
        role: true,
        kycDocuments: true,
        bankAccounts: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      status: 'success',
      data: usersWithVerifications,
    });
  })
);

// Verify email manually
router.patch(
  '/users/:uuid/verify-email',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { uuid } = req.params;
    
    const user = await prisma.user.update({
      where: { uuid },
      data: { emailVerifiedAt: new Date() },
    });

    await checkAndActivateUser(user.id);

    res.json({
      status: 'success',
      message: 'E-mail vérifié avec succès',
      data: user,
    });
  })
);

// Update KYC status
router.patch(
  '/users/:uuid/verify-kyc',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { uuid } = req.params;
    const { status } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
        throw new AppException(400, 'Statut invalide');
    }

    const user = await prisma.user.update({
      where: { uuid },
      data: { 
        kycStatus: status,
        kycDocuments: {
            updateMany: {
                where: { status: 'PENDING' },
                data: { status }
            }
        }
      },
      include: { kycDocuments: true }
    });

    await checkAndActivateUser(user.id);

    res.json({
      status: 'success',
      message: `KYC ${status === 'APPROVED' ? 'approuvé' : 'rejeté'} avec succès`,
      data: user,
    });
  })
);

// Update bank account status
router.patch(
  '/bank-accounts/:id/status',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
        throw new AppException(400, 'Statut invalide');
    }

    const bankAccount = await prisma.userBankAccount.update({
      where: { id: Number(id) },
      data: { status },
      include: { user: true }
    });

    if (status === 'REJECTED') {
      await prisma.notification.create({
        data: {
          userId: bankAccount.userId,
          title: "Compte Bancaire Rejeté",
          body: `Votre compte bancaire (${bankAccount.bankName}) a été rejeté. Veuillez ajouter un nouveau RIB (RIB: ${bankAccount.ribAccount}).`,
          type: "ERROR"
        }
      });
    }

    await checkAndActivateUser(bankAccount.userId);

    res.json({
      status: 'success',
      message: `Compte bancaire ${status === 'APPROVED' ? 'approuvé' : 'rejeté'} avec succès`,
      data: bankAccount,
    });
  })
);

// List all influencer users (for the assignment UI)
router.get(
  '/influencers',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const influencers = await prisma.user.findMany({
      where: {
        OR: [
          { role: { name: 'INFLUENCER' } },
          { isInfluencer: true },
        ],
      },
      include: { profile: true, role: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      status: 'success',
      data: influencers.map((u) => ({
        id: u.id,
        uuid: u.uuid,
        email: u.email,
        phone: u.phone,
        fullName: u.profile?.fullName || u.email || `User #${u.id}`,
        role: u.role.name,
        isInfluencer: u.isInfluencer,
        isActive: u.isActive,
      })),
    });
  })
);

// --- Support Management ---

// List all support requests
router.get(
  '/support-requests',
  authenticate,
  authorize('SUPER_ADMIN', 'SYSTEM_SUPPORT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, type } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const requests = await prisma.supportRequest.findMany({
      where,
      include: {
        user: { include: { profile: true, role: true } },
        product: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      status: 'success',
      data: requests
    });
  })
);

// Update support request status
router.patch(
  '/support-requests/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'SYSTEM_SUPPORT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    const request = await prisma.supportRequest.update({
      where: { id: Number(id) },
      data: { status }
    });

    res.json({
      status: 'success',
      data: request
    });
  })
);
// Get all conversations globally for spectate mode
router.get(
  '/conversations',
  authenticate,
  authorize('SUPER_ADMIN', 'SYSTEM_SUPPORT', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, type, claimedByUserId, orderNumber } = req.query;

    const where: any = {};
    if (status) {
      where.status = status;
    } else {
      where.status = { in: ['ACTIVE', 'PENDING_CLAIM'] };
    }
    if (type) where.type = type;
    if (claimedByUserId) where.claimedByUserId = Number(claimedByUserId);
    if (orderNumber) {
      where.metadata = {
        path: ['orderNumber'],
        equals: orderNumber
      };
    }

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        participants: {
          include: {
            user: { include: { profile: true, role: true } }
          }
        },
        claimedBy: { include: { profile: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({
      status: 'success',
      data: { conversations: conversations.map(c => ({
        ...c,
        lastMessage: c.messages[0] || null
      })) }
    });
  })
);

export default router;
