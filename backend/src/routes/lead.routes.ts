import { prisma } from '../lib/prisma.js';
import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import axios from 'axios';
import { getSecret } from '../lib/secretStore.js';
import { getIO } from '../lib/realtime.js';

// Helper to call Coliaty API
const callColiatyCreateParcel = async (parcelData: {
  package_reciever: string;
  package_phone: string;
  package_price: number;
  package_addresse: string;
  package_city: string;
  package_content?: string;
  package_code?: string;
  package_no_open?: boolean;
  package_replacement?: boolean;
  package_old_tracking?: string;
  package_note?: string;
}): Promise<{ package_code: string; package_id: number }> => {
  const COLIATY_PUBLIC_KEY = getSecret('COLIATY_PUBLIC_KEY');
  const COLIATY_SECRET_KEY = getSecret('COLIATY_SECRET_KEY');
  const COLIATY_BASE_URL = getSecret('COLIATY_BASE_URL') || 'https://customer-api-v1.coliaty.com';

  if (!COLIATY_PUBLIC_KEY || !COLIATY_SECRET_KEY || COLIATY_PUBLIC_KEY === 'your_coliaty_public_key') {
    throw new AppException(400, '[Coliaty] Clés API non configurées.');
  }

  try {
    const response = await axios.post(
      `${COLIATY_BASE_URL}/parcel/normal`,
      {
        package_content: parcelData.package_content || "Marchandise", // Required field
        package_no_open: false,
        package_replacement: false,
        package_old_tracking: '',
        ...parcelData,
      },
      {
        headers: {
          Authorization: `Bearer ${COLIATY_PUBLIC_KEY}:${COLIATY_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (response.data?.success) {
      return {
        package_code: response.data.data.package_code,
        package_id: response.data.data.package_id,
      };
    }
    
    // Server responded with 200 OK but success is false
    const errorMessage = response.data?.message || JSON.stringify(response.data?.errors) || 'Erreur inconnue (Coliaty)';
    console.error('[Coliaty] API returned failure:', response.data);
    throw new AppException(400, `Coliaty API: ${errorMessage}`);
  } catch (error: any) {
    if (error instanceof AppException) throw error;
    
    console.error('[Coliaty] API error:', error.response?.data || error.message);
    
    // Extract detailed validation errors if present
    const detail = error.response?.data?.errors 
      ? JSON.stringify(error.response.data.errors) 
      : (error.response?.data?.message || error.message);
      
    throw new AppException(400, `Coliaty Network/API Error: ${detail}`);
  }
};

const getPackPrice = (lead: any) => {
  if (lead.order?.totalAmountMad !== undefined && lead.order?.totalAmountMad !== null) {
    return Number(lead.order.totalAmountMad);
  }
  if (lead.productVariant && lead.referralLink?.landingPage?.customStructure) {
    try {
      let structure = lead.referralLink.landingPage.customStructure;
      if (typeof structure === 'string') {
        structure = JSON.parse(structure);
      }
      const blocks = Array.isArray(structure) ? structure : (structure.blocks || []);
      const checkoutBlock = blocks.find((b: any) => b.type === 'express_checkout');
      if (checkoutBlock?.content?.options) {
        const variant = lead.productVariant?.toLowerCase().trim();
        const option = checkoutBlock.content.options.find((o: any) => 
          o.name?.toLowerCase().trim() === variant || 
          o.id?.toLowerCase().trim() === variant
        );
        if (option && option.price) {
          return Number(option.price);
        }
      }
    } catch (e) {}
  }
  return lead.referralLink?.product?.retailPriceMad || 0;
};

const router = Router();

// Cache for Coliaty cities to prevent rate limits
let coliatyCitiesCache: any = null;
let coliatyCitiesCacheTime = 0;
const CITIES_CACHE_TTL = 1000 * 60 * 60; // 1 hour

router.get(
  '/coliaty/cities',
  authenticate,
  authorize('CALL_CENTER_AGENT', 'HELPER', 'VENDOR', 'INFLUENCER', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    if (coliatyCitiesCache && Date.now() - coliatyCitiesCacheTime < CITIES_CACHE_TTL) {
      return res.json({
        status: 'success',
        data: coliatyCitiesCache
      });
    }

    const COLIATY_PUBLIC_KEY = getSecret('COLIATY_PUBLIC_KEY');
    const COLIATY_SECRET_KEY = getSecret('COLIATY_SECRET_KEY');
    const COLIATY_BASE_URL = getSecret('COLIATY_BASE_URL') || 'https://customer-api-v1.coliaty.com';

    if (!COLIATY_PUBLIC_KEY || !COLIATY_SECRET_KEY || COLIATY_PUBLIC_KEY === 'your_coliaty_public_key') {
      throw new AppException(400, 'Clés API Coliaty non configurées.');
    }

    try {
      // Use POST + X-HTTP-Method-Override to bypass Cloudflare WAF (only POST is allowed through)
      const response = await axios.post(`${COLIATY_BASE_URL}/cities/getCities`, {}, {
        headers: {
          Authorization: `Bearer ${COLIATY_PUBLIC_KEY}:${COLIATY_SECRET_KEY}`,
          'Content-Type': 'application/json',
          'X-HTTP-Method-Override': 'GET',
        },
        timeout: 10000,
      });

      if (response.data?.success) {
        coliatyCitiesCache = response.data.data;
        coliatyCitiesCacheTime = Date.now();
        return res.json({
          status: 'success',
          data: coliatyCitiesCache
        });
      }
      throw new AppException(400, `Erreur lors de la récupération des villes: ${response.data?.message || 'Erreur inconnue'}`);
    } catch (error: any) {
      console.error('[Coliaty] Error fetching cities:', error.message);
      console.error('[Coliaty] Status:', error.response?.status);
      console.error('[Coliaty] Response data:', JSON.stringify(error.response?.data));
      console.error('[Coliaty] Request URL:', error.config?.url);
      const detail = error.response?.data?.message || error.message;
      throw new AppException(error.response?.status || 500, `Coliaty cities error: ${detail}`);
    }
  })
);
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const {
      page = 1, limit = 50, status, agentId, search, viewMode, excludeProcessed, mode, vendorId, productId,
      // Admin-oriented filters (all optional / additive)
      city, source, sourceMode, paymentSituation, hasOrder, dateFrom, dateTo, sort, withStats,
    } = req.query;

    // Status lives in its own bucket so stats can be computed across all statuses
    const conditions: any[] = [];

    if (mode) {
      conditions.push({ sourceMode: mode as string });
    }

    if (excludeProcessed === 'true') {
      conditions.push({ order: null });
      conditions.push({ status: { notIn: ['PUSHED_TO_DELIVERY', 'ORDERED', 'CONFIRMED'] } });
    }

    if (req.user!.roleName === 'VENDOR') {
      conditions.push({ vendorId: req.user!.id });
    } else if (req.user!.roleName === 'CALL_CENTER_AGENT') {
      if (viewMode === 'ALL') {
        conditions.push({
          OR: [
            { assignedAgentId: req.user!.id },
            { status: { in: ['AVAILABLE'] } },
          ]
        });
      } else {
        conditions.push({ assignedAgentId: req.user!.id });
      }
    } else if (req.user!.roleName === 'HELPER') {
      if (!req.user!.canManageLeads) {
        throw new AppException(403, 'Permission denied: Vous n\'avez pas le droit de gérer les leads');
      }
      
      const queryVendorId = vendorId ? Number(vendorId) : null;
      const assignments = await (prisma as any).helperUserAssignment.findMany({
        where: { helperId: req.user!.id },
      });
      const assignedUserIds = assignments.map((a: any) => a.targetUserId);
      
      if (queryVendorId) {
        if (assignedUserIds.includes(queryVendorId)) {
          conditions.push({ vendorId: queryVendorId });
        } else {
          conditions.push({ vendorId: { in: [] } }); // No access to this vendor
        }
      } else {
        conditions.push({ vendorId: { in: assignedUserIds } });
      }
    } else if (req.user!.roleName === 'SUPER_ADMIN') {
      if (vendorId) {
        conditions.push({ vendorId: Number(vendorId) });
      }
    }
    
    if (productId) {
      conditions.push({ referralLink: { productId: Number(productId) } });
    }
    
    // Hide leads that already have a Coliaty code (stored in the associated Order) for Agents and Helpers
    if (req.user!.roleName === 'CALL_CENTER_AGENT' || req.user!.roleName === 'HELPER') {
      conditions.push({
        OR: [
          { order: null },
          { order: { coliatyPackageCode: null } }
        ]
      });
    }

    const statusConditions: any[] = [];
    if (status) {
      const statusStr = status as string;
      if (statusStr.includes(',')) {
        statusConditions.push({ status: { in: statusStr.split(',').map(s => s.trim()) } });
      } else {
        statusConditions.push({ status: statusStr });
      }
    } else if (viewMode !== 'ALL' && excludeProcessed !== 'true') {
      statusConditions.push({ status: { not: 'PUSHED_TO_DELIVERY' } });
    }

    if (agentId) conditions.push({ assignedAgentId: Number(agentId as string) });

    if (city) conditions.push({ city: { equals: city as string, mode: 'insensitive' } });
    if (source) conditions.push({ source: source as string });
    if (sourceMode) conditions.push({ sourceMode: sourceMode as string });
    if (paymentSituation) conditions.push({ paymentSituation: paymentSituation as string });
    if (hasOrder === 'yes') conditions.push({ order: { isNot: null } });
    if (hasOrder === 'no') conditions.push({ order: null });

    if (dateFrom || dateTo) {
      const createdAt: any = {};
      if (dateFrom) createdAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
      if (dateTo) createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
      conditions.push({ createdAt });
    }

    if (search) {
      conditions.push({
        OR: [
          { fullName: { contains: search as string, mode: 'insensitive' } },
          { phone: { contains: search as string } },
          { whatsapp: { contains: search as string } },
          { city: { contains: search as string, mode: 'insensitive' } },
          { address: { contains: search as string, mode: 'insensitive' } },
          { order: { coliatyPackageCode: { contains: search as string, mode: 'insensitive' } } },
          { order: { orderNumber: { contains: search as string, mode: 'insensitive' } } },
        ]
      });
    }

    // `where` = every filter; `whereWithoutStatus` powers the per-status counts
    const allConditions = [...conditions, ...statusConditions];
    const where = allConditions.length > 0 ? { AND: allConditions } : {};
    const whereWithoutStatus = conditions.length > 0 ? { AND: conditions } : {};

    const orderByMap: Record<string, any> = {
      recent: { createdAt: 'desc' },
      oldest: { createdAt: 'asc' },
      updated: { updatedAt: 'desc' },
      name: { fullName: 'asc' },
      city: { city: 'asc' },
      amount_desc: { order: { totalAmountMad: 'desc' } },
      amount_asc: { order: { totalAmountMad: 'asc' } },
    };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          vendor: {
            include: { profile: true, role: true },
          },
          assignedAgent: {
            include: { profile: true },
          },
          importBatch: true,
          statusHistory: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
          callLogs: {
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
          referralLink: {
            include: {
              product: { include: { images: true } },
              landingPage: true,
              influencer: { include: { profile: true, role: true } },
            },
          },
          order: true,
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: orderByMap[sort as string] || { createdAt: 'desc' },
      }),
      prisma.lead.count({ where }),
    ]);

    // Contact-click counts (WhatsApp / appel) for the leads on this page.
    // Raw SQL so it keeps working regardless of Prisma client generation state.
    const leadIds = leads.map(l => l.id);
    const clickMap = new Map<number, any>();
    if (leadIds.length > 0) {
      const clickRows = await prisma.$queryRaw<
        { leadId: number; channel: string; count: number; lastAt: Date }[]
      >`
        SELECT "leadId", "channel", COUNT(*)::int AS count, MAX("createdAt") AS "lastAt"
        FROM lead_contact_clicks
        WHERE "leadId" = ANY(${leadIds}::int[])
        GROUP BY "leadId", "channel"
      `;
      for (const row of clickRows) {
        const entry = clickMap.get(row.leadId) || { whatsapp: 0, call: 0, lastWhatsappAt: null, lastCallAt: null };
        if (row.channel === 'WHATSAPP') {
          entry.whatsapp = Number(row.count);
          entry.lastWhatsappAt = row.lastAt;
        } else if (row.channel === 'CALL') {
          entry.call = Number(row.count);
          entry.lastCallAt = row.lastAt;
        }
        clickMap.set(row.leadId, entry);
      }
    }

    // Optional aggregate block — only the admin console asks for it
    let stats: any = undefined;
    let filterOptions: any = undefined;
    if (withStats === 'true') {
      const orderScope = conditions.length > 0 ? { lead: { is: { AND: conditions } } } : {};

      const [byStatusRows, orderAgg, deliveredAgg, cityRows, sourceRows, agentUsers] = await Promise.all([
        prisma.lead.groupBy({
          by: ['status'],
          where: whereWithoutStatus,
          _count: { _all: true },
        }),
        prisma.order.aggregate({
          where: orderScope,
          _sum: { totalAmountMad: true },
          _count: { _all: true },
        }),
        prisma.order.aggregate({
          where: { ...orderScope, status: 'DELIVERED' },
          _sum: { totalAmountMad: true },
          _count: { _all: true },
        }),
        prisma.lead.findMany({
          where: { ...whereWithoutStatus, city: { not: null } },
          select: { city: true },
          distinct: ['city'],
          take: 500,
        }),
        prisma.lead.findMany({
          where: whereWithoutStatus,
          select: { source: true },
          distinct: ['source'],
          take: 100,
        }),
        prisma.user.findMany({
          where: { isActive: true, role: { name: 'CALL_CENTER_AGENT' } },
          select: { id: true, email: true, profile: { select: { fullName: true } } },
          orderBy: { profile: { fullName: 'asc' } },
        }),
      ]);

      const byStatus: Record<string, number> = {};
      let scopeTotal = 0;
      for (const row of byStatusRows) {
        byStatus[row.status] = row._count._all;
        scopeTotal += row._count._all;
      }

      stats = {
        total: scopeTotal,
        byStatus,
        ordersCount: orderAgg._count._all,
        ordersRevenue: orderAgg._sum.totalAmountMad || 0,
        deliveredCount: deliveredAgg._count._all,
        deliveredRevenue: deliveredAgg._sum.totalAmountMad || 0,
      };

      filterOptions = {
        cities: cityRows.map(r => r.city).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b))),
        sources: sourceRows.map(r => r.source).filter(Boolean).sort(),
        agents: agentUsers.map(a => ({ id: a.id, name: a.profile?.fullName || a.email || `Agent #${a.id}` })),
      };
    }

    res.json({
      status: 'success',
      data: {
        leads: leads.map((l) => ({
          id: l.id,
          fullName: l.fullName,
          phone: l.phone,
          whatsapp: l.whatsapp,
          city: l.city,
          address: l.address,
          status: l.status,
          callbackAt: l.callbackAt,
          productVariant: l.productVariant,
          notes: l.notes,
          assignedAgent: l.assignedAgent
            ? {
              id: l.assignedAgent.id,
              uuid: l.assignedAgent.uuid,
              fullName: l.assignedAgent.profile?.fullName,
            }
            : null,
          vendor: l.vendor
            ? {
              id: l.vendor.id,
              fullName: l.vendor.profile?.fullName || 'Utilisateur',
              phone: l.vendor.phone || '',
              accountType: (l.vendor as any).role?.name || null, // VENDOR | INFLUENCER | ...
              accountMode: (l.vendor as any).mode || null,       // SELLER | AFFILIATE
              isInfluencer: (l.vendor as any).isInfluencer || false,
              subdomain: (l.vendor as any).subdomain || null,
            }
            : null,
          recentCalls: l.callLogs.length,
          lastCall: l.callLogs[0]?.createdAt || null,
          productPrice: getPackPrice(l),
          product: l.referralLink?.product ? {
            id: l.referralLink.product.id,
            name: l.referralLink.product.nameFr || l.referralLink.product.nameAr,
            sku: l.referralLink.product.sku,
            price: l.referralLink.product.retailPriceMad,
            image: l.referralLink.product.images[0]?.imageUrl || null,
          } : null,
          coliatyPackageCode: l.order?.coliatyPackageCode || null,
          source: l.source,
          createdAt: l.createdAt,
          // --- Additional detail (already loaded above, previously dropped) ---
          sourceMode: l.sourceMode,
          sourceId: l.sourceId,
          paymentSituation: l.paymentSituation,
          requestedPriceMad: l.requestedPriceMad,
          requestedPriceStatus: l.requestedPriceStatus,
          updatedAt: l.updatedAt,
          importBatch: l.importBatch
            ? { id: l.importBatch.id, fileName: (l.importBatch as any).fileName || null }
            : null,
          referralLink: l.referralLink
            ? {
              id: l.referralLink.id,
              code: (l.referralLink as any).code || null,
              landingPageTitle: (l.referralLink as any).landingPage?.title || null,
              // Everything needed to rebuild the public /r/<code> URL client-side
              ownerSubdomain: (l.referralLink as any).influencer?.subdomain || null,
              ownerCustomDomain: (l.referralLink as any).influencer?.customDomain || null,
              ownerCustomDomainStatus: (l.referralLink as any).influencer?.customDomainStatus || null,
            }
            : null,
          // Who owns the link the lead came through, and what kind of account it is
          linkOwner: (l.referralLink as any)?.influencer
            ? {
              id: (l.referralLink as any).influencer.id,
              fullName: (l.referralLink as any).influencer.profile?.fullName
                || (l.referralLink as any).influencer.email,
              accountType: (l.referralLink as any).influencer.role?.name || null, // VENDOR | INFLUENCER | ...
              accountMode: (l.referralLink as any).influencer.mode || null,        // SELLER | AFFILIATE
              isInfluencer: (l.referralLink as any).influencer.isInfluencer || false,
              subdomain: (l.referralLink as any).influencer.subdomain || null,
            }
            : null,
          contactClicks: clickMap.get(l.id) || { whatsapp: 0, call: 0, lastWhatsappAt: null, lastCallAt: null },
          order: l.order
            ? {
              id: l.order.id,
              orderNumber: l.order.orderNumber,
              status: l.order.status,
              totalAmountMad: l.order.totalAmountMad,
              coliatyPackageCode: l.order.coliatyPackageCode,
              coliatyPackageId: l.order.coliatyPackageId,
              createdAt: l.order.createdAt,
            }
            : null,
          lastStatusChange: l.statusHistory[0]
            ? {
              oldStatus: l.statusHistory[0].oldStatus,
              newStatus: l.statusHistory[0].newStatus,
              notes: l.statusHistory[0].notes,
              createdAt: l.statusHistory[0].createdAt,
            }
            : null,
          statusChangeCount: l.statusHistory.length,
        })),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
        ...(stats ? { stats } : {}),
        ...(filterOptions ? { filterOptions } : {}),
      },
    });
  })
);

