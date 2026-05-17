import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { v4 as uuidv4 } from 'uuid';
import { io } from '../index.js';

const router = Router();
const prisma = new PrismaClient();

router.post(
  '/enable',
  authenticate,
  authorize('VENDOR'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const referralCode = uuidv4().slice(0, 8).toUpperCase();

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        isInfluencer: true,
        referralCode
      }
    });

    res.json({ isInfluencer: user.isInfluencer, referralCode: user.referralCode });
  })
);

router.post(
  '/links',
  authenticate,
  authorize('VENDOR', 'INFLUENCER'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { productId } = req.body;

    if (!req.user!.isInfluencer) {
      throw new AppException(400, 'You must enable influencer mode first');
    }

    // NEW: Check if there is an APPROVED claim for this product
    const claim = await prisma.affiliateClaim.findUnique({
      where: { userId_productId: { userId, productId } }
    });

    if (!claim || claim.status !== 'APPROVED') {
      throw new AppException(403, 'You must have an APPROVED claim for this product before generating a link');
    }

    const existingLink = await prisma.referralLink.findUnique({
      where: { influencerId_productId: { influencerId: userId, productId } }
    });

    if (existingLink) {
      return res.json(existingLink);
    }

    const code = uuidv4().slice(0, 8).toUpperCase();

    const referralLink = await prisma.referralLink.create({
      data: {
        influencerId: userId,
        productId,
        code,
        isActive: false,
        status: 'BUILDING'
      }
    });

    res.json(referralLink);
  })
);

// Claim a product for affiliation
router.post(
  '/claims',
  authenticate,
  authorize('VENDOR', 'INFLUENCER'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { productId, brandingLabelPrintUrl, brandName, requestedQty, requestedLandingPageUrl } = req.body;

    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product || !(product.visibility.includes('AFFILIATE') || product.visibility.includes('INFLUENCER') || product.visibility.includes('REGULAR'))) {
      throw new AppException(404, 'Product not found or not available for your role');
    }

    const claim = await prisma.affiliateClaim.upsert({
      where: { userId_productId: { userId, productId } },
      update: {
        status: 'PENDING',
        brandingLabelPrintUrl,
        brandName,
        requestedQty: requestedQty ? Number(requestedQty) : undefined,
        requestedLandingPageUrl
      },
      create: {
        userId,
        productId,
        status: 'PENDING',
        brandingLabelPrintUrl,
        brandName,
        requestedQty: requestedQty ? Number(requestedQty) : null,
        requestedLandingPageUrl
      }
    });

    res.status(201).json(claim);
  })
);

// Get my claims
router.get(
  '/claims',
  authenticate,
  authorize('VENDOR', 'INFLUENCER'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const [claims, links] = await Promise.all([
      prisma.affiliateClaim.findMany({
        where: { userId },
        include: {
          product: { include: { images: { where: { isPrimary: true }, take: 1 } } }
        }
      }),
      prisma.referralLink.findMany({
        where: { influencerId: userId }
      })
    ]);

    const claimsWithLinks = claims.map(claim => ({
      ...claim,
      referralLink: links.find(l => l.productId === claim.productId)
    }));

    res.json(claimsWithLinks);
  })
);


