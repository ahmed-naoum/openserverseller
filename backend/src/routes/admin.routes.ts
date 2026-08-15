import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { isSessionRecordingEnabled, setSessionRecordingEnabled } from '../lib/sessionRecording.js';
import { broadcastRecordingState } from '../lib/realtime.js';
import { runSessionCleanup } from '../jobs/sessionCleanup.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { checkAndActivateUser } from '../utils/verification.js';
import { fetchMaintenanceSettings } from '../middleware/maintenance.js';
import { decrypt, encrypt } from '../utils/crypto.js';
import { getBlockedIPsList, unblockIP } from '../middleware/security.js';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { SAFE_USER_SELECT } from '../lib/safeUserSelect.js';

const router = Router();

// Read/write the global auto-recording switch.
router.get(
  '/session-recording-setting',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (_req: Request, res: Response) => {
    const enabled = await isSessionRecordingEnabled();
    res.json({ enabled });
  })
);

router.patch(
  '/session-recording-setting',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const enabled = !!req.body?.enabled;
    await setSessionRecordingEnabled(enabled);
    // Push the new state to every connected client so tracking starts/stops now.
    broadcastRecordingState(enabled);
    res.json({ enabled });
  })
);

router.get(
  '/sessions',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const search = (req.query.search as string)?.trim();

    const where = search
      ? {
          OR: [
            { ip: { contains: search, mode: 'insensitive' as const } },
            { path: { contains: search, mode: 'insensitive' as const } },
            { userUuid: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [recordings, total] = await Promise.all([
      prisma.sessionRecording.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          sessionId: true,
          userUuid: true,
          ip: true,
          userAgent: true,
          path: true,
          durationSec: true,
          hasLead: true,
          createdAt: true,
        },
      }),
      prisma.sessionRecording.count({ where }),
    ]);

    res.json({ recordings, total, page, totalPages: Math.ceil(total / limit) });
  })
);

router.get(
  '/sessions/:id/events',
  authenticate,
  authorize('SUPER_ADMIN', 'CALL_CENTER_AGENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const recordId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const record = await prisma.sessionRecording.findUnique({
      where: { id: recordId },
    });

    if (!record || !record.eventDataGzip) {
      return res.status(404).json({ error: 'Session recording not found' });
    }

    const jsonString = zlib.gunzipSync(record.eventDataGzip).toString('utf-8');
    const events = JSON.parse(jsonString);

    res.json({ record: { ...record, eventDataGzip: undefined }, events });
  })
);

// Storage management: counts + real bytes on disk + abandoned/converted split.
router.get(
  '/sessions/stats',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (_req: Request, res: Response) => {
    const [
      recCount, bytesRow, oldest, attemptsTotal, abandoned, converted,
      signupsTotal, signupsAbandoned, signupsCompleted,
    ] = await Promise.all([
      prisma.sessionRecording.count(),
      prisma.$queryRaw<{ bytes: bigint | null }[]>`SELECT COALESCE(SUM(octet_length("eventDataGzip")), 0)::bigint AS bytes FROM session_recordings`,
      prisma.sessionRecording.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
      prisma.checkoutAttempt.count(),
      prisma.checkoutAttempt.count({ where: { completed: false, phone: { not: null } } }),
      prisma.checkoutAttempt.count({ where: { completed: true } }),
      prisma.signupAttempt.count(),
      prisma.signupAttempt.count({ where: { completed: false } }),
      prisma.signupAttempt.count({ where: { completed: true } }),
    ]);

    res.json({
      recordings: recCount,
      totalBytes: Number(bytesRow?.[0]?.bytes || 0),
      oldestAt: oldest?.createdAt || null,
      attempts: { total: attemptsTotal, abandoned, converted },
      signups: { total: signupsTotal, abandoned: signupsAbandoned, completed: signupsCompleted },
    });
  })
);

// Abandoned / completed checkout attempts, with a link to the session replay
// (when one exists). Filter: 'abandoned' (default) | 'completed' | 'all'.
router.get(
  '/checkout-attempts',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const filter = (req.query.filter as string) || 'abandoned';
    const search = (req.query.search as string)?.trim();

    const and: any[] = [];
    if (filter === 'abandoned') and.push({ completed: false }, { phone: { not: null } });
    else if (filter === 'completed') and.push({ completed: true });
    if (search) {
      and.push({
        OR: [
          { ip: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search, mode: 'insensitive' as const } },
          { fullName: { contains: search, mode: 'insensitive' as const } },
          { referralCode: { contains: search, mode: 'insensitive' as const } },
        ],
      });
    }
    const where = and.length ? { AND: and } : {};

    const [attempts, total] = await Promise.all([
      prisma.checkoutAttempt.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: limit }),
      prisma.checkoutAttempt.count({ where }),
    ]);

    // Attach a recordingId where a session replay exists for the same socket.
    const sessionIds = attempts.map((a) => a.sessionId);
    const recordings = sessionIds.length
      ? await prisma.sessionRecording.findMany({
          where: { sessionId: { in: sessionIds } },
          select: { id: true, sessionId: true },
        })
      : [];
    const recBySession = new Map(recordings.map((r) => [r.sessionId, r.id]));

    res.json({
      attempts: attempts.map((a) => ({ ...a, recordingId: recBySession.get(a.sessionId) || null })),
      total, page, totalPages: Math.ceil(total / limit),
    });
  })
);

// Abandoned / completed SIGN-UP attempts from /register ("I'm a Seller" /
// "I'm an Influencer"). Filter: 'abandoned' (default) | 'completed' | 'all'.
router.get(
  '/signup-attempts',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const filter = (req.query.filter as string) || 'abandoned';
    const role = (req.query.role as string) || 'ALL';
    const search = (req.query.search as string)?.trim();

    const and: any[] = [];
    if (filter === 'abandoned') and.push({ completed: false });
    else if (filter === 'completed') and.push({ completed: true });
    if (role === 'VENDOR' || role === 'INFLUENCER') and.push({ role });
    if (search) {
      and.push({
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search, mode: 'insensitive' as const } },
          { fullName: { contains: search, mode: 'insensitive' as const } },
          { ip: { contains: search, mode: 'insensitive' as const } },
        ],
      });
    }
    const where = and.length ? { AND: and } : {};

    const [attempts, total] = await Promise.all([
      prisma.signupAttempt.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: limit }),
      prisma.signupAttempt.count({ where }),
    ]);

    // Mark rows whose email/phone now belongs to a real account: the visitor may
    // have abandoned this session but signed up later, so it is not a lost lead.
    const emails = attempts.map((a) => a.email).filter(Boolean) as string[];
    const phones = attempts.map((a) => a.phone).filter(Boolean) as string[];
    const existing = (emails.length || phones.length)
      ? await prisma.user.findMany({
          where: { OR: [ ...(emails.length ? [{ email: { in: emails } }] : []), ...(phones.length ? [{ phone: { in: phones } }] : []) ] },
          select: { email: true, phone: true },
        })
      : [];
    const knownEmails = new Set(existing.map((u) => u.email).filter(Boolean));
    const knownPhones = new Set(existing.map((u) => u.phone).filter(Boolean));

    res.json({
      attempts: attempts.map((a) => ({
        ...a,
        registeredLater: (!!a.email && knownEmails.has(a.email)) || (!!a.phone && knownPhones.has(a.phone)),
      })),
      total, page, totalPages: Math.ceil(total / limit),
    });
  })
);

// Manual purge (age + cap policy) for storage management.
router.post(
  '/sessions/purge',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { all, target } = req.body || {};
    let attemptsCount = 0;
    let signupsCount = 0;
    let recordingsCount = 0;

    if (target === 'history' || target === 'recordings') {
      const resRecordings = await prisma.sessionRecording.deleteMany({});
      recordingsCount = resRecordings.count;
    } else if (target === 'checkouts') {
      const resAttempts = await prisma.checkoutAttempt.deleteMany({ where: { convertedLeadId: null } });
      attemptsCount = resAttempts.count;
    } else if (target === 'signups') {
      const resSignups = await prisma.signupAttempt.deleteMany({ where: { completed: false } });
      signupsCount = resSignups.count;
    } else if (all || target === 'all') {
      const [resAttempts, resSignups, resRecordings] = await Promise.all([
        prisma.checkoutAttempt.deleteMany({ where: { convertedLeadId: null } }),
        prisma.signupAttempt.deleteMany({ where: { completed: false } }),
        prisma.sessionRecording.deleteMany({}),
      ]);
      attemptsCount = resAttempts.count;
      signupsCount = resSignups.count;
      recordingsCount = resRecordings.count;
    } else {
      await runSessionCleanup();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const [attempts, signups] = await Promise.all([
        prisma.checkoutAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } }),
        prisma.signupAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } }),
      ]);
      attemptsCount = attempts.count;
      signupsCount = signups.count;
    }

    res.json({
      status: 'success',
      purgedAttempts: attemptsCount,
      purgedSignups: signupsCount,
      purgedRecordings: recordingsCount
    });
  })
);

router.post(
  '/cache-refresh',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (_req: Request, res: Response) => {
    const newVersion = Date.now().toString();
    try {
      const versionFilePath = path.join(process.cwd(), 'cache_version.json');
      fs.writeFileSync(
        versionFilePath,
        JSON.stringify({ version: newVersion, updatedAt: new Date().toISOString() }),
        'utf8'
      );
    } catch (err) {
      console.error('Error writing cache version:', err);
      throw new AppException(500, 'Impossible de mettre à jour la version du cache');
    }

    res.json({
      status: 'success',
      message: 'Cache vidé avec succès pour tous les utilisateurs',
      data: { version: newVersion },
    });
  })
);

router.post(
  '/reset-rank-levels',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await prisma.wallet.updateMany({
      data: {
        totalEarnedMad: 0,
      },
    });

    res.json({
      status: 'success',
      message: `Niveaux de rang réinitialisés avec succès pour tous les utilisateurs. (${result.count} portefeuilles mis à jour)`,
    });
  })
);

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
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN', 'SYSTEM_SUPPORT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 50, userId, action } = req.query;

    const where: any = {};
    if (userId) where.userId = Number(userId as string);
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

router.delete(
  '/audit-logs',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.activityLog.deleteMany({});
    res.json({
      status: 'success',
      message: 'Tous les journaux d\'activité ont été supprimés',
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
    const { status, actionType, cloneName, cloneDescription, clonePrice, cloneImageUrls, cloneQuantity, cloneSku: inputCloneSku } = req.body;

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

            const baseSku = inputCloneSku || `${original.sku}-U${currentClaim.userId}`;
            
            // Check if clone SKU already exists, add timestamp if needed
            const existingSku = await tx.product.findUnique({ where: { sku: baseSku } });
            const finalSku = existingSku ? `${baseSku}-${Date.now()}` : baseSku;

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
            const updatedClaim = await tx.affiliateClaim.update({
                where: { id: Number(id) },
                data: { 
                    status: 'APPROVED', 
                    productId: clonedProduct.id 
                }
            });

            // Also resolve linked support requests for original product
            await tx.supportRequest.updateMany({
                where: {
                    userId: currentClaim.userId,
                    productId: currentClaim.productId,
                    status: { in: ['OPEN', 'IN_PROGRESS'] }
                },
                data: { status: 'RESOLVED' }
            });

            // Close linked conversations
            await tx.conversation.updateMany({
                where: {
                    type: 'SUPPORT',
                    supportRequest: {
                        userId: currentClaim.userId,
                        productId: currentClaim.productId,
                    },
                    status: { not: 'CLOSED' }
                },
                data: { status: 'CLOSED' }
            });

            return updatedClaim;
        }

        // Standard status update
        const updatedClaim = await tx.affiliateClaim.update({
            where: { id: Number(id) },
            data: { status }
        });

        // If approving or rejecting, also resolve the support request
        if (status === 'APPROVED' || status === 'REJECTED') {
            await tx.supportRequest.updateMany({
                where: {
                    userId: currentClaim.userId,
                    productId: currentClaim.productId,
                    status: { in: ['OPEN', 'IN_PROGRESS'] }
                },
                data: { status: status === 'APPROVED' ? 'RESOLVED' : 'CLOSED' }
            });

            await tx.conversation.updateMany({
                where: {
                    type: 'SUPPORT',
                    supportRequest: {
                        userId: currentClaim.userId,
                        productId: currentClaim.productId,
                    },
                    status: { not: 'CLOSED' }
                },
                data: { status: 'CLOSED' }
            });
        }

        return updatedClaim;
    });

    try {
      const product = await prisma.product.findUnique({
        where: { id: claim.productId }
      });
      const productName = product?.nameFr || product?.nameAr || 'Produit';

      let notifTitle = '';
      let notifBody = '';
      if (claim.status === 'APPROVED') {
        notifTitle = '🎉 Votre produit a été approuvé !';
        notifBody = `Félicitations ! Votre demande d'affiliation pour le produit "${productName}" a été acceptée. Vous pouvez maintenant générer des liens.`;
      } else if (claim.status === 'REJECTED') {
        notifTitle = '❌ Votre demande de produit a été refusée';
        notifBody = `Désolé, votre demande d'affiliation pour le produit "${productName}" a été refusée par l'administrateur.`;
      } else if (claim.status === 'REVOKED') {
        notifTitle = '⚠️ Accès au produit révoqué';
        notifBody = `Votre accès d'affiliation au produit "${productName}" a été révoqué.`;
      }

      if (notifTitle && notifBody) {
        const { createNotification } = await import('../utils/notification.js');
        await createNotification(claim.userId, 'PRODUCT_CLAIM_STATUS', notifTitle, notifBody);
      }
    } catch (err) {
      console.error('Failed to trigger claim notification:', err);
    }

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
        influencer: { select: SAFE_USER_SELECT },
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

