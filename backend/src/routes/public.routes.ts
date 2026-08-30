import { prisma } from '../lib/prisma.js';
import { Router, Request, Response } from 'express';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { optionalAuth } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { validateInfluencerSubdomain } from '../utils/subdomain.js';
import { getClientIp, getClientCountry } from '../utils/clientIp.js';
import { maybeAutoBanForOrders } from '../lib/ipBan.js';
import { getIO } from '../lib/realtime.js';
import { getNotifiableAgentIds } from '../utils/agentScope.js';
import { enqueueSheetPush } from '../services/sheetPush.service.js';
import { clientIp, lookupClientGeo } from '../services/geoIntel.service.js';
import { reportLeadToMetaCapi } from '../services/metaCapi.service.js';

const router = Router();

/**
 * Visitor IP intelligence for landing-page cloaking.
 *
 * Replaces the browser's direct call to ipapi.co, whose free quota ran out on
 * busy days and took every geo rule down with it. Serving this ourselves means
 * country and IP come from the request (no quota at all), the upstream lookup
 * used for ISP/VPN data is cached per address, and the visitor cannot feed the
 * page a spoofed address the way a client-side lookup allowed.
 *
 * Public and unauthenticated by design: landing pages run on vendor custom
 * domains with no session.
 */
const geoRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => clientIp(req) || 'unknown',
  handler: (_req, res) => {
    res.status(429).json({ status: 'error', message: 'Too many lookups.' });
  },
});

router.get(
  '/geo',
  geoRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    // `full=0` skips the upstream provider entirely — country and IP version
    // are answered from the request alone.
    const withEnrichment = req.query.full !== '0';
    const geo = await lookupClientGeo(req, withEnrichment);

    // Short private cache: the same visitor re-checking within a page session
    // must not cost another lookup, but no shared cache may key this by URL.
    res.setHeader('Cache-Control', 'private, max-age=300');

    res.json({
      status: 'success',
      data: {
        ip: geo.ip,
        countryCode: geo.countryCode,
        countryName: geo.countryName,
        org: geo.org,
        asn: geo.asn,
        hostname: geo.hostname,
        vpn: geo.vpn,
        proxy: geo.proxy,
        tor: geo.tor,
        hosting: geo.hosting,
        source: geo.source,
      },
    });
  })
);

router.get(
  '/version',
  asyncHandler(async (_req: Request, res: Response) => {
    let version = '1.0.0';
    try {
      const versionFilePath = path.join(process.cwd(), 'cache_version.json');
      if (fs.existsSync(versionFilePath)) {
        const data = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
        version = data.version || '1.0.0';
      }
    } catch (err) {
      console.error('Error reading cache version:', err);
    }

    res.json({
      status: 'success',
      data: { version },
    });
  })
);

/**
 * Public city list for landing pages and checkout forms.
 *
 * Only deliverable cities are exposed here: a customer picking a city we cannot
 * ship to produces an order nobody can fulfil. Staff-facing screens use
 * /api/cities, which serves the full catalogue including historical localities.
 *
 * The legacy `nameFr` key is kept alongside `name` so landing pages built
 * against the old moroccan_cities shape keep rendering after this switch.
 */
router.get(
  '/cities',
  asyncHandler(async (_req: Request, res: Response) => {
    const rows = await prisma.city.findMany({
      where: { isActive: true, isDeliverable: true },
      orderBy: [{ isMajor: 'desc' }, { name: 'asc' }],
      select: {
        id: true, name: true, slug: true, nameAr: true, region: true,
        latitude: true, longitude: true, isMajor: true,
      },
    });

    res.json({
      status: 'success',
      data: {
        cities: rows.map((c) => ({ ...c, nameFr: c.name })),
      },
    });
  })
);

router.get(
  '/categories',
  asyncHandler(async (_req: Request, res: Response) => {
    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { nameFr: 'asc' },
    });

    res.json({
      status: 'success',
      data: { categories },
    });
  })
);