router.get(
  '/links',
  authenticate,
  authorize('VENDOR', 'INFLUENCER', 'HELPER', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { start, end } = req.query;

    const links = await prisma.referralLink.findMany({
      where: { influencerId: userId },
      include: {
        product: { include: { images: { where: { isPrimary: true }, take: 1 } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const startDate = start ? new Date(start as string) : undefined;
    const endDate = end ? new Date(end as string) : undefined;
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }

    const formattedLinks = await Promise.all(links.map(async (link) => {
      const dateFilter = startDate && endDate ? { createdAt: { gte: startDate, lte: endDate } } : {};
      
      const [clicksData, leadsCount, earningsSum] = await Promise.all([
        (prisma as any).referralLinkClick.findMany({
          where: {
            referralLinkId: link.id,
            ...dateFilter
          },
          select: { ipAddress: true, userAgent: true }
        }),
        prisma.lead.count({
          where: {
            referralLinkId: link.id,
            ...dateFilter
          }
        }),
        prisma.influencerCommission.aggregate({
          where: {
            referralLinkId: link.id,
            ...dateFilter
          },
          _sum: { amount: true }
        })
      ]);

      // Calculate unique clicks (IP + User Agent)
      const uniqueClicksSet = new Set();
      clicksData.forEach((c: any) => {
        uniqueClicksSet.add(`${c.ipAddress}-${c.userAgent || 'unknown'}`);
      });

      return {
        ...link,
        clicks: uniqueClicksSet.size,
        conversions: leadsCount,
        earnings: earningsSum._sum.amount || 0
      };
    }));

    res.json(formattedLinks);
  })
);

router.get(
  '/links/:code/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.params;

    const link = await prisma.referralLink.findUnique({
      where: { code: code as string },
      include: {
        product: { include: { images: { where: { isPrimary: true }, take: 1 } } }
      }
    });

    if (!link) {
      throw new AppException(404, 'Referral link not found');
    }

    // Increment clicks with IP deduplication
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'];

    // Check if this IP + UserAgent has already clicked this link
    const existingClick = await (prisma as any).referralLinkClick.findFirst({
      where: {
        referralLinkId: link.id,
        ipAddress: ip,
        userAgent: typeof userAgent === 'string' ? userAgent : null
      }
    });

    await (prisma as any).referralLinkClick.create({
      data: {
        referralLinkId: link.id,
        ipAddress: ip,
        userAgent: typeof userAgent === 'string' ? userAgent : null
      }
    });

    // Only increment the counter if it's a new IP
    if (!existingClick) {
      await (prisma as any).referralLink.update({
        where: { id: link.id },
        data: { clicks: { increment: 1 } }
      });
    }

    res.json(link);
  })
);

router.get(
  '/links/:code/public',
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.params;

    const link = await (prisma as any).referralLink.findUnique({
      where: { code: code as string },
      include: {
        product: { include: { images: { orderBy: { sortOrder: 'asc' } }, categories: true } },
        influencer: { include: { profile: true } },
        landingPage: true
      }
    });

    if (!link || !link.isActive || !link.product.isActive) {
      throw new AppException(404, 'Referral link or product not found or inactive');
    }

    // Increment clicks (Unique - per IP)
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'];

    const existingClick = await (prisma as any).referralLinkClick.findFirst({
      where: {
        referralLinkId: link.id,
        ipAddress: ip,
        userAgent: typeof userAgent === 'string' ? userAgent : null
      }
    });

    await (prisma as any).referralLinkClick.create({
      data: {
        referralLinkId: link.id,
        ipAddress: ip,
        userAgent: typeof userAgent === 'string' ? userAgent : null
      }
    });

    // Only increment the click counter if it's a new IP
    if (!existingClick) {
      await (prisma as any).referralLink.update({
        where: { id: link.id },
        data: { clicks: { increment: 1 } }
      });
    }

    // We only return public-safe data
    res.json({
      status: 'success',
      data: {
        code: link.code,
        product: {
          id: link.product.id,
          nameAr: link.product.nameAr,
          nameFr: link.product.nameFr,
          nameEn: link.product.nameEn,
          description: link.product.description,
          retailPriceMad: link.product.retailPriceMad,
          images: link.product.images,
          category: link.product.category
        },
        influencerName: link.influencer.profile?.fullName,
        influencerAvatar: link.influencer.profile?.avatarUrl,
        landingPage: link.landingPage
      }
    });
  })
);

router.post(
  '/track-conversion',
  asyncHandler(async (req: Request, res: Response) => {
    const { code, orderId } = req.body;

    const link = await prisma.referralLink.findUnique({ where: { code } });

    if (!link) {
      throw new AppException(404, 'Referral link not found');
    }

    await prisma.$transaction([
      prisma.referralLink.update({
        where: { id: link.id },
        data: { conversions: { increment: 1 } }
      }),
      prisma.influencerCommission.create({
        data: {
          influencerId: link.influencerId,
          referralLinkId: link.id,
          orderId,
          amount: 0,
          status: 'PENDING'
        }
      })
    ]);

    res.json({ success: true });
  })
);

