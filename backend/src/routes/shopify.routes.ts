import { prisma } from '../lib/prisma.js';
import { Router } from 'express';
import axios from 'axios';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/v1/shopify/status
 * Get the current Shopify connection and sync status
 */
router.get(
  '/status',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { 
        shopifyAccessToken: true, 
        shopifySyncActive: true,
        shopifyStoreDomain: true
      },
    });

    res.json({
      success: true,
      data: {
        isConnected: !!vendor?.shopifyAccessToken,
        autoSyncActive: vendor?.shopifySyncActive ?? false,
        storeDomain: vendor?.shopifyStoreDomain || null
      }
    });
  })
);

/**
 * POST /api/v1/shopify/token
 * Exchange OAuth authorization code for Shopify Admin Access Token
 */
router.post(
  '/token',
  authenticate,
  asyncHandler(async (req, res) => {
    const { code, shop } = req.body;
    const vendorId = req.user?.id;

    if (!code || !shop) {
      res.status(400).json({ success: false, message: 'Code et domaine de boutique requis' });
      return;
    }

    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    try {
      const clientId = (process.env.SHOPIFY_CLIENT_ID || process.env.SHOPIFY_API_KEY || '').trim();
      const clientSecret = (process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET || '').trim();

      // Normalize shop domain (e.g. mystore.myshopify.com)
      const cleanShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');

      console.log(`[Shopify OAuth Token Exchange] Exchanging code for shop: ${cleanShop}`);

      const response = await axios.post(
        `https://${cleanShop}/admin/oauth/access_token`,
        {
          client_id: clientId,
          client_secret: clientSecret,
          code,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: 15000,
        }
      );

      const accessToken = response.data?.access_token;

      if (!accessToken) {
        res.status(400).json({
          success: false,
          message: 'Échec de la récupération du jeton d\'accès Shopify.',
        });
        return;
      }

      // Save token and domain to DB
      await prisma.user.update({
        where: { id: vendorId },
        data: {
          shopifyAccessToken: accessToken,
          shopifyStoreDomain: cleanShop,
          shopifySyncActive: true,
        },
      });

      res.json({
        success: true,
        message: 'Boutique Shopify connectée avec succès !',
        data: {
          storeDomain: cleanShop,
        }
      });
    } catch (error: any) {
      const errorData = error.response?.data;
      const errorMessage = typeof errorData === 'object' 
        ? (errorData?.error_description || errorData?.message || errorData?.error || error.message)
        : String(errorData || error.message);

      console.error('Shopify OAuth Error Details:', {
        status: error.response?.status,
        data: errorData,
        message: error.message,
      });

      res.status(400).json({
        success: false,
        message: 'Échec de la connexion Shopify',
        error: errorMessage,
      });
    }
  })
);

/**
 * POST /api/v1/shopify/save-token
 * Manually connect or update Shopify via store domain and Admin API token
 */
router.post(
  '/save-token',
  authenticate,
  asyncHandler(async (req, res) => {
    const { storeDomain, accessToken } = req.body;
    const vendorId = req.user?.id;

    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!storeDomain) {
      res.status(400).json({ success: false, message: 'Le domaine du متجر (store domain) est requis.' });
      return;
    }

    const cleanShop = storeDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');

    await prisma.user.update({
      where: { id: vendorId },
      data: {
        shopifyAccessToken: accessToken || null,
        shopifyStoreDomain: cleanShop,
        shopifySyncActive: true,
      },
    });

    res.json({
      success: true,
      message: 'Intégration Shopify enregistrée avec succès !',
      data: { storeDomain: cleanShop }
    });
  })
);

/**
 * POST /api/v1/shopify/toggle-sync
 * Toggle automatic Shopify synchronization
 */
router.post(
  '/toggle-sync',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    const { active } = req.body;

    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    await prisma.user.update({
      where: { id: vendorId },
      data: { shopifySyncActive: !!active },
    });

    res.json({
      success: true,
      message: `Synchronisation automatique Shopify ${active ? 'activée' : 'désactivée'}`
    });
  })
);

/**
 * GET /api/v1/shopify/orders
 * Fetch live orders directly from Shopify Admin API
 */
router.get(
  '/orders',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { shopifyAccessToken: true, shopifyStoreDomain: true },
    });

    if (!vendor || !vendor.shopifyAccessToken || !vendor.shopifyStoreDomain) {
      res.status(400).json({ success: false, message: 'La boutique Shopify n\'est pas connectée' });
      return;
    }

    try {
      const response = await axios.get(`https://${vendor.shopifyStoreDomain}/admin/api/2024-01/orders.json`, {
        params: { status: 'any', limit: 50, ...req.query },
        headers: {
          'X-Shopify-Access-Token': vendor.shopifyAccessToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 15000,
      });

      res.json({
        success: true,
        data: response.data?.orders || [],
      });
    } catch (error: any) {
      console.error('Shopify Orders API Error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        success: false,
        message: 'Impossible de récupérer les commandes Shopify',
        error: error.response?.data || error.message,
      });
    }
  })
);

