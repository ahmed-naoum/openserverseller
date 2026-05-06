import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import axios from 'axios';

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
}): Promise<{ package_code: string; package_id: number }> => {
  const COLIATY_PUBLIC_KEY = process.env.COLIATY_PUBLIC_KEY;
  const COLIATY_SECRET_KEY = process.env.COLIATY_SECRET_KEY;
  const COLIATY_BASE_URL = process.env.COLIATY_BASE_URL || 'https://customer-api-v1.coliaty.com';

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
const prisma = new PrismaClient();

// Cache for Coliaty cities to prevent rate limits
let coliatyCitiesCache: any = null;
let coliatyCitiesCacheTime = 0;
const CITIES_CACHE_TTL = 1000 * 60 * 60; // 1 hour

router.get(
  '/coliaty/cities',
  authenticate,
  authorize('CALL_CENTER_AGENT', 'HELPER'),
  asyncHandler(async (req, res) => {
    if (coliatyCitiesCache && Date.now() - coliatyCitiesCacheTime < CITIES_CACHE_TTL) {
      return res.json({
        status: 'success',
        data: coliatyCitiesCache
      });
    }

    const COLIATY_PUBLIC_KEY = process.env.COLIATY_PUBLIC_KEY;
    const COLIATY_SECRET_KEY = process.env.COLIATY_SECRET_KEY;
    const COLIATY_BASE_URL = process.env.COLIATY_BASE_URL || 'https://customer-api-v1.coliaty.com';

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
    const { page = 1, limit = 50, status, agentId, search, viewMode, excludeProcessed, mode } = req.query;

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
      
      const queryVendorId = req.query.vendorId ? Number(req.query.vendorId) : null;
      const assignments = await (prisma as any).helperUserAssignment.findMany({
        where: { helperId: req.user!.id },
      });
      const assignedUserIds = assignments.map((a: any) => a.targetUserId);
      
      if (queryVendorId) {
        if (assignedUserIds.includes(queryVendorId)) {
          conditions.push({ vendorId: queryVendorId });
        } else {
          conditions.push({ vendorId: { in: [] } });
        }
      } else {
        conditions.push({ vendorId: { in: assignedUserIds } });
      }
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

    if (status) {
      const statusStr = status as string;
      if (statusStr.includes(',')) {
        conditions.push({ status: { in: statusStr.split(',').map(s => s.trim()) } });
      } else {
        conditions.push({ status: statusStr });
      }
    } else if (viewMode !== 'ALL' && excludeProcessed !== 'true') {
      conditions.push({ status: { not: 'PUSHED_TO_DELIVERY' } });
    }

    if (agentId) conditions.push({ assignedAgentId: Number(agentId as string) });

    if (search) {
      conditions.push({
        OR: [
          { fullName: { contains: search as string, mode: 'insensitive' } },
          { phone: { contains: search as string } },
          { city: { contains: search as string, mode: 'insensitive' } },
        ]
      });
    }

    const where = conditions.length > 0 ? { AND: conditions } : {};

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          vendor: {
            include: { profile: true },
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
            include: { product: { include: { images: true } }, landingPage: true },
          },
          order: true,
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lead.count({ where }),
    ]);

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
          createdAt: l.createdAt,
        })),
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

router.get(
  '/available',
  authenticate,
  authorize('CALL_CENTER_AGENT'),
  asyncHandler(async (req, res) => {
    const agentId = req.user!.id;
    const { influencerId } = req.query;

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
          hasActiveLead: !!activeLead,
          activeLeadId: activeLead?.id || null,
          assignedInfluencers: [], // Return empty array so dropdown doesn't show all system influencers
        },
      });
      return;
    }

    const where: any = {
      status: { in: ['AVAILABLE'] },
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

      // If none of the influencers have referral links, there can be no leads
      if (linkIds.length === 0) {
        res.json({
          status: 'success',
          data: {
            leads: [],
            hasActiveLead: !!activeLead,
            activeLeadId: activeLead?.id || null,
            assignedInfluencers,
          },
        });
        return;
      }
      where.referralLinkId = { in: linkIds };
    }

    const leads = await prisma.lead.findMany({
      where,
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { 
        referralLink: {
          include: { product: { include: { images: true } }, landingPage: true }
        }
      },
    });

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
        hasActiveLead: !!activeLead,
        activeLeadId: activeLead?.id || null,
        assignedInfluencers,
      },
    });
  })
);

// GET agent's livraison (orders/parcels with Coliaty tracking) - must be before /:id routes
router.get(
  '/livraison',
  authenticate,
  authorize('CALL_CENTER_AGENT', 'HELPER'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50 } = req.query;

    const where: any = {
      order: { isNot: null }, // Leads that have been converted to orders
    };
    if (req.user!.roleName === 'CALL_CENTER_AGENT') {
      where.assignedAgentId = req.user!.id;
    } else if (req.user!.roleName === 'HELPER') {
      if (!req.user!.canManageOrders) {
        throw new AppException(403, 'Permission denied: Vous n\'avez pas le droit de gérer les colis');
      }
      // Only show deliveries from assigned users
      const assignments = await (prisma as any).helperUserAssignment.findMany({
        where: { helperId: req.user!.id },
      });
      const assignedUserIds = assignments.map((a: any) => a.targetUserId);
      where.vendorId = { in: assignedUserIds };
    }

    // Get leads for delivery tracking
    const agentLeads = await prisma.lead.findMany({
      where,
      include: {
        vendor: { include: { profile: true } },
        order: {
          include: {
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
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { updatedAt: 'desc' },
    });

    const parcels = agentLeads
      .filter(l => l.order)
      .map(l => {
        const o = l.order as any;
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
          vendorName: l.vendor?.profile?.fullName || l.vendor?.email || null,
          vendorEmail: l.vendor?.email || null,
          createdAt: o.createdAt,
        };
      });

    res.json({
      status: 'success',
      data: { parcels, total: parcels.length },
    });
  })
);