router.get(
  '/commissions',
  authenticate,
  authorize('VENDOR', 'INFLUENCER'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const commissions = await prisma.influencerCommission.findMany({
      where: { influencerId: userId },
      include: {
        referralLink: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const totals = await prisma.influencerCommission.groupBy({
      by: ['status'],
      where: { influencerId: userId },
      _sum: { amount: true },
      _count: true
    });

    res.json({ commissions, totals });
  })
);

router.get(
  '/analytics/daily',
  authenticate,
  authorize('VENDOR', 'INFLUENCER'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { start, end, days, referralLinkId } = req.query;

    let dateLimitStart: Date;
    let dateLimitEnd = new Date();
    const isAllTime = days === 'all';
    const numDays = isAllTime ? 0 : (parseInt(days as string) || 30);
    const isHourly = numDays === 1 && !start;

    if (start && end) {
      dateLimitStart = new Date(start as string);
      dateLimitEnd = new Date(end as string);
      dateLimitEnd.setHours(23, 59, 59, 999);
    } else if (isAllTime) {
      const whereOldest: any = { influencerId: userId };
      if (referralLinkId) {
        whereOldest.id = parseInt(referralLinkId as string);
      }
      const oldestLink = await prisma.referralLink.findFirst({
        where: whereOldest,
        orderBy: { createdAt: 'asc' }
      });
      if (oldestLink) {
        dateLimitStart = new Date(oldestLink.createdAt);
        dateLimitStart.setHours(0, 0, 0, 0);
      } else {
        dateLimitStart = new Date();
        dateLimitStart.setDate(dateLimitStart.getDate() - 30);
      }
      dateLimitEnd = new Date();
    } else {
      dateLimitStart = new Date();
      dateLimitStart.setDate(dateLimitStart.getDate() - (numDays - 1));
      dateLimitStart.setHours(0, 0, 0, 0);
      dateLimitEnd = new Date(); // Real-time: up to now
    }

    const whereBase: any = { influencerId: userId };
    if (referralLinkId) {
      whereBase.id = parseInt(referralLinkId as string);
    }

    const [clicks, leads, commissions] = await Promise.all([
      (prisma as any).referralLinkClick.findMany({
        where: {
          referralLink: whereBase,
          createdAt: { gte: dateLimitStart, lte: dateLimitEnd }
        },
        select: { createdAt: true, ipAddress: true, userAgent: true }
      }),
      prisma.lead.findMany({
        where: {
          referralLink: whereBase,
          createdAt: { gte: dateLimitStart, lte: dateLimitEnd }
        },
        select: { createdAt: true }
      }),
      prisma.influencerCommission.findMany({
        where: {
          referralLink: whereBase,
          createdAt: { gte: dateLimitStart, lte: dateLimitEnd }
        },
        select: { createdAt: true }
      })
    ]);

    const getKey = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      if (isHourly) {
        const h = String(date.getHours()).padStart(2, '0');
        return `${y}-${m}-${d}T${h}`;
      }
      return `${y}-${m}-${d}`;
    };

    const clicksByDate: Record<string, Set<string>> = {};
    clicks.forEach((c: any) => {
      const key = getKey(c.createdAt);
      if (!clicksByDate[key]) clicksByDate[key] = new Set();
      clicksByDate[key].add(`${c.ipAddress}-${c.userAgent || 'unknown'}`);
    });

    const uniqueClicksByDate: Record<string, number> = {};
    Object.keys(clicksByDate).forEach(key => {
      uniqueClicksByDate[key] = clicksByDate[key].size;
    });

    const salesByDate: Record<string, number> = {};
    leads.forEach(l => {
      const key = getKey(l.createdAt);
      salesByDate[key] = (salesByDate[key] || 0) + 1;
    });
    // Removed duplicate counting from commissions

    const stats = [];
    const curr = new Date(dateLimitStart);
    while (curr <= dateLimitEnd) {
      const key = getKey(curr);
      const views = uniqueClicksByDate[key] || 0;
      const sales = salesByDate[key] || 0;
      stats.push({
        date: curr.toISOString(),
        views,
        sales,
        convRate: views > 0 ? Number(((sales / views) * 100).toFixed(1)) : 0
      });
      
      if (isHourly) {
        curr.setHours(curr.getHours() + 1);
      } else {
        curr.setDate(curr.getDate() + 1);
      }
    }

    res.json(stats);
  })
);

// Delete a lead (influencer can only delete their own leads)
router.delete(
  '/leads/:id',
  authenticate,
  authorize('VENDOR', 'INFLUENCER'),
  asyncHandler(async (req: Request, res: Response) => {
    const leadId = parseInt(req.params.id as string);
    const userId = req.user!.id;

    const influencerLinks = await prisma.referralLink.findMany({
      where: { influencerId: userId },
      select: { id: true }
    });
    const linkIds = influencerLinks.map(l => l.id);

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, referralLinkId: { in: linkIds } }
    });

    if (!lead) {
      throw new AppException(404, 'Lead not found or not yours');
    }

    await prisma.lead.delete({ where: { id: leadId } });
    res.json({ status: 'success', message: 'Lead deleted' });
  })
);

