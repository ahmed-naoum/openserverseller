import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Add type declarations to use req.user
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: number;
      uuid: string;
      roleId: number;
    };
  }
}

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
      console.log('YouCan Token Exchange Request:', {
        client_id: process.env.YOUCAN_CLIENT_ID,
        redirect_uri: `${process.env.FRONTEND_URL}/dashboard/youcan-callback`,
        grant_type: 'authorization_code'
      });

      // Exchange code for access token via YouCan
      const response = await axios.post(
        process.env.YOUCAN_TOKEN_URL || 'https://seller-area.youcan.shop/oauth/token',
        new URLSearchParams({
          client_id: process.env.YOUCAN_CLIENT_ID || '',
          client_secret: process.env.YOUCAN_CLIENT_SECRET || '',
          grant_type: 'authorization_code',
          redirect_uri: `${process.env.FRONTEND_URL}/dashboard/youcan-callback`,
          code,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
        }
      );

      const data = response.data;

      if (!data.access_token) {
        throw new Error('Failed to retrieve access token');
      }

      // Fetch store info to get the domain
      const storeResponse = await axios.get(`${process.env.YOUCAN_API_URL || 'https://api.youcan.shop'}/me`, {
        headers: {
          Authorization: `Bearer ${data.access_token}`,
          Accept: 'application/json',
        },
      });

      const storeDomain = storeResponse.data?.domain || storeResponse.data?.slug || null;

      // Save token and domain to DB
      await prisma.user.update({
        where: { id: vendorId },
        data: {
          youcanAccessToken: data.access_token,
          youcanStoreDomain: storeDomain,
          youcanSyncActive: true,
        },
      });

      res.json({
        success: true,
        message: 'Successfully connected to YouCan',
      });
    } catch (error: any) {
      console.error('YouCan OAuth Error Details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to authenticate with YouCan',
        error: error.response?.data?.message || error.response?.data?.error || error.message,
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
      select: { youcanAccessToken: true },
    });

    if (!vendor || !vendor.youcanAccessToken) {
       res.status(400).json({ success: false, message: 'YouCan is not connected' });
       return;
    }

    try {
      // Fetch customers from YouCan Store API
      const response = await axios.get(`${process.env.YOUCAN_API_URL || 'https://api.youcan.shop'}/customers`, {
        headers: {
          Authorization: `Bearer ${vendor.youcanAccessToken}`,
          Accept: 'application/json',
        },
      });

      const youcanCustomers = response.data?.data || response.data || [];
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
