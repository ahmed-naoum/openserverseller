import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import prisma from '../lib/prisma';
import axios from 'axios';

const router = Router();

/**
 * GET /api/v1/woocommerce/status
 * Get WooCommerce connection status for current vendor
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
        wooCommerceUrl: true, 
        wooCommerceConsumerKey: true, 
        wooCommerceConsumerSecret: true,
        wooCommerceSyncActive: true 
      },
    });

    const isConnected = !!(vendor?.wooCommerceUrl && vendor?.wooCommerceConsumerKey && vendor?.wooCommerceConsumerSecret);

    res.json({
      success: true,
      data: {
        isConnected,
        storeUrl: vendor?.wooCommerceUrl || null,
        autoSyncActive: vendor?.wooCommerceSyncActive ?? true,
      },
    });
  })
);

/**
 * POST /api/v1/woocommerce/save-keys
 * Connect or update WooCommerce via Store URL, Consumer Key (ck_...), Consumer Secret (cs_...)
 */
router.post(
  '/save-keys',
  authenticate,
  asyncHandler(async (req, res) => {
    const { storeUrl, consumerKey, consumerSecret } = req.body;
    const vendorId = req.user?.id;

    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!storeUrl || !consumerKey || !consumerSecret) {
      res.status(400).json({ success: false, message: 'Tous les champs (URL, Consumer Key, Consumer Secret) sont requis.' });
      return;
    }

    let cleanUrl = storeUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    cleanUrl = cleanUrl.replace(/\/$/, '');

    // Test API call to verify WooCommerce credentials
    try {
      await axios.get(`${cleanUrl}/wp-json/wc/v3/orders`, {
        params: {
          consumer_key: consumerKey.trim(),
          consumer_secret: consumerSecret.trim(),
          per_page: 1,
        },
        timeout: 10000,
      });
    } catch (testError: any) {
      console.warn('WooCommerce Credentials verification warning:', testError.response?.data || testError.message);
      // We will still allow saving if test fails due to SSL/CORS, but log warning
    }

    await prisma.user.update({
      where: { id: vendorId },
      data: {
        wooCommerceUrl: cleanUrl,
        wooCommerceConsumerKey: consumerKey.trim(),
        wooCommerceConsumerSecret: consumerSecret.trim(),
        wooCommerceSyncActive: true,
      },
    });

    res.json({
      success: true,
      message: 'Boutique WooCommerce connectée avec succès !',
      data: {
        storeUrl: cleanUrl,
      },
    });
  })
);

