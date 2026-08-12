import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { v4 as uuidv4 } from 'uuid';
import { io } from '../index.js';
import { containsBlockedWord } from '../utils/blockedWords.js';
import { validateInfluencerSubdomain } from '../utils/subdomain.js';
import { getNotifiableAgentIds } from '../utils/agentScope.js';
import { parseDateRange } from '../lib/dateRange.js';
import {
  productScopeOf,
  applyProductScope,
  applyReferralLinkProductScope,
  isProductInScope,
  OUT_OF_SCOPE,
} from '../lib/subAccountProductScope.js';

const router = Router();
const prisma = new PrismaClient();
const recentClicks = new Map<string, number>();

/**
 * Refuse a per-link action when a scoped sub-account was not handed the link's
 * product.
 *
 * A referral link IS a product's control surface — renaming its code, editing
 * its landing page or switching it off all change what the customer sees for
 * that product. So the link inherits the product's scope, and the id in the URL
 * is checked rather than trusted, exactly as the product detail route does.
 * Everyone else (vendors, influencers, admins) short-circuits on the first line.
 */
const assertLinkInScope = async (req: Request, linkId: number) => {
  const scope = productScopeOf(req);
  if (!scope) return;
  const link = await prisma.referralLink.findUnique({
    where: { id: linkId },
    select: { productId: true },
  });
  if (!link || !isProductInScope(scope, link.productId)) {
    throw new AppException(403, OUT_OF_SCOPE);
  }
};


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

router.get(
  '/links/check-unique',
  authenticate,
  authorize('VENDOR', 'INFLUENCER'),
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.query;
    if (!name || typeof name !== 'string') {
      return res.json({ unique: false, message: 'Nom invalide' });
    }

    const nameStr = name.trim();
    if (nameStr.length < 3 || nameStr.length > 20 || !/^[a-zA-Z0-9-_]+$/.test(nameStr)) {
      return res.json({ unique: false, message: 'Format invalide' });
    }

    const exists = await prisma.referralLink.findUnique({
      where: { code: nameStr }
    });

    return res.json({ unique: !exists });
  })
);