router.get(
  '/available',
  authenticate,
  authorize('CALL_CENTER_AGENT', 'CONFIRMATION_AGENT', 'AGENT', 'HELPER', 'SUPER_ADMIN', 'VENDOR'),
  asyncHandler(async (req, res) => {
    const agentId = req.user!.id;
    const { influencerId, limit, search, city, productId } = req.query;

    let takeLimit = 20;
    if (limit) {
      if (limit === 'max' || limit === 'all') {
        takeLimit = 1000;
      } else {
        takeLimit = Math.min(1000, Math.max(1, parseInt(limit as string) || 20));
      }
    }

    // Check if this agent has influencer assignments
    const assignments = await prisma.agentInfluencerAssignment.findMany({
      where: { agentId },
      include: {
        influencer: { include: { profile: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    let assignedInfluencers = assignments.map(a => ({
      id: a.influencer.id,
      fullName: a.influencer.profile?.fullName || a.influencer.email,
      email: a.influencer.email,
    }));

    const activeLead = await prisma.lead.findFirst({
      where: {
        assignedAgentId: req.user!.id,
        status: 'ASSIGNED',
      },
      select: { id: true },
    });

    // If agent has no specific assignments, they see NO leads and NO filter options
    if (assignedInfluencers.length === 0) {
      res.json({
        status: 'success',
        data: {
          leads: [],
          totalAvailable: 0,
          hasActiveLead: !!activeLead,
          activeLeadId: activeLead?.id || null,
          assignedInfluencers: [], // Return empty array so dropdown doesn't show all system influencers
        },
      });
      return;
    }

    const where: any = {
      status: 'AVAILABLE',
      assignedAgentId: null,
      order: null, // Exclude leads already pushed to delivery (have tracking number)
    };

    // If a specific influencer is requested, filter by them
    // Otherwise, filter by all of their assigned influencers
    const filterByInfluencers = influencerId
      ? [Number(influencerId)]
      : assignments.map(a => a.influencerId);

    if (filterByInfluencers.length > 0) {
      // Get all referral links owned by the filter influencers
      const referralLinks = await prisma.referralLink.findMany({
        where: { influencerId: { in: filterByInfluencers } },
        select: { id: true },
      });
      const linkIds = referralLinks.map(l => l.id);

      where.OR = [
        { referralLinkId: { in: linkIds } },
        { vendorId: { in: filterByInfluencers } }
      ];
    }

    // Scope before the agent's own search/filters — used for the dropdown options
    // and to show how many leads exist in total behind a filtered view.
    const scopeWhere = { ...where };

    const extraConditions: any[] = [];

    if (search) {
      const term = (search as string).trim();
      // Phone hunting: match on digits only so "0667…", "+212667…" and "212667…" all hit
      const digits = term.replace(/\D/g, '');
      const or: any[] = [
        { fullName: { contains: term, mode: 'insensitive' } },
        { city: { contains: term, mode: 'insensitive' } },
        { address: { contains: term, mode: 'insensitive' } },
        { productVariant: { contains: term, mode: 'insensitive' } },
        { referralLink: { product: { nameFr: { contains: term, mode: 'insensitive' } } } },
        { referralLink: { product: { nameAr: { contains: term, mode: 'insensitive' } } } },
        { referralLink: { product: { sku: { contains: term, mode: 'insensitive' } } } },
      ];
      if (digits.length >= 3) {
        const tail = digits.slice(-9);
        or.push({ phone: { contains: tail } });
        or.push({ whatsapp: { contains: tail } });
      }
      extraConditions.push({ OR: or });
    }

    if (city) extraConditions.push({ city: { equals: city as string, mode: 'insensitive' } });
    if (productId) extraConditions.push({ referralLink: { productId: Number(productId) } });

    if (extraConditions.length > 0) where.AND = extraConditions;

    const [leads, totalAvailable, totalScope, scopeRows] = await Promise.all([
      prisma.lead.findMany({
        where,
        take: takeLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          referralLink: {
            include: { product: { include: { images: true } }, landingPage: true }
          }
        },
      }),
      prisma.lead.count({ where }),
      prisma.lead.count({ where: scopeWhere }),
      // Options for the city / product pickers, over the unfiltered scope
      prisma.lead.findMany({
        where: scopeWhere,
        select: {
          city: true,
          referralLink: { select: { product: { select: { id: true, nameFr: true, nameAr: true, sku: true } } } },
        },
        take: 1000,
      }),
    ]);

    const citySet = new Set<string>();
    const productMap = new Map<number, { name: string; sku: string | null }>();
    for (const row of scopeRows) {
      if (row.city) citySet.add(row.city);
      const p = row.referralLink?.product;
      if (p && !productMap.has(p.id)) {
        productMap.set(p.id, { name: p.nameFr || p.nameAr || `#${p.id}`, sku: p.sku || null });
      }
    }

    // Several distinct products can share a name — append the SKU so the
    // picker doesn't show identical-looking rows.
    const nameCounts = new Map<string, number>();
    for (const { name } of productMap.values()) {
      nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
    }
    const productOptions = Array.from(productMap.entries())
      .map(([id, { name, sku }]) => ({
        id,
        name: (nameCounts.get(name) || 0) > 1 && sku ? `${name} · ${sku}` : name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      status: 'success',
      data: {
        leads: leads.map(l => ({
          ...l,
          productPrice: getPackPrice(l),
          product: l.referralLink?.product ? {
            id: l.referralLink.product.id,
            name: l.referralLink.product.nameFr || l.referralLink.product.nameAr,
            sku: l.referralLink.product.sku,
            image: l.referralLink.product.images[0]?.imageUrl || null,
          } : null,
        })),
        totalAvailable,
        totalScope,
        hasActiveLead: !!activeLead,
        activeLeadId: activeLead?.id || null,
        assignedInfluencers,
        filterOptions: {
          cities: Array.from(citySet).sort((a, b) => a.localeCompare(b)),
          products: productOptions,
        },
      },
    });
  })
);

// GET agent's livraison (orders/parcels with Coliaty tracking) - must be before /:id routes
router.get(
  '/livraison',
  authenticate,
  authorize('CALL_CENTER_AGENT', 'HELPER', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 50,
      search,
      status,
      paymentSituation,
      city,
      vendorId,
      hasCode,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount,
      tab,
      sort = 'recent',
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, Number(page) || 1);
    // Cap generously: the agent dashboard still pulls large unpaginated pages
    const limitNum = Math.min(1000, Math.max(1, Number(limit) || 50));

    // --- 1. Base scope (what this user is allowed to see at all) ---
    const baseWhere: any = {
      order: { isNot: null }, // Leads that have been converted to orders
    };
    if (req.user!.roleName === 'CALL_CENTER_AGENT') {
      baseWhere.assignedAgentId = req.user!.id;
    } else if (req.user!.roleName === 'HELPER') {
      if (!req.user!.canManageOrders) {
        throw new AppException(403, 'Permission denied: Vous n\'avez pas le droit de gérer les colis');
      }
      // Only show deliveries from assigned users
      const assignments = await (prisma as any).helperUserAssignment.findMany({
        where: { helperId: req.user!.id },
      });
      const assignedUserIds = assignments.map((a: any) => a.targetUserId);
      baseWhere.vendorId = { in: assignedUserIds };
    }

    // --- 2. Filters layered on top of the base scope ---
    const where: any = { ...baseWhere };
    const orderFilter: any = {};

    const statusList = (status || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (statusList.length > 0) orderFilter.status = { in: statusList };

    if (city) orderFilter.customerCity = { equals: city, mode: 'insensitive' };
    if (hasCode === 'yes') orderFilter.coliatyPackageCode = { not: null };
    if (hasCode === 'no') orderFilter.coliatyPackageCode = null;

    if (dateFrom || dateTo) {
      orderFilter.createdAt = {};
      if (dateFrom) orderFilter.createdAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
      if (dateTo) orderFilter.createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
    }

    if (minAmount || maxAmount) {
      orderFilter.totalAmountMad = {};
      if (minAmount) orderFilter.totalAmountMad.gte = Number(minAmount);
      if (maxAmount) orderFilter.totalAmountMad.lte = Number(maxAmount);
    }

    if (paymentSituation) where.paymentSituation = paymentSituation;

    // A vendor filter can only ever narrow the base scope, never widen it
    if (vendorId && !Number.isNaN(Number(vendorId))) {
      if (req.user!.roleName === 'HELPER') {
        const allowed: number[] = baseWhere.vendorId?.in || [];
        if (allowed.includes(Number(vendorId))) where.vendorId = Number(vendorId);
      } else {
        where.vendorId = Number(vendorId);
      }
    }

    // "Retours non facturés" tab
    if (tab === 'uninvoiced_returns') {
      orderFilter.status = { in: ['RETURNED'] };
      where.paymentSituation = { not: 'FACTURED' };
    }

    if (Object.keys(orderFilter).length > 0) {
      where.order = { is: orderFilter };
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { order: { is: { customerName: { contains: search, mode: 'insensitive' } } } },
        { order: { is: { customerPhone: { contains: search } } } },
        { order: { is: { customerCity: { contains: search, mode: 'insensitive' } } } },
        { order: { is: { orderNumber: { contains: search, mode: 'insensitive' } } } },
        { order: { is: { coliatyPackageCode: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const orderByMap: Record<string, any> = {
      recent: { updatedAt: 'desc' },
      oldest: { updatedAt: 'asc' },
      newest_order: { order: { createdAt: 'desc' } },
      oldest_order: { order: { createdAt: 'asc' } },
      amount_desc: { order: { totalAmountMad: 'desc' } },
      amount_asc: { order: { totalAmountMad: 'asc' } },
      customer: { order: { customerName: 'asc' } },
    };

    // --- 3. Page of results + total for that filter set ---
    const [total, agentLeads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        include: {
          vendor: { include: { profile: true } },
          order: {
            include: {
              statusHistory: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: { changedByUser: { include: { profile: true } } },
              },
              items: {
                include: {
                  product: {
                    include: { images: { where: { isPrimary: true }, take: 1 } },
                  },
                },
              },
            },
          },
        },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: orderByMap[sort as string] || orderByMap.recent,
      }),
    ]);

    const parcels = agentLeads
      .filter(l => l.order)
      .map(l => {
        const o = l.order as any;
        const lastChange = o.statusHistory?.[0] || null;
        return {
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          customerPhone: o.customerPhone,
          customerCity: o.customerCity,
          customerAddress: o.customerAddress,
          totalAmountMad: o.totalAmountMad,
          status: o.status,
          paymentMethod: o.paymentMethod,
          coliatyPackageCode: o.coliatyPackageCode || null,
          coliatyPackageId: o.coliatyPackageId || null,
          packageContent: o.packageContent || null,
          packageNoOpen: o.packageNoOpen || false,
          productVariant: o.productVariant || null,
          items: o.items?.map((item: any) => ({
            id: item.id,
            productName: item.product?.nameFr || item.product?.nameAr,
            productSku: item.product?.sku,
            productImage: item.product?.images?.[0]?.imageUrl,
            quantity: item.quantity,
            unitPriceMad: item.unitPriceMad,
            totalPriceMad: item.totalPriceMad,
          })) || [],
          leadId: l.id,
          leadFullName: l.fullName,
          paymentSituation: l.paymentSituation,
          vendorId: l.vendorId,
          vendorName: l.vendor?.profile?.fullName || l.vendor?.email || null,
          vendorEmail: l.vendor?.email || null,
          createdAt: o.createdAt,
          // Last manual status change (reason is mandatory for DELIVERED / RETURNED)
          lastStatusNote: lastChange?.notes || null,
          lastStatusAt: lastChange?.createdAt || null,
          lastStatusBy:
            lastChange?.changedByUser?.profile?.fullName ||
            lastChange?.changedByUser?.email ||
            null,
        };
      });

    // --- 4. Stats + filter options computed over the whole visible scope ---
    const scopeRows = await prisma.lead.findMany({
      where: baseWhere,
      select: {
        vendorId: true,
        paymentSituation: true,
        vendor: { select: { email: true, profile: { select: { fullName: true } } } },
        order: { select: { status: true, customerCity: true, coliatyPackageCode: true } },
      },
    });

    const statusCounts: Record<string, number> = {};
    const cities = new Set<string>();
    const vendorMap = new Map<number, string>();
    let withColiaty = 0;
    let uninvoicedReturns = 0;

    for (const row of scopeRows) {
      const st = row.order?.status || 'UNKNOWN';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
      if (row.order?.customerCity) cities.add(row.order.customerCity);
      if (row.order?.coliatyPackageCode) withColiaty++;
      if (st === 'RETURNED' && row.paymentSituation !== 'FACTURED') uninvoicedReturns++;
      if (row.vendorId && !vendorMap.has(row.vendorId)) {
        vendorMap.set(
          row.vendorId,
          row.vendor?.profile?.fullName || row.vendor?.email || `#${row.vendorId}`
        );
      }
    }

    res.json({
      status: 'success',
      data: {
        parcels,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
        stats: {
          total: scopeRows.length,
          withColiaty,
          pending: statusCounts['PENDING'] || 0,
          delivered: statusCounts['DELIVERED'] || 0,
          returned: statusCounts['RETURNED'] || 0,
          uninvoicedReturns,
          byStatus: statusCounts,
        },
        filterOptions: {
          cities: Array.from(cities).sort((a, b) => a.localeCompare(b)),
          vendors: Array.from(vendorMap.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        },
      },
    });
  })
);

router.get(
  '/coliaty/parcel/:code/history',
  authenticate,
  authorize('CALL_CENTER_AGENT', 'VENDOR', 'SUPER_ADMIN', 'HELPER'),
  asyncHandler(async (req, res) => {
    const { code } = req.params;
    
    const COLIATY_PUBLIC_KEY = getSecret('COLIATY_PUBLIC_KEY');
    const COLIATY_SECRET_KEY = getSecret('COLIATY_SECRET_KEY');
    const COLIATY_BASE_URL = getSecret('COLIATY_BASE_URL') || 'https://customer-api-v1.coliaty.com';

    if (!COLIATY_PUBLIC_KEY || !COLIATY_SECRET_KEY || COLIATY_PUBLIC_KEY === 'your_coliaty_public_key') {
      throw new AppException(400, 'Clés API Coliaty non configurées.');
    }

    try {
      const response = await axios.get(`${COLIATY_BASE_URL}/parcel/history/${code}`, {
        headers: {
          Authorization: `Bearer ${COLIATY_PUBLIC_KEY}:${COLIATY_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      if (response.data?.success) {
        res.json({
          status: 'success',
          data: response.data.data
        });
      } else {
        throw new AppException(response.data?.code || 404, response.data?.message || 'Historique introuvable');
      }
    } catch (error: any) {
      console.error('[Coliaty] History API Error:', error.response?.data || error.message);
      const status = error.response?.status || 500;
      const message = error.response?.data?.message || 'Erreur lors de la récupération de l\'historique';
      throw new AppException(status, message);
    }
  })
);

router.get(
  '/history-by-phone/:phone',
  authenticate,
  authorize('CALL_CENTER_AGENT', 'SUPER_ADMIN', 'HELPER', 'VENDOR'),
  asyncHandler(async (req, res) => {
    const { phone } = req.params;
    
    // Validate Moroccan phone prefix strictly (0 or +212)
    const rawClean = phone.replace(/\s+/g, '');
    let corePhone = '';

    if (rawClean.startsWith('+212') || rawClean.startsWith('00212')) {
      corePhone = rawClean.replace(/\D/g, '').slice(-9);
    } else if (rawClean.startsWith('0') && rawClean.replace(/\D/g, '').length === 10) {
      corePhone = rawClean.replace(/\D/g, '').slice(-9);
    } else {
      // Invalid prefix (e.g., started with 8, 7 without +212), return empty history
      return res.json({
        status: 'success',
        data: {
          summary: { totalLeads: 0, totalOrders: 0, leadStats: {}, orderStats: {} },
          rawHistory: { leads: [], orders: [] }
        }
      });
    }

    if (corePhone.length < 9) {
      throw new AppException(400, 'Numéro de téléphone invalide pour la recherche');
    }

    // Find all leads with this phone number
    const leads = await prisma.lead.findMany({
      where: {
        OR: [
          { phone: { contains: corePhone } },
          { whatsapp: { contains: corePhone } }
        ]
      },
      select: {
        status: true,
        createdAt: true,
        vendor: { select: { profile: { select: { fullName: true } } } }
      }
    });

    // Find all orders with this phone number
    const orders = await prisma.order.findMany({
      where: {
        customerPhone: { contains: corePhone }
      },
      select: {
        status: true,
        createdAt: true,
        vendor: { select: { profile: { select: { fullName: true } } } }
      }
    });

    // Summarize history
    const leadStats = leads.reduce((acc: any, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, {});

    const orderStats = orders.reduce((acc: any, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      status: 'success',
      data: {
        summary: {
          totalLeads: leads.length,
          totalOrders: orders.length,
          leadStats,
          orderStats
        },
        rawHistory: {
          leads: leads.map(l => ({
            status: l.status,
            createdAt: l.createdAt,
            vendorName: l.vendor?.profile?.fullName || 'Vendeur Inconnu'
          })),
          orders: orders.map(o => ({
            status: o.status,
            createdAt: o.createdAt,
            vendorName: o.vendor?.profile?.fullName || 'Vendeur Inconnu'
          }))
        }
      }
    });
  })
);

router.post(
  '/:id/claim',
  authenticate,
  authorize('CALL_CENTER_AGENT'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const lead = await prisma.lead.findFirst({
      where: { id: Number(id), status: { in: ['AVAILABLE'] }, assignedAgentId: null, order: null },
    });

    if (!lead) {
      throw new AppException(400, 'Lead is no longer available');
    }

    const claimedLead = await prisma.$transaction(async (tx) => {
      await tx.leadAssignment.create({
        data: { leadId: lead.id, agentId: req.user!.id },
      });

      await tx.leadStatusHistory.create({
        data: {
          leadId: lead.id,
          oldStatus: lead.status, // use actual old status
          newStatus: 'ASSIGNED',
          changedBy: req.user!.id,
          notes: 'Agent claimed lead manually',
        },
      });

      return tx.lead.update({
        where: { id: lead.id },
        data: { assignedAgentId: req.user!.id, status: 'ASSIGNED' },
      });
    });

    res.json({
      status: 'success',
      message: 'Lead claimed successfully',
      data: { lead: claimedLead },
    });
  })
);

router.get(
  '/:id/detail',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({
      where: { id: Number(id) },
      include: {
        vendor: { include: { profile: true } },
        assignedAgent: { include: { profile: true } },
        callLogs: { orderBy: { createdAt: 'desc' } },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          include: {
            changer: {
              include: { profile: true }
            }
          }
        },
        referralLink: {
          include: {
            influencer: { include: { profile: true, role: true } },
            product: { include: { images: true } },
            landingPage: true
          }
        },
        // Needed for the Coliaty tracking code and the delivery transition
        order: {
          include: {
            statusHistory: {
              orderBy: { createdAt: 'desc' },
              include: { changedByUser: { include: { profile: true } } },
            },
          },
        },
      },
    });

    if (!lead) {
      throw new AppException(404, 'Lead introuvable');
    }

    // Role-based restrictions for agents
    if (req.user!.roleName === 'CALL_CENTER_AGENT') {
      if (lead.assignedAgentId !== req.user!.id) {
        throw new AppException(403, 'Permission denied: Ce lead ne vous est pas assigné');
      }
      
      const finishedStatuses = ['PUSHED_TO_DELIVERY', 'ORDERED', 'SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED'];
      if (finishedStatuses.includes(lead.status)) {
        throw new AppException(403, 'Permission denied: Ce lead a déjà été traité et envoyé à la livraison');
      }
    }

    const { vendor, referralLink, ...leadData } = lead;
    const influencer = referralLink?.influencer
      ? {
        ...referralLink.influencer,
        fullName: referralLink.influencer.profile?.fullName || referralLink.influencer.email,
        accountType: (referralLink.influencer as any).role?.name || null, // VENDOR | INFLUENCER
        accountMode: (referralLink.influencer as any).mode || null,       // SELLER | AFFILIATE
      }
      : null;
    const product = referralLink?.product
      ? {
        ...referralLink.product,
        image: referralLink.product.images?.find(i => i.isPrimary)?.imageUrl || referralLink.product.images?.[0]?.imageUrl,
        name: referralLink.product.nameFr || referralLink.product.nameAr,
        retailPrice: referralLink.product.retailPriceMad
      }
      : null;
    const vendorFormatted = vendor
      ? { ...vendor, fullName: vendor.profile?.fullName || vendor.email }
      : null;

    res.json({
      status: 'success',
      data: {
        lead: { ...leadData, referralLink },
        influencer,
        product,
        vendor: vendorFormatted
      },
    });
  })
);

// POST /:id/contact-click - record that an operator opened WhatsApp / dialled the lead
router.post(
  '/:id/contact-click',
  authenticate,
  asyncHandler(async (req, res) => {
    const leadId = Number(req.params.id);
    const channel = String(req.body?.channel || '').toUpperCase();

    if (!['WHATSAPP', 'CALL'].includes(channel)) {
      throw new AppException(400, 'channel must be WHATSAPP or CALL');
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, assignedAgentId: true } });
    if (!lead) throw new AppException(404, 'Lead introuvable');

    // An agent may only log contact attempts on their own leads
    if (req.user!.roleName === 'CALL_CENTER_AGENT' && lead.assignedAgentId !== req.user!.id) {
      throw new AppException(403, 'Permission denied: Ce lead ne vous est pas assigné');
    }

    await prisma.$executeRaw`
      INSERT INTO lead_contact_clicks ("leadId", "userId", "channel", "createdAt")
      VALUES (${leadId}, ${req.user!.id}, ${channel}, NOW())
    `;

    const rows = await prisma.$queryRaw<{ channel: string; count: number }[]>`
      SELECT "channel", COUNT(*)::int AS count
      FROM lead_contact_clicks
      WHERE "leadId" = ${leadId}
      GROUP BY "channel"
    `;
    const counts = { whatsapp: 0, call: 0 };
    for (const r of rows) {
      if (r.channel === 'WHATSAPP') counts.whatsapp = Number(r.count);
      if (r.channel === 'CALL') counts.call = Number(r.count);
    }

    res.json({ status: 'success', data: { leadId, channel, counts } });
  })
);

// GET /:id/timeline - merged internal history (lead status changes + order status
// changes) for a lead. Unlike /:id/detail this stays readable once the lead has been
// pushed to delivery, which is exactly when the parcel screens need it.
router.get(
  '/:id/timeline',
  authenticate,
  authorize('SUPER_ADMIN', 'HELPER', 'CALL_CENTER_AGENT', 'VENDOR'),
  asyncHandler(async (req, res) => {
    const leadId = Number(req.params.id);

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          include: { changer: { include: { profile: true } } },
        },
        order: {
          include: {
            statusHistory: {
              orderBy: { createdAt: 'desc' },
              include: { changedByUser: { include: { profile: true } } },
            },
          },
        },
      },
    });
    if (!lead) throw new AppException(404, 'Lead introuvable');

    if (req.user!.roleName === 'VENDOR' && lead.vendorId !== req.user!.id) {
      throw new AppException(403, 'Permission denied');
    }

    const naming = (u: any) => u?.profile?.fullName || u?.email || null;

    const entries = [
      ...lead.statusHistory.map(h => ({
        id: `lead-${h.id}`,
        scope: 'LEAD' as const,
        oldStatus: h.oldStatus,
        newStatus: h.newStatus,
        notes: h.notes,
        changedBy: naming((h as any).changer),
        createdAt: h.createdAt,
      })),
      ...((lead.order?.statusHistory || []).map(h => ({
        id: `order-${h.id}`,
        scope: 'ORDER' as const,
        oldStatus: h.oldStatus,
        newStatus: h.newStatus,
        notes: h.notes,
        changedBy: naming((h as any).changedByUser),
        createdAt: h.createdAt,
      }))),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      status: 'success',
      data: {
        leadId,
        currentStatus: lead.status,
        order: lead.order
          ? {
            id: lead.order.id,
            orderNumber: lead.order.orderNumber,
            status: lead.order.status,
            totalAmountMad: lead.order.totalAmountMad,
            coliatyPackageCode: lead.order.coliatyPackageCode,
            coliatyPackageId: lead.order.coliatyPackageId,
            createdAt: lead.order.createdAt,
          }
          : null,
        entries,
      },
    });
  })
);

// GET /:id/sessions - live-stream recordings (Streaming Direct & Replay) tied to this lead.
// A lead is matched to a browsing session either explicitly (an abandoned cart that was
// converted into this lead) or by the phone number captured on the /r/<code> page.
router.get(
  '/:id/sessions',
  authenticate,
  authorize('SUPER_ADMIN', 'HELPER', 'CALL_CENTER_AGENT'),
  asyncHandler(async (req, res) => {
    const leadId = Number(req.params.id);

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, phone: true, whatsapp: true, referralLink: { select: { code: true } } },
    });
    if (!lead) throw new AppException(404, 'Lead introuvable');

    // Match phones on their last 9 digits so 06…, +2126…, 2126… all line up
    const tail = (v?: string | null) => (v || '').replace(/\D/g, '').slice(-9);
    const phoneTails = [tail(lead.phone), tail(lead.whatsapp)].filter(t => t.length === 9);

    const orConditions: any[] = [{ convertedLeadId: leadId }];
    for (const t of phoneTails) orConditions.push({ phone: { endsWith: t } });

    const attempts = await prisma.checkoutAttempt.findMany({
      where: { OR: orConditions },
      orderBy: { updatedAt: 'desc' },
      take: 25,
    });

    const sessionIds = attempts.map(a => a.sessionId);
    const recordings = sessionIds.length
      ? await prisma.sessionRecording.findMany({
        where: { sessionId: { in: sessionIds } },
        select: {
          id: true, sessionId: true, ip: true, userAgent: true, path: true,
          durationSec: true, hasLead: true, createdAt: true,
        },
      })
      : [];
    const recBySession = new Map(recordings.map(r => [r.sessionId, r]));

    res.json({
      status: 'success',
      data: {
        referralCode: lead.referralLink?.code || null,
        sessions: attempts.map(a => {
          const rec = recBySession.get(a.sessionId);
          return {
            attemptId: a.id,
            sessionId: a.sessionId,
            recordingId: rec?.id || null,
            ip: rec?.ip || a.ip,
            userAgent: rec?.userAgent || a.userAgent,
            path: rec?.path || a.path,
            durationSec: rec?.durationSec ?? null,
            referralCode: a.referralCode,
            productName: a.productName,
            fullName: a.fullName,
            phone: a.phone,
            city: a.city,
            address: a.address,
            fieldsFilled: a.fieldsFilled,
            completed: a.completed,
            convertedLeadId: a.convertedLeadId,
            matchedBy: a.convertedLeadId === leadId ? 'CONVERTED' : 'PHONE',
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
          };
        }),
      },
    });
  })
);

router.post(
  '/import',
  authenticate,
  authorize('VENDOR'),
  asyncHandler(async (req, res) => {
    const { productId, leads, sourceMode } = req.body;

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      throw new AppException(400, 'Leads array is required');
    }

    // If productId is provided, find or create a referral link to connect leads to the product
    let resolvedReferralLinkId: number | null = null;
    if (productId) {
      const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
      if (product) {
        // Find existing referral link for this vendor + product
        let refLink = await prisma.referralLink.findFirst({
          where: { influencerId: req.user!.id, productId: product.id },
        });
        if (!refLink) {
          // Create one for the vendor so leads are linked to the product
          const code = `V${req.user!.id}-P${product.id}-${Date.now().toString(36)}`;
          refLink = await prisma.referralLink.create({
            data: {
              influencerId: req.user!.id,
              productId: product.id,
              code,
              isActive: true,
            },
          });
        }
        resolvedReferralLinkId = refLink.id;
      }
    }

    const batch = await prisma.leadImportBatch.create({
      data: {
        vendorId: req.user!.id,
        fileName: `import -${Date.now()}.csv`,
        totalRows: leads.length,
        status: 'PROCESSING',
      },
    });

    let validRows = 0;
    let duplicateRows = 0;
    const errors: string[] = [];

    // Normalize and validate Moroccan phone numbers
    // Accepts: 0612345678, 612345678, +212612345678, 00212612345678, with optional spaces/dashes
    const normalizePhone = (raw: string): string | null => {
      // Remove all spaces, dashes, dots, parentheses
      let cleaned = String(raw).replace(/[\s\-\.\(\)]/g, '');
      
      // Handle various prefixes
      if (cleaned.startsWith('00212')) {
        cleaned = '+212' + cleaned.slice(5);
      } else if (cleaned.startsWith('+212')) {
        // already good
      } else if (cleaned.startsWith('0') && cleaned.length === 10) {
        cleaned = '+212' + cleaned.slice(1);
      } else if (/^[6-7]\d{8}$/.test(cleaned)) {
        // 9-digit number without prefix (Excel stripped the leading 0)
        cleaned = '+212' + cleaned;
      } else if (/^\d{9}$/.test(cleaned)) {
        // Any 9-digit number, assume Moroccan
        cleaned = '+212' + cleaned;
      }
      
      // Final validation: must be +212 followed by 9 digits
      if (/^\+212\d{9}$/.test(cleaned)) {
        return cleaned;
      }
      return null;
    };

    for (const lead of leads) {
      try {
        if (!lead.fullName || !lead.phone) {
          errors.push(`Missing required fields for lead: ${JSON.stringify(lead)} `);
          continue;
        }

        const normalizedPhone = normalizePhone(lead.phone);

        if (!normalizedPhone) {
          errors.push(`Invalid phone format: "${lead.phone}" (cleaned to nothing valid)`);
          continue;
        }

        /* 
        const existingLead = await prisma.lead.findFirst({
          where: {
            vendorId: req.user!.id,
            phone: normalizedPhone,
          },
        });

        if (existingLead) {
          duplicateRows++;
          continue;
        }
        */

        await prisma.lead.create({
          data: {
            vendorId: req.user!.id,
            importBatchId: batch.id,
            referralLinkId: resolvedReferralLinkId,
            fullName: lead.fullName,
            phone: normalizedPhone,
            whatsapp: lead.whatsapp || normalizedPhone,
            city: lead.city,
            address: lead.address,
            status: 'NEW',
            sourceMode: sourceMode || 'VENDOR',
          },
        });

        validRows++;
      } catch (error) {
        errors.push(`Error processing lead: ${error} `);
      }
    }

    await prisma.leadImportBatch.update({
      where: { id: batch.id },
      data: {
        validRows,
        duplicateRows,
        status: 'COMPLETED',
      },
    });

    // Log import results for debugging
    if (errors.length > 0) {
      console.log(`[Lead Import] ${validRows} valid, ${duplicateRows} duplicates, ${errors.length} errors:`);
      errors.slice(0, 5).forEach(e => console.log(`  - ${e}`));
    }

    res.status(201).json({
      status: 'success',
      message: 'Leads imported successfully',
      data: {
        batch: {
          id: batch.id,
          totalRows: leads.length,
          validRows,
          duplicateRows,
          errors: errors.slice(0, 10),
        },
      },
    });
  })
);

router.get(
  '/vendors',
  authenticate,
  authorize('CALL_CENTER_AGENT', 'SUPER_ADMIN', 'HELPER'),
  asyncHandler(async (req, res) => {
    const vendors = await prisma.user.findMany({
      where: {
        isActive: true,
        role: {
          name: { in: ['VENDOR', 'INFLUENCER'] }
        }
      },
      select: {
        id: true,
        email: true,
        phone: true,
        profile: {
          select: {
            fullName: true,
          }
        }
      },
      orderBy: {
        profile: {
          fullName: 'asc'
        }
      }
    });

    res.json({
      status: 'success',
      data: vendors.map(v => ({
        id: v.id,
        email: v.email,
        phone: v.phone,
        fullName: v.profile?.fullName || v.email || `Vendeur #${v.id}`
      }))
    });
  })
);

router.get(
  '/products-by-vendor/:vendorId',
  authenticate,
  authorize('CALL_CENTER_AGENT', 'SUPER_ADMIN', 'HELPER', 'VENDOR'),
  asyncHandler(async (req, res) => {
    const { vendorId } = req.params;
    
    // Vendors can only fetch their own products
    if (req.user!.roleName === 'VENDOR' && Number(vendorId) !== req.user!.id) {
      throw new AppException(403, 'Permission denied');
    }


    const products = await prisma.product.findMany({
      where: {
        status: 'APPROVED',
        OR: [
          { ownerId: Number(vendorId) },
          { inventories: { some: { userId: Number(vendorId) } } },
          { claims: { some: { userId: Number(vendorId), status: { in: ['APPROVED', 'ACTIVE'] } } } }
        ]
      },
      include: {
        images: {
          where: { isPrimary: true },
          take: 1,
        },
        inventories: {
          where: { userId: Number(vendorId) }
        },
        claims: {
          where: { userId: Number(vendorId) }
        }
      },
      orderBy: {
        nameFr: 'asc'
      }
    });

    res.json({
      status: 'success',
      data: products.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.nameFr || p.nameAr,
        retailPriceMad: p.retailPriceMad,
        image: p.images[0]?.imageUrl || null,
        ownerId: p.ownerId,
        hasInventory: p.inventories.length > 0,
        isClaimed: p.claims.some(c => ['APPROVED', 'ACTIVE'].includes(c.status))
      }))
    });
  })
);

router.post(
  '/',
  authenticate,
  authorize('VENDOR', 'HELPER', 'CALL_CENTER_AGENT', 'SUPER_ADMIN'),
  [
    body('fullName').notEmpty().trim(),
    body('phone').matches(/^(\+212|0)[0-9]{9}$/),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed');
    }

    const { fullName, phone, whatsapp, city, address, productId, notes, vendorId: bodyVendorId, sourceMode, package_replacement, package_old_tracking, package_note, customPrice, packName, skipColiaty, source, qte } = req.body;
    const qteNum = qte && Number(qte) > 0 ? Number(qte) : 1;

    // HELPER, CALL_CENTER_AGENT, and SUPER_ADMIN must supply a vendorId in the request body
    const needsVendorId = ['HELPER', 'CALL_CENTER_AGENT', 'SUPER_ADMIN'].includes(req.user!.roleName);
    const effectiveVendorId = needsVendorId ? Number(bodyVendorId) : req.user!.id;
    if (needsVendorId && !bodyVendorId) {
      throw new AppException(400, 'Must provide a vendorId');
    }

    if (!productId) {
      throw new AppException(400, 'Must provide a productId');
    }

    const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
    if (!product) {
      throw new AppException(404, 'Product not found');
    }

    if (product.stockQuantity < qteNum) {
      throw new AppException(400, `Stock insuffisant pour ce produit. (Disponible: ${product.stockQuantity}, Demandé: ${qteNum})`);
    }

    // Pricing calculation (override with customPrice if provided)
    const totalAmountMad = (customPrice !== undefined && customPrice !== null && customPrice !== '') 
      ? Number(customPrice) 
      : product.retailPriceMad * qteNum;
    const commissionPercentage = parseFloat(getSecret('PLATFORM_COMMISSION_PERCENTAGE') || '15');
    const platformFeeMad = totalAmountMad * (commissionPercentage / 100);
    const vendorEarningMad = totalAmountMad - platformFeeMad;

    const generateOrderNumber = (): string => {
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      return `OS-${dateStr}-${random}`;
    };

    const normalizedPhone = phone.replace(/^0/, '+212');

    // Normalize phone for Coliaty: must start with 05, 06 or 07 followed by 8 digits (10 total)
    let normalizedColiatyPhone = normalizedPhone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
    if (normalizedColiatyPhone.startsWith('+212')) normalizedColiatyPhone = '0' + normalizedColiatyPhone.slice(4);
    else if (normalizedColiatyPhone.startsWith('212')) normalizedColiatyPhone = '0' + normalizedColiatyPhone.slice(3);
    else if (!normalizedColiatyPhone.startsWith('0')) normalizedColiatyPhone = '0' + normalizedColiatyPhone;

    // Coliaty requires package_content between 5 and 100 characters
    const productName = product.nameFr || product.nameAr || '';
    let baseContent = '';
    if (productName && packName) {
      baseContent = `${productName} - ${packName}`;
    } else {
      baseContent = packName ? String(packName) : (productName || 'Marchandise');
    }
    let contentValue = baseContent;
    const details = [];
    if (product.sku) details.push(`SKU:${product.sku}`);
    if (details.length > 0) {
      contentValue = `${baseContent} (${details.join(' ')})`;
    }
    if (contentValue.length < 5) contentValue = contentValue.padEnd(5, ' ');
    if (contentValue.length > 100) contentValue = contentValue.substring(0, 100);

    // Call Coliaty parcel creation API (if not skipped)
    let coliatyResult: { package_code: string; package_id: number } | null = null;
    
    if (!skipColiaty) {
      try {
        coliatyResult = await callColiatyCreateParcel({
          package_reciever: fullName,
          package_phone: normalizedColiatyPhone,
          package_price: Number(totalAmountMad),
          package_addresse: address || city || 'Unknown',
          package_city: city || 'Casablanca',
          package_content: contentValue,
          package_no_open: false,
          package_replacement: package_replacement === true || package_replacement === 'true',
          package_old_tracking: package_old_tracking || '',
          package_note: package_note || '',
        });
      } catch (coliatyError: any) {
        console.error('[Coliaty] Error during parcel creation:', coliatyError);
        if (coliatyError instanceof AppException) throw coliatyError;
        throw new AppException(500, 'Erreur lors de la communication avec le service Coliaty.');
      }
    }

    // Referral link resolution
    let resolvedReferralLinkId: number | null = null;
    let refLink = await prisma.referralLink.findFirst({
      where: { influencerId: effectiveVendorId, productId: product.id },
    });
    if (!refLink) {
      const code = `V${effectiveVendorId}-P${product.id}-${Date.now().toString(36)}`;
      refLink = await prisma.referralLink.create({
        data: {
          influencerId: effectiveVendorId,
          productId: product.id,
          code,
          isActive: true,
        },
      });
    }
    resolvedReferralLinkId = refLink.id;

    // Transaction execution
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Lead in PUSHED_TO_DELIVERY or LEAD status
      const newLeadStatus = skipColiaty ? 'LEAD' : 'PUSHED_TO_DELIVERY';
      const lead = await tx.lead.create({
        data: {
          vendorId: effectiveVendorId,
          referralLinkId: resolvedReferralLinkId,
          fullName,
          phone: normalizedPhone,
          whatsapp: whatsapp || normalizedPhone,
          city,
          address,
          status: newLeadStatus,
          productVariant: packName || null,
          notes: notes || `Lead inséré ${skipColiaty ? '(en attente d\'expédition)' : 'et poussé à Coliaty manuellement'} par l'agent.${package_note ? ` (Note Coliaty: ${package_note})` : ''}${package_replacement === true || package_replacement === 'true' ? ` [Replacement de: ${package_old_tracking}]` : ''}${packName ? ` [Nom du Pack: ${packName}]` : ''}${(customPrice !== undefined && customPrice !== null && customPrice !== '') ? ` [Prix Custom: ${customPrice} MAD]` : ''}`,
          sourceMode: sourceMode || 'VENDOR',
          source: source || 'MANUAL',
          assignedAgentId: req.user!.roleName === 'CALL_CENTER_AGENT' ? req.user!.id : null,
        },
      });

      let order = null;

      if (!skipColiaty) {
        // 2. Create Order linked to lead and Coliaty parcel
        order = await (tx.order as any).create({
          data: {
            orderNumber: generateOrderNumber(),
            vendorId: effectiveVendorId,
            leadId: lead.id,
            customerName: fullName,
            customerPhone: normalizedPhone,
            customerCity: city || 'Casablanca',
            customerAddress: address || city || 'Unknown',
            totalAmountMad,
            vendorEarningMad,
            platformFeeMad,
            paymentMethod: 'COD',
            status: 'PENDING',
            packageContent: product.nameFr || product.nameAr || 'Produit',
            packageNoOpen: false,
            productVariant: packName || null,
            coliatyPackageCode: coliatyResult?.package_code || null,
            coliatyPackageId: coliatyResult?.package_id || null,
            items: {
              create: [
                {
                  productId: product.id,
                  quantity: qteNum,
                  unitPriceMad: (customPrice !== undefined && customPrice !== null && customPrice !== '') 
                    ? Number(customPrice) / qteNum 
                    : product.retailPriceMad,
                  totalPriceMad: totalAmountMad,
                },
              ],
            },
          },
        });

        // 3. Decrement Product Stock
        await tx.product.update({
          where: { id: product.id },
          data: { stockQuantity: { decrement: qteNum } },
        });
      }

      // 4. Record history logs
      if (req.user!.roleName === 'CALL_CENTER_AGENT') {
        await tx.leadAssignment.create({
          data: {
            leadId: lead.id,
            agentId: req.user!.id,
          }
        });
      }

      await tx.leadStatusHistory.create({
        data: {
          leadId: lead.id,
          oldStatus: 'NEW',
          newStatus: newLeadStatus,
          changedBy: req.user!.id,
          notes: skipColiaty ? 'Lead inséré (en attente d\'expédition)' : 'Lead inséré et poussé à Coliaty manuellement',
        }
      });

      return { lead, order };
    });

    res.status(201).json({
      status: 'success',
      message: skipColiaty ? 'Lead created and queued for dispatch' : 'Lead created and pushed to Coliaty delivery successfully',
      data: { 
        lead: result.lead,
        order: result.order
      },
    });
  })
);

