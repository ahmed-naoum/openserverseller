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

    const profileAny = user.profile as any;
    const safeProfileRib = profileAny?.ribAccount ? decrypt(profileAny.ribAccount) : '';

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
        defaultBankName: profileAny?.bankName || '',
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
    const pAny = user.profile as any;
    if (pAny && (!pAny.bankName || !pAny.ribAccount)) {
      await prisma.userProfile.update({
        where: { userId },
        data: {
          bankName: String(bankName).trim(),
          ribAccount: encrypt(cleanRib)
        } as any
      }).catch(() => {});
    }

    res.status(201).json({
      status: 'success',
      message: 'Demande de retrait d\'affiliation soumise avec succès',
      data: { payoutId: payout.id, amountMad: payout.amountMad }
    });
  })
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Dashboard
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** A parcel in one of these has stopped moving. */
const CLOSED_STATUSES = new Set([
  'DELIVERED', 'RETURNED', 'REFUSE',
  'CANCELED', 'CANCELED_BY_SELLER', 'CANCELED_BY_SYSTEM', 'CANCELLED',
]);

const DAY_MS = 86_400_000;
const SERIES_DAYS = 30;
/** A parcel still moving after this many days needs a human to look at it. */
const STALE_AFTER_DAYS = 7;

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * GET /api/v1/helper/dashboard
 *
 * Every figure is aggregated server-side over the helper's whole assigned scope.
 * The page used to pull 1000 leads and count them in the browser, which silently
 * capped every number it displayed.
 */
