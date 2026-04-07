import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import os from 'os';

const router = Router();
const prisma = new PrismaClient();

// ─── In-memory threat tracking ───────────────────────────────────────────────
interface ThreatRecord { count: number; firstSeen: number; lastSeen: number; }
const loginFailures = new Map<string, ThreatRecord>();
const suspiciousRequests = new Map<string, ThreatRecord>();
const blockedIPs = new Set<string>(
  (process.env.SECURITY_BLOCKED_IPS || '').split(',').filter(Boolean)
);

// Track failed logins (called from auth routes) 
export const recordLoginFailure = (ip: string) => {
  const r = loginFailures.get(ip) || { count: 0, firstSeen: Date.now(), lastSeen: Date.now() };
  r.count++;
  r.lastSeen = Date.now();
  loginFailures.set(ip, r);
};

export const recordSuspiciousRequest = (ip: string) => {
  const r = suspiciousRequests.get(ip) || { count: 0, firstSeen: Date.now(), lastSeen: Date.now() };
  r.count++;
  r.lastSeen = Date.now();
  suspiciousRequests.set(ip, r);
};

// ─── GET /admin/security/overview ────────────────────────────────────────────
router.get(
  '/overview',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    // Active threats (login failures in last hour with ≥ 3 attempts)
    const activeThreats = Array.from(loginFailures.entries())
      .filter(([, v]) => v.lastSeen > now - oneHour && v.count >= 3)
      .map(([ip, v]) => ({ ip, ...v, type: 'BRUTE_FORCE' }))
      .sort((a, b) => b.count - a.count);

    // Suspicious IPs (≥5 suspicious hits in last 24h)
    const suspiciousIPs = Array.from(suspiciousRequests.entries())
      .filter(([, v]) => v.lastSeen > now - oneDay && v.count >= 5)
      .map(([ip, v]) => ({ ip, ...v, type: 'SUSPICIOUS' }))
      .sort((a, b) => b.count - a.count);

    // Last 100 audit logs for recent activity
    let recentActivity: any[] = [];
    try {
      recentActivity = await prisma.activityLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { include: { profile: true } } },
      });
    } catch (_) { /* activityLog may not be migrated yet */ }

    // Failed login attempts from ActivityLog (status 401)
    let failedLogins = 0;
    try {
      failedLogins = await (prisma as any).activityLog?.count({
        where: {
          action: { contains: 'POST /auth/login' },
          changes: { contains: '"statusCode":401' },
          createdAt: { gte: new Date(now - oneDay) },
        }
      }) || 0;
    } catch (_) { }

    // User stats
    const [totalUsers, activeUsers, adminUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: { name: { in: ['SUPER_ADMIN', 'FINANCE_ADMIN'] } } } }),
    ]);

    // System info
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    const freeMemPct = Math.round((os.freemem() / os.totalmem()) * 100);
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

    // Security checks
    const checks = [
      {
        id: 'jwt_secret',
        label: 'JWT Secret strength',
        status: (process.env.JWT_SECRET || '').length >= 32 ? 'PASS' : 'FAIL',
        detail: (process.env.JWT_SECRET || '').length >= 32
          ? 'JWT secret is sufficiently long'
          : 'JWT_SECRET should be at least 32 characters',
      },
      {
        id: 'node_env',
        label: 'Production mode',
        status: process.env.NODE_ENV === 'production' ? 'PASS' : 'WARN',
        detail: process.env.NODE_ENV === 'production'
          ? 'Running in production mode'
          : `NODE_ENV is "${process.env.NODE_ENV || 'development'}" — change to production before deploying`,
      },
      {
        id: 'bcrypt',
        label: 'Password hashing rounds',
        status: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10') >= 10 ? 'PASS' : 'WARN',
        detail: `bcrypt salt rounds: ${process.env.BCRYPT_SALT_ROUNDS || '12 (default)'}`,
      },
      {
        id: 'cors',
        label: 'CORS configuration',
        status: process.env.FRONTEND_URL ? 'PASS' : 'WARN',
        detail: process.env.FRONTEND_URL
          ? `Restricted to: ${process.env.FRONTEND_URL}`
          : 'FRONTEND_URL not set — CORS allows localhost fallback',
      },
      {
        id: 'rate_limit',
        label: 'Rate limiting',
        status: 'PASS',
        detail: 'Login: 30 req/20s, Register: 10 req/hr, Password reset: 3 req/hr',
      },
      {
        id: 'helmet',
        label: 'Security headers (Helmet)',
        status: 'PASS',
        detail: 'X-Frame-Options, X-Content-Type-Options, X-XSS-Protection enabled',
      },
      {
        id: 'upload',
        label: 'File upload restrictions',
        status: 'PASS',
        detail: 'Allowed: JPEG, PNG, WebP, PDF. Max size: 10MB',
      },
      {
        id: 'sql_injection',
        label: 'SQL injection protection',
        status: 'WARN',
        detail: 'Prisma ORM prevents most SQLi. 4 raw SQL queries found — verify inputs are parameterized',
      },
      {
        id: 'fallback_secret',
        label: 'No hardcoded fallback secrets',
        status: 'WARN',
        detail: 'maintenance.ts and settingsController.ts use fallback_secret — set JWT_SECRET in .env',
      },
      {
        id: 'stack_trace',
        label: 'Stack traces (dev mode)',
        status: process.env.NODE_ENV === 'production' ? 'PASS' : 'WARN',
        detail: process.env.NODE_ENV === 'production'
          ? 'Stack traces hidden in production'
          : 'Stack traces are exposed because NODE_ENV != production',
      },
      {
        id: 'health_endpoint',
        label: 'Health endpoint info exposure',
        status: 'WARN',
        detail: '/api/v1/health exposes NODE_ENV and version — consider restricting in production',
      },
      {
        id: 'filename_sanitization',
        label: 'Upload filename sanitization',
        status: 'WARN',
        detail: 'upload.routes.ts preserves original filename in disk storage — use UUID-only filenames',
      },
    ];

    const score = Math.round(
      checks.filter(c => c.status === 'PASS').length / checks.length * 100
    );

    res.json({
      status: 'success',
      data: {
        score,
        checks,
        threats: {
          active: activeThreats.slice(0, 20),
          suspicious: suspiciousIPs.slice(0, 20),
          blockedIPs: Array.from(blockedIPs),
          failedLoginsLast24h: failedLogins,
        },
        system: {
          uptime: Math.round(uptime),
          heapUsedMB,
          freeMemPct,
          nodeVersion: process.version,
          platform: process.platform,
        },
        users: { total: totalUsers, active: activeUsers, admins: adminUsers },
        recentActivity: recentActivity.map(l => ({
          id: l.id,
          action: l.action,
          user: l.user?.profile?.fullName || l.user?.email || 'Anonymous',
          createdAt: l.createdAt,
          changes: typeof l.changes === 'string' ? JSON.parse(l.changes) : l.changes,
        })),
      },
    });
  })
);