router.post(
  '/links',
  authenticate,
  authorize('VENDOR', 'INFLUENCER'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { productId, customName } = req.body;

    // A new link is a new selling surface for this product, so it needs the same
    // grant as opening the product does.
    if (!isProductInScope(productScopeOf(req), Number(productId))) {
      throw new AppException(403, OUT_OF_SCOPE);
    }

    const product = await prisma.product.findUnique({
      where: { id: Number(productId) },
      select: { ownerId: true }
    });
    const isOwner = product?.ownerId === userId;


    // Check if there is an APPROVED claim for this product (unless owner)
    let claim = null;
    if (!isOwner) {
      claim = await prisma.affiliateClaim.findFirst({
        where: { userId, productId: Number(productId), status: 'APPROVED' }
      });

      if (!claim) {
        throw new AppException(403, 'You must have an APPROVED claim for this product before generating a link');
      }
    }

    // Limit to max 5 links per product
    const linkCount = await prisma.referralLink.count({
      where: { influencerId: userId, productId: Number(productId) }
    });

    if (linkCount >= 5) {
      throw new AppException(400, 'Vous ne pouvez pas créer plus de 5 liens pour ce produit.');
    }

    let code = '';
    if (customName) {
      const nameStr = String(customName).trim();
      if (nameStr.length < 3 || nameStr.length > 20) {
        throw new AppException(400, 'Le nom personnalisé doit contenir entre 3 et 20 caractères.');
      }
      const nameRegex = /^[a-zA-Z0-9-_]+$/;
      if (!nameRegex.test(nameStr)) {
        throw new AppException(400, 'Le nom personnalisé ne peut contenir que des lettres, chiffres, tirets (-) et underscores (_).');
      }

      // Check for blocked/forbidden words
      const blockedWord = containsBlockedWord(nameStr);
      if (blockedWord) {
        throw new AppException(400, 'Ce nom contient un mot interdit et ne peut pas être utilisé.');
      }

      // Check uniqueness
      const existingCode = await prisma.referralLink.findUnique({
        where: { code: nameStr }
      });
      if (existingCode) {
        throw new AppException(400, 'Ce nom de lien est déjà utilisé. Veuillez en choisir un autre.');
      }
      code = nameStr;
    } else {
      // Default fallback - generate a random code
      let attempts = 0;
      let generated = uuidv4().slice(0, 8).toUpperCase();
      while (attempts < 5) {
        const exists = await prisma.referralLink.findUnique({ where: { code: generated } });
        if (!exists) break;
        generated = uuidv4().slice(0, 8).toUpperCase();
        attempts++;
      }
      code = generated;
    }

    const referralLink = await prisma.referralLink.create({
      data: {
        influencerId: userId,
        productId: Number(productId),
        code,
        isActive: true, // Default to true when created so it's immediately active
        status: 'ACTIVE' // Let's make it ACTIVE by default to be usable immediately
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
    const { productId, brandingLabelPrintUrl, brandName, requestedQty, requestedLandingPageUrl, userMode } = req.body;

    // Claiming widens the vendor's catalogue, which is the one thing a helper
    // pinned to part of that catalogue should not be doing: the product it adds
    // lands outside its own scope, so it could neither see nor sell what it just
    // asked for. The vendor grants the product first, then the helper works it.
    if (productScopeOf(req)) {
      throw new AppException(
        403,
        "Votre accès est limité à certains produits : seul le vendeur peut en ajouter de nouveaux.",
      );
    }

    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product || !(product.visibility.includes('AFFILIATE') || product.visibility.includes('INFLUENCER') || product.visibility.includes('REGULAR'))) {
      throw new AppException(404, 'Product not found or not available for your role');
    }

    const userRole = req.user!.roleName;
    const mode = userRole === 'INFLUENCER' ? 'INFLUENCER' : (userMode || 'AFFILIATE');
    const claim = await prisma.affiliateClaim.upsert({
      where: { userId_productId_userMode: { userId, productId, userMode: mode } },
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
        userMode: mode,
        brandingLabelPrintUrl,
        brandName,
        requestedQty: requestedQty ? Number(requestedQty) : null,
        requestedLandingPageUrl
      }
    });
    try {
      const productName = product?.nameFr || product?.nameAr || 'Produit';
      const { createNotification } = await import('../utils/notification.js');
      await createNotification(
        userId,
        'PRODUCT_CLAIM_STATUS',
        '📝 Demande d\'affiliation soumise',
        `Votre demande d'affiliation pour le produit "${productName}" est en attente d'approbation par l'administrateur.`
      );
    } catch (err) {
      console.error('Failed to trigger claim submission notification:', err);
    }

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
    // This endpoint is what the inventory, links and marketplace screens read to
    // learn what this account may sell, so it is the single place that decides
    // how much of the catalogue a scoped helper appears to hold. All three
    // sources narrow together — leaving the links unfiltered would show a link
    // hanging off a product that is no longer in the list.
    const scope = productScopeOf(req);
    const [claims, links, ownedProducts] = await Promise.all([
      prisma.affiliateClaim.findMany({
        where: applyProductScope({ userId }, scope),
        include: {
          product: { include: { images: { where: { isPrimary: true }, take: 1 } } }
        }
      }),
      prisma.referralLink.findMany({
        where: applyProductScope({ influencerId: userId }, scope)
      }),
      prisma.product.findMany({
        where: applyProductScope({ ownerId: userId }, scope, 'id'),
        include: { images: { where: { isPrimary: true }, take: 1 } }
      })
    ]);

    const claimsWithLinks = claims.map(claim => ({
      ...claim,
      referralLink: links.find(l => l.productId === claim.productId)
    }));

    const existingProductIds = new Set(claims.map(c => c.productId));
    const ownedProductClaims = ownedProducts
      .filter(p => !existingProductIds.has(p.id))
      .map(p => ({
        id: `owned_${p.id}`,
        userId,
        productId: p.id,
        status: 'APPROVED',
        userMode: 'SELLER',
        product: p,
        referralLink: links.find(l => l.productId === p.id),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }));

    res.json([...claimsWithLinks, ...ownedProductClaims]);
  })
);


