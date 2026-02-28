import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export interface SecurityConfig {
  enableIPBlocking: boolean;
  enableAuditLog: boolean;
  enableRequestSanitization: boolean;
  blockedIPs: string[];
  whitelistedIPs: string[];
}

const config: SecurityConfig = {
  enableIPBlocking: process.env.SECURITY_ENABLE_IP_BLOCKING === 'true',
  enableAuditLog: process.env.SECURITY_ENABLE_AUDIT_LOG === 'true',
  enableRequestSanitization: process.env.SECURITY_ENABLE_SANITIZATION === 'true',
  blockedIPs: (process.env.SECURITY_BLOCKED_IPS || '').split(',').filter(Boolean),
  whitelistedIPs: (process.env.SECURITY_WHITELISTED_IPS || '').split(',').filter(Boolean),
};

export const ipFilter = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!config.enableIPBlocking) {
    return next();
  }

  const clientIP = req.ip || req.socket.remoteAddress || 'unknown';

  if (config.whitelistedIPs.length > 0) {
    if (config.whitelistedIPs.includes(clientIP)) {
      return next();
    }
    return res.status(403).json({
      status: 'error',
      message: 'Access denied. IP not whitelisted.',
    });
  }

  if (config.blockedIPs.includes(clientIP)) {
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
  if (!config.enableAuditLog) {
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
  const models = ['users', 'products', 'orders', 'leads', 'brands', 'categories', 'wallets'];
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
  if (!config.enableRequestSanitization) {
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
  const sensitiveFields = ['password', 'passwordHash', 'token', 'secret', 'creditCard', 'rib', 'otp'];
  
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