router.get(
  '/products/featured',
  asyncHandler(async (_req: Request, res: Response) => {
    let products = await prisma.product.findMany({
      where: { 
        isActive: true, 
        status: 'APPROVED',
        showInHomepage: true,
        NOT: { visibility: { has: 'NONE' } }
      },
      include: {
        categories: true,
        images: { orderBy: { sortOrder: 'asc' } },
      },
      take: 12,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      status: 'success',
      data: { products },
    });
  })
);

router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [vendorsCount, productsCount, ordersCount] = await Promise.all([
      prisma.user.count({ where: { role: { name: 'VENDOR' }, isActive: true } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
    ]);

    res.json({
      status: 'success',
      data: {
        stats: {
          vendors: vendorsCount,
          products: productsCount,
          orders: ordersCount,
        },
      },
    });
  })
);

router.get(
  '/marketplace/products',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, category, search, view = 'REGULAR' } = req.query;

    const where: any = {
      isActive: true,
      status: 'APPROVED',
      visibility: { has: view as string }
    };

    if (category) {
      const categorySlugs = (category as string).split(',').map(s => s.trim()).filter(Boolean);
      if (categorySlugs.length > 0) {
        where.categories = {
          some: {
            slug: { in: categorySlugs }
          }
        };
      }
    }

    if (search) {
      where.OR = [
        { nameAr: { contains: search as string } },
        { nameFr: { contains: search as string } },
        { sku: { contains: search as string } },
      ];
    }

    const [products, total, userInventory, userClaims, userRequests] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          categories: true,
          images: { orderBy: { sortOrder: 'asc' } },
          owner: { include: { profile: true } }
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
      req.user ? prisma.productInventory.findMany({
        where: { userId: req.user.id }
      }) : Promise.resolve([]),
      req.user ? prisma.affiliateClaim.findMany({
        where: { 
          userId: req.user.id, 
          status: { in: ['PENDING', 'APPROVED'] },
          userMode: view === 'REGULAR' ? 'SELLER' : 'AFFILIATE'
        }
      }) : Promise.resolve([]),
      req.user ? prisma.supportRequest.findMany({
        where: { userId: req.user.id, status: { in: ['OPEN', 'IN_PROGRESS'] } }
      }) : Promise.resolve([])
    ]);

    const inventoryProductIds = new Set(userInventory.map(i => i.productId));
    const claimProductIds = new Set(userClaims.map(c => c.productId));
    const requestProductIds = new Set((userRequests as any[]).filter(r => r.productId !== null).map(r => r.productId as number));

    res.json({
      status: 'success',
      data: {
        products: products.map(p => ({
          ...p,
          userStatus: {
            isBought: inventoryProductIds.has(p.id),
            isClaimed: claimProductIds.has(p.id),
            isPending: requestProductIds.has(p.id)
          }
        })),
        total,
        page: Number(page),
        limit: Number(limit)
      },
    });
  })
);

router.get(
  '/marketplace/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [regularCount, affiliateCount] = await Promise.all([
      prisma.product.count({ where: { isActive: true, status: 'APPROVED', visibility: { has: 'REGULAR' } } }),
      prisma.product.count({ where: { isActive: true, status: 'APPROVED', visibility: { has: 'AFFILIATE' } } })
    ]);

    res.json({
      status: 'success',
      data: {
        regularProducts: regularCount,
        affiliateProducts: affiliateCount
      }
    });
  })
);

// Advanced rate limiter for orders (max 3 per day per IP + User Agent)
const orderRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 20,
  keyGenerator: (req) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    return `${ip}-${userAgent}`;
  },
  handler: (req, res, next, options) => {
    res.status(429).json({
      status: 'error',
      message: 'Vous avez atteint la limite de commandes pour aujourd\'hui. Veuillez réessayer demain.',
    });
  },
});

/**
 * Sanitisers for the pack fields the compiled landing page now posts alongside
 * the legacy `productVariant` display string.
 *
 * This endpoint is public, unauthenticated and carries no validation schema —
 * just the rate limiter above and a required-fields check. That was tolerable
 * while everything it stored was inert display text, but `packQuantity` is
 * subtracted from Product.stockQuantity when the lead is pushed to delivery, so
 * a hostile POST of 99999 would walk straight into inventory. Hence the clamp.
 *
 * Nothing here throws: a customer is sitting on the form, and a junk pack field
 * must never cost us the lead. Whatever we cannot make sense of becomes NULL,
 * which the readers resolve back to a quantity of 1.
 */