// List the product-level narrowing rows for an agent.
// Shape: [{ influencerId, influencerName, productId, productName, sku }]
router.get(
  '/agent-product-assignments',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { agentId } = req.query;

    const where: any = {};
    if (agentId) where.agentId = Number(agentId);

    const assignments = await (prisma as any).agentProductAssignment.findMany({
      where,
      include: {
        influencer: { include: { profile: true } },
        product: { select: { id: true, nameFr: true, nameAr: true, sku: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    res.json({
      status: 'success',
      data: assignments.map((a: any) => ({
        id: a.id,
        agentId: a.agentId,
        influencerId: a.influencerId,
        influencerName:
          a.influencer.profile?.fullName || a.influencer.email || `User #${a.influencerId}`,
        productId: a.productId,
        productName: a.product.nameFr || a.product.nameAr || `Produit #${a.productId}`,
        sku: a.product.sku,
        assignedAt: a.assignedAt,
      })),
    });
  })
);

// Products belonging to one influencer/vendor — everything they could hand to an
// agent. That is what they own plus whatever they hold a referral link for,
// since a lead's product is resolved through its referral link.
router.get(
  '/influencers/:influencerId/products',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const influencerId = Number(req.params.influencerId);
    if (!Number.isInteger(influencerId)) {
      res.status(400).json({ status: 'error', message: 'influencerId invalide' });
      return;
    }

    const [links, owned] = await Promise.all([
      prisma.referralLink.findMany({
        where: { influencerId },
        select: {
          product: {
            select: {
              id: true,
              nameFr: true,
              nameAr: true,
              sku: true,
              isActive: true,
              images: { where: { isPrimary: true }, take: 1, select: { imageUrl: true } },
            },
          },
        },
      }),
      prisma.product.findMany({
        where: { ownerId: influencerId },
        select: {
          id: true,
          nameFr: true,
          nameAr: true,
          sku: true,
          isActive: true,
          images: { where: { isPrimary: true }, take: 1, select: { imageUrl: true } },
        },
      }),
    ]);

    const byId = new Map<number, any>();
    for (const p of [...links.map((l) => l.product), ...owned]) {
      if (p && !byId.has(p.id)) byId.set(p.id, p);
    }

    const products = Array.from(byId.values())
      .map((p) => ({
        id: p.id,
        name: p.nameFr || p.nameAr || `Produit #${p.id}`,
        sku: p.sku,
        isActive: p.isActive,
        image: p.images[0]?.imageUrl || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({ status: 'success', data: products });
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

// Admin Helper Affiliate Overview Stats
router.get(
  '/helpers/affiliate-stats',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (_req: Request, res: Response) => {
    const helpers = await prisma.user.findMany({
      where: { role: { name: 'HELPER' } },
      include: {
        profile: true,
        role: true,
        helperAssignments: {
          where: { isAffiliateInvite: true },
          include: {
            targetUser: {
              include: { profile: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const result = await Promise.all(
      helpers.map(async (h) => {
        const targetUserIds = h.helperAssignments.map((a: any) => a.targetUserId);
        
        let totalLeads = 0;
        let deliveredLeads = 0;

        if (targetUserIds.length > 0) {
          const leadCounts = await prisma.lead.groupBy({
            by: ['status'],
            where: { vendorId: { in: targetUserIds } },
            _count: { id: true }
          });

          leadCounts.forEach((c) => {
            totalLeads += c._count.id;
            if (c.status === 'DELIVERED') {
              deliveredLeads += c._count.id;
            }
          });
        }

        const commissionRate = h.helperCommissionPerDeliveredLead ?? 5.0;

        return {
          id: h.id,
          uuid: h.uuid,
          fullName: h.profile?.fullName || 'N/A',
          email: h.email,
          phone: h.phone,
          referralCode: h.referralCode,
          canManageAffiliateInvites: h.canManageAffiliateInvites,
          helperCommissionPerDeliveredLead: commissionRate,
          totalInvitedUsers: targetUserIds.length,
          totalLeads,
          deliveredLeads,
          totalEarnings: deliveredLeads * commissionRate,
          createdAt: h.createdAt
        };
      })
    );

    res.json({
      status: 'success',
      data: result
    });
  })
);

// Admin Toggle Helper Permission & Commission
router.patch(
  '/helpers/:id/affiliate-config',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { canManageAffiliateInvites, helperCommissionPerDeliveredLead } = req.body;

    const helper = await prisma.user.findFirst({
      where: { id: Number(id), role: { name: 'HELPER' } }
    });

    if (!helper) {
      res.status(404).json({ status: 'error', message: 'Helper user not found' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: Number(id) },
      data: {
        canManageAffiliateInvites: typeof canManageAffiliateInvites === 'boolean' ? canManageAffiliateInvites : helper.canManageAffiliateInvites,
        helperCommissionPerDeliveredLead: helperCommissionPerDeliveredLead !== undefined ? Number(helperCommissionPerDeliveredLead) : helper.helperCommissionPerDeliveredLead
      },
      include: { profile: true }
    });

    res.json({
      status: 'success',
      message: 'Helper affiliate configuration updated successfully',
      data: {
        id: updated.id,
        uuid: updated.uuid,
        canManageAffiliateInvites: updated.canManageAffiliateInvites,
        helperCommissionPerDeliveredLead: updated.helperCommissionPerDeliveredLead
      }
    });
  })
);

router.post(
  '/helper-user-assignments',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { helperId, targetUserIds, autoAssign, autoAssignVendors, autoAssignInfluencers } = req.body;

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

    let finalTargetUserIds = [...targetUserIds];

    // If autoAssign, autoAssignVendors, or autoAssignInfluencers is true, fetch the corresponding users
    if (autoAssign || autoAssignVendors || autoAssignInfluencers) {
      const orConditions: any[] = [];
      if (autoAssign) {
        orConditions.push({ role: { name: { notIn: ['SUPER_ADMIN', 'FINANCE_ADMIN'] } } });
      } else {
        if (autoAssignVendors) {
          orConditions.push({ role: { name: 'VENDOR' } });
        }
        if (autoAssignInfluencers) {
          orConditions.push({ role: { name: 'INFLUENCER' } });
        }
      }

      if (orConditions.length > 0) {
        const matchingUsers = await prisma.user.findMany({
          where: {
            OR: orConditions,
            id: { not: Number(helperId) },
          },
          select: { id: true }
        });
        finalTargetUserIds = matchingUsers.map(u => u.id);
      }
    }

    // Transaction: update autoAssign flags, delete old assignments, create new ones
    await (prisma as any).$transaction(async (tx: any) => {
      // Update autoAssignHelper flags on user
      await tx.user.update({
        where: { id: Number(helperId) },
        data: { 
          autoAssignHelperUsers: !!autoAssign,
          autoAssignHelperVendors: !!autoAssignVendors,
          autoAssignHelperInfluencers: !!autoAssignInfluencers,
        }
      });

      await tx.helperUserAssignment.deleteMany({
        where: { helperId: Number(helperId) },
      });

      if (finalTargetUserIds.length > 0) {
        await tx.helperUserAssignment.createMany({
          data: finalTargetUserIds.map((tid: number) => ({
            helperId: Number(helperId),
            targetUserId: Number(tid),
          })),
        });
      }
    });

    res.json({
      status: 'success',
      message: (autoAssign || autoAssignVendors || autoAssignInfluencers)
        ? `Helper configuré pour l'auto-assignation et lié à ${finalTargetUserIds.length} utilisateur(s)`
        : `Assignation de ${finalTargetUserIds.length} utilisateur(s) au helper effectuée avec succès`,
    });
  })
);

// Set assignments for an agent (replaces all existing).
//
// `productAssignments` is optional and narrows an assigned account down to some
// of its products: [{ influencerId, productIds: [] }]. An account listed here is
// implicitly assigned, so the admin never has to tick it in both places. An
// account with no entry keeps the whole-account behaviour.
router.post(
  '/agent-influencer-assignments',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { agentId, influencerIds, autoAssign, productAssignments } = req.body;

    if (!agentId || !Array.isArray(influencerIds)) {
      res.status(400).json({ status: 'error', message: 'agentId and influencerIds[] are required' });
      return;
    }

    if (productAssignments !== undefined && !Array.isArray(productAssignments)) {
      res.status(400).json({ status: 'error', message: 'productAssignments must be an array' });
      return;
    }

    // Collapse to one row per (influencer, product), dropping empty selections.
    const productRows: { influencerId: number; productId: number }[] = [];
    const seenPairs = new Set<string>();
    for (const entry of (productAssignments || []) as any[]) {
      const infId = Number(entry?.influencerId);
      if (!Number.isInteger(infId) || !Array.isArray(entry?.productIds)) continue;
      for (const raw of entry.productIds) {
        const pid = Number(raw);
        if (!Number.isInteger(pid)) continue;
        const key = `${infId}:${pid}`;
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        productRows.push({ influencerId: infId, productId: pid });
      }
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
    // Picking products for an account implies assigning that account.
    for (const row of productRows) {
      if (!finalInfluencerIds.some((id: any) => Number(id) === row.influencerId)) {
        finalInfluencerIds.push(row.influencerId);
      }
    }
    let finalProductRows = productRows;

    // If autoAssign is requested, we fetch all influencers & vendors to assign them all
    if (autoAssign) {
      const allInfluencers = await prisma.user.findMany({
        where: {
          OR: [
            { role: { name: 'INFLUENCER' } },
            { role: { name: 'VENDOR' } },
          ],
        },
        select: { id: true }
      });
      finalInfluencerIds = allInfluencers.map(inf => inf.id);
      // "Everything, present and future" and "only these products" contradict
      // each other — the global switch wins.
      finalProductRows = [];
    }

    // Drop rows pointing at products that no longer exist, so createMany cannot
    // blow up the whole save on one stale id from the client.
    if (finalProductRows.length > 0) {
      const existing = await prisma.product.findMany({
        where: { id: { in: Array.from(new Set(finalProductRows.map((r) => r.productId))) } },
        select: { id: true },
      });
      const liveIds = new Set(existing.map((p) => p.id));
      finalProductRows = finalProductRows.filter((r) => liveIds.has(r.productId));
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

      // Product narrowing is replace-all too, so unticking a product removes it.
      await (tx as any).agentProductAssignment.deleteMany({
        where: { agentId: Number(agentId) },
      });

      if (finalProductRows.length > 0) {
        await (tx as any).agentProductAssignment.createMany({
          data: finalProductRows.map((row) => ({
            agentId: Number(agentId),
            influencerId: row.influencerId,
            productId: row.productId,
          })),
          skipDuplicates: true,
        });
      }
    });

    const restrictedAccounts = new Set(finalProductRows.map((r) => r.influencerId)).size;

    res.json({
      status: 'success',
      message: autoAssign
        ? `Agent marked for auto-assignment and linked to all ${finalInfluencerIds.length} influencers`
        : `Assigned ${finalInfluencerIds.length} influencer(s) to agent`
          + (restrictedAccounts
            ? `, ${finalProductRows.length} product(s) scoped across ${restrictedAccounts} account(s)`
            : ''),
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

    // Drop the product narrowing with it — orphaned rows would silently
    // re-restrict the account if it were ever re-assigned.
    await prisma.$transaction([
      prisma.agentInfluencerAssignment.deleteMany({
        where: {
          agentId: Number(agentId),
          influencerId: Number(influencerId),
        },
      }),
      (prisma as any).agentProductAssignment.deleteMany({
        where: {
          agentId: Number(agentId),
          influencerId: Number(influencerId),
        },
      }),
    ]);

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
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN', 'CONFIRMATION_AGENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { filter = 'all', page = '1', limit = '10', search = '', role = 'ALL' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const andConditions: any[] = [];
    const currentUserRole = (req.user as any)?.roleName;

    if (currentUserRole === 'CONFIRMATION_AGENT') {
      andConditions.push({ role: { name: { in: ['VENDOR', 'INFLUENCER'] } } });
    } else {
      andConditions.push({ role: { name: { notIn: ['SUPER_ADMIN'] } } });
    }

    if (role !== 'ALL') {
      andConditions.push({ role: { name: role } });
    }

    if (search) {
      andConditions.push({
        OR: [
          { email: { contains: search as string, mode: 'insensitive' } },
          { phone: { contains: search as string, mode: 'insensitive' } },
          { profile: { fullName: { contains: search as string, mode: 'insensitive' } } }
        ]
      });
    }

    const baseWhere = andConditions.length > 0 ? { AND: andConditions } : {};
    const statsWhere = { ...baseWhere };

    const settings = await fetchMaintenanceSettings();
    const showIdentity = settings.showIdentityVerification !== false;
    const showBank = settings.showBankVerification !== false;
    const showContract = settings.showContractVerification !== false;

    // Prerequisite: Steps 1, 2, 3 must be complete (submitted / ready)
    // Step 1: subdomain is set
    // Step 2: emailVerifiedAt is set
    // Step 3:
    // - if showIdentity: kycStatus is APPROVED or UNDER_REVIEW
    // - if !showIdentity and showBank: has at least one bank account
    // - if !showIdentity and !showBank and showContract: no extra condition (just pending contract)
    const step123Conditions: any[] = [
      { subdomain: { not: null } },
      { subdomain: { not: '' } },
      { emailVerifiedAt: { not: null } }
    ];
    if (showIdentity) {
      step123Conditions.push({ kycStatus: { in: ['APPROVED', 'UNDER_REVIEW'] } });
    } else if (showBank) {
      step123Conditions.push({ bankAccounts: { some: {} } });
    }

    const pendingQueryCondition = {
      AND: [
        { isActive: false },
        ...step123Conditions
      ]
    };

    const filterConditions = [...andConditions];
    if (filter === 'PENDING') {
      filterConditions.push(pendingQueryCondition);
    } else if (filter === 'PENDING_EMAIL') {
      filterConditions.push({ emailVerifiedAt: null });
    } else if (filter === 'PENDING_KYC') {
      filterConditions.push(showIdentity ? { kycStatus: { in: ['PENDING', 'UNDER_REVIEW'] } } : { id: -1 });
    } else if (filter === 'PENDING_BANK') {
      filterConditions.push(showBank ? { bankAccounts: { some: { status: 'PENDING' } } } : { id: -1 });
    } else if (filter === 'PENDING_CONTRACT') {
      filterConditions.push(showContract ? { contractAccepted: false } : { id: -1 });
    }

    const filterWhere = filterConditions.length > 0 ? { AND: filterConditions } : {};

    const [
      totalCount,
      pendingCount,
      pendingEmailCount,
      pendingKycCount,
      pendingBankCount,
      pendingContractCount,
      filteredTotal,
      usersWithVerifications
    ] = await Promise.all([
      prisma.user.count({ where: statsWhere }),
      prisma.user.count({ where: { AND: [...(statsWhere.AND ? (statsWhere.AND as any[]) : []), pendingQueryCondition] } }),
      prisma.user.count({ where: { AND: [...(statsWhere.AND ? (statsWhere.AND as any[]) : []), { emailVerifiedAt: null } ] } }),
      showIdentity ? prisma.user.count({ where: { AND: [...(statsWhere.AND ? (statsWhere.AND as any[]) : []), { kycStatus: { in: ['PENDING', 'UNDER_REVIEW'] } } ] } }) : Promise.resolve(0),
      showBank ? prisma.user.count({ where: { AND: [...(statsWhere.AND ? (statsWhere.AND as any[]) : []), { bankAccounts: { some: { status: 'PENDING' } } } ] } }) : Promise.resolve(0),
      showContract ? prisma.user.count({ where: { AND: [...(statsWhere.AND ? (statsWhere.AND as any[]) : []), { contractAccepted: false } ] } }) : Promise.resolve(0),
      prisma.user.count({ where: filterWhere }),
      prisma.user.findMany({
        where: filterWhere,
        include: {
          profile: true,
          role: true,
          kycDocuments: true,
          bankAccounts: true,
          questionnaire: true,
          influencerQuestionnaire: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      })
    ]);

    // Decrypt RIB for admin view
    const decryptedUsers = usersWithVerifications.map(user => ({
      ...user,
      bankAccounts: user.bankAccounts.map(ba => ({
        ...ba,
        ribAccount: decrypt(ba.ribAccount),
      })),
    }));

    res.json({
      status: 'success',
      data: decryptedUsers,
      meta: {
        total: filteredTotal,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(filteredTotal / limitNum),
        stats: {
          total: totalCount,
          pending: pendingCount,
          pendingEmail: pendingEmailCount,
          pendingKyc: pendingKycCount,
          pendingBank: pendingBankCount,
          pendingContract: pendingContractCount,
        }
      }
    });
  })
);

// Verify email manually (supports verify & unverify)
router.patch(
  '/users/:uuid/verify-email',
  authenticate,
  authorize('SUPER_ADMIN', 'CONFIRMATION_AGENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { uuid } = req.params;
    const { verified = true } = req.body || {};
    
    const user = await prisma.user.update({
      where: { uuid: String(uuid) },
      data: { emailVerifiedAt: verified ? new Date() : null },
    });

    await checkAndActivateUser(user.id);

    res.json({
      status: 'success',
      message: verified ? 'E-mail vérifié avec succès' : 'Vérification e-mail annulée',
      data: user,
    });
  })
);

// Manually activate or deactivate user
router.patch(
  '/users/:uuid/active',
  authenticate,
  authorize('SUPER_ADMIN', 'CONFIRMATION_AGENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { uuid } = req.params;
    const { isActive } = req.body;

    const user = await prisma.user.update({
      where: { uuid: String(uuid) },
      data: { isActive: Boolean(isActive) },
    });

    res.json({
      status: 'success',
      message: `Compte utilisateur ${isActive ? 'activé' : 'désactivé'} avec succès`,
      data: user,
    });
  })
);

// Admin set/update/clear user subdomain
router.patch(
  '/users/:uuid/subdomain',
  authenticate,
  authorize('SUPER_ADMIN', 'CONFIRMATION_AGENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { uuid } = req.params;
    const { subdomain } = req.body;

    // If subdomain is null or empty, clear it
    if (subdomain === null || subdomain === '' || subdomain === undefined) {
      const updated = await prisma.user.update({
        where: { uuid: String(uuid) },
        data: { subdomain: null },
      });
      return res.json({
        status: 'success',
        message: 'Subdomain cleared',
        data: updated,
      });
    }

    if (typeof subdomain !== 'string') {
      throw new AppException(400, 'Subdomain is required');
    }

    const cleaned = subdomain.trim().toLowerCase();
    const regex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    if (!regex.test(cleaned) || cleaned.length < 3 || cleaned.length > 30) {
      throw new AppException(400, 'Invalid subdomain format (3-30 chars, lowercase letters, numbers, hyphens)');
    }

    // Check uniqueness
    const targetUser = await prisma.user.findUnique({ where: { uuid: String(uuid) } });
    if (!targetUser) throw new AppException(404, 'User not found');

    const existing = await prisma.user.findFirst({
      where: { subdomain: cleaned, NOT: { id: targetUser.id } }
    });
    if (existing) {
      throw new AppException(400, 'This subdomain is already taken by another user');
    }

    const updated = await prisma.user.update({
      where: { uuid: String(uuid) },
      data: { subdomain: cleaned },
    });

    res.json({
      status: 'success',
      message: `Subdomain updated to "${cleaned}"`,
      data: updated,
    });
  })
);

// Update KYC status (supports APPROVED, REJECTED, PENDING)
router.patch(
  '/users/:uuid/verify-kyc',
  authenticate,
  authorize('SUPER_ADMIN', 'CONFIRMATION_AGENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { uuid } = req.params;
    const { status } = req.body;

    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
        throw new AppException(400, 'Statut invalide');
    }

    const user = await prisma.user.update({
      where: { uuid: String(uuid) },
      data: { 
        kycStatus: status,
        kycDocuments: {
            updateMany: {
                where: { status: { in: ['PENDING', 'APPROVED', 'REJECTED'] } },
                data: { status }
            }
        }
      },
      include: { kycDocuments: true }
    });

    await checkAndActivateUser(user.id);

    res.json({
      status: 'success',
      message: `KYC mis à jour vers ${status} avec succès`,
      data: user,
    });
  })
);

// Manually approve/sign or reset contract for user
router.patch(
  '/users/:uuid/verify-contract',
  authenticate,
  authorize('SUPER_ADMIN', 'CONFIRMATION_AGENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { uuid } = req.params;
    const { accepted = true } = req.body || {};

    const user = await prisma.user.update({
      where: { uuid: String(uuid) },
      data: {
        contractAccepted: accepted ? true : false,
        contractSignedAt: accepted ? new Date() : null,
        damanesignTransactionId: accepted ? undefined : null,
        damanesignMemberId: accepted ? undefined : null,
        damanesignFileId: accepted ? undefined : null,
        damanesignSignedFileUrl: accepted ? undefined : null,
      },
    });

    await checkAndActivateUser(user.id);

    res.json({
      status: 'success',
      message: accepted ? 'Contrat signé manuellement avec succès' : 'Contrat réinitialisé avec succès',
      data: user,
    });
  })
);

// Manually verify/approve bank account (creates default if none exists)
router.patch(
  '/users/:uuid/verify-bank',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN', 'CONFIRMATION_AGENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { uuid } = req.params;
    const { approved = true } = req.body || {};

    const user = await prisma.user.findUnique({
      where: { uuid: String(uuid) },
      include: { bankAccounts: true }
    });

    if (!user) {
      throw new AppException(404, 'User not found');
    }

    if (approved) {
      if (user.bankAccounts.length > 0) {
        await prisma.userBankAccount.updateMany({
          where: { userId: user.id },
          data: { status: 'APPROVED' }
        });
      } else {
        await prisma.userBankAccount.create({
          data: {
            userId: user.id,
            bankName: 'Validation Manuelle',
            ribAccount: encrypt('000000000000000000000000'),
            status: 'APPROVED',
            isDefault: true
          }
        });
      }
    } else {
      await prisma.userBankAccount.updateMany({
        where: { userId: user.id },
        data: { status: 'PENDING' }
      });
    }

    await checkAndActivateUser(user.id);

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { bankAccounts: true }
    });

    res.json({
      status: 'success',
      message: approved ? 'Compte bancaire validé avec succès' : 'Vérification bancaire réinitialisée',
      data: updatedUser,
    });
  })
);

// Update bank account status
router.patch(
  '/bank-accounts/:id/status',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN', 'CONFIRMATION_AGENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
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

// List all influencer and vendor users (for the assignment UI)
router.get(
  '/influencers',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const influencers = await prisma.user.findMany({
      where: {
        OR: [
          { role: { name: 'INFLUENCER' } },
          { role: { name: 'VENDOR' } },
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

// --- Call Center Inspector ---

// A LeadAssignment row looks identical whether the agent took the lead
// themselves or an admin/the round-robin job handed it to them. The only thing
// that tells them apart is the note lead.routes.ts writes on the accompanying
// status-history row, so that is what "how many times did this agent click
// Réclamer" has to be counted from.
const MANUAL_CLAIM_NOTE = 'Agent claimed lead manually';        // POST /leads/:id/claim
const FORCE_CLAIM_NOTE_PREFIX = 'Réclamation forcée';           // POST /leads/:id/force-claim

// Lead.status is a free-form column that three different systems write into:
// the agent (via PATCH /leads/:id/status), the order-status mirror in
// order.routes.ts, and the Coliaty webhook. So a lead an agent confirmed can
// later read DELIVERED, RETURNED or any raw carrier code. These buckets are
// what the scoreboard has to be computed from — counting only 'CONFIRMED'
// undercounts every agent whose sales already shipped.

// Still in the agent's hands — no outcome yet.
const OPEN_STATUSES = [
  'NEW', 'LEAD', 'AVAILABLE', 'ASSIGNED', 'CONTACTED', 'INTERESTED',
  'CALL_LATER', 'CALLBACK_REQUESTED',
];

// The agent worked it and did not get a sale.
const LOST_STATUSES = [
  'NOT_INTERESTED', 'UNREACHABLE', 'NO_REPLY', 'INVALID', 'WRONG_ORDER',
  'CANCEL_ORDER', 'CANCEL_REASON_PRICE', 'PRICE_REJECTED',
  // Retired after MAX_NO_REPLY_RELEASES failed attempts (lib/leadRelease.ts).
  'DEAD_NO_REPLY',
];

// Parcel states the Coliaty webhook writes onto the lead. Reaching any of them
// means an order exists, so they all count as confirmed sales.
const PARCEL_STATUSES = [
  'NEW_PARCEL', 'WAITING_PICKUP', 'WAITING_PREPARATION', 'PREPARED',
  'ENCORE_PREPARED', 'PICKED_UP', 'SENT', 'RECEIVED', 'DISTRIBUTION',
  'PROGRAMMER', 'PROGRAMMER_AUTO', 'POSTPONED', 'NOANSWER', 'ERR',
  'INCORRECT_ADDRESS', 'DELIVERED', 'RETURNED', 'CANCELED',
  'CANCELED_BY_SELLER', 'CANCELED_BY_SYSTEM', 'REFUSE',
];

// The sale closed — everything downstream of the confirmation call.
const CONFIRMED_STATUSES = [
  'CONFIRMED', 'PRICE_CONFIRMED', 'ORDERED', 'PUSHED_TO_DELIVERY',
  'PENDING', 'IN_PRODUCTION', 'READY_FOR_SHIPPING', 'SHIPPED',
  'CANCELLED', 'REFUNDED',
  ...PARCEL_STATUSES,
];

const DELIVERED_STATUSES = ['DELIVERED'];

// Parcel reached a terminal state that is not a delivery — the goods came back.
const DELIVERY_FAILED_STATUSES = [
  'RETURNED', 'REFUSE', 'CANCELED', 'CANCELED_BY_SELLER',
  'CANCELED_BY_SYSTEM', 'CANCELLED', 'REFUNDED',
];

// Turns a raw { status: count } map into the numbers the scoreboard shows.
// `unknown` is deliberately surfaced instead of silently folded into a bucket:
// the webhook writes unmapped carrier codes through verbatim, so a status the
// buckets don't know about is a real thing that needs a label, not a rounding
// error.
function buildAgentMetrics(statusBreakdown: Record<string, number>) {
  const bucket = (list: string[]) =>
    Object.entries(statusBreakdown).reduce(
      (sum, [status, count]) => sum + (list.includes(status.toUpperCase()) ? Number(count) : 0),
      0
    );

  const total = Object.values(statusBreakdown).reduce((s, c) => s + Number(c), 0);
  const open = bucket(OPEN_STATUSES);
  const lost = bucket(LOST_STATUSES);
  const confirmed = bucket(CONFIRMED_STATUSES);
  const delivered = bucket(DELIVERED_STATUSES);
  const deliveryFailed = bucket(DELIVERY_FAILED_STATUSES);
  const inTransit = Math.max(0, confirmed - delivered - deliveryFailed);
  const resolvedParcels = delivered + deliveryFailed;

  const known = [...OPEN_STATUSES, ...LOST_STATUSES, ...CONFIRMED_STATUSES];
  const unknownStatuses = Object.keys(statusBreakdown).filter(
    (s) => !known.includes(s.toUpperCase())
  );

  const rate = (num: number, den: number) => (den > 0 ? Number(((num / den) * 100).toFixed(1)) : 0);

  // Leads that actually reached an outcome. Claimed-but-not-yet-called leads
  // are excluded from the rate denominators, matching how the agent's own
  // dashboard scores Phase 1 (pages/agent/Dashboard.tsx) — counting un-called
  // leads as failures would drag the rate down for work the agent has not had
  // a chance to do yet, and the two screens must not disagree.
  const treated = Math.max(0, total - open);

  return {
    total,
    treated,
    open,
    lost,
    confirmed,
    delivered,
    deliveryFailed,
    inTransit,
    // Share of the leads the agent finished that turned into an order.
    confirmationRate: rate(confirmed, treated),
    // Delivered over parcels that actually finished their journey. Dividing by
    // `confirmed` instead would drag the number down for every parcel still in
    // transit and make a good agent look bad on a fresh date range.
    deliveryRate: rate(delivered, resolvedParcels),
    lossRate: rate(lost, treated),
    unknownStatuses,
    unknown: unknownStatuses.reduce((s, k) => s + Number(statusBreakdown[k] || 0), 0),
  };
}

// Get all call center agents with lead status breakdown
router.get(
  '/call-center-agents',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { agentId, status, search, page = 1, limit = 20, startDate, endDate } = req.query;

    // Build date range filter
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate as string);
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // Same window, expressed as plain bounds for the raw-SQL click query below.
    const windowFrom: Date = dateFilter.gte || new Date('1970-01-01');
    const windowTo: Date = dateFilter.lte || new Date('2999-12-31');

    // How often each agent actually pressed the buttons. Kept in one place so
    // the roster and the drill-down report identical numbers.
    //
    // `assignments` counts every LeadAssignment row (claimed + force-claimed +
    // handed over by an admin + round-robin), while `manualClaims` and
    // `forcedClaims` are the subset the agent triggered themselves. The three
    // do not have to add up: the auto-assign job writes no history row at all.
    const loadActivity = async (agentIds: number[]) => {
      const empty = new Map<number, any>();
      if (agentIds.length === 0) return empty;

      const assignmentWhere: any = { agentId: { in: agentIds } };
      if (hasDateFilter) assignmentWhere.assignedAt = dateFilter;

      const historyWhere: any = { changedBy: { in: agentIds }, newStatus: 'ASSIGNED' };
      if (hasDateFilter) historyWhere.createdAt = dateFilter;

      const statusChangeWhere: any = { changedBy: { in: agentIds } };
      if (hasDateFilter) statusChangeWhere.createdAt = dateFilter;

      const [assignments, distinctLeads, manualClaims, forcedClaims, statusChanges, lastAssignment] =
        await Promise.all([
          prisma.leadAssignment.groupBy({ by: ['agentId'], where: assignmentWhere, _count: true }),
          // Distinct leads touched — `assignments` counts re-claims of the same
          // lead twice, which is exactly the gap worth showing. Aggregated in
          // the database: Prisma's `distinct` would stream every assignment row
          // into Node just to count them.
          prisma.$queryRaw<{ agentId: number; count: number }[]>`
            SELECT "agentId", COUNT(DISTINCT "leadId")::int AS count
            FROM lead_assignments
            WHERE "agentId" = ANY(${agentIds}::int[])
              AND "assignedAt" BETWEEN ${windowFrom} AND ${windowTo}
            GROUP BY "agentId"
          `,
          prisma.leadStatusHistory.groupBy({
            by: ['changedBy'],
            where: { ...historyWhere, notes: MANUAL_CLAIM_NOTE },
            _count: true,
          }),
          prisma.leadStatusHistory.groupBy({
            by: ['changedBy'],
            where: { ...historyWhere, notes: { startsWith: FORCE_CLAIM_NOTE_PREFIX } },
            _count: true,
          }),
          // Every status the agent set — the real measure of work done, since a
          // claim with no follow-up status change is a lead left to rot.
          prisma.leadStatusHistory.groupBy({
            by: ['changedBy'],
            where: statusChangeWhere,
            _count: true,
          }),
          prisma.leadAssignment.groupBy({
            by: ['agentId'],
            where: { agentId: { in: agentIds } },
            _max: { assignedAt: true },
          }),
        ]);

      // Contact clicks live in lead_contact_clicks. Raw SQL (same as
      // lead.routes.ts) so this keeps working regardless of Prisma client
      // generation state, and tolerant of the table being absent.
      let clickRows: { userId: number; channel: string; count: number; lastAt: Date }[] = [];
      try {
        clickRows = await prisma.$queryRaw<typeof clickRows>`
          SELECT "userId", "channel", COUNT(*)::int AS count, MAX("createdAt") AS "lastAt"
          FROM lead_contact_clicks
          WHERE "userId" = ANY(${agentIds}::int[])
            AND "createdAt" BETWEEN ${windowFrom} AND ${windowTo}
          GROUP BY "userId", "channel"
        `;
      } catch {
        clickRows = [];
      }

      const distinctLeadCount: Record<number, number> = {};
      distinctLeads.forEach((d) => {
        distinctLeadCount[d.agentId] = Number(d.count);
      });

      const map = new Map<number, any>();
      const entry = (id: number) => {
        if (!map.has(id)) {
          map.set(id, {
            assignments: 0,
            distinctLeads: 0,
            manualClaims: 0,
            forcedClaims: 0,
            statusChanges: 0,
            whatsappClicks: 0,
            callClicks: 0,
            lastWhatsappAt: null,
            lastCallAt: null,
            lastAssignedAt: null,
          });
        }
        return map.get(id);
      };

      agentIds.forEach((id) => {
        const e = entry(id);
        e.distinctLeads = distinctLeadCount[id] || 0;
      });
      assignments.forEach((a: any) => { entry(a.agentId).assignments = a._count; });
      manualClaims.forEach((h: any) => { entry(h.changedBy).manualClaims = h._count; });
      forcedClaims.forEach((h: any) => { entry(h.changedBy).forcedClaims = h._count; });
      statusChanges.forEach((h: any) => { entry(h.changedBy).statusChanges = h._count; });
      lastAssignment.forEach((a: any) => { entry(a.agentId).lastAssignedAt = a._max.assignedAt; });
      clickRows.forEach((row) => {
        const e = entry(row.userId);
        if (row.channel === 'WHATSAPP') {
          e.whatsappClicks = Number(row.count);
          e.lastWhatsappAt = row.lastAt;
        } else if (row.channel === 'CALL') {
          e.callClicks = Number(row.count);
          e.lastCallAt = row.lastAt;
        }
      });

      map.forEach((e) => {
        e.totalClicks = e.whatsappClicks + e.callClicks;
        // Claims the agent made and never moved off ASSIGNED are invisible in
        // the status breakdown, so expose the ratio directly.
        e.claimTotal = e.manualClaims + e.forcedClaims;
        e.reclaimed = Math.max(0, e.assignments - e.distinctLeads);
      });

      return map;
    };

    // If agentId is provided, return detailed leads for that agent
    if (agentId) {
      const conditions: any[] = [{ assignedAgentId: Number(agentId) }];

      if (hasDateFilter) {
        conditions.push({ createdAt: dateFilter });
      }

      // A comma-separated value lets the UI filter by a whole bucket
      // ("confirmed", "lost", …) with the same parameter as a single status.
      if (status && status !== 'ALL') {
        const wanted = String(status).split(',').map((s) => s.trim()).filter(Boolean);
        conditions.push(wanted.length > 1 ? { status: { in: wanted } } : { status: wanted[0] });
      }

      if (search) {
        conditions.push({
          OR: [
            { fullName: { contains: search as string, mode: 'insensitive' } },
            { phone: { contains: search as string } },
            { city: { contains: search as string, mode: 'insensitive' } },
            { address: { contains: search as string, mode: 'insensitive' } },
          ]
        });
      }

      const where = { AND: conditions };

      const [leads, total] = await Promise.all([
        prisma.lead.findMany({
          where,
          include: {
            referralLink: {
              include: { product: { include: { images: true } }, landingPage: true },
            },
            order: true,
            statusHistory: {
              orderBy: { createdAt: 'desc' },
              take: 5,
              include: { changer: { include: { profile: true } } },
            },
          },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
        }),
        prisma.lead.count({ where }),
      ]);

      // Per-lead activity for the rows on this page: how many times this agent
      // took this particular lead, and how many times they opened WhatsApp or
      // dialled it.
      const pageLeadIds = leads.map((l) => l.id);
      const leadClaimMap = new Map<number, { claims: number; firstAt: Date | null; lastAt: Date | null }>();
      const leadClickMap = new Map<number, { whatsapp: number; call: number }>();

      if (pageLeadIds.length > 0) {
        const claimRows = await prisma.leadAssignment.findMany({
          where: { leadId: { in: pageLeadIds }, agentId: Number(agentId) },
          select: { leadId: true, assignedAt: true },
          orderBy: { assignedAt: 'asc' },
        });
        claimRows.forEach((r) => {
          const e = leadClaimMap.get(r.leadId) || { claims: 0, firstAt: null, lastAt: null };
          e.claims += 1;
          if (!e.firstAt) e.firstAt = r.assignedAt;
          e.lastAt = r.assignedAt;
          leadClaimMap.set(r.leadId, e);
        });

        try {
          const rows = await prisma.$queryRaw<{ leadId: number; channel: string; count: number }[]>`
            SELECT "leadId", "channel", COUNT(*)::int AS count
            FROM lead_contact_clicks
            WHERE "leadId" = ANY(${pageLeadIds}::int[]) AND "userId" = ${Number(agentId)}
            GROUP BY "leadId", "channel"
          `;
          rows.forEach((row) => {
            const e = leadClickMap.get(row.leadId) || { whatsapp: 0, call: 0 };
            if (row.channel === 'WHATSAPP') e.whatsapp = Number(row.count);
            else if (row.channel === 'CALL') e.call = Number(row.count);
            leadClickMap.set(row.leadId, e);
          });
        } catch {
          // table not present — leave the counts at zero rather than 500ing
        }
      }

      // Status counts for this agent
      const statusCountsWhere: any = { assignedAgentId: Number(agentId) };
      if (hasDateFilter) statusCountsWhere.createdAt = dateFilter;

      const statusCounts = await prisma.lead.groupBy({
        by: ['status'],
        where: statusCountsWhere,
        _count: true,
      });

      const statusBreakdown: Record<string, number> = {};
      statusCounts.forEach((sc: any) => {
        statusBreakdown[sc.status] = sc._count;
      });

      const activityMap = await loadActivity([Number(agentId)]);
      const activity = activityMap.get(Number(agentId)) || null;

      return res.json({
        status: 'success',
        data: {
          metrics: buildAgentMetrics(statusBreakdown),
          activity,
          leads: leads.map((l) => {
            // Calculate price from variant or product
            let productPrice = 0;
            let hasPriceFromOrder = false;
            if (l.order?.totalAmountMad !== undefined && l.order?.totalAmountMad !== null) {
              productPrice = Number(l.order.totalAmountMad);
              hasPriceFromOrder = true;
            }
            if (!hasPriceFromOrder && l.productVariant && l.referralLink?.landingPage?.customStructure) {
              try {
                let structure = l.referralLink.landingPage.customStructure;
                if (typeof structure === 'string') structure = JSON.parse(structure as string);
                const blocks = Array.isArray(structure) ? structure : ((structure as any).blocks || []);
                const checkoutBlock = blocks.find((b: any) => b.type === 'express_checkout');
                if (checkoutBlock?.content?.options) {
                  const variant = l.productVariant?.toLowerCase().trim();
                  const option = checkoutBlock.content.options.find((o: any) =>
                    o.name?.toLowerCase().trim() === variant || o.id?.toLowerCase().trim() === variant
                  );
                  if (option?.price) productPrice = Number(option.price);
                }
              } catch (e) {}
            }
            if (!productPrice) {
              productPrice = l.referralLink?.product?.retailPriceMad || 0;
            }

            const claims = leadClaimMap.get(l.id) || { claims: 0, firstAt: null, lastAt: null };
            const clicks = leadClickMap.get(l.id) || { whatsapp: 0, call: 0 };

            return {
              id: l.id,
              fullName: l.fullName,
              phone: l.phone,
              city: l.city,
              address: l.address,
              status: l.status,
              productVariant: l.productVariant,
              notes: l.notes,
              productPrice,
              // The price the agent settled on during the call, when they
              // negotiated one — this is what the courier actually collects.
              confirmedPriceMad: l.confirmedPriceMad,
              callbackAt: l.callbackAt,
              paymentSituation: l.paymentSituation,
              product: l.referralLink?.product ? {
                id: l.referralLink.product.id,
                name: (l.referralLink.product as any).nameFr || (l.referralLink.product as any).nameAr,
                sku: l.referralLink.product.sku,
                price: l.referralLink.product.retailPriceMad,
                image: l.referralLink.product.images[0]?.imageUrl || null,
              } : null,
              // Lead.status gets overwritten by the delivery side, so the
              // parcel state is carried separately — without it there is no way
              // to tell "agent confirmed, parcel still in transit" from
              // "agent confirmed, parcel came back".
              order: l.order ? {
                id: l.order.id,
                orderNumber: l.order.orderNumber,
                status: l.order.status,
                totalAmountMad: l.order.totalAmountMad,
                createdAt: l.order.createdAt,
              } : null,
              claims: claims.claims,
              firstClaimedAt: claims.firstAt,
              lastClaimedAt: claims.lastAt,
              contactClicks: { whatsapp: clicks.whatsapp, call: clicks.call },
              statusHistory: l.statusHistory.map((h: any) => ({
                id: h.id,
                oldStatus: h.oldStatus,
                newStatus: h.newStatus,
                notes: h.notes,
                createdAt: h.createdAt,
                changedBy: h.changer?.profile?.fullName || h.changer?.email || `#${h.changedBy}`,
                byThisAgent: h.changedBy === Number(agentId),
              })),
              coliatyPackageCode: l.order?.coliatyPackageCode || null,
              source: l.source,
              createdAt: l.createdAt,
              updatedAt: l.updatedAt,
            };
          }),
          statusBreakdown,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.max(1, Math.ceil(total / Number(limit))),
          },
        },
      });
    }

    // No agentId — return all agents with their status breakdowns
    const agents = await prisma.user.findMany({
      where: {
        role: { name: 'CALL_CENTER_AGENT' },
      },
      include: {
        profile: true,
        role: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get lead counts grouped by agent + status
    const leadCountsWhere: any = {
      assignedAgentId: { in: agents.map(a => a.id) },
    };
    if (hasDateFilter) leadCountsWhere.createdAt = dateFilter;

    const leadCounts = await prisma.lead.groupBy({
      by: ['assignedAgentId', 'status'],
      where: leadCountsWhere,
      _count: true,
    });

    // Build a map: agentId -> { status: count }
    const agentStatusMap: Record<number, Record<string, number>> = {};
    leadCounts.forEach((lc: any) => {
      if (!lc.assignedAgentId) return;
      if (!agentStatusMap[lc.assignedAgentId]) agentStatusMap[lc.assignedAgentId] = {};
      agentStatusMap[lc.assignedAgentId][lc.status] = lc._count;
    });

    const activityMap = await loadActivity(agents.map((a) => a.id));

    res.json({
      status: 'success',
      data: agents.map(agent => {
        const statusBreakdown = agentStatusMap[agent.id] || {};
        const metrics = buildAgentMetrics(statusBreakdown);

        return {
          id: agent.id,
          uuid: agent.uuid,
          email: agent.email,
          phone: agent.phone,
          fullName: agent.profile?.fullName || agent.email || `Agent #${agent.id}`,
          isActive: agent.isActive,
          createdAt: agent.createdAt,
          totalLeads: metrics.total,
          statusBreakdown,
          metrics,
          activity: activityMap.get(agent.id) || null,
        };
      }),
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
    if (status) {
      if (status === 'CLOSED') {
        where.status = { in: ['CLOSED', 'RESOLVED'] };
      } else {
        where.status = status;
      }
    }
    if (type) where.type = type;

    const requests = await prisma.supportRequest.findMany({
      where,
      include: {
        user: { include: { profile: true, role: true } },
        product: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const conversations = await prisma.conversation.findMany({
      where: {
        supportRequestId: { in: requests.map(r => r.id) }
      },
      select: { id: true, supportRequestId: true }
    });

    const requestsWithConv = requests.map(r => ({
      ...r,
      conversationId: conversations.find((c: any) => c.supportRequestId === r.id)?.id
    }));

    res.json({
      status: 'success',
      data: requestsWithConv
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

// --- Payment Monitoring ---

// Get all users (Sellers/Influencers) with PAID leads
router.get(
  '/payment-monitoring',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    // Optional lead creation-date window (same convention as the agent stats route)
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate as string);
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    const paidLeadWhere: any = { paymentSituation: { in: ['PAID', 'Payé'] } };
    if (Object.keys(dateFilter).length > 0) paidLeadWhere.createdAt = dateFilter;

    // 1. Get Influencers with PAID leads (via ReferralLinks)
    const influencersWithPaidLeads = await prisma.user.findMany({
      where: {
        OR: [
          { role: { name: 'INFLUENCER' } },
          { isInfluencer: true }
        ],
        referralLinks: {
          some: {
            leads: {
              some: paidLeadWhere
            }
          }
        }
      },
      include: {
        profile: true,
        role: true,
        referralLinks: {
          include: {
            leads: {
              where: paidLeadWhere,
              include: { order: true }
            }
          }
        }
      }
    });

    // 2. Get Sellers with PAID leads (direct leads)
    const sellersWithPaidLeads = await prisma.user.findMany({
      where: {
        role: { name: 'VENDOR' },
        leads: {
          some: paidLeadWhere
        }
      },
      include: {
        profile: true,
        role: true,
        leads: {
          where: paidLeadWhere,
          include: { order: true }
        }
      }
    });

    // Combine and format
    const influencers = influencersWithPaidLeads.map(user => {
      const paidLeads = user.referralLinks.flatMap(link => (link as any).leads);
      
      let totalPaidAmount = 0;
      paidLeads.forEach(lead => {
        const gross = Number(lead.order?.totalAmountMad) || 0;
        const shipping = lead.customShippingFee ?? 57;
        const rate = lead.customPlatformFeeRate ?? user.platformFeeRate ?? 0.13;
        const profit = gross - shipping;
        const platformFee = profit > 0 ? profit * rate : 0;
        totalPaidAmount += (gross - shipping - platformFee);
      });
      
      return {
        id: user.id,
        uuid: user.uuid,
        fullName: user.profile?.fullName || user.email,
        email: user.email,
        role: 'INFLUENCER',
        paidCount: paidLeads.length,
        totalPaidAmount,
        platformFeeRate: user.platformFeeRate ?? 0.13
      };
    });

    const sellers = sellersWithPaidLeads.map(user => {
      let totalPaidAmount = 0;
      user.leads.forEach(lead => {
        const gross = Number(lead.order?.totalAmountMad) || 0;
        const shipping = lead.customShippingFee ?? 57;
        const rate = lead.customPlatformFeeRate ?? user.platformFeeRate ?? 0.05;
        const profit = gross - shipping;
        const platformFee = profit > 0 ? profit * rate : 0;
        totalPaidAmount += (gross - shipping - platformFee);
      });
      
      return {
        id: user.id,
        uuid: user.uuid,
        fullName: user.profile?.fullName || user.email,
        email: user.email,
        role: 'SELLER',
        paidCount: user.leads.length,
        totalPaidAmount,
        platformFeeRate: user.platformFeeRate ?? 0.05
      };
    });

    res.json({
      status: 'success',
      data: [...influencers, ...sellers]
    });
  })
);

// Get specific user's PAID leads
router.get(
  '/payment-monitoring/user/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.params.id);
    const { startDate, endDate } = req.query;

    // Optional lead creation-date window (mirrors the summary route above)
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate as string);
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    // Fetch both direct leads and referral leads
    const leads = await prisma.lead.findMany({
      where: {
        paymentSituation: { in: ['PAID', 'Payé'] },
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        OR: [
          { vendorId: userId },
          { referralLink: { influencerId: userId } }
        ]
      },
      include: {
        order: {
          include: {
            items: {
              include: { product: true }
            }
          }
        },
        referralLink: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      status: 'success',
      data: leads
    });
  })
);

// Update specific lead's customPlatformFeeRate and customShippingFee overrides
router.patch(
  '/payment-monitoring/lead/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const leadId = Number(req.params.id);
    const { customPlatformFeeRate, customShippingFee } = req.body;

    const updateData: any = {};
    if (customPlatformFeeRate !== undefined) {
      updateData.customPlatformFeeRate = customPlatformFeeRate === null ? null : Number(customPlatformFeeRate);
    }
    if (customShippingFee !== undefined) {
      updateData.customShippingFee = customShippingFee === null ? null : Number(customShippingFee);
    }

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: updateData,
      include: {
        order: {
          include: {
            items: {
              include: { product: true }
            }
          }
        },
        referralLink: {
          include: { product: true }
        }
      }
    });

    res.json({
      status: 'success',
      data: updatedLead
    });
  })
);

// Bulk update lead payment situation
router.patch(
  '/payment-monitoring/bulk-update',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { leadIds, situation } = req.body;

    if (!Array.isArray(leadIds) || !['PAID', 'NOT_PAID', 'FACTURED', 'FACTURED-CC', 'Payé', 'no Payé'].includes(situation)) {
      res.status(400).json({ status: 'error', message: 'Invalid request' });
      return;
    }

    if (situation === 'FACTURED') {
      const leads = await prisma.lead.findMany({
        where: { id: { in: leadIds.map(id => Number(id)) } },
        include: {
          order: true,
          referralLink: true
        }
      });

      if (leads.length > 0) {
        // Assume all leads belong to the same user as they are selected from a user's page
        let userId = leads[0].referralLink?.influencerId || leads[0].vendorId;
        
        // Fetch user's custom platform fee rate
        const userObj = userId ? await prisma.user.findUnique({
          where: { id: userId },
          select: { platformFeeRate: true }
        }) : null;
        const platformFeeRate = userObj?.platformFeeRate ?? 0.05;
        
        let totalAmount = 0;
        for (const lead of leads) {
           totalAmount += Number(lead.order?.totalAmountMad) || 0;
        }

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        const invoiceNumber = `INV-${dateStr}-${randomStr}`;

        let netAmount = 0;
        for (const lead of leads) {
          const gross = Number(lead.order?.totalAmountMad) || 0;
          const shipping = lead.customShippingFee ?? 57;
          const rate = lead.customPlatformFeeRate ?? platformFeeRate ?? 0.05;
          const profit = gross - shipping;
          const fee = profit > 0 ? profit * rate : 0;
          netAmount += (gross - shipping - fee);
        }

        const invoice = await prisma.invoice.create({
          data: {
            invoiceNumber,
            userId,
            totalAmountMad: netAmount,
            status: 'PAID'
          }
        });

        // --- WALLET INTEGRATION ---
        let wallet = await prisma.wallet.findUnique({ where: { userId } });
        if (!wallet) {
          wallet = await prisma.wallet.create({ data: { userId } });
        }

        const updatedWallet = await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            balanceMad: { increment: netAmount },
            totalEarnedMad: { increment: totalAmount }
          }
        });

        await prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'INVOICE_PAYMENT',
            amountMad: netAmount,
            balanceAfterMad: updatedWallet.balanceMad,
            description: `Paiement facture ${invoiceNumber} (Frais déduits)`,
          }
        });
        // --------------------------

        await prisma.lead.updateMany({
          where: { id: { in: leadIds.map(id => Number(id)) } },
          data: { paymentSituation: situation, invoiceId: invoice.id }
        });

        res.json({
          status: 'success',
          message: `${leadIds.length} leads mis à jour avec succès et facture ${invoiceNumber} générée`,
          data: { invoiceId: invoice.id }
        });
        return;
      }
    }

    await prisma.lead.updateMany({
      where: { id: { in: leadIds.map(id => Number(id)) } },
      data: { paymentSituation: situation, invoiceId: null }
    });

    res.json({
      status: 'success',
      message: `${leadIds.length} leads mis à jour avec succès`
    });
  })
);