router.post(
  '/leads/delete/bulk',
  authenticate,
  authorize('VENDOR', 'INFLUENCER'),
  asyncHandler(async (req: Request, res: Response) => {
    const { leadIds } = req.body;
    const userId = req.user!.id;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      throw new AppException(400, 'Please provide an array of lead IDs');
    }

    const influencerLinks = await prisma.referralLink.findMany({
      where: { influencerId: userId },
      select: { id: true }
    });
    const linkIds = influencerLinks.map(l => l.id);

    // Verify all leads belong to this influencer and are in eligible status (LEAD or NEW)
    // We only allow deleting leads that haven't been pushed or are still "NEW"
    const leads = await prisma.lead.findMany({
      where: { 
        id: { in: leadIds }, 
        referralLinkId: { in: linkIds },
        status: { in: ['NEW', 'LEAD'] }
      }
    });

    if (leads.length === 0) {
      throw new AppException(404, 'No eligible leads found for deletion');
    }

    const deletedIds = leads.map(l => l.id);

    await prisma.lead.deleteMany({
      where: { id: { in: deletedIds } }
    });

    res.json({
      status: 'success',
      message: `${deletedIds.length} leads deleted`,
      data: { count: deletedIds.length }
    });
  })
);

// Push lead to call center (set as AVAILABLE for agents to claim)
router.post(
  '/leads/:id/push-callcenter',
  authenticate,
  authorize('VENDOR', 'INFLUENCER'),
  asyncHandler(async (req: Request, res: Response) => {
    const leadId = parseInt(req.params.id as string);
    const userId = req.user!.id;

    const influencerLinks = await prisma.referralLink.findMany({
      where: { influencerId: userId },
      select: { id: true }
    });
    const linkIds = influencerLinks.map(l => l.id);

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, referralLinkId: { in: linkIds }, order: null },
      include: {
        referralLink: { include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } } }
      }
    });

    if (!lead) {
      throw new AppException(404, 'Lead not found or not yours');
    }

    let wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await prisma.wallet.create({ data: { userId } });
    }

    const updatedLead = await prisma.$transaction(async (tx: any) => {
      await tx.leadStatusHistory.create({
        data: { leadId: lead.id, oldStatus: lead.status, newStatus: 'AVAILABLE', changedBy: userId }
      });
      const updated = await tx.lead.update({
        where: { id: lead.id },
        data: { status: 'AVAILABLE' }
      });

      const newBalance = wallet.balanceMad - 2;
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceMad: newBalance }
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CALL_CENTER_FEE',
          amountMad: -2,
          balanceAfterMad: newBalance,
          description: `Frais d'envoi d'un lead au Call Center (Lead #${lead.id})`,
        }
      });

      return updated;
    });

    const influencerProfile = await prisma.userProfile.findUnique({
      where: { userId }
    });

    const assignments = await prisma.agentInfluencerAssignment.findMany({
      where: { influencerId: userId },
      select: { agentId: true }
    });

    const leadData = {
      id: updatedLead.id,
      fullName: updatedLead.fullName,
      phone: updatedLead.phone,
      city: updatedLead.city,
      address: updatedLead.address,
      product: lead.referralLink?.product ? {
        name: (lead.referralLink.product as any).nameFr || (lead.referralLink.product as any).nameAr,
        image: (lead.referralLink.product as any).images?.[0]?.url
      } : null,
      influencer: {
        id: userId,
        fullName: influencerProfile?.fullName || req.user!.email
      },
      createdAt: updatedLead.createdAt
    };

    assignments.forEach(a => {
      io.to(`user:${a.agentId}`).emit('new-available-lead', leadData);
    });

    res.json({
      status: 'success',
      message: 'Lead pushed to call center',
      data: { lead: updatedLead }
    });
  })
);

