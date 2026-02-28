import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { v4 as uuidv4 } from 'uuid';

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
      where: { code },
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
  '/campaigns',
  asyncHandler(async (req: Request, res: Response) => {
    const campaigns = await prisma.influencerCampaign.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    res.json(campaigns);
  })
);

router.post(
  '/campaigns/:id/join',
  authenticate,
  authorize('VENDOR', 'INFLUENCER'),
  asyncHandler(async (req: Request, res: Response) => {
    const campaignId = parseInt(req.params.id);
    const { productIds } = req.body;

    if (!req.user!.isInfluencer) {
      throw new AppException(400, 'You must enable influencer mode first');
    }

    for (const productId of productIds) {
      await prisma.referralLink.upsert({
        where: { influencerId_productId: { influencerId: req.user!.id, productId } },
        create: {
          influencerId: req.user!.id,
          productId,
          code: uuidv4().slice(0, 8).toUpperCase()
        },
        update: {}
      });
    }

    res.json({ success: true });
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

export default router;