// Get all users for wallet adjustment search
router.get(
  '/finance/users',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { role: { name: { in: ['VENDOR', 'GROSSELLER', 'INFLUENCER', 'CALL_CENTER_AGENT', 'HELPER', 'SELLER'] } } },
          { isInfluencer: true }
        ],
        deletedAt: null
      },
      select: {
        id: true,
        email: true,
        role: true,
        profile: {
          select: { fullName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      status: 'success',
      data: users.map(u => ({
        id: u.id,
        email: u.email,
        fullName: u.profile?.fullName || u.email,
        role: u.role.name
      }))
    });
  })
);

// Manual wallet adjustment (Donations / Fees)
router.post(
  '/wallet/adjust',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, amount, type, description } = req.body;

    if (!userId || isNaN(Number(amount)) || !['CREDIT', 'DEBIT'].includes(type)) {
      throw new AppException(400, 'Données invalides');
    }

    const amountNum = Math.abs(Number(amount));
    const adjustment = type === 'CREDIT' ? amountNum : -amountNum;

    const result = await prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({ where: { userId: Number(userId) } });
      if (!wallet) {
        wallet = await tx.wallet.create({ data: { userId: Number(userId) } });
      }

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balanceMad: { increment: adjustment },
          totalEarnedMad: type === 'CREDIT' ? { increment: amountNum } : undefined
        }
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
          amountMad: adjustment,
          balanceAfterMad: updatedWallet.balanceMad,
          description: description || (type === 'CREDIT' ? 'Crédit manuel (Donation)' : 'Débit manuel (Frais)')
        }
      });

      return updatedWallet;
    });

    res.json({
      status: 'success',
      message: 'Portefeuille mis à jour avec succès',
      data: result
    });
  })
);