/**
 * POST /api/v1/shopify/sync
 * Sync leads from Shopify API directly into database Lead records
 */
router.post(
  '/sync',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { shopifyAccessToken: true, shopifyStoreDomain: true },
    });

    if (!vendor || !vendor.shopifyAccessToken || !vendor.shopifyStoreDomain) {
      res.status(400).json({ success: false, message: 'Boutique Shopify non connectée' });
      return;
    }

    try {
      const response = await axios.get(`https://${vendor.shopifyStoreDomain}/admin/api/2024-01/orders.json`, {
        params: { status: 'any', limit: 50 },
        headers: {
          'X-Shopify-Access-Token': vendor.shopifyAccessToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 15000,
      });

      const orders = response.data?.orders || [];
      let importedCount = 0;

      for (const order of orders) {
        const phoneRaw = order.customer?.phone || order.shipping_address?.phone || order.billing_address?.phone || order.phone || '';
        const phone = phoneRaw.replace(/[^0-9+]/g, '');

        if (!phone) continue;

        const firstName = order.customer?.first_name || order.shipping_address?.first_name || order.billing_address?.first_name || '';
        const lastName = order.customer?.last_name || order.shipping_address?.last_name || order.billing_address?.last_name || '';
        const fullName = [firstName, lastName].filter(Boolean).join(' ') || `Client Shopify #${order.order_number || order.id}`;

        const existingLead = await prisma.lead.findFirst({
          where: {
            vendorId,
            phone,
          },
        });

        if (!existingLead) {
          await prisma.lead.create({
            data: {
              vendorId,
              fullName,
              phone,
              city: order.shipping_address?.city || order.billing_address?.city || 'Non spécifiée',
              address: order.shipping_address?.address1 || order.billing_address?.address1 || null,
              status: 'NEW',
              source: 'SHOPIFY',
              sourceId: order.id.toString(),
              notes: `Commande Shopify #${order.order_number || order.name || order.id} (${order.total_price || 0} ${order.currency || 'MAD'})`,
            },
          });
          importedCount++;
        }
      }

      res.json({
        success: true,
        message: `${importedCount} nouveau(x) prospect(s) Shopify synchronisé(s) avec succès !`,
        count: importedCount,
      });
    } catch (error: any) {
      console.error('Shopify Lead Sync Error:', error.response?.data || error.message);
      res.status(500).json({
        success: false,
        message: 'Échec de la synchronisation des prospects depuis Shopify',
        error: error.response?.data || error.message,
      });
    }
  })
);

/**
 * POST /api/v1/shopify/webhook
 * Public endpoint to receive orders/create webhooks from Shopify
 */
router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const shopDomain = req.headers['x-shopify-shop-domain'] || payload.domain || payload.shop_domain;

    if (!shopDomain) {
      res.status(400).json({ success: false, message: 'Store domain missing' });
      return;
    }

    const cleanShop = (shopDomain as string).replace(/^https?:\/\//, '').replace(/\/$/, '');

    const vendor = await prisma.user.findFirst({
      where: {
        shopifyStoreDomain: cleanShop,
        shopifySyncActive: true,
        shopifyAccessToken: { not: null },
      },
    });

    if (!vendor) {
      res.status(200).json({ success: true, message: 'Ignored: No active connection' });
      return;
    }

    const order = payload;
    const phoneRaw = order.customer?.phone || order.shipping_address?.phone || order.billing_address?.phone || order.phone || '';
    const phone = phoneRaw.replace(/[^0-9+]/g, '');

    if (!phone) {
      res.status(200).json({ success: true, message: 'Ignored: No phone number' });
      return;
    }

    const firstName = order.customer?.first_name || order.shipping_address?.first_name || '';
    const lastName = order.customer?.last_name || order.shipping_address?.last_name || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || `Client Shopify #${order.order_number || order.id}`;

    const existingLead = await prisma.lead.findFirst({
      where: {
        vendorId: vendor.id,
        phone,
      },
    });

    if (!existingLead) {
      await prisma.lead.create({
        data: {
          vendorId: vendor.id,
          fullName,
          phone,
          city: order.shipping_address?.city || 'Non spécifiée',
          address: order.shipping_address?.address1 || null,
          status: 'NEW',
          source: 'SHOPIFY',
          sourceId: order.id?.toString() || null,
          notes: `Commande Webhook Shopify #${order.order_number || order.name || order.id}`,
        },
      });
      console.log(`Lead automatically created for vendor ${vendor.id} from Shopify webhook`);
    }

    res.json({ success: true });
  })
);

export default router;