// PATCH /bulk-status - Bulk update lead statuses (VENDOR, SUPER_ADMIN, HELPER)
router.patch(
  '/bulk-status',
  authenticate,
  authorize('VENDOR', 'SUPER_ADMIN', 'HELPER'),
  asyncHandler(async (req, res) => {
    const { ids, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new AppException(400, 'IDs array is required');
    }

    const validStatuses = [
      'NEW',
      'LEAD',
      'AVAILABLE',
      'ASSIGNED',
      'CONTACTED',
      'INTERESTED',
      'NOT_INTERESTED',
      'CALLBACK_REQUESTED',
      'ORDERED',
      'PUSHED_TO_DELIVERY',
      'UNREACHABLE',
      'INVALID',
    ];

    if (!validStatuses.includes(status)) {
      throw new AppException(400, 'Invalid status');
    }

    const where: any = { id: { in: ids.map(Number) } };
    if (req.user!.roleName === 'VENDOR') {
      where.vendorId = req.user!.id;
    }

    const leads = await prisma.lead.findMany({ where });
    if (leads.length === 0) {
      throw new AppException(404, 'No leads found to update');
    }

    // NEW: Validation for duplicate phone numbers when pushing to Call Center
    if (status === 'AVAILABLE') {
      const phones = leads.map(l => l.phone);
      const uniquePhones = new Set(phones);
      if (uniquePhones.size !== phones.length) {
        throw new AppException(400, 'Impossible d\'envoyer des doublons au Call Center (numéros identiques dans la sélection)');
      }

      // Optional: Check if any of these phones are already in AVAILABLE/ASSIGNED status for this vendor
      const existingActive = await prisma.lead.findFirst({
        where: {
          vendorId: req.user!.id,
          phone: { in: phones },
          status: { in: ['AVAILABLE', 'ASSIGNED'] },
          id: { notIn: leads.map(l => l.id) },
          order: null
        }
      });

      if (existingActive) {
        throw new AppException(400, `Le numéro ${existingActive.phone} est déjà actif au Call Center`);
      }
    }

    const updatedLeads = await prisma.$transaction(async (tx) => {
      // Create status history for each lead
      await tx.leadStatusHistory.createMany({
        data: leads.map(lead => ({
          leadId: lead.id,
          oldStatus: lead.status,
          newStatus: status,
          changedBy: req.user!.id,
        })),
      });

      // Update leads
      return tx.lead.updateMany({
        where: { id: { in: leads.map(l => l.id) } },
        data: { status },
      });
    });

    // Sending leads to the call center from /helper/leads and /vendor/leads goes
    // through this endpoint, which previously emitted nothing at all — so agents
    // got no toast, no sound and no live row until the 8s poll caught up.
    // Emitted after the transaction commits, so an agent that reacts instantly
    // cannot read the lead before its new status is visible.
    if (status === 'AVAILABLE') {
      try {
        const io = getIO();
        if (io) {
          const fresh = await prisma.lead.findMany({
            where: { id: { in: leads.map((l) => l.id) } },
            include: {
              referralLink: { include: { product: { include: { images: true } }, influencer: true } },
            },
          });

          for (const lead of fresh) {
            const product = (lead as any).referralLink?.product;
            const influencer = (lead as any).referralLink?.influencer;
            const payload = {
              id: lead.id,
              fullName: lead.fullName,
              phone: lead.phone,
              city: lead.city,
              address: lead.address,
              status: lead.status,
              createdAt: lead.createdAt,
              updatedAt: lead.updatedAt,
              productPrice: lead.requestedPriceMad || product?.retailPriceMad || 0,
              productVariant: lead.productVariant,
              product: product
                ? {
                    id: product.id,
                    name: product.nameFr || product.nameAr || product.nameEn || `Produit #${product.id}`,
                    sku: product.sku,
                    image: product.images?.[0]?.imageUrl || null,
                  }
                : null,
              influencer: influencer
                ? { id: influencer.id, fullName: influencer.fullName || influencer.email }
                : null,
            };

            // Every call-center agent may claim from the available pool, so this
            // is a role broadcast rather than a per-agent room emit.
            io.to('role:CALL_CENTER_AGENT').emit('new-available-lead', payload);
          }
        }
      } catch (e) {
        // Never fail the status update because the realtime nudge could not be sent.
        console.error('[bulk-status] realtime broadcast failed:', e);
      }
    }

    res.json({
      status: 'success',
      message: `${updatedLeads.count} leads updated successfully`,
      data: { count: updatedLeads.count },
    });
  })
);