// Invoices
router.get(
  '/invoices',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, search, role, userId, startDate, endDate } = req.query;
    
    const vendorWhere: any = {};
    const agentWhere: any = {};

    if (search) {
      const searchStr = search as string;
      vendorWhere.OR = [
        { invoiceNumber: { contains: searchStr, mode: 'insensitive' } },
        { user: { email: { contains: searchStr, mode: 'insensitive' } } },
        { user: { profile: { fullName: { contains: searchStr, mode: 'insensitive' } } } }
      ];
      agentWhere.OR = [
        { invoiceNumber: { contains: searchStr, mode: 'insensitive' } },
        { agent: { email: { contains: searchStr, mode: 'insensitive' } } },
        { agent: { profile: { fullName: { contains: searchStr, mode: 'insensitive' } } } }
      ];
    }

    if (userId && userId !== 'ALL') {
      const uid = Number(userId);
      if (!isNaN(uid)) {
        vendorWhere.userId = uid;
        agentWhere.agentId = uid;
      }
    }

    if (role && role !== 'ALL') {
      const roleStr = (role as string).toUpperCase();
      if (roleStr === 'CALL_CENTER_AGENT') {
        vendorWhere.id = -1;
        agentWhere.agent = { role: { name: 'CALL_CENTER_AGENT' } };
      } else if (roleStr === 'VENDOR') {
        vendorWhere.user = { role: { name: { in: ['VENDOR', 'SELLER'] } } };
        agentWhere.id = -1;
      } else {
        vendorWhere.user = { role: { name: roleStr } };
        agentWhere.agent = { role: { name: roleStr } };
      }
    }

    if (startDate || endDate) {
      const dateCondition: any = {};
      if (startDate) dateCondition.gte = new Date(startDate as string);
      if (endDate) dateCondition.lte = new Date(`${endDate}T23:59:59.999Z`);
      vendorWhere.createdAt = dateCondition;
      agentWhere.createdAt = dateCondition;
    }

    const [vendorInvoices, agentInvoices] = await Promise.all([
      prisma.invoice.findMany({
        where: vendorWhere,
        include: {
          user: {
            include: { profile: true, role: true }
          },
          _count: {
            select: { leads: true }
          }
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.agentInvoice.findMany({
        where: agentWhere,
        include: {
          agent: {
            include: { profile: true, role: true }
          },
          _count: {
            select: { items: true }
          }
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formattedVendor = vendorInvoices.map(inv => ({
      id: inv.id,
      type: 'VENDOR',
      invoiceNumber: inv.invoiceNumber,
      userId: inv.userId,
      userFullName: inv.user.profile?.fullName || inv.user.email,
      userEmail: inv.user.email,
      userRole: inv.user.role?.name || 'VENDOR',
      totalAmountMad: inv.totalAmountMad,
      status: inv.status,
      leadsCount: inv._count.leads,
      createdAt: inv.createdAt
    }));

    const formattedAgent = agentInvoices.map(inv => ({
      id: `agent-${inv.id}`,
      realId: inv.id,
      type: 'AGENT',
      invoiceNumber: inv.invoiceNumber,
      userId: inv.agentId,
      userFullName: inv.agent.profile?.fullName || inv.agent.email,
      userEmail: inv.agent.email,
      userRole: inv.agent.role?.name || 'CALL_CENTER_AGENT',
      totalAmountMad: inv.totalAmountMad,
      status: inv.status,
      leadsCount: inv.parcelCount || inv._count.items,
      createdAt: inv.createdAt
    }));

    const combined = [...formattedVendor, ...formattedAgent].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const total = combined.length;
    const paginatedInvoices = combined.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      status: 'success',
      data: {
        invoices: paginatedInvoices,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        }
      }
    });
  })
);

router.get(
  '/invoices/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const rawId = String(req.params.id);

    if (rawId.startsWith('agent-')) {
      const agentInvoiceId = Number(rawId.replace('agent-', ''));
      const agentInvoice = await prisma.agentInvoice.findUnique({
        where: { id: agentInvoiceId },
        include: {
          agent: {
            include: { profile: true, role: true }
          },
          items: {
            include: {
              lead: {
                include: {
                  order: {
                    include: { items: { include: { product: true } } }
                  }
                }
              }
            }
          }
        }
      });

      if (!agentInvoice) {
        res.status(404).json({ status: 'error', message: 'Facture agent introuvable' });
        return;
      }

      res.json({
        status: 'success',
        data: {
          id: `agent-${agentInvoice.id}`,
          realId: agentInvoice.id,
          type: 'AGENT',
          invoiceNumber: agentInvoice.invoiceNumber,
          feePerParcelMad: agentInvoice.feePerParcelMad,
          totalAmountMad: agentInvoice.totalAmountMad,
          status: agentInvoice.status,
          createdAt: agentInvoice.createdAt,
          userFullName: agentInvoice.agent.profile?.fullName || agentInvoice.agent.email,
          user: {
            email: agentInvoice.agent.email,
            role: agentInvoice.agent.role?.name || 'CALL_CENTER_AGENT'
          },
          leads: agentInvoice.items.map(it => ({
            id: it.leadId,
            fullName: it.lead?.fullName,
            createdAt: it.lead?.order?.createdAt || agentInvoice.createdAt,
            order: {
              orderNumber: it.lead?.order?.orderNumber,
              coliatyPackageCode: it.lead?.order?.coliatyPackageCode,
              customerName: it.lead?.order?.customerName || it.lead?.fullName,
              customerPhone: it.lead?.order?.customerPhone,
              customerCity: it.lead?.order?.customerCity,
              customerAddress: it.lead?.order?.customerAddress,
              totalAmountMad: it.amountMad,
              items: it.lead?.order?.items || []
            }
          }))
        }
      });
      return;
    }

    const numericId = Number(rawId);
    if (!isNaN(numericId)) {
      const vendorInvoice = await prisma.invoice.findUnique({
        where: { id: numericId },
        include: {
          user: {
            include: { profile: true, role: true }
          },
          leads: {
            include: {
              order: {
                include: { items: { include: { product: true } } }
              },
              referralLink: {
                include: { product: true }
              }
            }
          }
        }
      });

      if (vendorInvoice) {
        res.json({
          status: 'success',
          data: {
            ...vendorInvoice,
            type: 'VENDOR',
            userFullName: vendorInvoice.user.profile?.fullName || vendorInvoice.user.email,
          }
        });
        return;
      }

      const agentInvoice = await prisma.agentInvoice.findUnique({
        where: { id: numericId },
        include: {
          agent: {
            include: { profile: true, role: true }
          },
          items: {
            include: {
              lead: {
                include: {
                  order: {
                    include: { items: { include: { product: true } } }
                  }
                }
              }
            }
          }
        }
      });

      if (agentInvoice) {
        res.json({
          status: 'success',
          data: {
            id: `agent-${agentInvoice.id}`,
            realId: agentInvoice.id,
            type: 'AGENT',
            invoiceNumber: agentInvoice.invoiceNumber,
            feePerParcelMad: agentInvoice.feePerParcelMad,
            totalAmountMad: agentInvoice.totalAmountMad,
            status: agentInvoice.status,
            createdAt: agentInvoice.createdAt,
            userFullName: agentInvoice.agent.profile?.fullName || agentInvoice.agent.email,
            user: {
              email: agentInvoice.agent.email,
              role: agentInvoice.agent.role?.name || 'CALL_CENTER_AGENT'
            },
            leads: agentInvoice.items.map(it => ({
              id: it.leadId,
              fullName: it.lead?.fullName,
              createdAt: it.lead?.order?.createdAt || agentInvoice.createdAt,
              order: {
                orderNumber: it.lead?.order?.orderNumber,
                coliatyPackageCode: it.lead?.order?.coliatyPackageCode,
                customerName: it.lead?.order?.customerName || it.lead?.fullName,
                customerPhone: it.lead?.order?.customerPhone,
                customerCity: it.lead?.order?.customerCity,
                customerAddress: it.lead?.order?.customerAddress,
                totalAmountMad: it.amountMad,
                items: it.lead?.order?.items || []
              }
            }))
          }
        });
        return;
      }
    }

    res.status(404).json({ status: 'error', message: 'Facture introuvable' });
  })
);

