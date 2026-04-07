import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { fetchMaintenanceSettings, clearMaintenanceCache } from '../middleware/maintenance.js';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Public: GET /api/v1/settings/maintenance
export const getMaintenanceStatus = async (req: Request, res: Response) => {
  try {
    const settings = await fetchMaintenanceSettings();
    return res.json({
      status: 'success',
      data: { enabled: settings.enabled }
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch settings' });
  }
};

// Public: POST /api/v1/settings/maintenance/verify
export const verifyMaintenanceBypass = async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    const settings = await fetchMaintenanceSettings();
    
    // Check if password matches
    if (password === settings.secret) {
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
      }
      
      // Create a JWT token specifically for bypass
      const token = jwt.sign(
        { maintenanceBypass: true },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      
      return res.json({
        status: 'success',
        data: { token }
      });
    }
    
    return res.status(401).json({
      status: 'error',
      message: 'Mot de passe incorrect'
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Failed to verify password' });
  }
};

// Admin: PUT /api/v1/settings/maintenance
export const updateMaintenanceMode = async (req: Request, res: Response) => {
  try {
    const { enabled, secret } = req.body;

    if (typeof enabled !== 'boolean' || typeof secret !== 'string') {
        return res.status(400).json({ status: 'error', message: 'Invalid payload' });
    }
    
    await prisma.platformSettings.upsert({
      where: { key: 'maintenance_mode' },
      update: {
        value: { enabled, secret }
      },
      create: {
        key: 'maintenance_mode',
        value: { enabled, secret }
      }
    });

    clearMaintenanceCache();

    return res.json({
      status: 'success',
      message: 'Paramètres de maintenance mis à jour'
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Failed to update settings' });
  }
};

// Admin: GET /api/v1/settings/maintenance/admin
export const getMaintenanceAdminSettings = async (req: Request, res: Response) => {
  try {
    const settings = await fetchMaintenanceSettings();
    return res.json({
      status: 'success',
      data: settings
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch settings' });
  }
};