// PATCH /:id - Edit basic lead fields (HELPER, VENDOR, SUPER_ADMIN, CALL_CENTER_AGENT)
router.patch(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'VENDOR', 'HELPER', 'CALL_CENTER_AGENT'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { fullName, phone, whatsapp, city, address, notes } = req.body;

    const where: any = { id: Number(id) };
    if (req.user!.roleName === 'VENDOR') where.vendorId = req.user!.id;
    if (req.user!.roleName === 'CALL_CENTER_AGENT') where.assignedAgentId = req.user!.id;

    const lead = await prisma.lead.findFirst({ where });
    if (!lead) throw new AppException(404, 'Lead not found');

    // Validate server-side too: the agent UI checks these, but a malformed phone
    // reaching the database means the courier cannot deliver, and the previous
    // `replace(/^0/, '+212')` only rewrote one of the several shapes agents type.
    let normalizedPhone: string | undefined;
    if (phone !== undefined) {
      const cleaned = String(phone).replace(/[\s.\-()]/g, '');
      let subscriber: string;
      if (cleaned.startsWith('+212')) subscriber = cleaned.slice(4);
      else if (cleaned.startsWith('212')) subscriber = cleaned.slice(3);
      else if (cleaned.startsWith('0')) subscriber = cleaned.slice(1);
      else subscriber = cleaned;

      if (!/^[567]\d{8}$/.test(subscriber)) {
        throw new AppException(
          400,
          'Numéro de téléphone invalide. Format attendu : 0612345678 ou +212612345678.'
        );
      }
      normalizedPhone = `+212${subscriber}`;
    }

    if (fullName !== undefined && String(fullName).trim().length > 0) {
      const name = String(fullName).trim();
      if (name.length < 3 || name.length > 80) {
        throw new AppException(400, 'Nom invalide (entre 3 et 80 caractères).');
      }
    }

    if (address !== undefined && String(address).trim().length > 200) {
      throw new AppException(400, 'Adresse trop longue (200 caractères maximum).');
    }

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        fullName: fullName || lead.fullName,
        phone: normalizedPhone || lead.phone,
        whatsapp: whatsapp || lead.whatsapp,
        city: city !== undefined ? city : lead.city,
        address: address !== undefined ? address : lead.address,
        notes: notes !== undefined ? notes : lead.notes,
      },
    });

    res.json({ status: 'success', message: 'Lead updated', data: { lead: updated } });
  })
);