router.patch(
  '/invoices/:id/status',
  authenticate,
  authorize('SUPER_ADMIN', 'FINANCE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    const invoice = await prisma.invoice.update({
      where: { id: Number(id) },
      data: { status }
    });

    res.json({
      status: 'success',
      data: invoice
    });
  })
);

router.get(
  '/security/blocked-ips',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const list = getBlockedIPsList();
    res.json({
      status: 'success',
      data: list
    });
  })
);

router.post(
  '/security/unblock-ip',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { ip } = req.body;
    if (!ip) {
      throw new AppException(400, 'IP structure is required');
    }
    const success = unblockIP(ip);
    res.json({
      status: 'success',
      data: { success, ip }
    });
  })
);

// ========== INFLUENCER INSPECTOR ==========
router.get(
  '/influencer-inspector',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    // Get business users (Vendor, Influencer, Grosseller)
    const allUsers = await prisma.user.findMany({
      where: { role: { name: { in: ['VENDOR', 'INFLUENCER', 'GROSSELLER'] } } },
      include: {
        role: true,
        profile: true,
        wallet: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const results = await Promise.all(
      allUsers.map(async (user) => {
        // Referral Links
        const links = await prisma.referralLink.findMany({
          where: { influencerId: user.id },
          include: {
            product: { select: { id: true, nameFr: true, nameAr: true } },
            landingPage: { select: { id: true, title: true } },
          },
        });
        const activeLinks = links.filter((l) => l.isActive).length;
        const totalLinks = links.length;

        // Clicks (total views & unique visitors)
        const clicks = await (prisma as any).referralLinkClick.findMany({
          where: { referralLinkId: { in: links.map((l) => l.id) } },
          select: { referralLinkId: true, ipAddress: true, userAgent: true },
        });
        const totalViews = clicks.length;
        const uniqueSet = new Set<string>();
        clicks.forEach((c: any) =>
          uniqueSet.add(`${c.ipAddress}-${c.userAgent || 'unknown'}`)
        );
        const uniqueVisitors = uniqueSet.size;

        // WhatsApp clicks
        const totalWhatsappClicks = links.reduce(
          (sum, l) => sum + (l.whatsappClicks || 0),
          0
        );

        // Leads
        const leads = await prisma.lead.findMany({
          where: { OR: [{ referralLink: { influencerId: user.id } }, { vendorId: user.id }] },
          include: { order: true },
        });
        const totalLeads = leads.length;

        // Confirmed = leads that have an order
        const confirmedLeads = leads.filter((l) => l.order).length;

        // Delivered
        const deliveredLeads = leads.filter(
          (l) => l.status === 'DELIVERED'
        ).length;

        // Revenue from delivered orders
        const totalRevenue = leads
          .filter((l) => l.status === 'DELIVERED' && l.order)
          .reduce((sum, l) => sum + Number(l.order?.totalAmountMad || 0), 0);

        // Commissions
        const commissions = await prisma.influencerCommission.findMany({
          where: { influencerId: user.id },
        });
        const totalCommissions = commissions.reduce(
          (sum, c) => sum + Number(c.amount),
          0
        );
        const paidCommissions = commissions
          .filter((c) => c.status === 'PAID')
          .reduce((sum, c) => sum + Number(c.amount), 0);
        const pendingCommissions = commissions
          .filter((c) => c.status === 'PENDING')
          .reduce((sum, c) => sum + Number(c.amount), 0);

        // Payout requests
        const payouts = await prisma.payoutRequest.findMany({
          where: { vendorId: user.id },
        });
        const totalWithdrawn = payouts
          .filter(
            (p) => p.status === 'COMPLETED' || p.status === 'APPROVED'
          )
          .reduce((sum, p) => sum + Number(p.amountMad), 0);
        const pendingPayouts = payouts
          .filter((p) => p.status === 'PENDING')
          .reduce((sum, p) => sum + Number(p.amountMad), 0);

        // Affiliate claims
        const claims = await prisma.affiliateClaim.findMany({
          where: { userId: user.id },
          include: { product: { select: { id: true, nameFr: true, nameAr: true } } },
        });

        // Lead status breakdown
        const statusBreakdown: Record<string, number> = {};
        leads.forEach((l) => {
          statusBreakdown[l.status] = (statusBreakdown[l.status] || 0) + 1;
        });

        // Links detail
        const linksDetail = links.map((link) => {
          const linkLeads = leads.filter(
            (l) => l.referralLinkId === link.id
          );
          const linkClicks = clicks.filter(
            (c: any) => c.referralLinkId === link.id
          );
          const uniqueClicksSet = new Set();
          linkClicks.forEach((c: any) => {
            uniqueClicksSet.add(`${c.ipAddress}-${c.userAgent || 'unknown'}`);
          });

          return {
            id: link.id,
            code: link.code,
            isActive: link.isActive,
            status: link.status,
            product: link.product,
            landingPage: link.landingPage,
            clicks: uniqueClicksSet.size, // unique visitors
            rawClicks: linkClicks.length, // total views
            whatsappClicks: link.whatsappClicks,
            leadsCount: linkLeads.length,
            confirmedCount: linkLeads.filter((l) => l.order).length,
            deliveredCount: linkLeads.filter(
              (l) => l.status === 'DELIVERED'
            ).length,
            createdAt: link.createdAt,
          };
        });

        return {
          id: user.id,
          uuid: user.uuid,
          email: user.email,
          fullName: user.profile?.fullName || user.email,
          roleName: user.role.name,
          phone: user.phone || null,
          avatarUrl: user.profile?.avatarUrl || null,
          isActive: user.isActive,
          kycStatus: user.kycStatus,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          // Stats
          totalLinks,
          activeLinks,
          totalViews,
          uniqueVisitors,
          totalWhatsappClicks,
          totalLeads,
          confirmedLeads,
          deliveredLeads,
          totalRevenue,
          // Wallet
          walletBalance: user.wallet?.balanceMad ?? 0,
          totalEarned: user.wallet?.totalEarnedMad ?? 0,
          totalWithdrawn: user.wallet?.totalWithdrawnMad ?? 0,
          // Commissions
          totalCommissions,
          paidCommissions,
          pendingCommissions,
          // Payouts
          totalWithdrawnPayouts: totalWithdrawn,
          pendingPayouts,
          // Breakdowns
          statusBreakdown,
          linksDetail,
          claimsCount: claims.length,
          approvedClaims: claims.filter((c) => c.status === 'APPROVED').length,
        };
      })
    );

    // Global totals
    const totals = {
      totalUsers: results.length,
      totalInfluencers: results.length,
      totalLeads: results.reduce((s, r) => s + r.totalLeads, 0),
      totalConfirmed: results.reduce((s, r) => s + r.confirmedLeads, 0),
      totalDelivered: results.reduce((s, r) => s + r.deliveredLeads, 0),
      totalRevenue: results.reduce((s, r) => s + r.totalRevenue, 0),
      totalViews: results.reduce((s, r) => s + r.totalViews, 0),
      totalUniqueVisitors: results.reduce((s, r) => s + r.uniqueVisitors, 0),
      totalWhatsappClicks: results.reduce(
        (s, r) => s + r.totalWhatsappClicks,
        0
      ),
      totalWalletBalance: results.reduce((s, r) => s + r.walletBalance, 0),
      totalEarned: results.reduce((s, r) => s + r.totalEarned, 0),
      totalWithdrawn: results.reduce(
        (s, r) => s + r.totalWithdrawnPayouts,
        0
      ),
      totalLinks: results.reduce((s, r) => s + r.totalLinks, 0),
      totalActiveLinks: results.reduce((s, r) => s + r.activeLinks, 0),
    };

    res.json({
      status: 'success',
      data: {
        users: results,
        influencers: results,
        totals,
      },
    });
  })
);

// ========== SUPPORT INSPECTOR ==========
router.get(
  '/support-inspector',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    // Get all system support agents
    const agents = await prisma.user.findMany({
      where: { role: { name: 'SYSTEM_SUPPORT' } },
      include: {
        profile: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get all support conversations overall
    const allSupportConversations = await prisma.conversation.findMany({
      where: { type: 'SUPPORT' },
      include: {
        supportRequest: {
          include: {
            user: { include: { profile: true, role: true } },
            product: { select: { nameFr: true, sku: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const results = await Promise.all(
      agents.map(async (agent) => {
        // Tickets claimed by this agent
        const agentConversations = allSupportConversations.filter(
          (c) => c.claimedByUserId === agent.id
        );

        const totalTickets = agentConversations.length;
        const activeTickets = agentConversations.filter(
          (c) => c.status === 'ACTIVE' || c.status === 'PENDING_CLAIM'
        ).length;
        const closedTickets = agentConversations.filter(
          (c) => c.status === 'CLOSED' || c.status === 'ARCHIVED'
        ).length;

        // Calculate response times
        let totalResponseTimeMinutes = 0;
        let responseTimeCount = 0;

        const ticketsDetail = agentConversations.map((c) => {
          let responseTimeMinutes: number | null = null;
          
          // First user message vs First agent response
          const clientMsg = c.messages[0];
          const agentMsg = c.messages.find((m) => m.senderId === agent.id);

          if (clientMsg && agentMsg) {
            const diffMs = agentMsg.createdAt.getTime() - clientMsg.createdAt.getTime();
            responseTimeMinutes = Math.max(0, Math.round(diffMs / 60000));
            totalResponseTimeMinutes += responseTimeMinutes;
            responseTimeCount++;
          }

          return {
            id: c.id,
            subject: c.supportRequest?.subject || c.title || 'Support Ticket',
            category: c.supportRequest?.type || 'GENERAL',
            status: c.status,
            messagesCount: c.messages.length,
            responseTimeMinutes,
            createdAt: c.createdAt,
            claimedAt: c.claimedAt,
            client: c.supportRequest?.user
              ? {
                  fullName: c.supportRequest.user.profile?.fullName || c.supportRequest.user.email,
                  email: c.supportRequest.user.email,
                  roleName: c.supportRequest.user.role?.name || 'USER',
                }
              : null,
            product: c.supportRequest?.product
              ? {
                  nameFr: c.supportRequest.product.nameFr,
                  sku: c.supportRequest.product.sku,
                }
              : null,
          };
        });

        const averageResponseTimeMinutes =
          responseTimeCount > 0
            ? Math.round(totalResponseTimeMinutes / responseTimeCount)
            : null;

        return {
          id: agent.id,
          fullName: agent.profile?.fullName || agent.email,
          email: agent.email,
          isActive: agent.isActive,
          totalTickets,
          activeTickets,
          closedTickets,
          averageResponseTimeMinutes,
          ticketsDetail,
        };
      })
    );

    // Global totals
    const totalAgents = agents.length;
    const totalTickets = allSupportConversations.length;
    const totalActiveTickets = allSupportConversations.filter(
      (c) => c.status === 'ACTIVE'
    ).length;
    const totalClosedTickets = allSupportConversations.filter(
      (c) => c.status === 'CLOSED' || c.status === 'ARCHIVED'
    ).length;
    const totalPendingTickets = allSupportConversations.filter(
      (c) => c.status === 'PENDING_CLAIM'
    ).length;

    res.json({
      status: 'success',
      data: {
        agents: results,
        totals: {
          totalAgents,
          totalTickets,
          totalActiveTickets,
          totalClosedTickets,
          totalPendingTickets,
        },
      },
    });
  })
);

// ========== REFERRAL LINKS MANAGEMENT ==========
router.get(
  '/referral-links',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const links = await prisma.referralLink.findMany({
      include: {
        product: {
          include: { images: { where: { isPrimary: true }, take: 1 } }
        },
        influencer: {
          select: {
            id: true,
            email: true,
            phone: true,
            subdomain: true,
            profile: { select: { fullName: true } }
          }
        },
        landingPage: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const linkIds = links.map(l => l.id);

    const allClicks = await (prisma as any).referralLinkClick.findMany({
      where: { referralLinkId: { in: linkIds } },
      select: { referralLinkId: true, ipAddress: true }
    });

    const allLeads = await prisma.lead.findMany({
      where: { referralLinkId: { in: linkIds } },
      select: { id: true, referralLinkId: true, status: true, order: { select: { id: true } } }
    });

    const formatted = links.map(link => {
      const linkClicks = allClicks.filter(c => c.referralLinkId === link.id);
      const linkLeads = allLeads.filter(l => l.referralLinkId === link.id);
      const uniqueIps = new Set(linkClicks.map(c => c.ipAddress));

      return {
        id: link.id,
        code: link.code,
        isActive: link.isActive,
        status: link.status,
        createdAt: link.createdAt,
        product: link.product,
        influencer: {
          id: link.influencer?.id,
          email: link.influencer?.email,
          phone: link.influencer?.phone,
          subdomain: link.influencer?.subdomain,
          fullName: link.influencer?.profile?.fullName || 'Inconnu'
        },
        landingPage: link.landingPage,
        rawClicks: linkClicks.length,
        clicks: uniqueIps.size,
        whatsappClicks: link.whatsappClicks || 0,
        leadsCount: linkLeads.length,
        confirmedCount: linkLeads.filter(l => l.order || l.status === 'CONFIRMED' || l.status === 'DELIVERED').length,
        deliveredCount: linkLeads.filter(l => l.status === 'DELIVERED').length,
      };
    });

    res.json({ status: 'success', data: formatted });
  })
);

router.delete(
  '/referral-links/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const linkId = parseInt(String(req.params.id));

    const link = await prisma.referralLink.findUnique({
      where: { id: linkId }
    });

    if (!link) {
      throw new AppException(404, 'Referral link not found');
    }

    await prisma.$transaction(async (tx) => {
      // Disconnect leads
      await tx.lead.updateMany({
        where: { referralLinkId: linkId },
        data: { referralLinkId: null }
      });

      // Delete influencer commissions
      await (tx as any).influencerCommission.deleteMany({
        where: { referralLinkId: linkId }
      });

      // Delete the referral link
      await prisma.referralLink.delete({
        where: { id: linkId }
      });
    });

    res.json({
      status: 'success',
      message: 'Referral link deleted successfully'
    });
  })
);

// ========== CONTACT MESSAGES MANAGEMENT ==========
// Get all contact messages
router.get(
  '/contact-messages',
  authenticate,
  authorize('SUPER_ADMIN', 'SYSTEM_SUPPORT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, search, status } = req.query;

    const where: any = {};
    if (status) {
      where.status = status as string;
    }
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { subject: { contains: search as string, mode: 'insensitive' } },
        { message: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [messages, total] = await Promise.all([
      prisma.contactMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.contactMessage.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: {
        messages,
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

// Update contact message status
router.patch(
  '/contact-messages/:id/status',
  authenticate,
  authorize('SUPER_ADMIN', 'SYSTEM_SUPPORT'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!status) {
      throw new AppException(400, 'Status is required');
    }

    const updated = await prisma.contactMessage.update({
      where: { id },
      data: { status },
    });

    res.json({
      status: 'success',
      data: updated,
    });
  })
);

// Delete contact message
router.delete(
  '/contact-messages/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    await prisma.contactMessage.delete({
      where: { id },
    });

    res.json({
      status: 'success',
      message: 'Message de contact supprimé avec succès',
    });
  })
);

// --- Professional Email Management ---

// Helper function for system commands (with mock for non-linux/windows)
import { spawn } from 'child_process';

const runSystemCommand = (command: string, args: string[], stdinInput?: string): Promise<{ stdout: string; stderr: string }> => {
  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') {
      console.log(`[Mock System Command] ${command} ${args.join(' ')}`);
      return resolve({ stdout: '', stderr: '' });
    }

    const child = spawn('sudo', [command, ...args]);
    let stdout = '';
    let stderr = '';

    if (stdinInput && child.stdin) {
      child.stdin.write(stdinInput);
      child.stdin.end();
    }

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
};

// Sync existing mail users from /etc/passwd if running on Linux
const syncExistingUsers = async () => {
  try {
    if (process.platform === 'win32') return;
    if (!fs.existsSync('/etc/passwd')) return;

    const content = fs.readFileSync('/etc/passwd', 'utf8');
    const lines = content.split('\n');
    const systemUsers: string[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.split(':');
      if (parts.length < 7) continue;

      const username = parts[0];
      const home = parts[5];
      const shell = parts[6].trim();

      // Check if shell is nologin/false and home starts with /home/
      if ((shell === '/usr/sbin/nologin' || shell === '/bin/false' || shell.endsWith('nologin')) && home.startsWith('/home/')) {
        systemUsers.push(username);
      }
    }

    if (systemUsers.length === 0) return;

    const dbEmails = await prisma.professionalEmail.findMany({
      select: { username: true },
    });
    const dbUsernames = new Set(dbEmails.map((e) => e.username));

    const newUsers = systemUsers.filter((u) => !dbUsernames.has(u));

    if (newUsers.length > 0) {
      console.log(`Syncing ${newUsers.length} existing mail users from system to DB...`);
      await prisma.professionalEmail.createMany({
        data: newUsers.map((u) => ({
          username: u,
          email: `${u}@silacod.com`,
        })),
        skipDuplicates: true,
      });
    }
  } catch (error) {
    console.error('Failed to sync existing professional email users:', error);
  }
};

// Get all professional emails
router.get(
  '/professional-emails',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    // Sync first
    await syncExistingUsers();

    const emails = await prisma.professionalEmail.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      status: 'success',
      data: emails,
    });
  })
);

// Create professional email
router.post(
  '/professional-emails',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ status: 'error', message: 'Nom d\'utilisateur et mot de passe sont requis' });
      return;
    }

    // Validate username format
    const usernameRegex = /^[a-z0-9._-]+$/;
    if (!usernameRegex.test(username) || username.length < 2 || username.length > 32) {
      res.status(400).json({ 
        status: 'error', 
        message: 'Nom d\'utilisateur invalide. Utilisez uniquement des minuscules, chiffres, points, tirets et underscores (2-32 caractères).' 
      });
      return;
    }

    const email = `${username}@silacod.com`;

    // Check if email already exists in DB
    const existing = await prisma.professionalEmail.findUnique({
      where: { username },
    });
    if (existing) {
      res.status(400).json({ status: 'error', message: 'Cet email professionnel existe déjà.' });
      return;
    }

    try {
      // 1. Create system user
      await runSystemCommand('useradd', ['-m', '-s', '/usr/sbin/nologin', username]);

      // 2. Set temporary password
      await runSystemCommand('chpasswd', [], `${username}:${password}\n`);

      // 3. Save to database
      const newEmail = await prisma.professionalEmail.create({
        data: {
          username,
          email,
        },
      });

      res.status(201).json({
        status: 'success',
        message: 'Compte email professionnel créé avec succès',
        data: newEmail,
      });
    } catch (err: any) {
      console.error('Failed to create professional email:', err);
      res.status(500).json({ 
        status: 'error', 
        message: `Erreur lors de la création de l'email: ${err.message || err}` 
      });
    }
  })
);