router.post(
  '/leads/push-callcenter/bulk',
  authenticate,
  authorize('VENDOR', 'INFLUENCER'),
  asyncHandler(async (req: Request, res: Response) => {
    const { leadIds } = req.body;
    const userId = req.user!.id;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      throw new AppException(400, 'Please provide an array of lead IDs');
    }

    const influencerLinks = await prisma.referralLink.findMany({
      where: { influencerId: userId },
      select: { id: true }
    });
    const linkIds = influencerLinks.map(l => l.id);

    // Verify all leads belong to this influencer and are in eligible status
    const leads = await prisma.lead.findMany({
      where: { 
        id: { in: leadIds }, 
        referralLinkId: { in: linkIds },
        status: { in: ['NEW', 'LEAD'] },
        order: null
      },
      include: {
        referralLink: { include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } } }
      }
    });

    if (leads.length === 0) {
      throw new AppException(404, 'No eligible leads found for pushing');
    }

    // NEW: Validation for duplicate phone numbers
    const phones = leads.map(l => l.phone);
    const uniquePhones = new Set(phones);
    if (uniquePhones.size !== phones.length) {
      throw new AppException(400, 'Impossible d\'envoyer des doublons au Call Center (numéros identiques dans la sélection)');
    }

    // Check if any of these phones are already in AVAILABLE/ASSIGNED status for this influencer
    const existingActive = await prisma.lead.findFirst({
      where: {
        referralLinkId: { in: linkIds },
        phone: { in: phones },
        status: { in: ['AVAILABLE', 'ASSIGNED', 'CONTACTED', 'INTERESTED', 'ORDERED'] },
        id: { notIn: leads.map(l => l.id) },
        order: null
      }
    });

    if (existingActive) {
      throw new AppException(400, `Le numéro ${existingActive.phone} est déjà en cours de traitement`);
    }

    const totalCost = leads.length * 2;
    let wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await prisma.wallet.create({ data: { userId } });
    }

    const updatedLeads = await prisma.$transaction(async (tx: any) => {
      // Create status history for each lead
      await tx.leadStatusHistory.createMany({
        data: leads.map(l => ({
          leadId: l.id,
          oldStatus: l.status,
          newStatus: 'AVAILABLE',
          changedBy: userId
        }))
      });

      // Update leads status to AVAILABLE
      await tx.lead.updateMany({
        where: { id: { in: leads.map(l => l.id) } },
        data: { status: 'AVAILABLE' }
      });

      const newBalance = wallet.balanceMad - totalCost;
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceMad: newBalance }
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CALL_CENTER_FEE',
          amountMad: -totalCost,
          balanceAfterMad: newBalance,
          description: `Frais d'envoi de ${leads.length} leads au Call Center`,
        }
      });

      return tx.lead.findMany({
        where: { id: { in: leads.map(l => l.id) } }
      });
    });

    const influencerProfile = await prisma.userProfile.findUnique({
      where: { userId }
    });

    const assignments = await prisma.agentInfluencerAssignment.findMany({
      where: { influencerId: userId },
      select: { agentId: true }
    });

    // Notify agents for each pushed lead
    leads.forEach(lead => {
      const leadData = {
        id: lead.id,
        fullName: lead.fullName,
        phone: lead.phone,
        city: lead.city,
        address: lead.address,
        product: lead.referralLink?.product ? {
          name: (lead.referralLink.product as any).nameFr || (lead.referralLink.product as any).nameAr,
          image: (lead.referralLink.product as any).images?.[0]?.url
        } : null,
        influencer: {
          id: userId,
          fullName: influencerProfile?.fullName || req.user!.email
        },
        createdAt: lead.createdAt
      };

      assignments.forEach(a => {
        io.to(`user:${a.agentId}`).emit('new-available-lead', leadData);
      });
    });

    res.json({
      status: 'success',
      message: `${leads.length} leads pushed to call center`,
      data: { count: leads.length }
    });
  })
);

router.get(
  '/profile',
  authenticate,
  authorize('VENDOR', 'INFLUENCER'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        phone: true,
        isInfluencer: true,
        referralCode: true,
        totalEarnings: true,
        mode: true
      }
    });

    res.json(user);
  })
);

