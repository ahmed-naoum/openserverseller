import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

const prisma = new PrismaClient();

export interface DynamicSecuritySettings {
  enableIPBlocking: boolean;
  enableAuditLog: boolean;
  enableRequestSanitization: boolean;
  blockedIPs: string[];
  whitelistedIPs: string[];
  globalRateLimitWindowMs: number;
  globalRateLimitMax: number;
  uploadRateLimitMax: number;
  payoutRateLimitMax: number;
}

// In-memory cache for security settings
let securityCache: DynamicSecuritySettings | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL = 30000; // 30 seconds

export const fetchSecuritySettings = async (): Promise<DynamicSecuritySettings> => {
  const now = Date.now();
  if (securityCache && cacheExpiresAt > now) {
    return securityCache;
  }

  // Default values from environment or defaults
  const defaultSettings: DynamicSecuritySettings = {
    enableIPBlocking: process.env.SECURITY_ENABLE_IP_BLOCKING === 'true',
    enableAuditLog: process.env.SECURITY_ENABLE_AUDIT_LOG === 'true',
    enableRequestSanitization: process.env.SECURITY_ENABLE_SANITIZATION === 'true',
    blockedIPs: (process.env.SECURITY_BLOCKED_IPS || '').split(',').filter(Boolean),
    whitelistedIPs: (process.env.SECURITY_WHITELISTED_IPS || '').split(',').filter(Boolean),
    globalRateLimitWindowMs: 900000, // 15 min
    globalRateLimitMax: 100,
    uploadRateLimitMax: 10,
    payoutRateLimitMax: 5
  };

  try {
    const setting = await prisma.platformSettings.findUnique({
      where: { key: 'security_settings' }
    });

    if (setting && setting.value) {
      const data = setting.value as Partial<DynamicSecuritySettings>;
      securityCache = {
        enableIPBlocking: typeof data.enableIPBlocking === 'boolean' ? data.enableIPBlocking : defaultSettings.enableIPBlocking,
        enableAuditLog: typeof data.enableAuditLog === 'boolean' ? data.enableAuditLog : defaultSettings.enableAuditLog,
        enableRequestSanitization: typeof data.enableRequestSanitization === 'boolean' ? data.enableRequestSanitization : defaultSettings.enableRequestSanitization,
        blockedIPs: Array.isArray(data.blockedIPs) ? data.blockedIPs.map(ip => ip.trim()) : defaultSettings.blockedIPs,
        whitelistedIPs: Array.isArray(data.whitelistedIPs) ? data.whitelistedIPs.map(ip => ip.trim()) : defaultSettings.whitelistedIPs,
        globalRateLimitWindowMs: typeof data.globalRateLimitWindowMs === 'number' ? data.globalRateLimitWindowMs : defaultSettings.globalRateLimitWindowMs,
        globalRateLimitMax: typeof data.globalRateLimitMax === 'number' ? data.globalRateLimitMax : defaultSettings.globalRateLimitMax,
        uploadRateLimitMax: typeof data.uploadRateLimitMax === 'number' ? data.uploadRateLimitMax : defaultSettings.uploadRateLimitMax,
        payoutRateLimitMax: typeof data.payoutRateLimitMax === 'number' ? data.payoutRateLimitMax : defaultSettings.payoutRateLimitMax,
      };
      cacheExpiresAt = now + CACHE_TTL;
      return securityCache;
    }
  } catch (error) {
    console.error('Error fetching security settings:', error);
  }

  // Use defaults if settings record doesn't exist yet
  securityCache = defaultSettings;
  cacheExpiresAt = now + CACHE_TTL;
  return securityCache;
};

export const clearSecurityCache = () => {
  securityCache = null;
  cacheExpiresAt = 0;
};

export const ipFilter = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const settings = await fetchSecuritySettings();
  
  if (!settings.enableIPBlocking) {
    return next();
  }

  const clientIP = req.ip || req.socket.remoteAddress || 'unknown';

  // Check whitelist first
  if (settings.whitelistedIPs.length > 0) {
    if (settings.whitelistedIPs.includes(clientIP)) {
      return next();
    }
    return res.status(403).json({
      status: 'error',
      message: 'Access denied. IP not whitelisted.',
    });
  }

  // Check blacklist
  if (settings.blockedIPs.includes(clientIP)) {
    return res.status(403).json({
      status: 'error',
      message: 'Access denied. Your IP has been blocked.',
    });
  }

  next();
};

export const auditLog = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const settings = await fetchSecuritySettings();
  
  if (!settings.enableAuditLog) {
    return next();
  }

  const startTime = Date.now();

  res.on('finish', async () => {
    try {
      const duration = Date.now() - startTime;
      const userId = (req as any).user?.id || null;

      await prisma.activityLog.create({
        data: {
          userId,
          action: `${req.method} ${req.path}`,
          modelType: extractModelType(req.path),
          modelId: extractModelId(req.path),
          changes: JSON.stringify({
            method: req.method,
            path: req.path,
            query: req.query,
            body: sensitiveDataMasking(req.body),
            statusCode: res.statusCode,
            duration,
            ip: req.ip,
            userAgent: req.get('user-agent'),
          }),
        },
      });
    } catch (error) {
      console.error('Audit log error:', error);
    }
  });

  next();
};