/**
 * POST /api/v1/woocommerce/toggle-sync
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
      data: { wooCommerceSyncActive: !!active },
    });

    res.json({
      success: true,
      message: `Synchronisation automatique WooCommerce ${active ? 'activée' : 'désactivée'}`,
    });
  })
);

/**
 * GET /api/v1/woocommerce/orders
 * Fetch live orders directly from WooCommerce REST API
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
      select: { 
        wooCommerceUrl: true, 
        wooCommerceConsumerKey: true, 
        wooCommerceConsumerSecret: true 
      },
    });

    if (!vendor || !vendor.wooCommerceUrl || !vendor.wooCommerceConsumerKey || !vendor.wooCommerceConsumerSecret) {
      res.status(400).json({ success: false, message: 'La boutique WooCommerce n\'est pas connectée' });
      return;
    }

    try {
      const response = await axios.get(`${vendor.wooCommerceUrl}/wp-json/wc/v3/orders`, {
        params: {
          consumer_key: vendor.wooCommerceConsumerKey,
          consumer_secret: vendor.wooCommerceConsumerSecret,
          per_page: 50,
          ...req.query,
        },
        timeout: 15000,
      });

      res.json({
        success: true,
        data: response.data || [],
      });
    } catch (error: any) {
      console.error('WooCommerce Orders API Error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        success: false,
        message: 'Impossible de récupérer les commandes WooCommerce',
        error: error.response?.data || error.message,
      });
    }
  })
);

/**
 * POST /api/v1/woocommerce/sync
 * Sync leads from WooCommerce API directly into database Lead records
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
      select: { 
        wooCommerceUrl: true, 
        wooCommerceConsumerKey: true, 
        wooCommerceConsumerSecret: true 
      },
    });

    if (!vendor || !vendor.wooCommerceUrl || !vendor.wooCommerceConsumerKey || !vendor.wooCommerceConsumerSecret) {
      res.status(400).json({ success: false, message: 'Boutique WooCommerce non connectée' });
      return;
    }

    try {
      const response = await axios.get(`${vendor.wooCommerceUrl}/wp-json/wc/v3/orders`, {
        params: {
          consumer_key: vendor.wooCommerceConsumerKey,
          consumer_secret: vendor.wooCommerceConsumerSecret,
          per_page: 50,
        },
        timeout: 15000,
      });

      const orders = response.data || [];
      let importedCount = 0;

      for (const order of orders) {
        const phoneRaw = order.billing?.phone || order.shipping?.phone || '';
        const phone = phoneRaw.replace(/[^0-9+]/g, '');

        if (!phone) continue;

        const firstName = order.billing?.first_name || order.shipping?.first_name || '';
        const lastName = order.billing?.last_name || order.shipping?.last_name || '';
        const fullName = [firstName, lastName].filter(Boolean).join(' ') || `Client WooCommerce #${order.number || order.id}`;

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
              city: order.billing?.city || order.shipping?.city || 'Non spécifiée',
              address: order.billing?.address_1 || order.shipping?.address_1 || null,
              status: 'NEW',
              source: 'WOOCOMMERCE',
              sourceId: order.id.toString(),
              notes: `Commande WooCommerce #${order.number || order.id} (${order.total || 0} ${order.currency || 'MAD'})`,
            },
          });
          importedCount++;
        }
      }

      res.json({
        success: true,
        message: `${importedCount} nouveau(x) prospect(s) WooCommerce synchronisé(s) avec succès !`,
        count: importedCount,
      });
    } catch (error: any) {
      console.error('WooCommerce Lead Sync Error:', error.response?.data || error.message);
      res.status(500).json({
        success: false,
        message: 'Échec de la synchronisation des prospects depuis WooCommerce',
        error: error.response?.data || error.message,
      });
    }
  })
);

/**
 * POST /api/v1/woocommerce/webhook
 * Public endpoint to receive order.created webhooks from WooCommerce
 */
router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const storeHeader = req.headers['x-wc-webhook-source'] || req.headers['origin'] || payload.store_url;

    if (!payload || (!payload.id && !payload.number)) {
      res.status(400).json({ success: false, message: 'Payload missing order info' });
      return;
    }

    const vendors = await prisma.user.findMany({
      where: {
        wooCommerceSyncActive: true,
        wooCommerceUrl: { not: null },
      },
    });

    if (vendors.length === 0) {
      res.status(200).json({ success: true, message: 'Ignored: No active WooCommerce connections' });
      return;
    }

    // Try matching vendor by store URL header or payload
    let matchedVendor = vendors[0];
    if (storeHeader) {
      const match = vendors.find(v => v.wooCommerceUrl && String(storeHeader).includes(v.wooCommerceUrl.replace(/^https?:\/\//, '')));
      if (match) matchedVendor = match;
    }

    const order = payload;
    const phoneRaw = order.billing?.phone || order.shipping?.phone || '';
    const phone = phoneRaw.replace(/[^0-9+]/g, '');

    if (!phone) {
      res.status(200).json({ success: true, message: 'Ignored: No phone number in webhook' });
      return;
    }

    const firstName = order.billing?.first_name || order.shipping?.first_name || '';
    const lastName = order.billing?.last_name || order.shipping?.last_name || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || `Client WooCommerce #${order.number || order.id}`;

    const existingLead = await prisma.lead.findFirst({
      where: {
        vendorId: matchedVendor.id,
        phone,
      },
    });

    if (!existingLead) {
      await prisma.lead.create({
        data: {
          vendorId: matchedVendor.id,
          fullName,
          phone,
          city: order.billing?.city || order.shipping?.city || 'Non spécifiée',
          address: order.billing?.address_1 || order.shipping?.address_1 || null,
          status: 'NEW',
          source: 'WOOCOMMERCE',
          sourceId: order.id?.toString() || null,
          notes: `Commande Webhook WooCommerce #${order.number || order.id}`,
        },
      });
      console.log(`Lead created for vendor ${matchedVendor.id} from WooCommerce webhook`);
    }

    res.json({ success: true });
  })
);

export default router;