router.get(
  '/coliaty/parcel/:code/history',
  authenticate,
  authorize('CALL_CENTER_AGENT', 'VENDOR', 'SUPER_ADMIN', 'HELPER'),
  asyncHandler(async (req, res) => {
    const { code } = req.params;
    
    const COLIATY_PUBLIC_KEY = process.env.COLIATY_PUBLIC_KEY;
    const COLIATY_SECRET_KEY = process.env.COLIATY_SECRET_KEY;
    const COLIATY_BASE_URL = process.env.COLIATY_BASE_URL || 'https://customer-api-v1.coliaty.com';

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
            influencer: { include: { profile: true } },
            product: { include: { images: true } },
            landingPage: true
          }
        },
      },
    });

    if (!lead) {
      throw new AppException(404, 'Lead not found');
    }

    const { vendor, referralLink, ...leadData } = lead;
    const influencer = referralLink?.influencer
      ? { ...referralLink.influencer, fullName: referralLink.influencer.profile?.fullName || referralLink.influencer.email }
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

router.post(
  '/',
  authenticate,
  authorize('VENDOR', 'HELPER'),
  [
    body('fullName').notEmpty().trim(),
    body('phone').matches(/^(\+212|0)[0-9]{9}$/),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed');
    }

    const { fullName, phone, whatsapp, city, address, productId, notes, vendorId: bodyVendorId, sourceMode } = req.body;

    // HELPER must supply a vendorId in the request body
    const effectiveVendorId = req.user!.roleName === 'HELPER' ? Number(bodyVendorId) : req.user!.id;
    if (req.user!.roleName === 'HELPER' && !bodyVendorId) {
      throw new AppException(400, 'HELPER must provide a vendorId');
    }

    // If productId is provided, find or create a referral link to connect the lead to the product
    let resolvedReferralLinkId: number | null = null;
    if (productId) {
      const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
      if (product) {
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
      }
    }

    const normalizedPhone = phone.replace(/^0/, '+212');

    const lead = await prisma.lead.create({
      data: {
        vendorId: effectiveVendorId,
        referralLinkId: resolvedReferralLinkId,
        fullName,
        phone: normalizedPhone,
        whatsapp: whatsapp || normalizedPhone,
        city,
        address,
        status: 'NEW',
        notes,
        sourceMode: sourceMode || 'SELLER',
      },
    });

    res.status(201).json({
      status: 'success',
      message: 'Lead created successfully',
      data: { lead },
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

    res.json({
      status: 'success',
      message: `${updatedLeads.count} leads updated successfully`,
      data: { count: updatedLeads.count },
    });
  })
);

// PATCH /:id - Edit basic lead fields (HELPER, VENDOR, SUPER_ADMIN)
router.patch(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'VENDOR', 'HELPER'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { fullName, phone, whatsapp, city, address, notes } = req.body;

    const where: any = { id: Number(id) };
    if (req.user!.roleName === 'VENDOR') where.vendorId = req.user!.id;

    const lead = await prisma.lead.findFirst({ where });
    if (!lead) throw new AppException(404, 'Lead not found');

    const normalizedPhone = phone ? phone.replace(/^0/, '+212') : undefined;

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

    const valid = ['NOT_PAID', 'PAID', 'FACTURED'];
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
    const { status, notes, callbackAt } = req.body;

    const validStatuses = [
      'NEW',
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
        },
      });
    });

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
    
    const commissionPercentage = parseFloat(process.env.PLATFORM_COMMISSION_PERCENTAGE || '15');
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
      let baseContent = package_content || productToOrder.nameFr || productToOrder.nameAr || 'Marchandise';
      const finalVariant = productVariant || lead.productVariant;
      
      // Append SKU and Pack if available for better visibility in Coliaty
      let contentValue = baseContent;
      const details = [];
      if (productToOrder.sku) details.push(`SKU:${productToOrder.sku}`);
      if (finalVariant) details.push(`PK:${finalVariant}`);
      
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
          { coliatyPackageCode: code },
          { orderNumber: code }
        ]
      },
      include: { lead: { include: { referralLink: true } } }
    });

    if (!order || !order.lead) {
      throw new AppException(404, 'Order or Lead not found for this code');
    }

    if (order.status === 'RETURNED' && order.lead.paymentSituation === 'FACTURED') {
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

      const userId = order.lead!.referralLink?.influencerId || order.vendorId;

      // 3. Generate Frais de retour Invoice (-3 MAD)
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

      // 4. Wallet Deduction
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
      message: 'Retour traité avec succès (-3 MAD déduits).'
    });
  })
);

// Get products the current user has bought or claimed
router.get(
  '/my-products',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { mode } = req.query;

    let inventoryProducts: any[] = [];
    let claimedProducts: any[] = [];

    if (!mode || mode === 'SELLER') {
      // Products from inventory (bought)
      inventoryProducts = await prisma.productInventory.findMany({
        where: { userId },
        include: {
          product: {
            include: { images: { where: { isPrimary: true }, take: 1 } },
          },
        },
      });
    }

    if (!mode || mode === 'AFFILIATE') {
      // Products from affiliate claims (claimed & approved)
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

    // Must not be an order already
    const existingOrder = await prisma.order.findUnique({
      where: { leadId: lead.id }
    });
    if (existingOrder) {
      throw new AppException(400, 'Cannot delete a lead that has already been pushed to delivery. Please cancel the order first.');
    }

    await prisma.$transaction(async (tx) => {
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

export default router;