// PATCH /:id/payment-situation - Change billing situation (HELPER, SUPER_ADMIN)
router.patch(
  '/:id/payment-situation',
  authenticate,
  authorize('HELPER', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { paymentSituation } = req.body;

    const valid = ['NOT_PAID', 'PAID', 'FACTURED', 'Payé', 'no Payé'];
    if (!valid.includes(paymentSituation)) {
      throw new AppException(400, `Invalid paymentSituation. Must be one of: ${valid.join(', ')}`);
    }

    const lead = await prisma.lead.findUnique({ where: { id: Number(id) } });
    if (!lead) throw new AppException(404, 'Lead not found');

    const updated = await (prisma.lead as any).update({
      where: { id: lead.id },
      data: { paymentSituation },
    });

    res.json({
      status: 'success',
      message: 'Payment situation updated',
      data: { lead: updated },
    });
  })
);

router.patch(
  '/:id/status',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, notes, callbackAt, requestedPriceMad } = req.body;

    const validStatuses = [
      'NEW',
      'LEAD',
      'ASSIGNED',
      'CALL_LATER',
      'NO_REPLY',
      'CONFIRMED',
      'WRONG_ORDER',
      'CANCEL_REASON_PRICE',
      'CANCEL_ORDER',
      'INVALID',
      'CONTACTED',
      'INTERESTED',
      'NOT_INTERESTED',
      'CALLBACK_REQUESTED',
      'ORDERED',
      'PUSHED_TO_DELIVERY',
      'PRICE_CONFIRMED',
      'PRICE_REJECTED',
      'UNREACHABLE',
    ];

    if (!validStatuses.includes(status)) {
      throw new AppException(400, 'Invalid status');
    }

    const where: any = { id: Number(id) };

    if (req.user!.roleName === 'VENDOR') {
      where.vendorId = req.user!.id;
    } else if (req.user!.roleName === 'CALL_CENTER_AGENT') {
      where.assignedAgentId = req.user!.id;
    }
    // HELPER and SUPER_ADMIN have no additional filter — they can change any lead's status

    const lead = await prisma.lead.findFirst({ where });

    if (!lead) {
      throw new AppException(404, 'Lead not found');
    }

    const updatedLead = await prisma.$transaction(async (tx) => {
      await tx.leadStatusHistory.create({
        data: {
          leadId: lead.id,
          oldStatus: lead.status,
          newStatus: status,
          changedBy: req.user!.id,
        },
      });

      return tx.lead.update({
        where: { id: lead.id },
        data: {
          status,
          notes: notes !== undefined ? notes : lead.notes,
          callbackAt: callbackAt !== undefined ? callbackAt : lead.callbackAt,
          requestedPriceMad: requestedPriceMad !== undefined ? requestedPriceMad : lead.requestedPriceMad,
          requestedPriceStatus: requestedPriceMad !== undefined ? 'PENDING' : lead.requestedPriceStatus,
        },
      });
    });

    if (updatedLead && updatedLead.referralLinkId) {
      const statusesToNotify = ['CONFIRMED', 'DELIVERED', 'CANCEL_REASON_PRICE', 'RETURNED'];
      if (statusesToNotify.includes(status)) {
        try {
          const link = await prisma.referralLink.findUnique({
            where: { id: updatedLead.referralLinkId },
            include: { product: true }
          });
          if (link) {
            const statusLabels: Record<string, string> = {
              'CONFIRMED': 'CONFIRMÉ',
              'DELIVERED': 'LIVRÉ',
              'CANCEL_REASON_PRICE': 'ANNULÉ (PRIX)',
              'RETURNED': 'RETOURNÉ'
            };
            const label = statusLabels[status] || status;
            const productName = link.product?.nameFr || link.product?.nameAr || 'Produit';
            const { createNotification } = await import('../utils/notification.js');
            await createNotification(
              link.influencerId,
              'LEAD_STATUS_CHANGED',
              `📈 Statut du lead mis à jour : ${label}`,
              `Le lead de ${updatedLead.fullName} pour le produit "${productName}" est maintenant ${label}.`
            );
          }
        } catch (err) {
          console.error('Failed to trigger lead status notification:', err);
        }
      }
    }

    res.json({
      status: 'success',
      message: 'Lead status updated',
      data: { lead: updatedLead },
    });
  })
);