const sanitizeVariantText = (value: unknown, maxLength: number): string | null => {
  // Numbers are tolerated because option ids are sometimes authored as numerics
  // in the builder; anything else (objects, arrays) would only ever stringify
  // into garbage, so it is dropped rather than stored.
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const trimmed = String(value).trim().slice(0, maxLength);
  return trimmed || null;
};

const sanitizePackQuantity = (value: unknown): number | null => {
  // Deliberately strict: a numeric string is rejected rather than parsed, so a
  // client sending the wrong type is caught here instead of silently working.
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return value >= 1 && value <= 99 ? value : null;
};

/**
 * Conversions API companions the checkout runtimes post alongside the lead.
 * All optional, all advisory — they tune the server-side Meta event and touch
 * nothing else, so each one degrades to null rather than ever rejecting an
 * order.
 */
const sanitizeCapiEventId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return /^[A-Za-z0-9._-]{1,100}$/.test(s) ? s : null;
};

const sanitizeFbCookie = (value: unknown): string | null => {
  // The _fbp/_fbc cookie grammar: "fb.<digit>.<timestamp>.<id>". Anything else
  // would lower Meta's match quality rather than raise it.
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return /^fb\.[0-9]\.[0-9]+\.[\x21-\x7e]{1,400}$/.test(s) ? s : null;
};

const sanitizeCapiValue = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value >= 0 && value <= 1_000_000 ? value : null;
};

const sanitizeSourceUrl = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
};

