import { prisma } from '../lib/prisma.js';
import { Router } from 'express';
import axios from 'axios';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/v1/youcan/token
 * Exchange OAuth code for an access token
 */
router.post(
  '/token',
  authenticate,
  asyncHandler(async (req, res) => {
    const { code } = req.body;
    const vendorId = req.user?.id;

    if (!code) {
      res.status(400).json({ success: false, message: 'Authorization code is required' });
      return;
    }

    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    try {
      const clientId = (process.env.YOUCAN_CLIENT_ID || '').trim();
      const clientSecret = (process.env.YOUCAN_CLIENT_SECRET || '').trim();
      const origin = req.headers.origin || process.env.FRONTEND_URL || 'https://silacod.com';
      const redirectUri = `${origin.replace(/\/$/, '')}/dashboard/youcan-callback`;
      const tokenEndpoint = process.env.YOUCAN_TOKEN_URL || 'https://api.youcan.shop/oauth/token';

      console.log(`[YouCan Token Exchange] Exchanging code via ${tokenEndpoint} | redirect_uri: ${redirectUri}`);

      const bodyParams = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      });

      const response = await axios.post(tokenEndpoint, bodyParams, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        timeout: 15000,
      });

      const data = response.data;

      if (!data || !data.access_token) {
        res.status(400).json({
          success: false,
          message: 'Échec de la récupération du jeton d\'accès YouCan.',
        });
        return;
      }

      // Fetch store info (non-fatal if /me fails)
      let storeDomain: string | null = null;
      try {
        const storeResponse = await axios.get(`${process.env.YOUCAN_API_URL || 'https://api.youcan.shop'}/me`, {
          headers: {
            Authorization: `Bearer ${data.access_token}`,
            Accept: 'application/json',
          },
        });
        storeDomain = storeResponse.data?.domain || storeResponse.data?.slug || null;
      } catch (storeErr: any) {
        console.warn('[YouCan OAuth] Non-fatal /me fetch error:', storeErr.message);
      }

      // Save token and domain to DB
      const currentVendor = await prisma.user.findUnique({
        where: { id: vendorId },
        select: { youcanConnectedAt: true },
      });

      await prisma.user.update({
        where: { id: vendorId },
        data: {
          youcanAccessToken: data.access_token,
          youcanStoreDomain: storeDomain,
          youcanSyncActive: true,
          youcanConnectedAt: currentVendor?.youcanConnectedAt || new Date(),
        },
      });

      res.json({
        success: true,
        message: 'Boutique YouCan connectée avec succès !',
      });
    } catch (error: any) {
      const errorData = error.response?.data;
      const errorMessage = typeof errorData === 'object' 
        ? (errorData?.error_description || errorData?.message || errorData?.error || error.message)
        : String(errorData || error.message);

      console.error('YouCan OAuth Error Details:', {
        status: error.response?.status,
        data: errorData,
        message: error.message,
      });

      res.status(400).json({
        success: false,
        message: 'Échec de l\'authentification YouCan',
        error: errorMessage,
      });
    }
  })
);

/**
 * GET /api/v1/youcan/orders
 * Fetch live orders with customer information from YouCan API (filtered by youcanConnectedAt)
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
      select: { youcanAccessToken: true, youcanStoreDomain: true, youcanConnectedAt: true },
    });

    if (!vendor || !vendor.youcanAccessToken) {
      res.status(400).json({ success: false, message: 'YouCan store is not connected' });
      return;
    }

    let connectedAt = vendor.youcanConnectedAt;
    if (!connectedAt) {
      connectedAt = new Date();
      await prisma.user.update({
        where: { id: vendorId },
        data: { youcanConnectedAt: connectedAt },
      });
    }

    try {
      const response = await axios.get(`${process.env.YOUCAN_API_URL || 'https://api.youcan.shop'}/orders`, {
        params: {
          include: 'customer',
          ...req.query
        },
        headers: {
          Authorization: `Bearer ${vendor.youcanAccessToken}`,
          Accept: 'application/json',
        },
        timeout: 15000,
      });

      const rawOrders = response.data?.data || response.data || [];
      const orders = Array.isArray(rawOrders) ? rawOrders.filter((o: any) => new Date(o.created_at || o.createdAt) >= connectedAt) : [];

      res.json({
        success: true,
        data: orders,
        meta: response.data?.meta || null,
      });
    } catch (error: any) {
      console.error('YouCan Orders API Error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        success: false,
        message: 'Failed to fetch orders from YouCan API',
        error: error.response?.data || error.message,
      });
    }
  })
);

/**
 * GET /api/v1/youcan/customers
 * Fetch customers directly from YouCan API
 */
router.get(
  '/customers',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { youcanAccessToken: true },
    });

    if (!vendor || !vendor.youcanAccessToken) {
      res.status(400).json({ success: false, message: 'YouCan store is not connected' });
      return;
    }

    try {
      const response = await axios.get(`${process.env.YOUCAN_API_URL || 'https://api.youcan.shop'}/customers`, {
        params: req.query,
        headers: {
          Authorization: `Bearer ${vendor.youcanAccessToken}`,
          Accept: 'application/json',
        },
        timeout: 15000,
      });

      res.json({
        success: true,
        data: response.data?.data || response.data || [],
        meta: response.data?.meta || null,
      });
    } catch (error: any) {
      console.error('YouCan Customers API Error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        success: false,
        message: 'Failed to fetch customers from YouCan API',
        error: error.response?.data || error.message,
      });
    }
  })
);