router.post(
  '/:id/assign',
  authenticate,
  authorize('SUPER_ADMIN', 'CALL_CENTER_AGENT', 'HELPER'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { agentId } = req.body;

    const lead = await prisma.lead.findUnique({
      where: { id: Number(id) },
    });

    if (!lead) {
      throw new AppException(404, 'Lead not found');
    }

    const agent = await prisma.user.findFirst({
      where: {
        id: Number(agentId),
        role: { name: 'CALL_CENTER_AGENT' },
        isActive: true,
      },
    });

    if (!agent) {
      throw new AppException(404, 'Agent not found');
    }

    const updatedLead = await prisma.$transaction(async (tx) => {
      if (lead.assignedAgentId) {
        await tx.leadAssignment.updateMany({
          where: {
            leadId: lead.id,
            agentId: lead.assignedAgentId,
            unassignedAt: null,
          },
          data: { unassignedAt: new Date() },
        });
      }

      await tx.leadAssignment.create({
        data: {
          leadId: lead.id,
          agentId: agent.id,
        },
      });

      await tx.leadStatusHistory.create({
        data: {
          leadId: lead.id,
          oldStatus: lead.status,
          newStatus: 'ASSIGNED',
          changedBy: req.user!.id,
        },
      });

      return tx.lead.update({
        where: { id: lead.id },
        data: {
          assignedAgentId: agent.id,
          status: 'ASSIGNED',
        },
      });
    });

    res.json({
      status: 'success',
      message: 'Lead assigned successfully',
      data: { lead: updatedLead },
    });
  })
);

router.post(
  '/auto-assign',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const { limit = 50 } = req.body;

    const unassignedLeads = await prisma.lead.findMany({
      where: {
        status: 'NEW',
        assignedAgentId: null,
      },
      take: Number(limit),
    });

    const agents = await prisma.user.findMany({
      where: {
        role: { name: 'CALL_CENTER_AGENT' },
        isActive: true,
      },
    });

    if (agents.length === 0) {
      throw new AppException(400, 'No active agents available');
    }

    let assignedCount = 0;

    for (let i = 0; i < unassignedLeads.length; i++) {
      const agent = agents[i % agents.length];
      const lead = unassignedLeads[i];

      await prisma.$transaction(async (tx) => {
        await tx.leadAssignment.create({
          data: {
            leadId: lead.id,
            agentId: agent.id,
          },
        });

        await tx.lead.update({
          where: { id: lead.id },
          data: {
            assignedAgentId: agent.id,
            status: 'ASSIGNED',
          },
        });
      });

      assignedCount++;
    }

    res.json({
      status: 'success',
      message: `Successfully assigned ${assignedCount} leads`,
      data: { assignedCount, agentCount: agents.length },
    });
  })
);

router.post(
  '/:id/call-log',
  authenticate,
  authorize('CALL_CENTER_AGENT'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { duration, outcome, recordingUrl } = req.body;

    const lead = await prisma.lead.findFirst({
      where: {
        id: Number(id),
        assignedAgentId: req.user!.id,
      },
    });

    if (!lead) {
      throw new AppException(404, 'Lead not found or not assigned to you');
    }

    const callLog = await prisma.callLog.create({
      data: {
        leadId: lead.id,
        agentId: req.user!.id,
        callDurationSeconds: duration,
        outcome,
        recordingUrl,
      },
    });

    res.status(201).json({
      status: 'success',
      message: 'Call logged successfully',
      data: { callLog },
    });
  })
);

router.post(
  '/:id/push-to-delivery',
  authenticate,
  authorize('CALL_CENTER_AGENT', 'HELPER'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { 
      productId, 
      quantity = 1, 
      paymentMethod = 'COD',
      package_reciever,
      package_phone,
      package_city,
      package_addresse,
      package_price,
      package_content,
      package_no_open,
      package_note,
      productVariant
    } = req.body;

    const where: any = {
      id: Number(id),
      status: { in: ['ORDERED', 'CONFIRMED'] },
    };

    if (req.user!.roleName === 'CALL_CENTER_AGENT') {
      where.assignedAgentId = req.user!.id;
    } else if (req.user!.roleName === 'HELPER') {
      if (!req.user!.canManageLeads) {
        throw new AppException(403, 'Permission denied: Vous n\'avez pas le droit de gérer les leads');
      }
      const assignments = await (prisma as any).helperUserAssignment.findMany({
        where: { helperId: req.user!.id },
      });
      where.vendorId = { in: assignments.map((a: any) => a.targetUserId) };
    }

    const lead = await prisma.lead.findFirst({
      where,
      include: {
        referralLink: {
          include: {
            landingPage: true
          }
        }
      }
    });

    if (!lead) {
      throw new AppException(404, 'Lead not found, not assigned to you, or not in ORDERED/CONFIRMED status');
    }

    // Check if an order already exists for this lead (e.g. out of sync status or double click)
    const existingOrder = await prisma.order.findUnique({
      where: { leadId: lead.id }
    });

    if (existingOrder) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'PUSHED_TO_DELIVERY' }
      });
      return res.json({
        status: 'success',
        message: 'Order already exists, lead status synchronized',
        data: { order: existingOrder },
      });
    }

    // Brand logic removed

    let productToOrder = null;
    if (productId && Number(productId) !== 0) {
      productToOrder = await prisma.product.findUnique({ where: { id: Number(productId) } });
    }
    
    // If no explicit productId, use the product from the lead's referral link
    if (!productToOrder && lead.referralLink?.productId) {
      productToOrder = await prisma.product.findUnique({ where: { id: lead.referralLink.productId } });
    }
    
    // Last resort fallback: find any active product for this vendor
    if (!productToOrder) {
      productToOrder = await prisma.product.findFirst({
        where: { ownerId: lead.vendorId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!productToOrder) {
      throw new AppException(400, 'No active product found for this vendor to create an order');
    }

    // --- STOCK VALIDATION ---
    if (productToOrder.stockQuantity < Number(quantity || 1)) {
      throw new AppException(400, `Stock insuffisant pour ce produit. (Disponible: ${productToOrder.stockQuantity}, Demandé: ${quantity || 1})`);
    }

    let unitPrice = productToOrder.retailPriceMad;

    // Check for pack pricing if lead has a productVariant
    if (lead.productVariant && lead.referralLink?.landingPage?.customStructure) {
      try {
        const structure = typeof lead.referralLink.landingPage.customStructure === 'string'
          ? JSON.parse(lead.referralLink.landingPage.customStructure)
          : lead.referralLink.landingPage.customStructure;
        const blocks = structure.blocks || [];
        const checkoutBlock = blocks.find((b: any) => b.type === 'express_checkout');
        if (checkoutBlock) {
          const options = checkoutBlock.content?.options || [];
          const selected = options.find((o: any) => o.name === lead.productVariant);
          if (selected && selected.price) {
            unitPrice = selected.price;
          }
        }
      } catch (e) {
        console.error('Error parsing pack pricing:', e);
      }
    }
    
    // Use override price if provided, otherwise calculate
    const totalAmountMad = package_price !== undefined ? Number(package_price) : unitPrice * Number(quantity);
    
    const commissionPercentage = parseFloat(getSecret('PLATFORM_COMMISSION_PERCENTAGE') || '15');
    const platformFeeMad = totalAmountMad * (commissionPercentage / 100);
    const vendorEarningMad = totalAmountMad - platformFeeMad;

    const generateOrderNumber = (): string => {
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      return `OS - ${dateStr} -${random} `;
    };

    // Override lead data with modal input if provided
    const receiverName = package_reciever || lead.fullName;
    const receiverPhone = package_phone || lead.phone;
    const receiverCity = package_city || lead.city || 'Casablanca';
    const receiverAddress = package_addresse || lead.address || lead.city || 'Unknown';

    // Create a Coliaty parcel (MANDATORY)
    let coliatyResult: { package_code: string; package_id: number };
    try {
      // Normalize phone for Coliaty: must start with 05, 06 or 07 followed by 8 digits (10 total)
      let normalizedPhone = receiverPhone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
      if (normalizedPhone.startsWith('+212')) normalizedPhone = '0' + normalizedPhone.slice(4);
      else if (normalizedPhone.startsWith('212')) normalizedPhone = '0' + normalizedPhone.slice(3);
      else if (!normalizedPhone.startsWith('0')) normalizedPhone = '0' + normalizedPhone;
      
      // Coliaty requires package_content between 5 and 100 characters
      const finalVariant = productVariant || lead.productVariant;
      const productName = productToOrder.nameFr || productToOrder.nameAr || '';
      let baseContent = package_content;
      if (!baseContent) {
        if (productName && finalVariant) {
          baseContent = `${productName} - ${finalVariant}`;
        } else {
          baseContent = finalVariant || productName || 'Marchandise';
        }
      }
      
      // Append SKU and Pack if available for better visibility in Coliaty
      let contentValue = baseContent;
      const details = [];
      if (productToOrder.sku) details.push(`SKU:${productToOrder.sku}`);
      if (finalVariant && !baseContent.includes(finalVariant)) details.push(`PK:${finalVariant}`);
      
      if (details.length > 0) {
        contentValue = `${baseContent} (${details.join(' ')})`;
      }

      if (contentValue.length < 5) contentValue = contentValue.padEnd(5, ' ');
      if (contentValue.length > 100) contentValue = contentValue.substring(0, 100);

      coliatyResult = await callColiatyCreateParcel({
        package_reciever: receiverName,
        package_phone: normalizedPhone,
        package_price: Number(totalAmountMad),
        package_addresse: receiverAddress,
        package_city: receiverCity,
        package_content: contentValue,
        package_no_open: package_no_open ?? false,
        // The agent's call notes ("customer only available after 18h", "call
        // before delivery") are what the courier actually needs. Falls back to
        // the notes already stored on the lead when the modal sends none.
        package_note: (package_note ?? lead.notes ?? '').toString().slice(0, 255),
      });
    } catch (coliatyError: any) {
      console.error('[Coliaty] Error during parcel creation:', coliatyError);
      if (coliatyError instanceof AppException) throw coliatyError;
      throw new AppException(500, 'Erreur lors de la communication avec le service Coliaty.');
    }

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await (tx.order as any).create({
        data: {
          orderNumber: generateOrderNumber(),
          vendorId: lead.vendorId,
          leadId: lead.id,
          customerName: receiverName,
          customerPhone: receiverPhone,
          customerCity: receiverCity,
          customerAddress: receiverAddress,
          totalAmountMad,
          vendorEarningMad,
          platformFeeMad,
          paymentMethod,
          status: 'PENDING',
          packageContent: package_content || productToOrder.nameFr || productToOrder.nameAr || 'Produit',
          packageNoOpen: package_no_open ?? false,
          productVariant: productVariant || lead.productVariant,
          ...(coliatyResult ? {
            coliatyPackageCode: coliatyResult.package_code,
            coliatyPackageId: coliatyResult.package_id,
          } : {}),
          items: {
            create: [
              {
                productId: productToOrder!.id,
                quantity: Number(quantity),
                unitPriceMad: unitPrice,
                totalPriceMad: totalAmountMad,
              },
            ],
          },
        },
      });

      // Update lead status so it disappears from the active list
      await tx.lead.update({
        where: { id: lead.id },
        data: { status: 'PUSHED_TO_DELIVERY' }
      });

      // --- STOCK DECREMENT ---
      await tx.product.update({
        where: { id: productToOrder!.id },
        data: { stockQuantity: { decrement: Number(quantity || 1) } }
      });

      return newOrder;
    });

    res.status(201).json({
      status: 'success',
      message: coliatyResult
        ? `Order created and pushed to Coliaty (ref: ${coliatyResult.package_code})`
        : 'Order created and pushed to delivery (Coliaty not configured)',
      data: {
        order,
        coliaty: coliatyResult,
      },
    });
  })
);

// Verify Return Code (Helper - identifying before processing)
router.post(
  '/verify-return',
  authenticate,
  authorize('SUPER_ADMIN', 'HELPER'),
  asyncHandler(async (req, res) => {
    const { code } = req.body;
    if (!code) throw new AppException(400, 'Code is required');

    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { coliatyPackageCode: { equals: code, mode: 'insensitive' } },
          { orderNumber: { equals: code, mode: 'insensitive' } }
        ]
      },
      include: { 
        vendor: { select: { id: true, profile: { select: { fullName: true } } } },
        lead: { 
          include: { 
            referralLink: { 
              include: { 
                influencer: { select: { id: true, profile: { select: { fullName: true } } } } 
              } 
            } 
          } 
        }
      }
    });

    if (!order) {
      throw new AppException(404, 'Colis non trouvé');
    }

    if (order.status !== 'RETURNED') {
      throw new AppException(400, "Le statut du colis doit être RETOURNÉ pour être traité.");
    }

    if (order.lead?.paymentSituation === 'FACTURED') {
      throw new AppException(400, "Ce colis a déjà été retourné et facturé.");
    }

    const owner = order.lead?.referralLink?.influencer || order.vendor;
    const ownerName = owner?.profile?.fullName || 'Utilisateur inconnu';
    const ownerId = owner?.id;

    res.json({
      status: 'success',
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        coliatyCode: order.coliatyPackageCode,
        customerName: order.customerName,
        ownerName,
        ownerId,
        alreadyReturned: false // Since we explicitly throw above if already returned
      }
    });
  })
);