router.get(
  '/links',
  authenticate,
  authorize('VENDOR', 'INFLUENCER', 'HELPER', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { start, end, mode } = req.query;

    const whereClause: any = { influencerId: userId };
    if (mode === 'SELLER') {
      whereClause.product = { ownerId: userId };
    } else if (mode === 'AFFILIATE') {
      whereClause.product = {
        OR: [
          { ownerId: { not: userId } },
          { ownerId: null }
        ]
      };
    }
    // AND rather than an assignment: the mode filter above already writes to
    // `product`, and overwriting it would widen this list instead of narrowing it.
    applyProductScope(whereClause, productScopeOf(req));

    const links = await prisma.referralLink.findMany({
      where: whereClause,
      include: {
        product: { include: { images: { where: { isPrimary: true }, take: 1 } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Same parser as the dashboard's period bar, so a link's clicks and the
    // totals above them describe one window. A single bound is enough now:
    // "Aujourd'hui" sends no end, and requiring both used to leave every link
    // counting all-time while the cards next to them showed the day.
    const linkRange = parseDateRange(start, end);

    const formattedLinks = await Promise.all(links.map(async (link) => {
      const dateFilter = linkRange ? { createdAt: linkRange } : {};
      
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

      // Calculate unique clicks (IP + User Agent) and whatsapp clicks
      const uniqueClicksSet = new Set();
      let whatsappClicks = 0;
      let rawViews = 0;

      clicksData.forEach((c: any) => {
        if (c.userAgent === 'whatsapp_click') {
          whatsappClicks++;
        } else {
          rawViews++;
          uniqueClicksSet.add(`${c.ipAddress}-${c.userAgent || 'unknown'}`);
        }
      });

      return {
        ...link,
        clicks: uniqueClicksSet.size,
        rawClicks: rawViews,
        whatsappClicks,
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
    const clickKey = `${link.id}-${ip}-${userAgent || 'unknown'}`;
    const now = Date.now();

    const isDuplicate = recentClicks.has(clickKey) && (now - recentClicks.get(clickKey)!) < 10000;

    if (!isDuplicate) {
      recentClicks.set(clickKey, now);
      setTimeout(() => {
        recentClicks.delete(clickKey);
      }, 10000);

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
        const updatedLink = await (prisma as any).referralLink.update({
          where: { id: link.id },
          data: { clicks: { increment: 1 } }
        });
        if (updatedLink.clicks === 100) {
          try {
            const { createNotification } = await import('../utils/notification.js');
            await createNotification(
              link.influencerId,
              'REFERRAL_LINK_CLICKS',
              '🎉 Objectif 100 visiteurs atteint !',
              `Félicitations ! Votre lien de parrainage (${link.code}) a généré 100 visiteurs uniques !`
            );
          } catch (err) {
            console.error('Failed to trigger clicks milestone notification:', err);
          }
        }
      }
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
        influencer: { include: { profile: true, pixels: true } },
        landingPage: true
      }
    });

    if (!link || !link.isActive || !link.product.isActive) {
      throw new AppException(404, 'Referral link or product not found or inactive');
    }

    if (!validateInfluencerSubdomain(req, link.influencer.subdomain, link.influencer.customDomain)) {
      throw new AppException(404, 'Referral link or product not found or inactive');
    }

    // Increment clicks (Unique - per IP)
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'];
    const clickKey = `${link.id}-${ip}-${userAgent || 'unknown'}`;
    const now = Date.now();

    const isDuplicate = recentClicks.has(clickKey) && (now - recentClicks.get(clickKey)!) < 10000;

    if (!isDuplicate) {
      recentClicks.set(clickKey, now);
      setTimeout(() => {
        recentClicks.delete(clickKey);
      }, 10000);

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
        const updatedLink = await (prisma as any).referralLink.update({
          where: { id: link.id },
          data: { clicks: { increment: 1 } }
        });
        if (updatedLink.clicks === 100) {
          try {
            const { createNotification } = await import('../utils/notification.js');
            await createNotification(
              link.influencerId,
              'REFERRAL_LINK_CLICKS',
              '🎉 Objectif 100 visiteurs atteint !',
              `Félicitations ! Votre lien de parrainage (${link.code}) a généré 100 visiteurs uniques !`
            );
          } catch (err) {
            console.error('Failed to trigger clicks milestone notification:', err);
          }
        }
      }
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
        landingPage: link.landingPage,
        pixels: link.influencer.pixels || []
      }
    });
  })
);

router.post(
  '/links/:code/track-whatsapp',
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.params;

    const link = await (prisma as any).referralLink.findUnique({
      where: { code: code as string },
      include: { influencer: { select: { subdomain: true, customDomain: true } } }
    });

    if (!link) {
      throw new AppException(404, 'Referral link not found');
    }

    if (!validateInfluencerSubdomain(req, link.influencer?.subdomain, link.influencer?.customDomain)) {
      throw new AppException(404, 'Referral link not found');
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const clickType = 'whatsapp_click';

    // Insert a click record to be tracked in the time-series chart
    await (prisma as any).referralLinkClick.create({
      data: {
        referralLinkId: link.id,
        ipAddress: ip,
        userAgent: clickType
      }
    });

    await (prisma as any).referralLink.update({
      where: { id: link.id },
      data: { whatsappClicks: { increment: 1 } }
    });

    res.json({ success: true });
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

    // Earnings are per link, so they narrow with the products a sub-account was
    // given. The totals take the same filter as the rows — a total that counted
    // products the helper cannot open would be reporting the vendor's revenue,
    // not the helper's scope.
    const scope = productScopeOf(req);
    const commissionWhere = applyReferralLinkProductScope({ influencerId: userId }, scope);

    const commissions = await prisma.influencerCommission.findMany({
      where: commissionWhere,
      include: {
        referralLink: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const totals = await prisma.influencerCommission.groupBy({
      by: ['status'],
      where: commissionWhere,
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
    const { start, end, days, referralLinkId, mode } = req.query;

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
      } else if (mode === 'SELLER') {
        whereOldest.product = { ownerId: userId };
      } else if (mode === 'AFFILIATE') {
        whereOldest.product = { ownerId: { not: userId } };
      }
      applyProductScope(whereOldest, productScopeOf(req));
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
    } else if (mode === 'SELLER') {
      whereBase.product = { ownerId: userId };
    } else if (mode === 'AFFILIATE') {
      whereBase.product = { ownerId: { not: userId } };
    }
    // One filter for the whole endpoint: clicks, leads and commissions below all
    // reach their rows through `referralLink: whereBase`. It also settles the
    // `?referralLinkId=` case above — asking for a link outside the scope now
    // matches nothing instead of charting it.
    applyProductScope(whereBase, productScopeOf(req));

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
    const rawClicksByDate: Record<string, number> = {};
    const whatsappClicksByDate: Record<string, number> = {};
    clicks.forEach((c: any) => {
      const key = getKey(c.createdAt);
      if (c.userAgent === 'whatsapp_click') {
        whatsappClicksByDate[key] = (whatsappClicksByDate[key] || 0) + 1;
      } else {
        if (!clicksByDate[key]) clicksByDate[key] = new Set();
        clicksByDate[key].add(`${c.ipAddress}-${c.userAgent || 'unknown'}`);
        rawClicksByDate[key] = (rawClicksByDate[key] || 0) + 1;
      }
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
      const rawViews = rawClicksByDate[key] || 0;
      const whatsappClicks = whatsappClicksByDate[key] || 0;
      const sales = salesByDate[key] || 0;
      stats.push({
        date: curr.toISOString(),
        views,
        rawViews,
        whatsappClicks,
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
      where: applyProductScope({ influencerId: userId }, productScopeOf(req)),
      select: { id: true }
    });
    const linkIds = influencerLinks.map(l => l.id);

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, referralLinkId: { in: linkIds } }
    });

    if (!lead) {
      throw new AppException(404, 'Lead not found or not yours');
    }

    const existingOrder = await prisma.order.findUnique({
      where: { leadId }
    });

    await prisma.$transaction(async (tx) => {
      if (existingOrder) {
        await tx.orderItem.deleteMany({ where: { orderId: existingOrder.id } });
        await tx.orderStatusHistory.deleteMany({ where: { orderId: existingOrder.id } });
        await tx.order.delete({ where: { id: existingOrder.id } });
      }

      // Clean up lead assignments and history to allow delete
      await tx.leadAssignment.deleteMany({ where: { leadId } });
      await tx.leadStatusHistory.deleteMany({ where: { leadId } });
      await tx.callLog.deleteMany({ where: { leadId } });
      
      await tx.lead.delete({
        where: { id: leadId },
      });
    });

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
      where: applyProductScope({ influencerId: userId }, productScopeOf(req)),
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

    await prisma.$transaction(async (tx) => {
      // Clean up orders
      const orders = await tx.order.findMany({
        where: { leadId: { in: deletedIds } },
        select: { id: true }
      });
      const orderIds = orders.map(o => o.id);

      if (orderIds.length > 0) {
        await tx.orderItem.deleteMany({
          where: { orderId: { in: orderIds } }
        });
        await tx.orderStatusHistory.deleteMany({
          where: { orderId: { in: orderIds } }
        });
        await tx.order.deleteMany({
          where: { id: { in: orderIds } }
        });
      }

      // Clean up lead assignments and history
      await tx.leadAssignment.deleteMany({
        where: { leadId: { in: deletedIds } }
      });
      await tx.leadStatusHistory.deleteMany({
        where: { leadId: { in: deletedIds } }
      });
      await tx.callLog.deleteMany({
        where: { leadId: { in: deletedIds } }
      });

      // Finally delete the leads
      await tx.lead.deleteMany({
        where: { id: { in: deletedIds } }
      });
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
      where: applyProductScope({ influencerId: userId }, productScopeOf(req)),
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

    // Agents restricted to other products of this influencer are skipped.
    const agentIds = await getNotifiableAgentIds(userId, lead.referralLink?.productId ?? null);

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

    agentIds.forEach(id => {
      io.to(`user:${id}`).emit('new-available-lead', leadData);
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
      where: applyProductScope({ influencerId: userId }, productScopeOf(req)),
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
        where: { id: { in: leads.map(l => l.id) } },
        // The socket payload names the product, and the per-agent product scope
        // is resolved from it — both need the link loaded.
        include: { referralLink: { include: { product: { include: { images: true } } } } }
      });
    });

    const influencerProfile = await prisma.userProfile.findUnique({
      where: { userId }
    });

    // Notify agents for each pushed lead — the notifiable set is per product,
    // so agents narrowed to a subset only hear about their own products.
    for (const lead of leads) {
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

      const agentIds = await getNotifiableAgentIds(userId, (lead as any).referralLink?.productId ?? null);
      agentIds.forEach(id => {
        io.to(`user:${id}`).emit('new-available-lead', leadData);
      });
    }

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

// The customers list repeats its referral link on every row, so anything wide in
// there is paid for once per lead. `include` dragged along the product's
// `longDescription` (rich HTML) and the landing page's whole sitebuilder JSON —
// on a 3k-lead account that was tens of MB of the same few products over and
// over. The list only ever renders these five fields.
const CUSTOMER_LIST_LINK_SELECT = {
  id: true,
  code: true,
  productId: true,
  product: {
    select: {
      id: true,
      nameFr: true,
      sku: true,
      retailPriceMad: true,
      images: { where: { isPrimary: true }, take: 1, select: { imageUrl: true } },
    },
  },
  landingPage: { select: { id: true, customStructure: true } },
} as const;

// The only thing the list reads out of `customStructure` is the express_checkout
// block, to price the pack the customer picked. Keep that block and drop the
// rest of the page (hero copy, images, FAQs, testimonials…) before it ships.
// `cache` is per-request, not module-level: a vendor editing pack prices in the
// sitebuilder must see the new price on the very next load.
function trimLandingStructure(landingPage: any, cache: Map<number, any>) {
  if (!landingPage?.customStructure) return landingPage;
  if (!cache.has(landingPage.id)) {
    let trimmed: any = null;
    try {
      const structure = landingPage.customStructure;
      const blocks = Array.isArray(structure) ? structure : structure.blocks || [];
      const checkout = blocks.find((b: any) => b?.type === 'express_checkout');
      trimmed = checkout ? { blocks: [checkout] } : null;
    } catch {
      trimmed = null;
    }
    cache.set(landingPage.id, trimmed);
  }
  return { ...landingPage, customStructure: cache.get(landingPage.id) };
}

// The express_checkout block boiled down further: the list prices a row's pack
// by matching order.productVariant against an option name, so per link only
// [{ name, price }] survives. Prices are shipped raw, not coerced — the pages
// keep their own truthiness check on `price` exactly as they applied it to the
// block itself.
function extractPackOptions(landingPage: any): { name: string; price: any }[] | null {
  if (!landingPage?.customStructure) return null;
  try {
    const structure = landingPage.customStructure;
    const blocks = Array.isArray(structure) ? structure : structure.blocks || [];
    const checkout = blocks.find((b: any) => b?.type === 'express_checkout');
    const options = checkout?.content?.options;
    if (!Array.isArray(options)) return null;
    return options
      .filter((o: any) => o && typeof o.name === 'string')
      .map((o: any) => ({ name: o.name, price: o.price }));
  } catch {
    return null;
  }
}

/**
 * Which rows of the customers list an account may see.
 *
 * Extracted from the handler so the history route further down authorises
 * against the very same predicate the list selects by. Two copies of "may this
 * account see this row" drift, and the way that shows up is a row rendering a
 * History button that answers 404 when it is clicked.
 */
function buildCustomerCommissionWhere(userId: number, mode: unknown, search?: string) {
  const where: any = {
    order: search ? {
      OR: [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { customerCity: { contains: search, mode: 'insensitive' } },
      ]
    } : { isNot: null }
  };

  if (mode === 'SELLER') {
    where.OR = [
      { referralLink: { product: { ownerId: userId } } },
      { order: { vendorId: userId } }
    ];
  } else if (mode === 'AFFILIATE') {
    where.influencerId = userId;
    where.referralLink = {
      product: {
        OR: [
          { ownerId: { not: userId } },
          { ownerId: null }
        ]
      }
    };
  } else {
    where.influencerId = userId;
  }

  return where;
}

async function buildCustomerLeadWhere(req: Request, userId: number, mode: unknown, search?: string) {
  // The search predicate lives under AND, not OR — every mode branch below assigns
  // `.OR = [...]`, which would otherwise overwrite it and silently return the
  // vendor's whole lead list for any search term.
  const where: any = {
    ...(search ? {
      AND: [{
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } },
        ]
      }]
    } : {})
  };

  if (mode === 'SELLER') {
    where.OR = [
      { vendorId: userId },
      { referralLink: { product: { ownerId: userId } } }
    ];
  } else if (mode === 'AFFILIATE') {
    where.OR = [
      {
        referralLink: {
          influencerId: userId,
          product: {
            OR: [
              { ownerId: { not: userId } },
              { ownerId: null }
            ]
          }
        }
      },
      {
        vendorId: userId,
        sourceMode: 'AFFILIATE'
      }
    ];
  } else {
    const influencerLinks = await prisma.referralLink.findMany({
      where: applyProductScope({ influencerId: userId }, productScopeOf(req)),
      select: { id: true }
    });
    const linkIds = influencerLinks.map(l => l.id);
    where.OR = [
      { vendorId: userId },
      { referralLinkId: { in: linkIds } }
    ];
  }

  // Applied after the branches, not inside one: every branch above ORs in
  // `vendorId: userId`, which matches each lead the account owns whatever link
  // it came from. Narrowing only the link half would still hand a scoped
  // sub-account the vendor's whole customer book.
  applyReferralLinkProductScope(where, productScopeOf(req));

  return where;
}

router.get(
  '/customers',
  authenticate,
  authorize('VENDOR', 'INFLUENCER'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { page = 1, limit = 20, search, mode, all, summary } = req.query;

    // The leads pages compute their stats/charts/pagination client-side, so they ask
    // for the whole dataset with `all=true`. Cap it so a very large account can't OOM
    // the response; `truncated` tells the client the numbers are incomplete.
    const fetchAll = all === 'true' || all === '1' || (all as any) === true;
    const summaryOnly = summary === 'true' || summary === '1' || (summary as any) === true;
    const ALL_HARD_CAP = 5000;

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 500);

    const skip = fetchAll ? 0 : (safePage - 1) * safeLimit;
    const take = fetchAll ? ALL_HARD_CAP : safeLimit;

    const commissionWhereClause = buildCustomerCommissionWhere(userId, mode, search as string | undefined);

    // The slim branch keeps every field the leads pages read per row and nothing
    // else. The two history arrays collapse into their newest entry (`take: 1`
    // below): the pages only ever derive "when did this row last move" and
    // "does it have a history at all" from them — the full entries are served on
    // demand by GET /customers/:leadId/history when the history modal opens.
    const HISTORY_NEWEST_ONLY = {
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' as const },
      take: 1,
    };

    const commissions = await prisma.influencerCommission.findMany({
      where: commissionWhereClause,
      include: summaryOnly
        ? {
            order: {
              select: {
                id: true,
                customerName: true,
                customerPhone: true,
                customerCity: true,
                customerAddress: true,
                status: true,
                totalAmountMad: true,
                productVariant: true,
                coliatyPackageCode: true,
                coliatyPackageId: true,
                createdAt: true,
                items: { select: { quantity: true } },
                statusHistory: HISTORY_NEWEST_ONLY,
                lead: {
                  select: {
                    id: true,
                    createdAt: true,
                    paymentSituation: true,
                    callbackAt: true,
                    notes: true,
                    requestedPriceMad: true,
                    requestedPriceStatus: true,
                    source: true,
                    statusHistory: HISTORY_NEWEST_ONLY,
                  }
                }
              }
            },
            referralLink: {
              select: {
                id: true,
                code: true,
                productId: true,
              }
            }
          }
        : {
            order: {
              include: {
                items: true,
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
                  orderBy: { createdAt: 'asc' as const }
                }
              }
            },
            referralLink: { select: CUSTOMER_LIST_LINK_SELECT }
          },
      orderBy: { createdAt: 'desc' },
      skip,
      take
    });

    // New Leads (not yet orders).
    const leadWhereClause = await buildCustomerLeadWhere(req, userId, mode, search as string | undefined);

    const leads = await prisma.lead.findMany({
      where: leadWhereClause,
      include: summaryOnly
        ? {
            order: {
              select: {
                id: true,
                customerCity: true,
                status: true,
                totalAmountMad: true,
                coliatyPackageCode: true,
                coliatyPackageId: true,
                createdAt: true,
                items: { select: { quantity: true } },
                statusHistory: HISTORY_NEWEST_ONLY,
              }
            },
            statusHistory: HISTORY_NEWEST_ONLY,
            referralLink: {
              select: {
                id: true,
                code: true,
                productId: true,
              }
            }
          }
        : {
            order: {
              include: {
                items: true,
                statusHistory: {
                  include: { changedByUser: { select: { id: true, profile: { select: { fullName: true } } } } },
                  orderBy: { createdAt: 'asc' as const }
                }
              }
            },
            statusHistory: {
              include: { changer: { select: { id: true, profile: { select: { fullName: true } } } } },
              orderBy: { createdAt: 'asc' as const }
            },
            referralLink: { select: CUSTOMER_LIST_LINK_SELECT }
          },
      orderBy: { createdAt: 'desc' },
      // Was hardcoded to 100, which silently truncated every vendor with more leads
      // than that and made every client-side statistic wrong.
      take: fetchAll ? ALL_HARD_CAP : Math.max(safeLimit, 100)
    });

    // One cache for both lists below, so a link shared by hundreds of rows is
    // trimmed once per request rather than once per row.
    const landingCache = new Map<number, any>();
    const slimLink = (link: any) =>
      link?.landingPage ? { ...link, landingPage: trimLandingStructure(link.landingPage, landingCache) } : link;

    // In slim mode each history relation arrives as its single newest entry.
    // The list only needs "when did this row last move" (the newest createdAt
    // across both histories, matching the loose scan in frontend leadStatus.ts)
    // and "is there a history to show" — the arrays themselves stay behind on
    // GET /customers/:leadId/history.
    const newestOf = (...historyHeads: any[]) => {
      let latest: Date | null = null;
      for (const head of historyHeads) {
        const at = head?.[0]?.createdAt;
        if (at && (!latest || at > latest)) latest = at;
      }
      return latest;
    };

    // Map leads to a commission-like structure for the frontend
    const leadCommissions = leads.map(lead => ({
      id: `lead-${lead.id}`,
      influencerId: userId,
      referralLinkId: lead.referralLinkId,
      referralLink: summaryOnly ? lead.referralLink : slimLink(lead.referralLink),
      orderId: (lead as any).order?.id || null,
      amount: 0,
      status: 'PENDING',
      createdAt: lead.createdAt,
      ...(summaryOnly
        ? {
            statusChangedAt: newestOf((lead as any).statusHistory, (lead as any).order?.statusHistory),
            hasHistory: ((lead as any).statusHistory?.length || 0) + ((lead as any).order?.statusHistory?.length || 0) > 0,
          }
        : {}),
      order: {
        createdAt: (lead as any).order?.createdAt || lead.createdAt,
        customerName: lead.fullName,
        customerPhone: lead.phone,
        customerCity: (lead as any).order?.customerCity || lead.city,
        customerAddress: lead.address,
        status: (lead as any).order?.status || (lead.status === 'NEW' ? 'LEAD' : lead.status),
        productVariant: lead.productVariant,
        totalAmountMad: (lead as any).order?.totalAmountMad || lead.requestedPriceMad || 0,
        coliatyPackageCode: (lead as any).order?.coliatyPackageCode,
        coliatyPackageId: (lead as any).order?.coliatyPackageId,
        statusHistory: summaryOnly ? [] : ((lead as any).order?.statusHistory || []),
        items: (lead as any).order?.items || [],
        lead: {
          id: lead.id,
          createdAt: lead.createdAt,
          paymentSituation: lead.paymentSituation,
          callbackDate: lead.callbackAt,
          notes: lead.notes,
          statusHistory: summaryOnly ? [] : ((lead as any).statusHistory || []),
          requestedPriceMad: lead.requestedPriceMad,
          requestedPriceStatus: lead.requestedPriceStatus,
          source: lead.source,
        }
      }
    }));

    // Counts must use the same where clauses as the queries above, otherwise the
    // reported total describes a different set of rows than the one returned.
    const [totalCommissions, totalLeads] = await Promise.all([
      prisma.influencerCommission.count({ where: commissionWhereClause }),
      prisma.lead.count({ where: leadWhereClause })
    ]);

    // A lead that has been turned into an order can ALSO have a commission row
    // pointing at that same order. Emitting both double-counts the customer in
    // every stat and shows the row twice in the table.
    const leadOrderIds = new Set(
      leads.map(l => (l as any).order?.id).filter((id: number | undefined) => id != null)
    );
    const dedupedCommissions = commissions
      .filter(c => !c.orderId || !leadOrderIds.has(c.orderId))
      .map(c => {
        if (!summaryOnly) return { ...c, referralLink: slimLink((c as any).referralLink) };
        const order: any = (c as any).order;
        return {
          ...c,
          statusChangedAt: newestOf(order?.statusHistory, order?.lead?.statusHistory),
          hasHistory: (order?.statusHistory?.length || 0) + (order?.lead?.statusHistory?.length || 0) > 0,
          order: order
            ? {
                ...order,
                statusHistory: [],
                lead: order.lead
                  ? {
                      ...order.lead,
                      // The row mapper above calls it callbackDate; the raw Lead
                      // column is callbackAt. Ship both names so the two row
                      // shapes read the same.
                      callbackDate: order.lead.callbackAt,
                      statusHistory: [],
                    }
                  : order.lead,
              }
            : order,
        };
      });

    const combined = [...leadCommissions, ...dedupedCommissions].sort((a, b) =>
      new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime()
    );

    // When we fetched everything, the array itself is the exact answer (already deduped).
    const total = fetchAll ? combined.length : totalCommissions + totalLeads;

    // The product cell, thumbnail and pack price used to ride on every row as a
    // nested referralLink — the same few products serialised thousands of times,
    // and the landing page's sitebuilder JSON re-fetched from the DB once per
    // row. Sent once per link instead, keyed by referralLinkId.
    // Only the slim shape needs it: the heavy rows still carry their own link,
    // so building the map there would be a second read of the same landing pages
    // and a second copy on the wire.
    const linkMeta: Record<string, any> = {};
    if (summaryOnly) {
      const linkIds = Array.from(new Set(
        [...leads.map(l => l.referralLinkId), ...commissions.map(c => c.referralLinkId)]
          .filter((id): id is number => id != null)
      ));
      const linkRows = linkIds.length
        ? await prisma.referralLink.findMany({
            where: { id: { in: linkIds } },
            select: CUSTOMER_LIST_LINK_SELECT,
          })
        : [];
      for (const link of linkRows) {
        linkMeta[String(link.id)] = {
          id: link.id,
          code: link.code,
          productId: link.productId,
          product: link.product
            ? {
                id: link.product.id,
                nameFr: link.product.nameFr,
                sku: link.product.sku,
                retailPriceMad: link.product.retailPriceMad,
                imageUrl: (link.product as any).images?.[0]?.imageUrl ?? null,
              }
            : null,
          packOptions: extractPackOptions((link as any).landingPage),
        };
      }
    }

    res.json({
      status: 'success',
      data: {
        commissions: combined,
        ...(summaryOnly ? { linkMeta } : {}),
        pagination: {
          page: fetchAll ? 1 : safePage,
          limit: fetchAll ? combined.length : safeLimit,
          total,
          totalPages: fetchAll ? 1 : Math.ceil(total / safeLimit),
          returned: combined.length,
          // true when the hard cap kicked in and the client is seeing a subset
          truncated: fetchAll && (leads.length >= ALL_HARD_CAP || commissions.length >= ALL_HARD_CAP)
        }
      }
    });
  })
);

