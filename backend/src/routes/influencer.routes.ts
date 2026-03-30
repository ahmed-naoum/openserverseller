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
    const { productId } = req.body;

    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product || !(product.visibility.includes('AFFILIATE') || product.visibility.includes('INFLUENCER'))) {
      throw new AppException(404, 'Product not found or not available for influencers');
    }

    const claim = await prisma.affiliateClaim.upsert({
      where: { userId_productId: { userId, productId } },
      update: { status: 'PENDING' },
      create: {
        userId,
        productId,
        status: 'PENDING'
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
  authorize('VENDOR', 'INFLUENCER'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const links = await prisma.referralLink.findMany({
      where: { influencerId: userId },
      include: {
        product: { include: { images: { where: { isPrimary: true }, take: 1 } } }
      },
      orderBy: { createdAt: 'desc' }
    });

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

    await prisma.referralLink.update({
      where: { id: link.id },
      data: { clicks: { increment: 1 } }
    });

    res.json(link);
  })
);

router.get(
  '/links/:code/public',
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.params;

    const link = await prisma.referralLink.findUnique({
      where: { code: code as string },
      include: {
        product: { include: { images: { orderBy: { sortOrder: 'asc' } }, categories: true } },
        influencer: { include: { profile: true } }
      }
    }) as any;

    if (!link || !link.isActive || !link.product.isActive) {
      throw new AppException(404, 'Referral link or product not found or inactive');
    }

    // We only return public-safe data
    res.json({
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
      influencerAvatar: link.influencer.profile?.avatarUrl
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

    if (lead.status === 'AVAILABLE' || lead.status === 'ASSIGNED' || lead.assignedAgentId) {
      throw new AppException(400, 'Lead is already in the call center queue');
    }

    const updatedLead = await prisma.$transaction(async (tx: any) => {
      await tx.leadStatusHistory.create({
        data: { leadId: lead.id, oldStatus: lead.status, newStatus: 'AVAILABLE', changedBy: userId }
      });
      return tx.lead.update({
        where: { id: lead.id },
        data: { status: 'AVAILABLE' }
      });
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
        order: true,
        referralLink: { include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } } }
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
        referralLink: { include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } } }
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
        totalAmountMad: 0
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

export default router;