router.get(
  '/customers',
  authenticate,
  authorize('VENDOR', 'INFLUENCER'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { page = 1, limit = 20, search } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const commissions = await prisma.influencerCommission.findMany({
      where: {
        influencerId: userId,
        order: search ? {
          OR: [
            { customerName: { contains: search as string, mode: 'insensitive' } },
            { customerPhone: { contains: search as string, mode: 'insensitive' } },
            { customerCity: { contains: search as string, mode: 'insensitive' } },
          ]
        } : { isNot: null }
      },
      include: {
        order: {
          include: {
            lead: {
              include: {
                statusHistory: {
                  include: { changer: { select: { id: true, profile: { select: { fullName: true } } } } },
                  orderBy: { createdAt: 'asc' }
                }
              }
            },
            statusHistory: {
              include: { changedByUser: { select: { id: true, profile: { select: { fullName: true } } } } },
              orderBy: { createdAt: 'asc' }
            }
          }
        },
        referralLink: { include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } }, landingPage: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take
    });

    // New Leads (not yet orders)
    const influencerLinks = await prisma.referralLink.findMany({
      where: { influencerId: userId },
      select: { id: true }
    });

    const linkIds = influencerLinks.map(l => l.id);

    const leads = await prisma.lead.findMany({
      where: {
        referralLinkId: { in: linkIds },
        ...(search ? {
          OR: [
            { fullName: { contains: search as string, mode: 'insensitive' } },
            { phone: { contains: search as string, mode: 'insensitive' } },
            { city: { contains: search as string, mode: 'insensitive' } },
          ]
        } : {})
      },
      include: {
        order: {
          include: {
            statusHistory: {
              include: { changedByUser: { select: { id: true, profile: { select: { fullName: true } } } } },
              orderBy: { createdAt: 'asc' }
            }
          }
        },
        statusHistory: {
          include: { changer: { select: { id: true, profile: { select: { fullName: true } } } } },
          orderBy: { createdAt: 'asc' }
        },
        referralLink: { include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } }, landingPage: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit leads for now
    });

    // Map leads to a commission-like structure for the frontend
    const leadCommissions = leads.map(lead => ({
      id: `lead-${lead.id}`,
      influencerId: userId,
      referralLinkId: lead.referralLinkId,
      referralLink: lead.referralLink,
      orderId: (lead as any).order?.id || null,
      amount: 0,
      status: 'PENDING',
      createdAt: lead.createdAt,
      order: {
        customerName: lead.fullName,
        customerPhone: lead.phone,
        customerCity: (lead as any).order?.customerCity || lead.city,
        customerAddress: lead.address,
        status: lead.status === 'NEW' ? 'LEAD' : lead.status,
        productVariant: lead.productVariant,
        totalAmountMad: (lead as any).order?.totalAmountMad || 0,
        coliatyPackageCode: (lead as any).order?.coliatyPackageCode,
        coliatyPackageId: (lead as any).order?.coliatyPackageId,
        statusHistory: (lead as any).order?.statusHistory || [],
        lead: {
          paymentSituation: lead.paymentSituation,
          callbackDate: lead.callbackAt,
          notes: lead.notes,
          statusHistory: (lead as any).statusHistory || [],
          requestedPriceMad: lead.requestedPriceMad,
          requestedPriceStatus: lead.requestedPriceStatus,
        }
      }
    }));

    const totalCommissions = await prisma.influencerCommission.count({
      where: {
        influencerId: userId,
        order: search ? {
          OR: [
            { customerName: { contains: search as string, mode: 'insensitive' } },
            { customerPhone: { contains: search as string, mode: 'insensitive' } },
            { customerCity: { contains: search as string, mode: 'insensitive' } },
          ]
        } : { isNot: null }
      }
    });

    const combined = [...leadCommissions, ...commissions].sort((a, b) =>
      new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime()
    );

    res.json({
      status: 'success',
      data: {
        commissions: combined,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCommissions + leadCommissions.length,
          totalPages: Math.ceil((totalCommissions + leadCommissions.length) / Number(limit)),
        }
      }
    });
  })
);

router.get(
  '/links/:id/landing-page',
  authenticate,
  authorize('VENDOR', 'INFLUENCER', 'HELPER', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const linkId = parseInt(String(req.params.id));

    const link = await (prisma as any).referralLink.findUnique({
      where: { id: linkId }
    });

    if (!link) {
      throw new AppException(404, 'Referral link not found');
    }

    const isAdmin = req.user!.roleName === 'SUPER_ADMIN';
    const isOwner = link.influencerId === userId;
    let isAuthorizedHelper = false;

    if (req.user!.roleName === 'HELPER' && req.user!.canManageInfluencerLinks) {
      const assignment = await (prisma as any).helperUserAssignment.findFirst({
        where: { helperId: userId, targetUserId: link.influencerId }
      });
      if (assignment) isAuthorizedHelper = true;
    }

    if (!isAdmin && !isOwner && !isAuthorizedHelper) {
      throw new AppException(403, 'You do not have permission to perform this action');
    }

    const landingPage = await (prisma as any).referralLinkLandingPage.findUnique({
      where: { referralLinkId: linkId },
      include: {
        referralLink: {
          include: {
            product: {
              select: {
                id: true,
                nameFr: true,
                retailPriceMad: true,
                images: { where: { isPrimary: true }, take: 1 }
              }
            }
          }
        }
      }
    });

    res.json({ 
      status: 'success',
      data: landingPage || { 
        themeColor: '#f97316', 
        title: '', 
        description: '', 
        buttonText: 'Commander Maintenant',
        // If landingPage is missing, we still try to get the product info via the link
        referralLink: link ? await (prisma as any).referralLink.findUnique({
          where: { id: linkId },
          include: { product: { select: { id: true, nameFr: true, retailPriceMad: true } } }
        }) : null
      }
    });
  })
);

