import { prisma } from '../lib/prisma.js';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import xss from 'xss';
import { streamLogToExternalTransport } from '../services/logger.service.js';
import { logImmutableAction } from '../utils/hashChain.js';

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

export const parseCookies = (cookieHeader?: string): Record<string, string> => {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;

  try {
    cookieHeader.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      const key = parts.shift()?.trim();
      if (key) {
        list[key] = decodeURIComponent(parts.join('='));
      }
    });
  } catch {
    // Catch malformed URI components gracefully
  }
  return list;
};

export const logSecurityEvent = async (data: {
  eventType: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  sourceIp: string;
  country?: string;
  endpoint?: string;
  payload?: string;
  action: 'BLOCKED' | 'FLAGGED' | 'ALLOWED';
  userId?: number;
  userEmail?: string;
  details?: string;
}) => {
  try {
    // 1. Log to append-only database table
    await prisma.securityEvent.create({
      data: {
        eventType: data.eventType,
        severity: data.severity,
        sourceIp: data.sourceIp,
        country: data.country || 'Unknown',
        endpoint: data.endpoint || null,
        payload: data.payload || null,
        action: data.action,
        userId: data.userId || null,
        userEmail: data.userEmail || null,
        details: data.details || null,
      }
    });

    // 2. Stream event over WebSocket to active listeners (SOC dashboard)
    try {
      const { io } = await import('../index.js');
      if (io) {
        io.emit('security_event', {
          ...data,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (wsErr) {
      // Ignore WebSocket loading errors during early server startup
    }

    // 3. Log to immutable audit log for critical alerts
    if (data.severity === 'CRITICAL') {
      await logImmutableAction(
        data.userId || null,
        data.userEmail || null,
        `SECURITY_ALERT: ${data.eventType} - ${data.action}`,
        data.sourceIp,
        data.details || null
      );
    }
  } catch (err) {
    console.error('Failed to log security event:', err);
  }
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
  const modelType = extractModelType(req.originalUrl);
  const modelId = extractModelId(req.originalUrl);
  const modelUuid = extractModelUuid(req.originalUrl);
  
  let preFetchState: any = null;
  const modelMapping: Record<string, string> = {
    users: 'user',
    products: 'product',
    orders: 'order',
    leads: 'lead',
    categories: 'category',
    wallets: 'wallet',
    invoices: 'invoice',
    payouts: 'payoutRequest',
    support: 'supportRequest',
    fulfillment: 'supportRequest',
    'bank-accounts': 'userBankAccount',
    announcements: 'announcement',
    settings: 'platformSettings',
  };

  const prismaModelName = modelType ? modelMapping[modelType] : null;

  let whereClause: any = null;
  if (modelId) {
    whereClause = { id: modelId };
  } else if (modelUuid && prismaModelName === 'user') {
    whereClause = { uuid: modelUuid };
  }

  if (req.method !== 'GET' && prismaModelName && whereClause && (prisma as any)[prismaModelName]) {
    try {
      preFetchState = await (prisma as any)[prismaModelName].findUnique({
        where: whereClause
      });
    } catch (err) {
      console.error('Failed to pre-fetch model state:', err);
    }
  }

  res.on('finish', async () => {
    try {
      const duration = Date.now() - startTime;
      const userId = (req as any).user?.id || null;
      const userEmail = (req as any).user?.email || null;

      let postFetchState: any = null;
      if (req.method !== 'GET' && prismaModelName && whereClause && (prisma as any)[prismaModelName] && preFetchState) {
        try {
          postFetchState = await (prisma as any)[prismaModelName].findUnique({
            where: whereClause
          });
        } catch (err) {
          console.error('Failed to post-fetch model state:', err);
        }
      }

      const dbChanges = (req as any).dbChanges || (preFetchState ? {
        before: preFetchState,
        after: postFetchState
      } : null);

      const changesPayload = {
        method: req.method,
        path: req.originalUrl,
        query: req.query,
        body: sensitiveDataMasking(req.body),
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        dbChanges: sensitiveDataMasking(dbChanges),
      };

      const changesString = JSON.stringify(changesPayload, (key, value) => typeof value === 'bigint' ? value.toString() : value);

      await prisma.activityLog.create({
        data: {
          userId,
          action: `${req.method} ${req.originalUrl}`,
          modelType: modelType,
          modelId: modelId || (preFetchState?.id) || null,
          changes: changesString,
        },
      });

      // Write to the Cryptographic Hash Chain Audit Log
      await logImmutableAction(
        userId,
        userEmail,
        `${req.method} ${req.originalUrl}`,
        req.ip || 'unknown',
        changesPayload
      );

      // Stream to secure external logging provider
      await streamLogToExternalTransport({
        userId,
        action: `${req.method} ${req.originalUrl}`,
        modelType: modelType,
        modelId: modelId || (preFetchState?.id) || null,
        changes: changesPayload,
        timestamp: new Date().toISOString(),
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
    'fulfillment', 'bank-accounts',
    'announcements', 'settings', 'campaigns', 'webhooks'
  ];
  for (const model of models) {
    if (path.includes(model)) {
      return model;
    }
  }
  return null;
}

function extractModelUuid(path: string): string | null {
  const match = path.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|\?|$)/i);
  return match ? match[1] : null;
}

function extractModelId(path: string): number | null {
  if (extractModelUuid(path)) {
    return null;
  }
  const match = path.match(/\/(\d+)(?:\/|\?|$)/);
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

  const sanitize = (obj: any, depth = 0): any => {
    if (depth > 10) return obj; // Enforce depth limit to prevent stack overflows
    if (typeof obj === 'string') {
      return xss(obj).trim();
    }
    if (Array.isArray(obj)) {
      return obj.map(item => sanitize(item, depth + 1));
    }
    if (obj && typeof obj === 'object') {
      if (obj instanceof Date) return obj;
      const sanitized: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          sanitized[key] = sanitize(obj[key], depth + 1);
        }
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

export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  const method = req.method.toUpperCase();
  
  // Set XSRF-TOKEN cookie if it is not present on safe requests
  const cookies = parseCookies(req.headers.cookie);
  let xsrfToken = cookies['XSRF-TOKEN'];
  if (!xsrfToken) {
    xsrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('XSRF-TOKEN', xsrfToken, {
      httpOnly: false, // Must be readable by client JS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  // Bypass CSRF checks for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }

  // Bypass CSRF for public webhook and upload routes
  if (req.originalUrl.includes('/webhook') || req.originalUrl.includes('/uploads/')) {
    return next();
  }

  const headerToken = req.headers['x-xsrf-token'] || req.headers['X-XSRF-TOKEN'] || req.headers['x-xsrf-token'.toLowerCase()];
  if (!headerToken || headerToken !== xsrfToken) {
    logSecurityEvent({
      eventType: 'CSRF_VIOLATION',
      severity: 'WARNING',
      sourceIp: req.ip || req.socket.remoteAddress || 'unknown',
      endpoint: req.originalUrl,
      action: 'BLOCKED',
      details: `CSRF Mismatch: header=${headerToken}, cookie=${xsrfToken}`,
    });
    return res.status(403).json({
      status: 'error',
      message: 'Invalid CSRF token',
    });
  }

  next();
};

export const honeypotTrap = async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  await logSecurityEvent({
    eventType: 'RECONNAISSANCE',
    severity: 'CRITICAL',
    sourceIp: ip,
    endpoint: req.originalUrl,
    action: 'BLOCKED',
    details: `Honeypot hit on path: ${req.originalUrl}`,
  });

  // Auto-block the IP
  const settings = await fetchSecuritySettings();
  if (!settings.blockedIPs.includes(ip)) {
    settings.blockedIPs.push(ip);
    await prisma.platformSettings.upsert({
      where: { key: 'security_settings' },
      update: { value: settings as any },
      create: { key: 'security_settings', value: settings as any }
    });
    clearSecurityCache();
  }

  return res.status(403).json({
    status: 'error',
    message: 'Access denied.',
  });
};

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

  if (data instanceof Date) {
    return data;
  }
  
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
    
    // Skip if localhost
    if (
      clientIP === '::1' || 
      clientIP === '127.0.0.1' || 
      clientIP === '::ffff:127.0.0.1' || 
      clientIP.includes('127.0.0.1')
    ) {
      return true;
    }

    // Skip if IP is whitelisted
    if (settings.whitelistedIPs.includes(clientIP)) {
      return true;
    }

    // Skip if request is an admin/helper login attempt
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

    // Skip if request has a bearer token belonging to an admin/helper user
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
    // Fall back to not skipping
  }
  return false;
};

const rateLimitBlockedIPs = new Map<string, number>();

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
    
    rateLimitBlockedIPs.set(clientIP, Date.now() + 10 * 60 * 1000);

    res.status(429).json({
      status: 'error',
      message: "Trop de requêtes. Votre IP a été bloquée pour 10 minutes.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const login2faLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes window
  limit: 5, // Max 5 requests per 5 minutes
  message: {
    status: 'error',
    message: 'Too many 2FA verification attempts. Please try again in 5 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
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

export const getBlockedIPsList = () => {
  const list: { ip: string; blockedUntil: string }[] = [];
  const now = Date.now();
  for (const [ip, blockedUntil] of rateLimitBlockedIPs.entries()) {
    if (blockedUntil > now) {
      list.push({
        ip,
        blockedUntil: new Date(blockedUntil).toISOString()
      });
    }
  }
  return list;
};

export const unblockIP = (ip: string) => {
  return rateLimitBlockedIPs.delete(ip);
};
