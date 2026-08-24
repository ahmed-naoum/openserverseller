import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient, Prisma } from '@prisma/client';
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

import {
  maskingVendorId,
  maskLockedLeads,
  phoneSearchableLeadFilter,
  LEAD_ROW_MASK,
  ORDER_ROW_MASK,
} from '../lib/leadMasking.js';
import { getLockedLeadIds } from '../services/leadCredits.service.js';

import { recordReferralClick } from '../services/referralClicks.js';
import { validateLandingPageUpdate } from '../validations/landingPage.validation.js';
import { invalidate, compileNow } from '../services/landingCompiler/index.js';
import { mode } from './landing.routes.js';

const router = Router();
const prisma = new PrismaClient();

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

    const dateFilter = linkRange ? { createdAt: linkRange } : {};
    const linkIds = links.map((l) => l.id);

    /**
     * Three grouped reads for the whole list, not three reads per link.
     *
     * Each link used to run its own clicks/leads/earnings trio, and the clicks
     * one was a `findMany` that pulled every matching row's ip and userAgent
     * into Node so a `Set` could size them here. A vendor with a few hundred
     * thousand clicks therefore moved all of them across the socket on every
     * dashboard load — that read alone was ~2.7s — and the query count grew
     * with the number of links.
     *
     * The counting now happens where the rows already are. The clicks query
     * groups by identity for the same reason the traffic route does: a
     * `COUNT(DISTINCT (ip, agent))` has no hash aggregate and degrades into a
     * sort of the whole window. `agent` is COALESCEd before comparison so a
     * null userAgent stays a page view instead of falling out of both counts.
     */
    const clickRows = linkIds.length
      ? await prisma.$queryRaw<
          { lid: number; raw_views: bigint; uniques: bigint; whatsapp: bigint }[]
        >`
          WITH grouped AS MATERIALIZED (
            SELECT
              "referralLinkId" AS lid,
              "ipAddress" AS ip,
              COALESCE("userAgent", 'unknown') AS agent,
              COUNT(*)::bigint AS n
            FROM referral_link_clicks
            WHERE "referralLinkId" IN (${Prisma.join(linkIds)})
            ${linkRange?.gte ? Prisma.sql`AND "createdAt" >= ${linkRange.gte}` : Prisma.empty}
            ${linkRange?.lte ? Prisma.sql`AND "createdAt" <= ${linkRange.lte}` : Prisma.empty}
            GROUP BY 1, 2, 3
          )
          SELECT
            lid,
            COALESCE(SUM(n) FILTER (WHERE agent <> 'whatsapp_click'), 0)::bigint AS raw_views,
            COUNT(*) FILTER (WHERE agent <> 'whatsapp_click')::bigint AS uniques,
            COALESCE(SUM(n) FILTER (WHERE agent = 'whatsapp_click'), 0)::bigint AS whatsapp
          FROM grouped
          GROUP BY lid
        `
      : [];

    const [leadRows, earningRows] = linkIds.length
      ? await Promise.all([
          prisma.lead.groupBy({
            by: ['referralLinkId'],
            where: { referralLinkId: { in: linkIds }, ...dateFilter },
            _count: { _all: true },
          }),
          prisma.influencerCommission.groupBy({
            by: ['referralLinkId'],
            where: { referralLinkId: { in: linkIds }, ...dateFilter },
            _sum: { amount: true },
          }),
        ])
      : [[], []];

    // Indexed by link id so the map below stays a lookup. A link with no clicks,
    // no leads or no commissions simply has no row, and reads as zero.
    const clicksById = new Map(clickRows.map((r) => [Number(r.lid), r]));
    const leadsById = new Map(leadRows.map((r) => [r.referralLinkId, r._count._all]));
    const earningsById = new Map(
      earningRows.map((r) => [r.referralLinkId, r._sum.amount || 0])
    );

    const formattedLinks = links.map((link) => {
      const c = clicksById.get(link.id);
      return {
        ...link,
        clicks: Number(c?.uniques || 0),
        rawClicks: Number(c?.raw_views || 0),
        whatsappClicks: Number(c?.whatsapp || 0),
        conversions: leadsById.get(link.id) || 0,
        earnings: earningsById.get(link.id) || 0,
      };
    });

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

    // Shared with the compiled-HTML route at /r/:code, which records the same
    // visit. One implementation means one dedupe map, so a visitor served the
    // static page whose browser also reaches this endpoint is counted once.
    await recordReferralClick({
      linkId: link.id,
      influencerId: link.influencerId,
      code: link.code,
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] as string | undefined,
    });

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

    // Shared with the compiled-HTML route at /r/:code, which records the same
    // visit. One implementation means one dedupe map, so a visitor served the
    // static page whose browser also reaches this endpoint is counted once.
    await recordReferralClick({
      linkId: link.id,
      influencerId: link.influencerId,
      code: link.code,
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] as string | undefined,
    });

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

    // The clicks table is past half a million rows and a single popular link holds
    // two hundred thousand of them. Pulling every row in the window into Node just
    // to bucket it by day was the largest read on this endpoint by far, so the
    // buckets are built in SQL. `whereBase` is a Prisma filter, so it is resolved
    // to ids first rather than reimplemented in raw SQL.
    const scopedLinkIds = (
      await prisma.referralLink.findMany({ where: whereBase, select: { id: true } })
    ).map(l => l.id);

    // date_trunc buckets on the stored timestamp, which is the same wall clock
    // `getKey` reads off the Date below — both this process and Postgres run UTC.
    const bucketUnit = isHourly ? 'hour' : 'day';

    const [clicks, leads, commissions] = await Promise.all([
      scopedLinkIds.length
        ? prisma.$queryRaw<Array<{
            bucket: Date; rawClicks: bigint; uniqueClicks: bigint; whatsappClicks: bigint;
          }>>`
            SELECT date_trunc(${bucketUnit}, c."createdAt") AS "bucket",
                   COUNT(*) FILTER (WHERE c."userAgent" IS DISTINCT FROM 'whatsapp_click')
                     AS "rawClicks",
                   COUNT(DISTINCT (c."ipAddress", COALESCE(c."userAgent", 'unknown')))
                     FILTER (WHERE c."userAgent" IS DISTINCT FROM 'whatsapp_click')
                     AS "uniqueClicks",
                   COUNT(*) FILTER (WHERE c."userAgent" = 'whatsapp_click')
                     AS "whatsappClicks"
              FROM referral_link_clicks c
             WHERE c."referralLinkId" = ANY(${scopedLinkIds}::int[])
               AND c."createdAt" >= ${dateLimitStart}::timestamp
               AND c."createdAt" <= ${dateLimitEnd}::timestamp
             GROUP BY 1
          `
        : Promise.resolve([]),
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

    const rawClicksByDate: Record<string, number> = {};
    const whatsappClicksByDate: Record<string, number> = {};
    const uniqueClicksByDate: Record<string, number> = {};
    // One row per bucket now, not one per click. COUNT() arrives as bigint.
    (clicks as any[]).forEach((c: any) => {
      const key = getKey(c.bucket);
      rawClicksByDate[key] = Number(c.rawClicks);
      uniqueClicksByDate[key] = Number(c.uniqueClicks);
      whatsappClicksByDate[key] = Number(c.whatsappClicks);
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

    // A lead the seller has not paid for must not be actionable at all. Masking the
    // number alone would not hold: dispatching it to the call centre hands the lead
    // to an agent and surfaces the number again through the resulting order.
    const gateVendorId = maskingVendorId(req);
    if (gateVendorId) {
      const locked = await getLockedLeadIds(gateVendorId, [{ id: lead.id, createdAt: lead.createdAt }]);
      if (locked.has(lead.id)) {
        throw new AppException(
          400,
          'Lead verrouillé : rechargez vos crédits Google Sheets pour afficher le numéro et l\'envoyer au Call Center.'
        );
      }
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

    // The agents' copy above is built and emitted first and keeps the real
    // number — they are the ones who have to call. What goes back to the seller
    // is the same row they would see in their list, so it obeys the same lock.
    await maskLockedLeads(maskingVendorId(req), [updatedLead], LEAD_ROW_MASK);

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

    // Unpaid leads are dropped from the batch before anything else runs — including
    // the duplicate-phone check below, which would otherwise compare numbers the
    // seller is not entitled to see. An all-locked batch is refused outright.
    const gateVendorId = maskingVendorId(req);
    let lockedCount = 0;
    if (gateVendorId) {
      const locked = await getLockedLeadIds(
        gateVendorId,
        leads.map((l) => ({ id: l.id, createdAt: l.createdAt }))
      );
      if (locked.size) {
        lockedCount = locked.size;
        for (let i = leads.length - 1; i >= 0; i--) {
          if (locked.has(leads[i].id)) leads.splice(i, 1);
        }
        if (leads.length === 0) {
          throw new AppException(
            400,
            `${lockedCount} lead(s) verrouillés : rechargez vos crédits Google Sheets pour les envoyer au Call Center.`
          );
        }
      }
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
function buildCustomerCommissionWhere(userId: number, mode: unknown, search?: string, phoneFilter?: any) {
  // A gated seller may not search by a number they are not allowed to read —
  // see phoneSearchableLeadFilter. The filter is about the LEAD, so an order
  // raised without one is admitted as it always was.
  const customerPhoneMatches: any = phoneFilter
    ? {
        AND: [
          { customerPhone: { contains: search, mode: 'insensitive' } },
          { OR: [{ leadId: null }, { lead: phoneFilter }] },
        ]
      }
    : { customerPhone: { contains: search, mode: 'insensitive' } };

  const where: any = {
    order: search ? {
      OR: [
        { customerName: { contains: search, mode: 'insensitive' } },
        customerPhoneMatches,
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

async function buildCustomerLeadWhere(req: Request, userId: number, mode: unknown, search?: string, phoneFilter?: any) {
  // A gated seller may not search by a number they are not allowed to read: the
  // phone half of the search is narrowed to the leads they may read, so it
  // cannot be walked digit by digit into a masked number. Everyone else keeps
  // the plain predicate — see phoneSearchableLeadFilter.
  const phoneMatches: any = phoneFilter
    ? { AND: [{ phone: { contains: search, mode: 'insensitive' } }, phoneFilter] }
    : { phone: { contains: search, mode: 'insensitive' } };

  // The search predicate lives under AND, not OR — every mode branch below assigns
  // `.OR = [...]`, which would otherwise overwrite it and silently return the
  // vendor's whole lead list for any search term.
  const where: any = {
    ...(search ? {
      AND: [{
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          phoneMatches,
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
    // for the whole dataset with `all=true`. A single flat `take` of 5000 silently
    // truncated every account past that point: the TOTAL LEADS counter froze on 5000
    // and the leads beyond it were simply not there. Read the whole set in batches
    // instead. ALL_HARD_CAP is now only an OOM backstop, well above any real account,
    // and `truncated` tells the client when it was actually reached.
    const fetchAll = all === 'true' || all === '1' || (all as any) === true;
    const summaryOnly = summary === 'true' || summary === '1' || (summary as any) === true;
    const ALL_HARD_CAP = 20000;
    const ALL_BATCH_SIZE = 1000;

    // Skip-paging is only stable under a total ordering — bulk-imported leads share a
    // createdAt to the millisecond, so without the id tie-break rows could repeat in
    // one batch and go missing from another.
    const ALL_ORDER_BY = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

    const fetchAllInBatches = async <T>(
      query: (skip: number, take: number) => Promise<T[]>
    ): Promise<T[]> => {
      const rows: T[] = [];
      while (rows.length < ALL_HARD_CAP) {
        const batchSize = Math.min(ALL_BATCH_SIZE, ALL_HARD_CAP - rows.length);
        const batch = await query(rows.length, batchSize);
        rows.push(...batch);
        if (batch.length < batchSize) break;
      }
      return rows;
    };

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 500);

    const skip = fetchAll ? 0 : (safePage - 1) * safeLimit;
    const take = safeLimit;

    // Both halves of this page can hide a phone, so both are built against the
    // same account and the same one lock lookup: `gateVendorId` is null for
    // anyone who must keep seeing real numbers, and then nothing below costs a
    // query. The search guard is only fetched when there is a search to guard.
    const gateVendorId = maskingVendorId(req);
    const phoneFilter = search ? await phoneSearchableLeadFilter(gateVendorId) : null;

    const commissionWhereClause = buildCustomerCommissionWhere(userId, mode, search as string | undefined, phoneFilter);

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

    const commissionQuery = (skipRows: number, takeRows: number) => prisma.influencerCommission.findMany({
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
                    // Who owns the lead decides whose credits gate it: a row for
                    // a product this account only affiliates for is not theirs
                    // to unlock. The heavy branch below gets it from `include`.
                    vendorId: true,
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
      orderBy: ALL_ORDER_BY,
      skip: skipRows,
      take: takeRows
    });

    const commissions = fetchAll
      ? await fetchAllInBatches(commissionQuery)
      : await commissionQuery(skip, take);

    // New Leads (not yet orders).
    const leadWhereClause = await buildCustomerLeadWhere(req, userId, mode, search as string | undefined, phoneFilter);

    const leadQuery = (skipRows: number, takeRows: number) => prisma.lead.findMany({
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
      orderBy: ALL_ORDER_BY,
      skip: skipRows,
      // Was hardcoded to 100, which silently truncated every vendor with more leads
      // than that and made every client-side statistic wrong.
      take: takeRows
    });

    const leads = fetchAll
      ? await fetchAllInBatches(leadQuery)
      : await leadQuery(0, Math.max(safeLimit, 100));

    // The leads list can filter and sort on WHEN a parcel reached a given step
    // (ramassage, expédition, réception, livraison, reportation) rather than on
    // when the row was created or last touched. Those timestamps live in the
    // status histories, and shipping whole histories per row would undo the
    // slim payload — so the newest entry per (row, step) is aggregated in two
    // grouped queries and sent as a small map. Statuses are grouped exactly as
    // MILESTONE_STATUSES in frontend/src/lib/leadStatus.ts: the two must agree
    // or a row filters under a different step than the one it displays.
    const MILESTONE_OF_STATUS: Record<string, string> = {
      POSTPONED: 'POSTPONED', PROGRAMMER: 'POSTPONED', PROGRAMMER_AUTO: 'POSTPONED',
      PICKED_UP: 'PICKUP',
      SENT: 'SHIPPING', SHIPPED: 'SHIPPING',
      RECEIVED: 'RECEPTION',
      DELIVERED: 'DELIVERY',
    };
    const MILESTONE_TRACKED_STATUSES = Object.keys(MILESTONE_OF_STATUS);

    const uniqueIds = (ids: any[]) =>
      Array.from(new Set(ids.filter((id): id is number => typeof id === 'number')));
    const milestoneOrderIds = uniqueIds([
      ...commissions.map(c => c.orderId),
      ...leads.map(l => (l as any).order?.id),
    ]);
    const milestoneLeadIds = uniqueIds([
      ...leads.map(l => l.id),
      ...commissions.map(c => (c as any).order?.lead?.id),
    ]);

    const [orderMilestoneRows, leadMilestoneRows] = await Promise.all([
      milestoneOrderIds.length
        ? prisma.orderStatusHistory.groupBy({
            by: ['orderId', 'newStatus'],
            where: { orderId: { in: milestoneOrderIds }, newStatus: { in: MILESTONE_TRACKED_STATUSES } },
            _max: { createdAt: true },
          })
        : Promise.resolve([] as any[]),
      milestoneLeadIds.length
        ? prisma.leadStatusHistory.groupBy({
            by: ['leadId', 'newStatus'],
            where: { leadId: { in: milestoneLeadIds }, newStatus: { in: MILESTONE_TRACKED_STATUSES } },
            _max: { createdAt: true },
          })
        : Promise.resolve([] as any[]),
    ]);

    const collectMilestones = (rows: any[], idKey: 'orderId' | 'leadId') => {
      const byId = new Map<number, Record<string, Date>>();
      for (const row of rows) {
        const at: Date | null = row._max?.createdAt ?? null;
        const key = MILESTONE_OF_STATUS[row.newStatus];
        if (!at || !key) continue;
        const bucket = byId.get(row[idKey]) || {};
        // Several statuses can map to one step (SENT/SHIPPED); the later wins.
        if (!bucket[key] || at > bucket[key]) bucket[key] = at;
        byId.set(row[idKey], bucket);
      }
      return byId;
    };
    const orderMilestones = collectMilestones(orderMilestoneRows as any[], 'orderId');
    const leadMilestones = collectMilestones(leadMilestoneRows as any[], 'leadId');

    // A row carries an order history and a lead history and the step can be
    // logged in either, so the later of the two wins — the same rule the
    // statusChangedAt scan below uses.
    const milestonesFor = (orderId?: number | null, leadId?: number | null) => {
      const merged: Record<string, Date> = {};
      for (const source of [
        orderId != null ? orderMilestones.get(orderId) : null,
        leadId != null ? leadMilestones.get(leadId) : null,
      ]) {
        if (!source) continue;
        for (const [key, at] of Object.entries(source)) {
          if (!merged[key] || at > merged[key]) merged[key] = at;
        }
      }
      return merged;
    };

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
      milestones: milestonesFor((lead as any).order?.id, lead.id),
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
          // Same field the commission branch selects, for the same reason: the
          // masking pass reads the lead's owner off this object.
          vendorId: lead.vendorId,
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
        const milestones = milestonesFor(c.orderId, (c as any).order?.lead?.id);
        if (!summaryOnly) return { ...c, milestones, referralLink: slimLink((c as any).referralLink) };
        const order: any = (c as any).order;
        return {
          ...c,
          milestones,
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

    // Both row shapes hang their lead off `order.lead` and their number off
    // `order.customerPhone`, so the whole page masks in one pass and one lock
    // lookup. Done here rather than in the two mappers above: a number that is
    // still real anywhere in this handler is a number that can be shipped.
    await maskLockedLeads(gateVendorId, combined as any[], ORDER_ROW_MASK);

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
      // An explicit select, not an include: `include` returns every scalar, which
      // would ship compiledHtml and compiledBrotli — tens of KB per page — back
      // to the builder on every open, for data it never reads.
      select: {
        id: true,
        referralLinkId: true,
        themeColor: true,
        title: true,
        description: true,
        buttonText: true,
        customStructure: true,
        ssgEnabled: true,
        createdAt: true,
        updatedAt: true,
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

    // After the authorisation checks on purpose: someone who may not touch this
    // link should get 403, not a schema error confirming the link exists.
    const problem = validateLandingPageUpdate(req.body);
    if (problem) {
      throw new AppException(400, problem);
    }

    const landingPage = await (prisma as any).referralLinkLandingPage.upsert({
      where: { referralLinkId: linkId },
      update: { themeColor, title, description, buttonText, customStructure },
      create: { referralLinkId: linkId, themeColor, title, description, buttonText, customStructure }
    });

    // The stored HTML now describes the previous version of this page. Clearing
    // compiledAt marks it stale for every process, not just this one; the local
    // memory cache is dropped separately.
    try {
      await (prisma as any).referralLinkCompiledPage.updateMany({
        where: { landingPageId: landingPage.id },
        data: { compiledAt: null, compilerVersion: null }
      });
    } catch (err) {
      console.error('[SSG] failed to mark compiled page stale for link', linkId, err);
    }
    invalidate(link.code);

    // Compile now rather than waiting for the next visitor, so the person who
    // just clicked Sauvegarder finds out whether their page will actually be
    // fast — and which block is holding it back if not. Never allowed to fail
    // the save: the structure is already stored by this point.
    let compile = null;
    try {
      compile = await compileNow(link.code, mode());
    } catch (err) {
      console.error('[SSG] compile-on-save failed for', link.code, err);
    }

    res.json({ ...landingPage, compile });
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