router.post(
  '/leads',
  orderRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { referralCode, fullName, phone, city, address } = req.body;
    // Capped at the same 120 as variantName and as the authenticated edit path.
    // It was the one field here that reached the database entirely unmeasured,
    // which left a 1 MB POST body sitting in a column three screens render.
    const productVariant = sanitizeVariantText(req.body.productVariant, 120);
    const variantOptionId = sanitizeVariantText(req.body.variantOptionId, 64);
    // 120 matches the cap the authenticated edit path enforces in lead.routes.ts.
    const variantName = sanitizeVariantText(req.body.variantName, 120);
    const packQuantity = sanitizePackQuantity(req.body.packQuantity);

    if (!referralCode || !fullName || !phone) {
      throw new AppException(400, 'referralCode, fullName, and phone are required');
    }

    const link = await prisma.referralLink.findUnique({
      where: { code: referralCode },
      include: {
        product: true,
        influencer: { select: { subdomain: true, customDomain: true, autoSendLeadsToCallCenter: true } }
      }
    });

    if (!link || !link.isActive || !link.product.isActive) {
      throw new AppException(404, 'Referral link or product not found or inactive');
    }

    if (!validateInfluencerSubdomain(req, link.influencer?.subdomain, link.influencer?.customDomain)) {
      throw new AppException(404, 'Referral link or product not found or inactive');
    }



    let vendorId = link.product.ownerId;

    // If product has no owner, attribute it to the platform admin
    if (!vendorId) {
      const admin = await prisma.user.findFirst({
        where: { role: { name: 'SUPER_ADMIN' } }
      });
      vendorId = admin?.id || null;
    }

    if (!vendorId) {
      throw new AppException(500, 'Product has no owner (vendor) assigned and no fallback admin found');
    }

    // Network identity of the buyer at the moment they submitted the checkout
    // form. Taken server-side: the landing page also resolves an IP client-side
    // for cloaking, but that only runs when a filter is enabled and is trivially
    // faked, so it is not something to bill or ban on.
    const ipAddress = getClientIp(req);
    const ipCountry = getClientCountry(req, ipAddress);
    const userAgent = (req.headers['user-agent'] || '').toString().slice(0, 500) || null;

    // Create the lead for the vendor
    const lead = await prisma.lead.create({
      data: {
        vendorId,
        referralLinkId: link.id,
        fullName,
        phone,
        city,
        address,
        productVariant,
        ipAddress,
        ipCountry,
        userAgent,
        variantOptionId,
        variantName,
        packQuantity,
        notes: null
      }
    });

    // Auto-ban an address that keeps placing orders. The rate limiter above
    // already refuses the extra orders, but it forgets after 24h and the same
    // person simply comes back; this makes the block stick. Runs after the lead
    // is saved and never throws into the response — the order is already the
    // customer's, and a failure to ban must not lose it.
    try {
      await maybeAutoBanForOrders(ipAddress, lead.id);
    } catch (err) {
      console.error('[AutoBan] check failed:', err);
    }

    // Queue the lead for the seller's own Google Sheet. This is the hottest path
    // in the system — a customer is sitting on the landing-page form — so the
    // enqueue only writes an outbox row and never touches Google; the cron drains
    // it. `enqueueSheetPush` already swallows everything it can throw, and this
    // try/catch is belt-and-braces on top: no failure of this feature may ever
    // cost us a lead capture. Every other hook below follows the same shape.
    try {
      await enqueueSheetPush(lead.id, vendorId, lead.source);
    } catch (err) {
      console.error('[SheetPush] enqueue failed:', err);
    }

    // Server-side Meta conversion event, deduplicated against the browser's fbq
    // call by the event id the page posted. Deliberately NOT awaited: the 201
    // below must not wait on graph.facebook.com, and the reporter swallows its
    // own failures. Pixels without a CAPI token cost one indexed query, after
    // the response is already on the wire.
    if (link.influencerId) {
      const capiValue = sanitizeCapiValue(req.body.value);
      const retailValue = Number(link.product?.retailPriceMad);
      void reportLeadToMetaCapi({
        influencerId: link.influencerId,
        code: link.code,
        leadId: lead.id,
        fullName,
        phone,
        city,
        ipAddress,
        userAgent,
        fbp: sanitizeFbCookie(req.body.fbp),
        fbc: sanitizeFbCookie(req.body.fbc),
        eventId: sanitizeCapiEventId(req.body.capiEventId),
        // The price shown at checkout when the page sent it; the product's
        // retail price otherwise, because a Purchase event without a value is
        // rejected by Meta outright.
        value: capiValue ?? (Number.isFinite(retailValue) ? retailValue : null),
        currency: 'MAD',
        productName: link.product?.nameFr || link.product?.nameAr || null,
        sourceUrl:
          sanitizeSourceUrl(req.body.eventSourceUrl) ||
          sanitizeSourceUrl(req.headers.referer) ||
          `https://${req.headers.host}/r/${encodeURIComponent(link.code)}`,
      });
    }

    // Increment conversions (Ventes) when the lead is successfully created
    await prisma.referralLink.update({
      where: { id: link.id },
      data: { conversions: { increment: 1 } }
    });

    // Auto-forward to the call center if the link owner has that permission.
    // Mirrors the manual "Envoyer au Call Center" action: status → AVAILABLE,
    // status history, and the 2 MAD call-center fee.
    if (link.influencer?.autoSendLeadsToCallCenter && link.influencerId) {
      const ownerId = link.influencerId;
      try {
        await prisma.$transaction(async (tx) => {
          await tx.leadStatusHistory.create({
            data: { leadId: lead.id, oldStatus: lead.status, newStatus: 'AVAILABLE', changedBy: ownerId },
          });
          await tx.lead.update({ where: { id: lead.id }, data: { status: 'AVAILABLE' } });

          let wallet = await tx.wallet.findUnique({ where: { userId: ownerId } });
          if (!wallet) wallet = await tx.wallet.create({ data: { userId: ownerId } });
          const newBalance = wallet.balanceMad - 2;
          await tx.wallet.update({ where: { id: wallet.id }, data: { balanceMad: newBalance } });
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'CALL_CENTER_FEE',
              amountMad: -2,
              balanceAfterMad: newBalance,
              description: `Frais d'envoi automatique au Call Center (Lead #${lead.id})`,
            },
          });
        });

        // Notify assigned call-center agents in real time — skipping any agent
        // whose assignment was narrowed to products other than this one.
        const notifiableAgentIds = await getNotifiableAgentIds(ownerId, link.productId);
        const io = getIO();
        if (io && notifiableAgentIds.length) {
          const payload = {
            id: lead.id, fullName, phone, city, address,
            product: { name: link.product?.nameFr || link.product?.nameAr },
            createdAt: lead.createdAt,
          };
          notifiableAgentIds.forEach((id) => io.to(`user:${id}`).emit('new-available-lead', payload));
        }
      } catch (err) {
        console.error('[AutoCallCenter] Failed to auto-forward lead:', err);
      }
    }

    try {
      const productName = link.product?.nameFr || link.product?.nameAr || 'Produit';
      const { createNotification } = await import('../utils/notification.js');
      await createNotification(
        link.influencerId,
        'NEW_LEAD',
        '🎉 Nouvelle vente (Lead) !',
        `Vous avez reçu un nouveau lead de ${fullName} (${city}) pour le produit "${productName}".`
      );
    } catch (err) {
      console.error('Failed to trigger new lead notification:', err);
    }

    res.status(201).json({
      status: 'success',
      data: { leadId: lead.id }
    });
  })
);