// Change password of professional email
router.post(
  '/professional-emails/change-password',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ status: 'error', message: 'Nom d\'utilisateur et nouveau mot de passe sont requis' });
      return;
    }

    const existing = await prisma.professionalEmail.findUnique({
      where: { username },
    });
    if (!existing) {
      res.status(404).json({ status: 'error', message: 'Email professionnel non trouvé.' });
      return;
    }

    try {
      // Change password
      await runSystemCommand('chpasswd', [], `${username}:${password}\n`);

      res.json({
        status: 'success',
        message: 'Mot de passe modifié avec succès',
      });
    } catch (err: any) {
      console.error('Failed to change password:', err);
      res.status(500).json({ 
        status: 'error', 
        message: `Erreur lors de la modification du mot de passe: ${err.message || err}` 
      });
    }
  })
);

// Delete professional email
router.delete(
  '/professional-emails/:username',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const username = req.params.username as string;

    const existing = await prisma.professionalEmail.findUnique({
      where: { username },
    });
    if (!existing) {
      res.status(404).json({ status: 'error', message: 'Email professionnel non trouvé.' });
      return;
    }

    try {
      // 1. Delete system user (and their home directory/mail spool)
      await runSystemCommand('userdel', ['-r', username]);

      // 2. Delete from database
      await prisma.professionalEmail.delete({
        where: { username },
      });

      res.json({
        status: 'success',
        message: 'Email professionnel supprimé avec succès',
      });
    } catch (err: any) {
      console.error('Failed to delete professional email:', err);
      res.status(500).json({ 
        status: 'error', 
        message: `Erreur lors de la suppression de l'email: ${err.message || err}` 
      });
    }
  })
);

export default router;
