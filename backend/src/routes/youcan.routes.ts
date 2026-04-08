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
      console.log('YouCan Token Exchange Payload:', {
        client_id: process.env.YOUCAN_CLIENT_ID,
        client_secret: process.env.YOUCAN_CLIENT_SECRET ? '***' + process.env.YOUCAN_CLIENT_SECRET.slice(-4) : undefined,
        redirect_uri: `${process.env.FRONTEND_URL}/dashboard/youcan-callback`,
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

      // Save token to DB
      await prisma.user.update({
        where: { id: vendorId },
        data: {
          youcanAccessToken: data.access_token,
        },
      });

      res.json({
        success: true,
        message: 'Successfully connected to YouCan',
      });
    } catch (error: any) {
      console.error('YouCan OAuth Error:', error.response?.data || error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to authenticate with YouCan',
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
              status: 'NEW', // Keep unassigned
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

export default router;