// Bulk Scan Returns (Helper)
router.post(
  '/bulk-scan-returns',
  authenticate,
  authorize('SUPER_ADMIN', 'HELPER'),
  asyncHandler(async (req, res) => {
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      throw new AppException(400, 'orderIds array is required');
    }

    const results = await prisma.$transaction(async (tx) => {
      const orders = await tx.order.findMany({
        where: { id: { in: orderIds.map(Number) } },
        include: { 
          lead: { include: { referralLink: true } },
          items: true
        }
      });

      const processed: number[] = [];
      const errors: any[] = [];
      const userGroups: Record<number, any[]> = {};

      for (const order of orders) {
        if (!order.lead) continue;
        if (order.status !== 'RETURNED') {
          errors.push({ orderId: order.id, message: "Le statut du colis doit être RETOURNÉ" });
          continue;
        }
        if (order.lead.paymentSituation === 'FACTURED') {
          errors.push({ orderId: order.id, message: 'Déjà retourné et facturé' });
          continue;
        }

        const userId = order.lead.referralLink?.influencerId || order.vendorId;
        if (!userGroups[userId]) userGroups[userId] = [];
        userGroups[userId].push(order);
      }

      for (const [userIdStr, userOrders] of Object.entries(userGroups)) {
        const userId = Number(userIdStr);
        const count = userOrders.length;
        const totalDeduction = count * 3;

        try {
          // 1. Create consolidated Invoice
          const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
          const invoiceNumber = `RET-BULK-${dateStr}-${randomStr}`;

          const invoice = await tx.invoice.create({
            data: {
              invoiceNumber,
              userId,
              totalAmountMad: -totalDeduction,
              status: 'PAID',
            }
          });

          // 2. Process each order in the group
          for (const order of userOrders) {
            // Update Order
            await tx.order.update({
              where: { id: order.id },
              data: { status: 'RETURNED' }
            });

            // Update Lead
            await tx.lead.update({
              where: { id: order.leadId! },
              data: { 
                status: 'RETURNED', 
                paymentSituation: 'FACTURED',
                invoiceId: invoice.id 
              }
            });

            // Restore Stock
            const stockRestorable = !['CANCELED', 'CANCELED_BY_SELLER', 'CANCELED_BY_SYSTEM', 'REFUSE', 'RETURNED', 'CANCELLED'].includes(order.status);
            if (stockRestorable) {
              for (const item of order.items) {
                await tx.product.update({
                  where: { id: item.productId },
                  data: { stockQuantity: { increment: item.quantity } }
                });
              }
            }
            processed.push(order.id);
          }

          // 3. Consolidated Wallet Deduction
          let wallet = await tx.wallet.findUnique({ where: { userId } });
          if (!wallet) wallet = await tx.wallet.create({ data: { userId } });

          const updatedWallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: { balanceMad: { decrement: totalDeduction } }
          });

          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'RETURN_FEE',
              amountMad: -totalDeduction,
              balanceAfterMad: updatedWallet.balanceMad,
              description: `Frais de retour groupés - ${count} colis`,
            }
          });

        } catch (err: any) {
          errors.push({ userId, message: err.message });
        }
      }

      return { processed, errors };
    });

    res.json({
      status: 'success',
      message: `${results.processed.length} retours traités avec succès.`,
      data: results
    });
  })
);

// Scan Return (Helper)
router.post(
  '/scan-return',
  authenticate,
  authorize('SUPER_ADMIN', 'HELPER'),
  asyncHandler(async (req, res) => {
    const { code } = req.body;
    if (!code) {
      throw new AppException(400, 'Code is required');
    }

    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { coliatyPackageCode: { equals: code, mode: 'insensitive' } },
          { orderNumber: { equals: code, mode: 'insensitive' } }
        ]
      },
      include: { 
        lead: { include: { referralLink: true } },
        items: true
      }
    });

    if (!order || !order.lead) {
      throw new AppException(404, 'Order or Lead not found for this code');
    }

    if (order.status !== 'RETURNED') {
      throw new AppException(400, "Le statut du colis doit être RETOURNÉ pour être traité.");
    }
    if (order.lead.paymentSituation === 'FACTURED') {
      throw new AppException(400, 'Ce colis a déjà été retourné et facturé.');
    }

    // Process Return
    await prisma.$transaction(async (tx) => {
      // 1. Update Order Status
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'RETURNED' }
      });

      // 2. Update Lead Status
      await tx.lead.update({
        where: { id: order.leadId! },
        data: { status: 'RETURNED', paymentSituation: 'FACTURED' }
      });

      // 3. Increment Stock Back (Only if it wasn't already in a cancelled/returned status)
      const stockAlreadyRestoredStatuses = ['CANCELED', 'CANCELED_BY_SELLER', 'CANCELED_BY_SYSTEM', 'REFUSE', 'RETURNED', 'CANCELLED'];
      if (!stockAlreadyRestoredStatuses.includes(order.status)) {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: item.quantity } }
          });
        }
      }

      const userId = order.lead!.referralLink?.influencerId || order.vendorId;

      // 4. Generate Frais de retour Invoice (-3 MAD)
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const invoiceNumber = `RET-${dateStr}-${randomStr}`;

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          userId,
          totalAmountMad: -3,
          status: 'PAID',
        }
      });

      // Link Invoice to Lead
      await tx.lead.update({
        where: { id: order.leadId! },
        data: { invoiceId: invoice.id }
      });

      // 5. Wallet Deduction
      let wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.wallet.create({ data: { userId } });
      }

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceMad: { decrement: 3 } }
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'RETURN_FEE',
          amountMad: -3,
          balanceAfterMad: updatedWallet.balanceMad,
          description: `Frais de retour - Colis ${code}`,
          orderId: order.id
        }
      });
    });

    res.json({
      status: 'success',
      message: 'Retour traité avec succès: stock récupéré et -3 MAD déduits.'
    });
  })
);

// Get products the current user has bought, owned, or claimed
router.get(
  '/my-products',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { mode } = req.query;
    const requestedMode = mode ? String(mode).toUpperCase() : null;

    let inventoryProducts: any[] = [];
    let ownedProducts: any[] = [];
    let claimedProducts: any[] = [];

    if (requestedMode === 'SELLER') {
      // 1. Products from inventory (bought)
      inventoryProducts = await prisma.productInventory.findMany({
        where: { userId },
        include: {
          product: {
            include: { images: { where: { isPrimary: true }, take: 1 } },
          },
        },
      });

      // 2. Products created/owned by vendor
      ownedProducts = await prisma.product.findMany({
        where: { ownerId: userId },
        include: { images: { where: { isPrimary: true }, take: 1 } },
      });

      // 3. Claims specifically in SELLER mode
      claimedProducts = await prisma.affiliateClaim.findMany({
        where: { userId, status: 'APPROVED', userMode: 'SELLER' },
        include: {
          product: {
            include: { images: { where: { isPrimary: true }, take: 1 } },
          },
        },
      });
    } else if (requestedMode === 'AFFILIATE') {
      // Products claimed specifically in AFFILIATE mode
      claimedProducts = await prisma.affiliateClaim.findMany({
        where: { userId, status: 'APPROVED', userMode: 'AFFILIATE' },
        include: {
          product: {
            include: { images: { where: { isPrimary: true }, take: 1 } },
          },
        },
      });
    } else {
      // All products if no mode parameter specified
      inventoryProducts = await prisma.productInventory.findMany({
        where: { userId },
        include: {
          product: {
            include: { images: { where: { isPrimary: true }, take: 1 } },
          },
        },
      });

      ownedProducts = await prisma.product.findMany({
        where: { ownerId: userId },
        include: { images: { where: { isPrimary: true }, take: 1 } },
      });

      claimedProducts = await prisma.affiliateClaim.findMany({
        where: { userId, status: 'APPROVED' },
        include: {
          product: {
            include: { images: { where: { isPrimary: true }, take: 1 } },
          },
        },
      });
    }

    // Merge and deduplicate
    const productMap = new Map<number, any>();

    for (const inv of inventoryProducts) {
      if (inv.product && !productMap.has(inv.productId)) {
        productMap.set(inv.productId, {
          id: inv.product.id,
          sku: inv.product.sku,
          name: inv.product.nameFr || inv.product.nameAr,
          image: inv.product.images[0]?.imageUrl || null,
          retailPrice: inv.product.retailPriceMad,
          source: 'INVENTORY',
        });
      }
    }

    for (const prod of ownedProducts) {
      if (!productMap.has(prod.id)) {
        productMap.set(prod.id, {
          id: prod.id,
          sku: prod.sku,
          name: prod.nameFr || prod.nameAr,
          image: prod.images[0]?.imageUrl || null,
          retailPrice: prod.retailPriceMad,
          source: 'OWNED',
        });
      }
    }

    for (const claim of claimedProducts) {
      if (claim.product && !productMap.has(claim.productId)) {
        productMap.set(claim.productId, {
          id: claim.product.id,
          sku: claim.product.sku,
          name: claim.product.nameFr || claim.product.nameAr,
          image: claim.product.images[0]?.imageUrl || null,
          retailPrice: claim.product.retailPriceMad,
          source: 'AFFILIATE_CLAIM',
        });
      }
    }

    // 4. Fallback ONLY if no mode parameter was specified
    if (productMap.size === 0 && !requestedMode) {
      const fallbackProducts = await prisma.product.findMany({
        where: { isActive: true, status: 'APPROVED' },
        take: 20,
        include: { images: { where: { isPrimary: true }, take: 1 } },
      });

      for (const prod of fallbackProducts) {
        productMap.set(prod.id, {
          id: prod.id,
          sku: prod.sku,
          name: prod.nameFr || prod.nameAr,
          image: prod.images[0]?.imageUrl || null,
          retailPrice: prod.retailPriceMad,
          source: 'CATALOG',
        });
      }
    }

    res.json({
      status: 'success',
      data: { products: Array.from(productMap.values()) },
    });
  })
);

router.delete(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'CALL_CENTER_AGENT', 'VENDOR'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({
      where: { id: Number(id) },
    });

    if (!lead) {
      throw new AppException(404, 'Lead not found');
    }

    // Role-based restrictions
    if (req.user!.roleName === 'VENDOR' && lead.vendorId !== req.user!.id) {
      throw new AppException(403, 'Not authorized to delete this lead');
    }
    if (req.user!.roleName === 'CALL_CENTER_AGENT' && lead.assignedAgentId !== req.user!.id) {
      throw new AppException(403, 'Not authorized to delete this assigned lead');
    }

    // Must not be pushed to Coliaty already
    const existingOrder = await prisma.order.findUnique({
      where: { leadId: lead.id }
    });
    if (existingOrder && existingOrder.coliatyPackageCode) {
      throw new AppException(400, 'Cannot delete a lead that has already been pushed to delivery. Please cancel the order first.');
    }

    await prisma.$transaction(async (tx) => {
      if (existingOrder) {
        await tx.orderItem.deleteMany({ where: { orderId: existingOrder.id } });
        await tx.orderStatusHistory.deleteMany({ where: { orderId: existingOrder.id } });
        await tx.order.delete({ where: { id: existingOrder.id } });
      }

      // Clean up lead assignments and history to allow delete
      await tx.leadAssignment.deleteMany({ where: { leadId: lead.id } });
      await tx.leadStatusHistory.deleteMany({ where: { leadId: lead.id } });
      await tx.callLog.deleteMany({ where: { leadId: lead.id } });
      
      await tx.lead.delete({
        where: { id: lead.id },
      });
    });

    res.json({
      status: 'success',
      message: 'Lead deleted completely',
    });
  })
);
router.post(
  '/:id/respond-price-request',
  authenticate,
  authorize('VENDOR', 'SUPER_ADMIN', 'HELPER', 'INFLUENCER'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { action } = req.body; // 'APPROVE' | 'REJECT'

    if (!['APPROVE', 'REJECT'].includes(action)) {
      throw new AppException(400, 'L\'action doit être APPROVE ou REJECT');
    }

    const where: any = { id: Number(id) };
    if (req.user!.roleName === 'VENDOR') {
      where.vendorId = req.user!.id;
    } else if (req.user!.roleName === 'INFLUENCER') {
      // Find the lead through its referral link owned by the influencer
      const influencerLinks = await prisma.referralLink.findMany({
        where: { influencerId: req.user!.id },
        select: { id: true }
      });
      where.referralLinkId = { in: influencerLinks.map(l => l.id) };
    }

    const lead = await prisma.lead.findFirst({ where });
    if (!lead) {
      throw new AppException(404, 'Lead introuvable ou vous n\'avez pas les permissions');
    }

    if (lead.status !== 'CANCEL_REASON_PRICE' || lead.requestedPriceStatus !== 'PENDING') {
      throw new AppException(400, 'Ce lead n\'a pas de demande de prix en attente');
    }

    const newStatus = action === 'APPROVE' ? 'PRICE_CONFIRMED' : 'PRICE_REJECTED';

    const updatedLead = await prisma.$transaction(async (tx) => {
      await tx.leadStatusHistory.create({
        data: {
          leadId: lead.id,
          oldStatus: lead.status,
          newStatus,
          changedBy: req.user!.id,
          notes: `Demande de prix ${action === 'APPROVE' ? 'approuvée' : 'rejetée'}`
        },
      });

      return tx.lead.update({
        where: { id: lead.id },
        data: {
          status: newStatus,
          requestedPriceStatus: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        },
      });
    });

    res.json({
      status: 'success',
      message: `Demande de prix ${action === 'APPROVE' ? 'approuvée' : 'rejetée'}`,
      data: { lead: updatedLead },
    });
  })
);

/**
 * POST /api/v1/leads/push-integration-leads
 * Bulk push selected WooCommerce, Shopify, or YouCan orders as Leads to Call Center
 */
router.post(
  '/push-integration-leads',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { source, mode, productId, orders } = req.body;

    if (!Array.isArray(orders) || orders.length === 0) {
      throw new AppException(400, 'Aucune commande sélectionnée.');
    }

    if (!productId) {
      throw new AppException(400, 'Veuillez sélectionner un produit dans votre inventaire.');
    }

    const product = await prisma.product.findUnique({
      where: { id: Number(productId) },
    });

    if (!product) {
      throw new AppException(404, 'Produit introuvable.');
    }

    const isAffiliate = mode === 'AFFILIATE';
    
    // Find or create referral link for this user & product
    let refLink = await prisma.referralLink.findFirst({
      where: { influencerId: userId, productId: product.id },
    });

    if (!refLink) {
      refLink = await prisma.referralLink.create({
        data: {
          influencerId: userId,
          productId: product.id,
          code: `${isAffiliate ? 'aff' : 'sell'}-${userId}-${product.id}-${Date.now().toString(36)}`,
        },
      });
    }
    const referralLinkId = refLink.id;

    const sourceTag = source ? String(source).toUpperCase() : 'WOOCOMMERCE';
    let createdCount = 0;

    for (const ord of orders) {
      const phoneRaw = ord.phone || ord.billing?.phone || ord.shipping?.phone || '';
      const phone = phoneRaw.replace(/[^0-9+]/g, '');

      if (!phone) continue;

      const firstName = ord.billing?.first_name || ord.shipping?.first_name || '';
      const lastName = ord.billing?.last_name || ord.shipping?.last_name || '';
      const fullName = ord.customerName || [firstName, lastName].filter(Boolean).join(' ') || `Client ${sourceTag} #${ord.number || ord.id}`;
      const city = ord.city || ord.billing?.city || ord.shipping?.city || 'Non spécifiée';
      const address = ord.address || ord.billing?.address_1 || ord.shipping?.address_1 || null;
      const orderRef = ord.number || ord.id || '';
      const totalAmount = Number(ord.total || 0);

      // Avoid creating duplicate leads for the same source & order ID
      const existing = await prisma.lead.findFirst({
        where: {
          vendorId: userId,
          phone,
          source: sourceTag,
          sourceId: String(ord.id),
        },
      });

      if (!existing) {
        const createdLead = await prisma.lead.create({
          data: {
            vendorId: userId,
            fullName,
            phone,
            city,
            address,
            status: 'AVAILABLE',
            source: sourceTag,
            sourceId: String(ord.id),
            sourceMode: isAffiliate ? 'AFFILIATE' : 'VENDOR',
            productVariant: product.nameFr || product.nameAr || product.nameEn || `Produit #${product.id}`,
            requestedPriceMad: totalAmount > 0 ? totalAmount : null,
            referralLinkId,
            notes: `Leads ${sourceTag} | Commande #${orderRef} | ${product.nameFr || product.nameAr}`,
          },
          include: {
            referralLink: {
              include: {
                product: { include: { images: { where: { isPrimary: true }, take: 1 } } },
                // profile carries fullName; the User row itself has no such column.
                influencer: { include: { profile: true } },
              },
            },
          },
        });
        createdCount++;

        // Real-time Socket Broadcast to Call Center Agents
        try {
          const io = getIO();
          if (io) {
            const payload = {
              id: createdLead.id,
              fullName: createdLead.fullName,
              phone: createdLead.phone,
              city: createdLead.city,
              address: createdLead.address,
              status: createdLead.status,
              createdAt: createdLead.createdAt,
              updatedAt: createdLead.updatedAt,
              productPrice: createdLead.requestedPriceMad || product.retailPriceMad || 0,
              productVariant: createdLead.productVariant,
              product: {
                id: product.id,
                name: product.nameFr || product.nameAr || product.nameEn || `Produit #${product.id}`,
                sku: product.sku,
                // Read the image off the lead's included relation: the standalone
                // `product` lookup above selects no relations, so product.images
                // does not exist on it.
                image: createdLead.referralLink?.product?.images?.[0]?.imageUrl || null,
              },
              influencer: createdLead.referralLink?.influencer ? {
                id: createdLead.referralLink.influencer.id,
                fullName:
                  createdLead.referralLink.influencer.profile?.fullName ||
                  createdLead.referralLink.influencer.email,
              } : null
            };

            io.emit('new-available-lead', payload);
          }
        } catch (e) {
          console.error('[Socket push-integration-leads error]', e);
        }
      }
    }

    res.json({
      status: 'success',
      message: `${createdCount} prospect(s) ${sourceTag} envoyé(s) avec succès au Call Center !`,
      count: createdCount,
    });
  })
);