router.put(
  '/links/:id/landing-page',
  authenticate,
  authorize('VENDOR', 'INFLUENCER', 'HELPER', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const linkId = parseInt(String(req.params.id));
    const { themeColor, title, description, buttonText, customStructure } = req.body;

    const link = await (prisma as any).referralLink.findUnique({
      where: { id: linkId }
    });

    if (!link) {
      throw new AppException(404, 'Referral link not found');
    }

    const isAdmin = req.user!.roleName === 'SUPER_ADMIN';
    const isOwner = link.influencerId === userId;
    let isAuthorizedHelper = false;

    if (req.user!.roleName === 'HELPER' && req.user!.canManageInfluencerLinks) {
      const assignment = await (prisma as any).helperUserAssignment.findFirst({
        where: { helperId: userId, targetUserId: link.influencerId }
      });
      if (assignment) isAuthorizedHelper = true;
    }

    if (!isAdmin && !isOwner && !isAuthorizedHelper) {
      throw new AppException(403, 'You do not have permission to perform this action');
    }

    const landingPage = await (prisma as any).referralLinkLandingPage.upsert({
      where: { referralLinkId: linkId },
      update: { themeColor, title, description, buttonText, customStructure },
      create: { referralLinkId: linkId, themeColor, title, description, buttonText, customStructure }
    });

    res.json(landingPage);
  })
);

// In-memory OTP store for regeneration verification (linkId -> { otp, expiresAt, email })
const regenOtpStore = new Map<number, { otp: string; expiresAt: Date; email: string }>();

