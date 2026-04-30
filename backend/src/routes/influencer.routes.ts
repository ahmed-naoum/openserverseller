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
        code
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

    if (start && end) {
      const startDate = new Date(start as string);
      const endDate = new Date(end as string);
      endDate.setHours(23, 59, 59, 999);

      const formattedLinks = await Promise.all(links.map(async (link) => {
        const [clicksCount, leadsCount, earningsSum] = await Promise.all([
          (prisma as any).referralLinkClick.groupBy({
            by: ['ipAddress'],
            where: {
              referralLinkId: link.id,
              createdAt: { gte: startDate, lte: endDate }
            }
          }).then((res: any) => res.length),
          prisma.lead.count({
            where: {
              referralLinkId: link.id,
              createdAt: { gte: startDate, lte: endDate }
            }
          }),
          prisma.influencerCommission.aggregate({
            where: {
              referralLinkId: link.id,
              createdAt: { gte: startDate, lte: endDate }
            },
            _sum: { amount: true }
          })
        ]);

        return {
          ...link,
          clicks: clicksCount,
          conversions: leadsCount,
          earnings: earningsSum._sum.amount || 0
        };
      }));

      return res.json(formattedLinks);
    }

    res.json(links);
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

    if (start && end) {
      dateLimitStart = new Date(start as string);
      dateLimitEnd = new Date(end as string);
      dateLimitEnd.setHours(23, 59, 59, 999);
    } else {
      const numDays = parseInt(days as string) || 30;
      dateLimitStart = new Date();
      dateLimitStart.setDate(dateLimitStart.getDate() - (numDays - 1));
      dateLimitStart.setHours(0, 0, 0, 0);
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

    const clicksByDate: Record<string, Set<string>> = {};
    clicks.forEach((c: any) => {
      const date = c.createdAt.toISOString().split('T')[0];
      if (!clicksByDate[date]) clicksByDate[date] = new Set();
      clicksByDate[date].add(`${c.ipAddress}-${c.userAgent || 'unknown'}`);
    });

    const uniqueClicksByDate: Record<string, number> = {};
    Object.keys(clicksByDate).forEach(date => {
      uniqueClicksByDate[date] = clicksByDate[date].size;
    });

    const salesByDate: Record<string, number> = {};
    // Combine leads and commissions for "Ventes" history
    // Leads are the primary source for referral form conversions
    leads.forEach(l => {
      const date = l.createdAt.toISOString().split('T')[0];
      salesByDate[date] = (salesByDate[date] || 0) + 1;
    });
    // Commissions might come from track-conversion or external sales
    commissions.forEach(c => {
      const date = c.createdAt.toISOString().split('T')[0];
      salesByDate[date] = (salesByDate[date] || 0) + 1;
    });

    const dailyStats = [];
    const curr = new Date(dateLimitStart);
    while (curr <= dateLimitEnd) {
      const dateStr = curr.toISOString().split('T')[0];
      const views = uniqueClicksByDate[dateStr] || 0;
      const sales = salesByDate[dateStr] || 0;
      dailyStats.push({
        date: dateStr,
        views,
        sales,
        convRate: views > 0 ? Number(((sales / views) * 100).toFixed(1)) : 0
      });
      curr.setDate(curr.getDate() + 1);
    }

    res.json(dailyStats);
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
      where: { id: leadId, referralLinkId: { in: linkIds } },
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
        status: { in: ['NEW', 'LEAD'] }
      },
      include: {
        referralLink: { include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } } }
      }
    });

    if (leads.length === 0) {
      throw new AppException(404, 'No eligible leads found for pushing');
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
            lead: true
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
      orderId: null,
      amount: 0,
      status: 'PENDING',
      createdAt: lead.createdAt,
      order: {
        customerName: lead.fullName,
        customerPhone: lead.phone,
        customerCity: lead.city,
        customerAddress: lead.address,
        status: lead.status === 'NEW' ? 'LEAD' : lead.status,
        productVariant: lead.productVariant,
        totalAmountMad: 0,
        lead: {
          paymentSituation: lead.paymentSituation
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
    const linkId = parseInt(req.params.id);

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
    const linkId = parseInt(req.params.id);
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

router.patch(
  '/links/:id/code',
  authenticate,
  authorize('VENDOR', 'INFLUENCER', 'HELPER', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const linkId = parseInt(req.params.id);

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
    const linkId = parseInt(req.params.id);
    const { isActive } = req.body;

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

    const updatedLink = await (prisma as any).referralLink.update({
      where: { id: linkId },
      data: { isActive },
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
