import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// In-memory cache for performance
let maintenanceCache: { enabled: boolean; secret: string; expiresAt: number } | null = null;
const CACHE_TTL = 30000; // 30 seconds

export const fetchMaintenanceSettings = async () => {
  const now = Date.now();
  if (maintenanceCache && maintenanceCache.expiresAt > now) {
    return maintenanceCache;
  }

  try {
    const setting = await prisma.platformSettings.findUnique({
      where: { key: 'maintenance_mode' }
    });
    
    if (setting && setting.value) {
      const data = setting.value as { enabled: boolean; secret: string };
      maintenanceCache = {
        enabled: data.enabled || false,
        secret: data.secret || 'silacod-admin',
        expiresAt: now + CACHE_TTL
      };
      return maintenanceCache;
    }
  } catch (error) {
    console.error('Error fetching maintenance settings:', error);
  }

  // Default if not set
  return { enabled: false, secret: 'silacod-admin' };
};

export const clearMaintenanceCache = () => {
  maintenanceCache = null;
};

export const maintenanceMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // Always allow preflight and exempt paths
  if (req.method === 'OPTIONS') {
    return next();
  }

  const path = req.path;
  const API_PREFIX = process.env.API_PREFIX || '/api/v1';
  const exemptPrefixes = [
    `${API_PREFIX}/settings/maintenance`, // always allow: status check + bypass verify
  ];
  
  // NOTE: req.path is relative to where middleware is mounted. 
  // If mounted at /api/v1, req.path is e.g. /settings/maintenance.
  if (exemptPrefixes.some(prefix => path.startsWith(prefix))) {
    return next();
  }

  const settings = await fetchMaintenanceSettings();
  
  if (!settings.enabled) {
    return next();
  }

  // Maintenance is enabled. Check for bypass token.
  const bypassToken = req.headers['x-maintenance-bypass'] as string;
  
  if (bypassToken) {
    try {
      if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET missing');
      const decoded = jwt.verify(bypassToken, process.env.JWT_SECRET) as { maintenanceBypass?: boolean };
      if (decoded && decoded.maintenanceBypass) {
        return next();
      }
    } catch (e) {
      // Invalid token, ignore and continue to throw 503
    }
  }

  // Reject Request
  return res.status(503).json({
    status: 'error',
    message: 'Site is currently under maintenance.',
    maintenance: true
  });
};