function extractModelType(path: string): string | null {
  const models = [
    'users', 'products', 'orders', 'leads', 'categories', 
    'wallets', 'backups', 'invoices', 'payouts', 'support',
    'announcements', 'settings', 'campaigns'
  ];
  for (const model of models) {
    if (path.includes(model)) {
      return model;
    }
  }
  return null;
}

function extractModelId(path: string): number | null {
  const match = path.match(/\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export const sanitizeInput = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const settings = await fetchSecuritySettings();
  
  if (!settings.enableRequestSanitization) {
    return next();
  }

  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query) as any;
  }
  if (req.params) {
    req.params = sanitize(req.params) as any;
  }

  next();
};

function sanitizeString(str: string): string {
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/data:/gi, '')
    .trim();
}

export const generateCSRFToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const verifyCSRFToken = (token: string, secret: string): boolean => {
  const expected = crypto.createHash('sha256').update(secret).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
};

export const securityHeaders = (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
};

export const validateRequestSize = (maxSize: number = 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('content-length') || '0', 10);
    if (contentLength > maxSize) {
      res.status(413).json({
        status: 'error',
        message: 'Request body too large',
      });
      return;
    }
    next();
  };
};

export const sensitiveDataMasking = (data: any): any => {
  const sensitiveFields = [
    'password', 'passwordhash', 'token', 'secret', 
    'creditcard', 'rib', 'otp', 'bankname', 
    'ribaccount', 'icenumber', 'bank_name', 'bank'
  ];
  
  if (typeof data === 'string') {
    return sensitiveFields.some(field => data.toLowerCase().includes(field)) 
      ? '***REDACTED***' 
      : data;
  }
  
  if (Array.isArray(data)) {
    return data.map(sensitiveDataMasking);
  }
  
  if (data && typeof data === 'object') {
    const masked: any = {};
    for (const key in data) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        masked[key] = '***REDACTED***';
      } else {
        masked[key] = sensitiveDataMasking(data[key]);
      }
    }
    return masked;
  }
  
  return data;
};

// ─── Dynamic Rate Limiters ───────────────────────────────────────────────

const shouldSkipRateLimit = async (req: Request): Promise<boolean> => {
  try {
    const settings = await fetchSecuritySettings();
    const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
    
    // 1. Skip if IP is whitelisted
    if (settings.whitelistedIPs.includes(clientIP)) {
      return true;
    }

    // 2. Skip if request is an admin/helper login attempt
    if (req.path && req.path.includes('/auth/login')) {
      const { email, phone } = req.body || {};
      if (email || phone) {
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              email ? { email } : null,
              phone ? { phone } : null,
            ].filter(Boolean) as any
          },
          include: { role: true }
        });
        if (user && ['SUPER_ADMIN', 'FINANCE_ADMIN', 'HELPER'].includes(user.role.name)) {
          return true;
        }
      }
    }

    // 3. Skip if request has a bearer token belonging to an admin/helper user
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      if (decoded && decoded.userId) {
        const user = await prisma.user.findUnique({
          where: { uuid: decoded.userId },
          include: { role: true }
        });
        if (user && ['SUPER_ADMIN', 'FINANCE_ADMIN', 'HELPER'].includes(user.role.name)) {
          return true;
        }
      }
    }
  } catch (err) {
    // If verification or DB query fails, fall back to not skipping
  }
  return false;
};

const rateLimitBlockedIPs = new Map<string, number>();

// Helper to check and prune blocked IPs
const isIPRateLimitBlocked = (ip: string): boolean => {
  const blockedUntil = rateLimitBlockedIPs.get(ip);
  if (!blockedUntil) return false;
  if (Date.now() > blockedUntil) {
    rateLimitBlockedIPs.delete(ip); // Prune expired block
    return false;
  }
  return true;
};

// Middleware to immediately block rate-limited IPs (while respecting admin bypass)
export const rateLimitCheckMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const clientIP = req.ip || req.socket.remoteAddress || 'unknown';

  if (isIPRateLimitBlocked(clientIP)) {
    // Admins and helpers are completely exempted from rate limits and blocks
    const skip = await shouldSkipRateLimit(req);
    if (skip) {
      return next();
    }

    return res.status(429).json({
      status: 'error',
      message: "Votre IP est temporairement bloquée pour 10 minutes en raison d'un nombre excessif de requêtes.",
    });
  }

  next();
};

export const globalRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  limit: 100, // Max 100 requests per minute
  skip: shouldSkipRateLimit,
  handler: (req: Request, res: Response) => {
    const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
    
    // Block IP for 10 minutes (10 * 60 * 1000 ms)
    rateLimitBlockedIPs.set(clientIP, Date.now() + 10 * 60 * 1000);

    res.status(429).json({
      status: 'error',
      message: "Trop de requêtes. Votre IP a été bloquée pour 10 minutes.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: async (req: Request) => {
    const settings = await fetchSecuritySettings();
    return settings.uploadRateLimitMax;
  },
  skip: shouldSkipRateLimit,
  message: {
    status: 'error',
    message: 'Too many upload requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const payoutRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: async (req: Request) => {
    const settings = await fetchSecuritySettings();
    return settings.payoutRateLimitMax;
  },
  skip: shouldSkipRateLimit,
  message: {
    status: 'error',
    message: 'Too many payout requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