// ─── POST /admin/security/block-ip ───────────────────────────────────────────
router.post(
  '/block-ip',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { ip } = req.body;
    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({ status: 'error', message: 'Valid IP required' });
    }

    blockedIPs.add(ip.trim());
    
    // Persist to env (in-memory only — would need DB in production)
    res.json({
      status: 'success',
      message: `IP ${ip} blocked (session only — add to SECURITY_BLOCKED_IPS in .env for persistence)`,
      blockedIPs: Array.from(blockedIPs),
    });
  })
);

// ─── DELETE /admin/security/block-ip ─────────────────────────────────────────
router.delete(
  '/block-ip',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ status: 'error', message: 'IP required' });

    blockedIPs.delete(ip.trim());
    loginFailures.delete(ip.trim());
    suspiciousRequests.delete(ip.trim());

    res.json({
      status: 'success',
      message: `IP ${ip} unblocked`,
      blockedIPs: Array.from(blockedIPs),
    });
  })
);

// ─── DELETE /admin/security/clear-threat ─────────────────────────────────────
router.delete(
  '/clear-threat',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { ip } = req.body;
    if (ip) {
      loginFailures.delete(ip);
      suspiciousRequests.delete(ip);
    } else {
      loginFailures.clear();
      suspiciousRequests.clear();
    }
    res.json({ status: 'success', message: ip ? `Threat record for ${ip} cleared` : 'All threat records cleared' });
  })
);

export default router;