router.get(
  '/dashboard',
  authenticate,
  authorize('HELPER', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const isHelper = req.user!.roleName === 'HELPER';

    const me = await prisma.user.findUnique({ where: { id: userId } });
    if (!me) throw new AppException(404, 'User not found');

    // --- Scope: which accounts this helper is allowed to see ---
    let assignedUserIds: number[] = [];
    if (isHelper) {
      const assignments = await (prisma as any).helperUserAssignment.findMany({
        where: { helperId: userId },
        select: { targetUserId: true },
      });
      assignedUserIds = assignments.map((a: any) => a.targetUserId);
    }

    const leadScope: any = isHelper ? { vendorId: { in: assignedUserIds } } : {};

    // A helper with no assigned accounts has an empty scope — return zeros rather
    // than letting an empty `in` clause read the whole table.
    const emptyScope = isHelper && assignedUserIds.length === 0;

    const rows = emptyScope
      ? []
      : await prisma.lead.findMany({
          where: leadScope,
          select: {
            status: true,
            createdAt: true,
            paymentSituation: true,
            vendorId: true,
            assignedAgentId: true,
            vendor: { select: { email: true, profile: { select: { fullName: true } } } },
            assignedAgent: { select: { email: true, profile: { select: { fullName: true } } } },
            order: {
              select: {
                status: true,
                totalAmountMad: true,
                createdAt: true,
                coliatyPackageCode: true,
                coliatyPickupRef: true,
                items: { select: { productId: true, quantity: true, totalPriceMad: true } },
              },
            },
          },
        });

    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // --- Accumulators ---
    const leadsByStatus: Record<string, number> = {};
    const parcelsByStatus: Record<string, number> = {};
    const series = new Map<string, { date: string; leads: number; parcels: number; delivered: number; revenue: number }>();
    for (let i = SERIES_DAYS - 1; i >= 0; i--) {
      const key = dayKey(new Date(now - i * DAY_MS));
      series.set(key, { date: key, leads: 0, parcels: 0, delivered: 0, revenue: 0 });
    }

    const productAgg = new Map<number, { parcels: number; units: number; revenue: number; delivered: number; returned: number }>();
    const accountAgg = new Map<number, { name: string; parcels: number; revenue: number; delivered: number; returned: number; leads: number }>();
    const agentAgg = new Map<number, { name: string; leads: number; parcels: number; delivered: number; returned: number; revenue: number }>();

    let leadsToday = 0, leads7d = 0, leads30d = 0;
    let parcelsTotal = 0, withCode = 0, notSynced = 0, readyForPickup = 0;
    let revenueTotal = 0, revenueDelivered = 0, revenueInTransit = 0, revenueReturned = 0;
    let uninvoicedReturns = 0, staleParcels = 0, unassignedLeads = 0;

    for (const row of rows) {
      const createdMs = row.createdAt.getTime();
      leadsByStatus[row.status] = (leadsByStatus[row.status] || 0) + 1;
      if (createdMs >= startOfToday.getTime()) leadsToday++;
      if (now - createdMs <= 7 * DAY_MS) leads7d++;
      if (now - createdMs <= 30 * DAY_MS) leads30d++;
      if (!row.assignedAgentId) unassignedLeads++;

      const leadBucket = series.get(dayKey(row.createdAt));
      if (leadBucket) leadBucket.leads++;

      if (row.vendorId) {
        const acc = accountAgg.get(row.vendorId) || {
          name: row.vendor?.profile?.fullName || row.vendor?.email || `#${row.vendorId}`,
          parcels: 0, revenue: 0, delivered: 0, returned: 0, leads: 0,
        };
        acc.leads++;
        accountAgg.set(row.vendorId, acc);
      }

      if (row.assignedAgentId) {
        const ag = agentAgg.get(row.assignedAgentId) || {
          name: (row as any).assignedAgent?.profile?.fullName || (row as any).assignedAgent?.email || `#${row.assignedAgentId}`,
          leads: 0, parcels: 0, delivered: 0, returned: 0, revenue: 0,
        };
        ag.leads++;
        agentAgg.set(row.assignedAgentId, ag);
      }

      const order = row.order;
      if (!order) continue;

      const st = order.status;
      const amount = Number(order.totalAmountMad) || 0;
      const isDelivered = st === 'DELIVERED';
      const isReturned = st === 'RETURNED';
      const isOpen = !CLOSED_STATUSES.has(st);

      parcelsTotal++;
      parcelsByStatus[st] = (parcelsByStatus[st] || 0) + 1;
      revenueTotal += amount;
      if (isDelivered) revenueDelivered += amount;
      else if (isReturned) revenueReturned += amount;
      if (isOpen) revenueInTransit += amount;

      if (order.coliatyPackageCode) withCode++;
      else notSynced++;
      if (st === 'PENDING' && order.coliatyPackageCode && !order.coliatyPickupRef) readyForPickup++;
      if (isReturned && row.paymentSituation !== 'FACTURED') uninvoicedReturns++;
      if (isOpen && now - order.createdAt.getTime() > STALE_AFTER_DAYS * DAY_MS) staleParcels++;

      const orderBucket = series.get(dayKey(order.createdAt));
      if (orderBucket) {
        orderBucket.parcels++;
        orderBucket.revenue += amount;
        if (isDelivered) orderBucket.delivered++;
      }

      if (row.vendorId) {
        const acc = accountAgg.get(row.vendorId)!;
        acc.parcels++;
        acc.revenue += amount;
        if (isDelivered) acc.delivered++;
        if (isReturned) acc.returned++;
      }

      if (row.assignedAgentId) {
        const ag = agentAgg.get(row.assignedAgentId)!;
        ag.parcels++;
        if (isDelivered) { ag.delivered++; ag.revenue += amount; }
        if (isReturned) ag.returned++;
      }

      for (const item of order.items) {
        if (!item.productId) continue;
        const p = productAgg.get(item.productId) || { parcels: 0, units: 0, revenue: 0, delivered: 0, returned: 0 };
        p.parcels++;
        p.units += item.quantity || 0;
        p.revenue += Number(item.totalPriceMad) || 0;
        if (isDelivered) p.delivered++;
        if (isReturned) p.returned++;
        productAgg.set(item.productId, p);
      }
    }

    // --- Resolve names/images for the top products only ---
    const topProductIds = [...productAgg.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 8)
      .map(([id]) => id);

    const productMeta = topProductIds.length
      ? await prisma.product.findMany({
          where: { id: { in: topProductIds } },
          select: {
            id: true,
            nameFr: true,
            nameAr: true,
            sku: true,
            images: { where: { isPrimary: true }, take: 1, select: { imageUrl: true } },
          },
        })
      : [];
    const metaById = new Map(productMeta.map(p => [p.id, p]));

    const topProducts = topProductIds.map(id => {
      const agg = productAgg.get(id)!;
      const meta = metaById.get(id);
      const closed = agg.delivered + agg.returned;
      return {
        id,
        name: meta?.nameFr || meta?.nameAr || `#${id}`,
        sku: meta?.sku || null,
        image: meta?.images?.[0]?.imageUrl || null,
        parcels: agg.parcels,
        units: agg.units,
        revenue: Math.round(agg.revenue),
        delivered: agg.delivered,
        returned: agg.returned,
        deliveryRate: closed > 0 ? Math.round((agg.delivered / closed) * 100) : null,
      };
    });

    const topAccounts = [...accountAgg.entries()]
      .map(([id, a]) => {
        const closed = a.delivered + a.returned;
        return {
          id, name: a.name, leads: a.leads, parcels: a.parcels,
          revenue: Math.round(a.revenue), delivered: a.delivered, returned: a.returned,
          deliveryRate: closed > 0 ? Math.round((a.delivered / closed) * 100) : null,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    const topAgents = [...agentAgg.entries()]
      .map(([id, a]) => {
        const closed = a.delivered + a.returned;
        return {
          id, name: a.name, leads: a.leads, parcels: a.parcels,
          delivered: a.delivered, returned: a.returned, revenue: Math.round(a.revenue),
          deliveryRate: closed > 0 ? Math.round((a.delivered / closed) * 100) : null,
        };
      })
      .sort((a, b) => b.delivered - a.delivered)
      .slice(0, 8);

    const closedParcels = (parcelsByStatus['DELIVERED'] || 0) + (parcelsByStatus['RETURNED'] || 0);

    res.json({
      status: 'success',
      data: {
        scope: {
          isHelper,
          accountsCount: isHelper ? assignedUserIds.length : accountAgg.size,
          permissions: {
            canManageLeads: me.canManageLeads,
            canManageOrders: me.canManageOrders,
            canManageProducts: me.canManageProducts,
            canManageTickets: me.canManageTickets,
            canScanReturns: me.canScanReturns,
            canManageInfluencerLinks: me.canManageInfluencerLinks,
            canManageAffiliateInvites: me.canManageAffiliateInvites,
            canImpersonate: me.canImpersonate,
          },
        },
        leads: {
          total: rows.length,
          today: leadsToday,
          last7d: leads7d,
          last30d: leads30d,
          byStatus: leadsByStatus,
          unassigned: unassignedLeads,
        },
        parcels: {
          total: parcelsTotal,
          withCode,
          notSynced,
          readyForPickup,
          delivered: parcelsByStatus['DELIVERED'] || 0,
          returned: parcelsByStatus['RETURNED'] || 0,
          inTransit: parcelsTotal - closedParcels,
          byStatus: parcelsByStatus,
        },
        revenue: {
          total: Math.round(revenueTotal),
          delivered: Math.round(revenueDelivered),
          inTransit: Math.round(revenueInTransit),
          returned: Math.round(revenueReturned),
        },
        rates: {
          delivery: closedParcels > 0 ? Math.round(((parcelsByStatus['DELIVERED'] || 0) / closedParcels) * 100) : null,
          return: closedParcels > 0 ? Math.round(((parcelsByStatus['RETURNED'] || 0) / closedParcels) * 100) : null,
        },
        alerts: { staleParcels, uninvoicedReturns, notSynced, unassignedLeads, readyForPickup },
        series: [...series.values()].map(s => ({ ...s, revenue: Math.round(s.revenue) })),
        topProducts,
        topAccounts,
        topAgents,
      },
    });
  })
);

export default router;