// Step 1: Send verification OTP to the influencer's email
router.post(
  '/links/:id/send-regen-otp',
  authenticate,
  authorize('VENDOR', 'INFLUENCER', 'HELPER', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const linkId = parseInt(String(req.params.id));

    const link = await (prisma as any).referralLink.findUnique({
      where: { id: linkId },
      include: { influencer: { select: { id: true, email: true, profile: { select: { fullName: true } } } } }
    });

    if (!link) {
      throw new AppException(404, 'Referral link not found');
    }

    // Permission Check
    const isAdmin = req.user!.roleName === 'SUPER_ADMIN';
    const isOwner = link.influencerId === userId;
    let isAuthorizedHelper = false;

    if (req.user!.roleName === 'HELPER' && req.user!.canManageInfluencerLinks) {
      const assignment = await (prisma as any).helperUserAssignment.findFirst({
        where: { helperId: userId, targetUserId: link.influencerId }
      });
      if (assignment) isAuthorizedHelper = true;
    }

    if (!isAdmin && !isOwner && !isAuthorizedHelper) {
      throw new AppException(403, 'You do not have permission to perform this action');
    }

    const email = link.influencer?.email;
    if (!email) {
      throw new AppException(400, 'No email found for this influencer');
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    regenOtpStore.set(linkId, { otp, expiresAt, email });

    // Send email
    const { sendEmail } = await import('../utils/mailer.js');
    const influencerName = link.influencer?.profile?.fullName || email;
    await sendEmail({
      to: email,
      subject: '🔐 Code de vérification - Régénération de lien',
      html: `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="width: 60px; height: 60px; background: #fee2e2; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
              <span style="font-size: 28px;">🔐</span>
            </div>
            <h2 style="color: #1e293b; margin: 0; font-size: 22px;">Vérification Requise</h2>
          </div>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
            Bonjour <strong>${influencerName}</strong>,<br><br>
            Une demande de régénération de code pour votre lien de parrainage a été initiée. 
            Voici votre code de vérification :
          </p>
          <div style="text-align: center; margin: 30px 0;">
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

    // Mask email for frontend display
    const [localPart, domain] = email.split('@');
    const maskedEmail = `${localPart.slice(0, 2)}***@${domain}`;

    res.json({ 
      status: 'success', 
      message: 'OTP sent',
      data: { maskedEmail }
    });
  })
);

// Step 2: Verify OTP and regenerate the code
router.post(
  '/links/:id/verify-regen-otp',
  authenticate,
  authorize('VENDOR', 'INFLUENCER', 'HELPER', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const linkId = parseInt(String(req.params.id));
    const { otp } = req.body;

    if (!otp) {
      throw new AppException(400, 'OTP is required');
    }

    const link = await (prisma as any).referralLink.findUnique({
      where: { id: linkId }
    });

    if (!link) {
      throw new AppException(404, 'Referral link not found');
    }

    // Permission Check
    const isAdmin = req.user!.roleName === 'SUPER_ADMIN';
    const isOwner = link.influencerId === userId;
    let isAuthorizedHelper = false;

    if (req.user!.roleName === 'HELPER' && req.user!.canManageInfluencerLinks) {
      const assignment = await (prisma as any).helperUserAssignment.findFirst({
        where: { helperId: userId, targetUserId: link.influencerId }
      });
      if (assignment) isAuthorizedHelper = true;
    }

    if (!isAdmin && !isOwner && !isAuthorizedHelper) {
      throw new AppException(403, 'You do not have permission to perform this action');
    }

    // Verify OTP
    const stored = regenOtpStore.get(linkId);
    if (!stored) {
      throw new AppException(400, 'Aucun code de vérification trouvé. Veuillez en demander un nouveau.');
    }

    if (new Date() > stored.expiresAt) {
      regenOtpStore.delete(linkId);
      throw new AppException(400, 'Le code de vérification a expiré. Veuillez en demander un nouveau.');
    }

    if (stored.otp !== otp) {
      throw new AppException(400, 'Code de vérification incorrect.');
    }

    // OTP verified — regenerate the code
    regenOtpStore.delete(linkId);

    const newCode = uuidv4().slice(0, 8).toUpperCase();

    const updatedLink = await (prisma as any).referralLink.update({
      where: { id: linkId },
      data: { code: newCode },
      include: {
        product: { include: { images: { where: { isPrimary: true }, take: 1 } } }
      }
    });

    res.json(updatedLink);
  })
);

router.patch(
  '/links/:id/status',
  authenticate,
  authorize('VENDOR', 'INFLUENCER', 'HELPER', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const linkId = parseInt(String(req.params.id));
    const { isActive, status } = req.body;

    // Initial check: if Link exists
    const link = await (prisma as any).referralLink.findUnique({
      where: { id: linkId }
    });

    if (!link) {
      throw new AppException(404, 'Referral link not found');
    }

    // Permission Check
    const isAdmin = req.user!.roleName === 'SUPER_ADMIN';
    const isOwner = link.influencerId === userId;
    let isAuthorizedHelper = false;

    if (req.user!.roleName === 'HELPER' && req.user!.canManageInfluencerLinks) {
      const assignment = await (prisma as any).helperUserAssignment.findFirst({
        where: { helperId: userId, targetUserId: link.influencerId }
      });
      if (assignment) isAuthorizedHelper = true;
    }

    if (!isAdmin && !isOwner && !isAuthorizedHelper) {
      throw new AppException(403, 'You do not have permission to perform this action');
    }

    const updateData: any = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (status !== undefined) updateData.status = status;

    const updatedLink = await (prisma as any).referralLink.update({
      where: { id: linkId },
      data: updateData,
      include: {
        product: { include: { images: { where: { isPrimary: true }, take: 1 } } }
      }
    });

    res.json(updatedLink);
  })
);

router.get(
  '/helper/links',
  authenticate,
  authorize('HELPER', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const helperId = req.user!.id;

    // Get all assigned influencer user IDs for this helper
    const assignments = await (prisma as any).helperUserAssignment.findMany({
      where: { helperId },
      select: { targetUserId: true }
    });

    const influencerIds = assignments.map((a: any) => a.targetUserId);

    if (influencerIds.length === 0) {
      return res.json([]);
    }

    const links = await (prisma as any).referralLink.findMany({
      where: { influencerId: { in: influencerIds } },
      include: {
        product: {
          include: { images: { where: { isPrimary: true }, take: 1 } }
        },
        influencer: {
          select: { 
            id: true, 
            email: true,
            phone: true,
            profile: { select: { fullName: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedLinks = links.map((link: any) => ({
      ...link,
      influencer: {
        ...link.influencer,
        fullName: link.influencer?.profile?.fullName
      }
    }));

    res.json(formattedLinks);
  })
);

export default router;