/**
 * POST /api/v1/youcan/sync
 * Sync leads from YouCan API using saved access token
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
      select: { youcanAccessToken: true, youcanConnectedAt: true },
    });

    if (!vendor || !vendor.youcanAccessToken) {
       res.status(400).json({ success: false, message: 'YouCan is not connected' });
       return;
    }

    let connectedAt = vendor.youcanConnectedAt;
    if (!connectedAt) {
      connectedAt = new Date();
      await prisma.user.update({
        where: { id: vendorId },
        data: { youcanConnectedAt: connectedAt },
      });
    }

    try {
      // Fetch customers from YouCan Store API
      const response = await axios.get(`${process.env.YOUCAN_API_URL || 'https://api.youcan.shop'}/customers`, {
        headers: {
          Authorization: `Bearer ${vendor.youcanAccessToken}`,
          Accept: 'application/json',
        },
      });

      const rawCustomers = response.data?.data || response.data || [];
      const youcanCustomers = Array.isArray(rawCustomers) 
        ? rawCustomers.filter((c: any) => new Date(c.created_at || c.createdAt) >= connectedAt) 
        : [];

      if (!Array.isArray(youcanCustomers)) {
         res.status(500).json({ success: false, message: 'Invalid response format from YouCan API' });
         return;
      }

      let importedCount = 0;

      // Import each customer into Silacod Leads
      for (const customer of youcanCustomers) {
        if (!customer.phone) continue; // Skip leads without phone as it is required

        // Create the lead
        // Assume customer has: id, first_name, last_name, phone, external_id, address, city
        const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'YouCan Customer';
        const formattedPhone = customer.phone.replace(/[^0-9]/g, '');

        if (!formattedPhone) continue;

        // Check if lead already exists based on phone for this vendor
        const existingLead = await prisma.lead.findFirst({
          where: {
            vendorId,
            phone: formattedPhone,
          },
        });

        if (!existingLead) {
          await prisma.lead.create({
            data: {
              vendorId,
              fullName,
              phone: formattedPhone,
              city: customer.city || 'Non spécifiée',
              address: customer.address?.address1 || null,
              status: 'NEW',
              source: 'YOUCAN',
              sourceId: customer.id?.toString() || null,
              notes: 'Imported from YouCan API',
            },
          });
          importedCount++;
        }
      }

      res.json({
        success: true,
        message: `Successfully synchronized ${importedCount} new leads from YouCan`,
        data: { importedCount },
      });
    } catch (error: any) {
      console.error('YouCan Sync Error:', error.response?.data || error.message);
      
      // Handle expiring or revoked tokens
      if (error.response?.status === 401) {
        await prisma.user.update({
          where: { id: vendorId },
          data: { youcanAccessToken: null },
        });
        res.status(401).json({
          success: false,
          message: 'YouCan token expired or revoked. Please reconnect.',
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to synchronize leads from YouCan',
        error: error.response?.data || error.message,
      });
    }
  })
);

/**
 * GET /api/v1/youcan/status
 * Get the current YouCan connection and sync status
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
        youcanAccessToken: true, 
        youcanSyncActive: true,
        youcanStoreDomain: true
      },
    });

    res.json({
      success: true,
      data: {
        isConnected: !!vendor?.youcanAccessToken,
        autoSyncActive: vendor?.youcanSyncActive ?? false,
        storeDomain: vendor?.youcanStoreDomain || null
      }
    });
  })
);

/**
 * POST /api/v1/youcan/toggle-sync
 * Toggle the automatic YouCan synchronization
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
      data: { youcanSyncActive: !!active },
    });

    res.json({
      success: true,
      message: `Synchronisation automatique ${active ? 'activée' : 'désactivée'}`
    });
  })
);

/**
 * POST /api/v1/youcan/disconnect
 * Disconnect YouCan integration for vendor
 */
router.post(
  '/disconnect',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    await prisma.user.update({
      where: { id: vendorId },
      data: {
        youcanAccessToken: null,
        youcanStoreDomain: null,
        youcanSyncActive: false,
        youcanConnectedAt: null,
      },
    });

    res.json({
      success: true,
      message: 'Intégration YouCan déconnectée avec succès',
    });
  })
);

/**
 * POST /api/v1/youcan/webhook
 * Public endpoint to receive webhooks from YouCan
 * Note: In production, verify signature if YouCan provides one.
 */
router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const storeDomain = req.headers['x-youcan-store-domain'] || payload.domain || payload.store_domain;

    if (!storeDomain) {
      console.warn('YouCan Webhook received without store domain');
      res.status(400).json({ success: false, message: 'Store domain missing' });
      return;
    }

    // Find vendor by store domain
    const vendor = await prisma.user.findFirst({
      where: { 
        youcanStoreDomain: storeDomain as string,
        youcanSyncActive: true,
        youcanAccessToken: { not: null }
      }
    });

    if (!vendor) {
      console.warn(`No active vendor found for store: ${storeDomain}`);
      res.status(200).json({ success: true, message: 'Ignored: No active connection' });
      return;
    }

    // Process customer/lead data
    // Payload might be customer.created or order.created
    const customer = payload.customer || payload;
    const phone = customer.phone?.replace(/[^0-9]/g, '');

    if (!phone) {
      res.status(200).json({ success: true, message: 'Ignored: No phone number' });
      return;
    }

    const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'YouCan Webhook Customer';

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
          city: customer.city || 'Non spécifiée',
          address: (customer.address?.address1 || customer.address) || null,
          status: 'NEW',
          source: 'YOUCAN',
          sourceId: customer.id?.toString() || null,
          notes: 'Automatically imported via YouCan Webhook',
        },
      });
      console.log(`Lead automatically created for vendor ${vendor.id} from YouCan`);
    }

    res.json({ success: true });
  })
);

export default router;