/**
 * The full status history behind one row of the customers list, for the history
 * modal. The slim list ships only statusChangedAt/hasHistory per row; the
 * entries with their notes and changer names — unbounded, and a third of the old
 * list payload — load here for the single row the user actually opened.
 *
 * Takes `leadId` or `orderId` because the list has two kinds of row, and an
 * order that was never a lead (an import, an order raised directly) has history
 * of its own with no lead to hang it on. Whichever the caller has, it is
 * authorised against the same two predicates the list selects by: a row it was
 * willing to show must not answer 404 when its History button is clicked.
 */
router.get(
  '/customers/history',
  authenticate,
  authorize('VENDOR', 'INFLUENCER'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { mode } = req.query;

    const leadId = Number(req.query.leadId);
    const orderId = Number(req.query.orderId);
    const hasLead = Number.isInteger(leadId) && leadId > 0;
    const hasOrder = Number.isInteger(orderId) && orderId > 0;
    if (!hasLead && !hasOrder) {
      return res.status(400).json({ status: 'error', message: 'leadId or orderId is required' });
    }

    const leadWhere = await buildCustomerLeadWhere(req, userId, mode);
    const commissionWhere = buildCustomerCommissionWhere(userId, mode);

    // The list admits a row through EITHER half — as a lead it owns, or through
    // a commission on its order — so both are asked here. `AND` rather than a
    // spread: the built clauses carry their own OR/scope keys and merging by
    // key would drop one of them.
    const [visibleLead, visibleCommission] = await Promise.all([
      hasLead
        ? prisma.lead.findFirst({ where: { AND: [{ id: leadId }, leadWhere] }, select: { id: true } })
        : Promise.resolve(null),
      prisma.influencerCommission.findFirst({
        where: { AND: [hasOrder ? { orderId } : { order: { leadId } }, commissionWhere] },
        select: { id: true }
      }),
    ]);

    if (!visibleLead && !visibleCommission) {
      return res.status(404).json({ status: 'error', message: 'Not found' });
    }

    const HISTORY_ENTRY = {
      id: true,
      oldStatus: true,
      newStatus: true,
      notes: true,
      createdAt: true,
    };
    const LEAD_HISTORY = {
      select: {
        ...HISTORY_ENTRY,
        changer: { select: { id: true, profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'asc' as const }
    };
    const ORDER_HISTORY = {
      select: {
        ...HISTORY_ENTRY,
        changedByUser: { select: { id: true, profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'asc' as const }
    };

    // Reached by lead when there is one, by order otherwise; an order-only row
    // still returns its own history rather than an empty timeline.
    const lead = hasLead
      ? await prisma.lead.findUnique({
          where: { id: leadId },
          select: {
            id: true,
            notes: true,
            statusHistory: LEAD_HISTORY,
            order: { select: { statusHistory: ORDER_HISTORY } }
          }
        })
      : null;

    const orderOnly = !lead && hasOrder
      ? await prisma.order.findUnique({
          where: { id: orderId },
          select: {
            statusHistory: ORDER_HISTORY,
            lead: { select: { notes: true, statusHistory: LEAD_HISTORY } }
          }
        })
      : null;

    if (!lead && !orderOnly) {
      return res.status(404).json({ status: 'error', message: 'Not found' });
    }

    res.json({
      status: 'success',
      data: {
        leadHistory: lead?.statusHistory || orderOnly?.lead?.statusHistory || [],
        orderHistory: lead?.order?.statusHistory || orderOnly?.statusHistory || [],
        notes: lead?.notes ?? orderOnly?.lead?.notes ?? null,
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
    await assertLinkInScope(req, linkId);

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
            influencer: {
              select: {
                id: true,
                email: true,
                subdomain: true,
                customDomain: true,
                customDomainStatus: true,
                profile: { select: { fullName: true } }
              }
            },
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
          include: { 
            product: { select: { id: true, nameFr: true, retailPriceMad: true } },
            influencer: {
              select: {
                id: true,
                email: true,
                subdomain: true,
                customDomain: true,
                customDomainStatus: true,
                profile: { select: { fullName: true } }
              }
            }
          }
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
    await assertLinkInScope(req, linkId);
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
    await assertLinkInScope(req, linkId);

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
    await assertLinkInScope(req, linkId);
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
    await assertLinkInScope(req, linkId);
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

    if (link.status === 'SUSPENDED' && !isAdmin) {
      throw new AppException(403, 'Ce lien est bloqué par l\'administration et ne peut pas être réactivé.');
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

    if (status && status !== link.status) {
      try {
        const statusLabels: Record<string, string> = {
          'BUILDING': 'En construction',
          'ACTIVE': 'Actif',
          'INACTIVE': 'Inactif',
          'SUSPENDED': 'Suspendu'
        };
        const label = statusLabels[status] || status;
        const productName = updatedLink.product?.nameFr || updatedLink.product?.nameAr || 'Produit';
        const { createNotification } = await import('../utils/notification.js');
        await createNotification(
          link.influencerId,
          'REFERRAL_LINK_STATUS',
          '🔄 Statut de votre lien mis à jour',
          `Le statut de votre lien de parrainage pour le produit "${productName}" est maintenant : ${label}.`
        );
      } catch (err) {
        console.error('Failed to trigger link status notification:', err);
      }
    }

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
            subdomain: true,
            customDomain: true,
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