// ==========================================================================
// ABANDONED CARTS (call-center recovery)
// Express-checkout sessions where the visitor typed their info but never
// clicked "Confirmer". Scoped to the agent's assigned sellers/influencers.
// ==========================================================================

/**
 * The influencer/vendor ids assigned to this agent.
 * An EMPTY result means "no explicit scope" — the agent then works the global
 * pool (sees and can convert every abandoned cart), so a fresh agent is never
 * left with a blank screen.
 */
const getAgentAssignedInfluencerIds = async (agentId: number): Promise<number[]> => {
  const assignments = await prisma.agentInfluencerAssignment.findMany({
    where: { agentId },
    select: { influencerId: true },
  });
  return assignments.map((a) => a.influencerId);
};

/** Fetch referral-link metadata for a set of codes, keyed by code, for enrichment. */
const buildLinkMap = async (codes: string[]) => {
  if (codes.length === 0) return new Map<string, any>();
  const links = await prisma.referralLink.findMany({
    where: { code: { in: codes } },
    select: {
      code: true,
      influencerId: true,
      influencer: { select: { profile: { select: { fullName: true } }, email: true } },
      product: { select: { nameFr: true, nameAr: true, images: { where: { isPrimary: true }, take: 1, select: { imageUrl: true } } } },
    },
  });
  return new Map(links.map((l) => [l.code, l]));
};

/**
 * Reduce a phone to its national significant digits, so the same customer written as
 * "0667619014", "+212667619014", "212 667 619 014" or "00212-667-619-014" all compare
 * equal. Used to decide whether an abandoned cart's number is already a Lead.
 */
const normalizePhone = (raw?: string | null) => {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('212')) d = d.slice(3);
  return d.replace(/^0+/, '');
};

/**
 * The stored forms a normalised number could appear as in `leads.phone`. Querying these
 * with `IN` keeps the lookup on the phone index instead of scanning and normalising the
 * whole leads table. (A lead stored with embedded spaces would be missed — none exist
 * today; if that changes, add a normalised generated column and index it.)
 */
const phoneVariants = (core: string) =>
  core ? [core, `0${core}`, `212${core}`, `+212${core}`, `00212${core}`] : [];

// List abandoned carts. Scoped to the agent's assigned sellers when they have
// assignments; otherwise the full pool.
router.get(
  '/abandoned-carts',
  authenticate,
  authorize('CALL_CENTER_AGENT', 'CONFIRMATION_AGENT', 'AGENT', 'HELPER', 'SUPER_ADMIN', 'VENDOR'),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const skip = (page - 1) * limit;
    const search = (req.query.search as string)?.trim();
    // 'saved'   → the cart's phone already exists as a Lead in the database
    // 'unsaved' → it does not
    const statusFilter = (req.query.status as string) === 'saved' ? 'saved'
      : (req.query.status as string) === 'unsaved' ? 'unsaved'
      : 'all';

    const influencerIds = await getAgentAssignedInfluencerIds(req.user!.id);
    const hasScope = influencerIds.length > 0;

    // Converted carts stay in the list — they are the ones that carry the "Validé"
    // badge. The status filter (defaulting to 'unsaved' on the client) is what keeps
    // the agent's actionable queue clean.
    const and: any[] = [
      { completed: false },
      { phone: { not: null } },
    ];

    // Only restrict by referral code when the agent actually has assignments.
    if (hasScope) {
      const scopedLinks = await prisma.referralLink.findMany({
        where: { influencerId: { in: influencerIds } },
        select: { code: true },
      });
      const codes = scopedLinks.map((l) => l.code);
      // Assigned but their sellers have no links yet → genuinely nothing to show.
      if (codes.length === 0) {
        return res.json({
          attempts: [], total: 0, page, totalPages: 0, scoped: true,
          counts: { all: 0, saved: 0, unsaved: 0 },
        });
      }
      and.push({ referralCode: { in: codes } });
    }

    if (search) {
      and.push({
        OR: [
          { phone: { contains: search, mode: 'insensitive' as const } },
          { fullName: { contains: search, mode: 'insensitive' as const } },
          { city: { contains: search, mode: 'insensitive' as const } },
        ],
      });
    }
    // "Saved as a lead" is a cross-table condition (checkout_attempts.phone exists in
    // leads.phone) that Prisma cannot express in a where clause — there is no relation
    // between the two. Resolve it to a concrete id list BEFORE paginating, otherwise
    // `total` and the page slicing would describe the unfiltered set.
    // Two narrow columns, so this stays cheap even on a large backlog.
    const candidates = await prisma.checkoutAttempt.findMany({
      where: { AND: and },
      select: { id: true, phone: true },
    });
    const candidateCores = Array.from(
      new Set(candidates.map((c) => normalizePhone(c.phone)).filter(Boolean)),
    );
    const knownCores = candidateCores.length
      ? new Set(
          (await prisma.lead.findMany({
            where: { phone: { in: candidateCores.flatMap(phoneVariants) } },
            select: { phone: true },
          })).map((l) => normalizePhone(l.phone)).filter(Boolean),
        )
      : new Set<string>();

    const isSaved = (c: { phone: string | null }) => {
      const core = normalizePhone(c.phone);
      return !!core && knownCores.has(core);
    };
    const savedCount = candidates.filter(isSaved).length;
    const counts = {
      all: candidates.length,
      saved: savedCount,
      unsaved: candidates.length - savedCount,
    };

    if (statusFilter !== 'all') {
      const wanted = candidates
        .filter((c) => isSaved(c) === (statusFilter === 'saved'))
        .map((c) => c.id);

      if (wanted.length === 0) {
        return res.json({ attempts: [], total: 0, page, totalPages: 0, scoped: hasScope, counts });
      }
      and.push({ id: { in: wanted } });
    }

    const where = { AND: and };

    const [attempts, total] = await Promise.all([
      prisma.checkoutAttempt.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: limit }),
      prisma.checkoutAttempt.count({ where }),
    ]);

    // Enrich from whatever codes actually appear on this page.
    const codeMap = await buildLinkMap(
      Array.from(new Set(attempts.map((a) => a.referralCode).filter(Boolean) as string[])),
    );

    // Whether THIS agent already owns a lead for the number, so they don't re-call it.
    // Distinct from `isSaved`, which asks whether the number exists as a Lead at all
    // (that one drives the Validé / Non validé badge and is computed above).
    const pageCores = Array.from(
      new Set(attempts.map((a) => normalizePhone(a.phone)).filter(Boolean)),
    );
    const activeLeads = pageCores.length
      ? await prisma.lead.findMany({
          where: { assignedAgentId: req.user!.id, phone: { in: pageCores.flatMap(phoneVariants) } },
          select: { phone: true },
        })
      : [];
    const activeCores = new Set(activeLeads.map((l) => normalizePhone(l.phone)).filter(Boolean));

    // Attach a recordingId where a session replay exists for the same socket or IP.
    const sessionIds = attempts.map((a) => a.sessionId).filter(Boolean) as string[];
    const ips = attempts.map((a) => a.ip).filter(Boolean) as string[];
    const recConditions: any[] = [];
    if (sessionIds.length > 0) recConditions.push({ sessionId: { in: sessionIds } });
    if (ips.length > 0) recConditions.push({ ip: { in: ips } });

    const recordings = recConditions.length > 0
      ? await prisma.sessionRecording.findMany({
          where: { OR: recConditions },
          select: { id: true, sessionId: true, ip: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const recBySession = new Map(recordings.map((r) => [r.sessionId, r.id]));

    // An IP can carry several recordings (multiple tabs, repeat visits, or a
    // shared carrier NAT). Building a Map straight from a desc-ordered list let
    // the OLDEST one win, which is how a cart full of data ended up linked to a
    // replay where the visitor never typed. Keep every candidate and pick the one
    // recorded closest in time to the attempt instead.
    const recsByIp = new Map<string, typeof recordings>();
    for (const r of recordings) {
      const list = recsByIp.get(r.ip);
      if (list) list.push(r); else recsByIp.set(r.ip, [r]);
    }
    const nearestRecordingForIp = (ip: string, at: Date) => {
      const list = recsByIp.get(ip);
      if (!list?.length) return null;
      const target = at.getTime();
      return list.reduce((best, r) =>
        Math.abs(r.createdAt.getTime() - target) < Math.abs(best.createdAt.getTime() - target) ? r : best,
      ).id;
    };

    const enriched = attempts.map((a) => {
      const link = a.referralCode ? codeMap.get(a.referralCode) : null;
      const recId = recBySession.get(a.sessionId) || nearestRecordingForIp(a.ip, a.updatedAt) || null;
      return {
        ...a,
        recordingId: recId,
        productName: a.productName || link?.product?.nameFr || link?.product?.nameAr || null,
        productImage: link?.product?.images?.[0]?.imageUrl || null,
        sellerName: link?.influencer?.profile?.fullName || link?.influencer?.email || null,
        alreadyHasLead: activeCores.has(normalizePhone(a.phone)),
        savedAsLead: isSaved(a),
        converted: a.convertedLeadId != null,
      };
    });

    res.json({ attempts: enriched, total, page, totalPages: Math.ceil(total / limit), scoped: hasScope, counts });
  })
);

// Convert an abandoned cart into a real Lead assigned to this agent.
router.post(
  '/abandoned-carts/:id/convert',
  authenticate,
  authorize('CALL_CENTER_AGENT', 'CONFIRMATION_AGENT', 'AGENT', 'HELPER', 'SUPER_ADMIN', 'VENDOR'),
  asyncHandler(async (req, res) => {
    const attempt = await prisma.checkoutAttempt.findUnique({ where: { id: req.params.id } });
    if (!attempt) throw new AppException(404, 'Panier introuvable');
    if (attempt.convertedLeadId) throw new AppException(400, 'Ce panier a déjà été converti en lead');
    if (!attempt.phone) throw new AppException(400, 'Ce panier n\'a pas de numéro de téléphone');
    if (!attempt.referralCode) throw new AppException(400, 'Ce panier n\'est lié à aucun lien de parrainage');

    const link = await prisma.referralLink.findUnique({
      where: { code: attempt.referralCode },
      include: { product: true },
    });
    if (!link) throw new AppException(404, 'Lien de parrainage introuvable');

    // Authorization: if the agent has explicit assignments, the seller behind this
    // cart must be one of them. Agents with NO assignments work the global pool.
    if (req.user!.roleName === 'CALL_CENTER_AGENT') {
      const influencerIds = await getAgentAssignedInfluencerIds(req.user!.id);
      if (influencerIds.length > 0 && !influencerIds.includes(link.influencerId)) {
        throw new AppException(403, 'Ce panier ne fait pas partie de vos vendeurs assignés');
      }
    }

    // Resolve the vendor exactly like the public lead-creation path.
    let vendorId: number | null = link.product.ownerId;
    if (!vendorId) {
      const admin = await prisma.user.findFirst({ where: { role: { name: 'SUPER_ADMIN' } } });
      vendorId = admin?.id ?? null;
    }
    if (!vendorId) throw new AppException(500, 'Aucun vendeur trouvé pour ce produit');

    const rawPhone = attempt.phone.replace(/\s+|-/g, '');
    const normalizedPhone = rawPhone.startsWith('0') ? '+212' + rawPhone.slice(1) : rawPhone;

    const result = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          vendorId: vendorId!,
          referralLinkId: link.id,
          fullName: attempt.fullName || 'Client (panier abandonné)',
          phone: normalizedPhone,
          whatsapp: normalizedPhone,
          city: attempt.city,
          address: attempt.address,
          status: 'ASSIGNED',
          assignedAgentId: req.user!.id,
          source: 'ABANDONED_CART',
          sourceMode: 'AFFILIATE',
          notes: 'Panier abandonné récupéré depuis le Streaming Direct.',
        },
      });

      await tx.leadStatusHistory.create({
        data: { leadId: lead.id, oldStatus: 'ABANDONED_CART', newStatus: 'ASSIGNED', changedBy: req.user!.id },
      });

      await tx.checkoutAttempt.update({
        where: { id: attempt.id },
        data: { convertedLeadId: lead.id, convertedAt: new Date() },
      });

      return lead;
    });

    res.status(201).json({ status: 'success', message: 'Panier converti en lead avec succès', data: { leadId: result.id } });
  })
);

export default router;
