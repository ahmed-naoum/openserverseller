import { prisma } from '../lib/prisma.js';
import { Router, Request, Response } from 'express';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { optionalAuth } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { validateInfluencerSubdomain } from '../utils/subdomain.js';

const router = Router();

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

router.get(
  '/cities',
  asyncHandler(async (_req: Request, res: Response) => {
    const cities = await prisma.moroccanCity.findMany({
      orderBy: [{ isMajor: 'desc' }, { nameFr: 'asc' }],
    });

    res.json({
      status: 'success',
      data: { cities },
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

router.post(
  '/leads',
  orderRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { referralCode, fullName, phone, city, address, productVariant } = req.body;

    if (!referralCode || !fullName || !phone) {
      throw new AppException(400, 'referralCode, fullName, and phone are required');
    }

    const link = await prisma.referralLink.findUnique({
      where: { code: referralCode },
      include: { 
        product: true,
        influencer: { select: { subdomain: true, customDomain: true } }
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
        notes: null
      }
    });

    // Increment conversions (Ventes) when the lead is successfully created
    await prisma.referralLink.update({
      where: { id: link.id },
      data: { conversions: { increment: 1 } }
    });

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
