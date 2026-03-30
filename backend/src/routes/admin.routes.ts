import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';

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
      totalBrands,
      pendingBrands,
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
      prisma.brand.count(),
      prisma.brand.count({ where: { status: 'PENDING_APPROVAL' } }),
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
          brands: { total: totalBrands, pending: pendingBrands },
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
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { status = 'PENDING' } = req.query;

    const claims = await prisma.affiliateClaim.findMany({
      where: status !== 'ALL' ? { status: status as string } : {},
      include: {
        user: { include: { profile: true } },
        product: { include: { images: { where: { isPrimary: true }, take: 1 } } }
      },
      orderBy: { claimedAt: 'desc' }
    });

    res.json({
      status: 'success',
      data: claims
    });
  })
);

// Approve or reject an affiliate claim
router.patch(
  '/affiliate-claims/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, actionType, cloneName, cloneDescription, clonePrice, cloneImageUrls } = req.body;

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
                    stockQuantity: original.stockQuantity,
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

// Set assignments for an agent (replaces all existing)
router.post(
  '/agent-influencer-assignments',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { agentId, influencerIds } = req.body;

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

    // Transaction: delete old assignments, create new ones
    await prisma.$transaction(async (tx) => {
      await tx.agentInfluencerAssignment.deleteMany({
        where: { agentId: Number(agentId) },
      });

      if (influencerIds.length > 0) {
        await tx.agentInfluencerAssignment.createMany({
          data: influencerIds.map((infId: number) => ({
            agentId: Number(agentId),
            influencerId: Number(infId),
          })),
        });
      }
    });

    res.json({
      status: 'success',
      message: `Assigned ${influencerIds.length} influencer(s) to agent`,
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

export default router;