// Rate limiter for contact messages (max 5 messages per 15 minutes per IP + User Agent)
const contactRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    return `${ip}-${userAgent}`;
  },
  handler: (req, res, next, options) => {
    res.status(429).json({
      status: 'error',
      message: 'Trop de messages envoyés. Veuillez réessayer dans quelques minutes.',
    });
  },
});

router.post(
  '/contact',
  contactRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      throw new AppException(400, 'Tous les champs (nom, email, sujet, message) sont obligatoires');
    }

    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    // Create database record
    const contactMessage = await prisma.contactMessage.create({
      data: {
        name,
        email,
        subject,
        message,
        ip,
        userAgent,
      },
    });

    // Send SMTP email
    try {
      const { sendEmail } = await import('../utils/mailer.js');
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'contact@silacod.com';
      
      const emailContent = `
        <h3>Nouveau message de contact reçu</h3>
        <p><b>Nom :</b> ${name}</p>
        <p><b>E-mail :</b> ${email}</p>
        <p><b>Sujet :</b> ${subject}</p>
        <p><b>Message :</b></p>
        <blockquote style="background: #f8f9fa; padding: 15px; border-left: 4px solid #ff5722; margin: 10px 0; font-family: sans-serif;">
          ${message.replace(/\n/g, '<br/>')}
        </blockquote>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"/>
        <p style="font-size: 11px; color: #888; font-family: sans-serif;">
          <b>Adresse IP :</b> ${ip}<br/>
          <b>Navigateur :</b> ${userAgent}
        </p>
      `;

      await sendEmail({
        to: adminEmail,
        subject: `[SILACOD Contact] ${subject}`,
        html: emailContent,
      });
    } catch (mailErr) {
      console.error('Failed to send contact email notification via SMTP:', mailErr);
    }

    res.status(201).json({
      status: 'success',
      data: { contactMessage },
    });
  })
);

// Analytics tracking endpoint for SPA route changes
router.post(
  '/track',
  (req: Request, res: Response) => {
    if (req.body?.status === 404) {
      res.status(404).send();
      return;
    }
    res.status(204).send();
  }
);

router.get(
  '/check-block',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const path = req.query.path as string;
    if (!path) return res.json({ status: 'success', data: { isBlocked: false } });

    const { pageBlocks } = await import('./security.routes.js');
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    
    // Check if there is a matching block for this user UUID
    let isBlocked = false;
    
    if (req.user?.uuid) {
      isBlocked = pageBlocks.has(`${req.user.uuid}-${path}`);
      if (!isBlocked && path !== '*') isBlocked = pageBlocks.has(`${req.user.uuid}-*`);
    }

    // Fallback to IP-based checks
    if (!isBlocked) {
      isBlocked = pageBlocks.has(`${ip}-${path}`);
      if (!isBlocked && path !== '*') isBlocked = pageBlocks.has(`${ip}-*`);
    }

    res.json({
      status: 'success',
      data: { isBlocked }
    });
  })
);

export default router;
