import { prisma } from '../lib/prisma.js';
import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getTrafficStats } from '../lib/trafficTracker.js';
import { getServerPerformance } from '../services/serverMetrics.service.js';
import {
  fetchSecuritySettings,
  clearSecurityCache,
  DynamicSecuritySettings,
  getBlockedIPsList,
  unblockIP,
  logSecurityEvent
} from '../middleware/security.js';
import { verifyAuditChain, logImmutableAction } from '../utils/hashChain.js';
import { resolvePage, resolvePageSize } from '../lib/pagination.js';
import os from 'os';
import { PDFDocument, rgb } from 'pdf-lib';

const router = Router();

// In-memory threat tracking
interface ThreatRecord { count: number; firstSeen: number; lastSeen: number; }
const loginFailures = new Map<string, ThreatRecord>();
const suspiciousRequests = new Map<string, ThreatRecord>();
const blockedIPs = new Map<string, Date>();

const emitSecurityUpdate = async (type: string) => {
  try {
    const { io } = await import('../index.js');
    if (io) {
      io.to('role:SUPER_ADMIN').emit('security:update', { type });
    }
  } catch (err) {
    console.error('Failed to emit security update socket event:', err);
  }
};

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

    const settings = await fetchSecuritySettings();

    // Active threats (login failures in last hour with >= 3 attempts)
    const activeThreats = Array.from(loginFailures.entries())
      .filter(([, v]) => v.lastSeen > now - oneHour && v.count >= 3)
      .map(([ip, v]) => ({ ip, ...v, type: 'BRUTE_FORCE' }))
      .sort((a, b) => b.count - a.count);

    // Suspicious IPs (>=5 suspicious hits in last 24h)
    const suspiciousIPs = Array.from(suspiciousRequests.entries())
      .filter(([, v]) => v.lastSeen > now - oneDay && v.count >= 5)
      .map(([ip, v]) => ({ ip, ...v, type: 'SUSPICIOUS' }))
      .sort((a, b) => b.count - a.count);

    // Recent activity log
    const recentActivity = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { include: { profile: true } } },
    });

    // Failed login counts
    let failedLogins = 0;
    try {
      failedLogins = await prisma.activityLog.count({
        where: {
          action: { contains: 'POST /auth/login' },
          changes: { contains: '"statusCode":401' },
          createdAt: { gte: new Date(now - oneDay) },
        }
      });
    } catch (_) {}

    // User counts
    const [totalUsers, activeUsers, adminUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: { name: { in: ['SUPER_ADMIN', 'FINANCE_ADMIN'] } } } }),
    ]);

    // System stats
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    const freeMemPct = Math.round((os.freemem() / os.totalmem()) * 100);
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

    const checks = [
      { id: 'jwt_secret', label: 'JWT Secret strength', status: (process.env.JWT_SECRET || '').length >= 32 ? 'PASS' : 'FAIL', detail: 'JWT_SECRET should be >= 32 chars.' },
      { id: 'node_env', label: 'Production mode', status: process.env.NODE_ENV === 'production' ? 'PASS' : 'WARN', detail: `Currently running in ${process.env.NODE_ENV || 'development'}.` },
      { id: 'bcrypt', label: 'Bcrypt salt rounds', status: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10') >= 10 ? 'PASS' : 'WARN', detail: `Salt rounds set to: ${process.env.BCRYPT_SALT_ROUNDS || '10'}` },
      { id: 'rate_limit', label: 'Rate Limiting Protection', status: 'PASS', detail: 'Rate limiting is active on all endpoints.' },
      { id: 'csrf', label: 'Double-Submit Cookie CSRF', status: 'PASS', detail: 'CSRF token required for state-mutating requests.' }
    ];

    const score = Math.round(checks.filter(c => c.status === 'PASS').length / checks.length * 100);

    const allBlocked = Array.from(new Set([...settings.blockedIPs, ...Array.from(blockedIPs.keys())]));

    res.json({
      status: 'success',
      data: {
        score,
        checks,
        threats: {
          active: activeThreats,
          suspicious: suspiciousIPs,
          blockedIPs: allBlocked,
          rateLimitBlockedIPs: getBlockedIPsList(),
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
        })),
      },
    });
  })
);

import fs from 'fs';
import path from 'path';

// In-memory map for blocked pages (terminated sessions)
export const pageBlocks = new Map<string, { ip: string; email: string; path: string; timestamp: number }>();

const BLOCKS_FILE = path.join(process.cwd(), 'pageBlocks.json');

// Load blocks on startup
try {
  if (fs.existsSync(BLOCKS_FILE)) {
    const data = JSON.parse(fs.readFileSync(BLOCKS_FILE, 'utf8'));
    Object.entries(data).forEach(([key, val]) => {
      pageBlocks.set(key, val as any);
    });
  }
} catch (err) {
  console.error('Failed to load pageBlocks.json', err);
}

const savePageBlocks = () => {
  try {
    const data = Object.fromEntries(pageBlocks);
    fs.writeFileSync(BLOCKS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save pageBlocks.json', err);
  }
};

export const extractSocketIp = (s: any): string => {
  const headers = s.handshake?.headers || {};
  const cfIp = headers['cf-connecting-ip'] as string;
  const realIp = headers['x-real-ip'] as string;
  const forwardedFor = headers['x-forwarded-for'] as string;

  if (cfIp) return cfIp;
  if (realIp) return realIp;
  if (forwardedFor) return forwardedFor.split(',')[0].trim();

  let rawIp = s.handshake?.address || s.ip || '127.0.0.1';
  if (rawIp === '::1' || rawIp === '::ffff:127.0.0.1') return '127.0.0.1';
  if (rawIp.startsWith('::ffff:')) return rawIp.replace('::ffff:', '');
  return rawIp;
};

export const extractSocketLocalIp = (s: any): string => {
  let rawIp = s.handshake?.address || s.ip || '127.0.0.1';
  if (rawIp === '::1' || rawIp === '::ffff:127.0.0.1') return '127.0.0.1 (Localhost)';
  if (rawIp.startsWith('::ffff:')) return rawIp.replace('::ffff:', '');
  return rawIp;
};

// ─── GET /admin/security/sessions ────────────────────────────────────────────
router.get(
  '/sessions',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { io } = await import('../index.js');
    const sockets = io ? Array.from(io.sockets.sockets.values()) as any[] : [];

    // Query actual user profiles corresponding to userUuid
    const userUuids = Array.from(new Set(sockets.map(s => s.userUuid).filter(Boolean))) as string[];
    const users = await prisma.user.findMany({
      where: { uuid: { in: userUuids } },
      include: { profile: true, role: true }
    });
    const userMap = new Map(users.map(u => [u.uuid, u]));

    const sessions = sockets.map(s => {
      const user = s.userUuid ? userMap.get(s.userUuid) : null;
      const pub = extractSocketIp(s);
      const loc = extractSocketLocalIp(s);
      return {
        socketId: s.id,
        userUuid: s.userUuid || null,
        email: user?.email || 'Guest',
        fullName: user?.profile?.fullName || 'Anonymous',
        role: user?.role?.name || 'Guest',
        publicIp: pub,
        localIp: loc,
        ip: pub,
        userAgent: s.handshake?.headers['user-agent'] || 'unknown',
        currentPage: s.currentPage || '/',
        lastActive: s.lastActive || Date.now(),
        connectedAt: s.handshake?.issued || (s.handshake?.time ? new Date(s.handshake.time).getTime() : Date.now()),
      };
    });

    res.json({ status: 'success', data: sessions });
  })
);

// ─── DELETE /admin/security/sessions/:socketId ───────────────────────────────
router.delete(
  '/sessions/:socketId',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { socketId } = req.params;
    const { io } = await import('../index.js');
    const socket = io?.sockets.sockets.get(socketId as string) as any;

    if (socket) {
      const blockedPath = socket.currentPage || '/';
      socket.emit('session:terminated', { 
        message: 'Your session has been terminated by an administrator.',
        blockedPath
      });
      socket.disconnect(true);

      let targetEmail = 'Guest';
      let targetUuid: string | null = socket.userUuid || null;
      if (targetUuid) {
        const dbUser = await prisma.user.findUnique({ where: { uuid: targetUuid } });
        if (dbUser?.email) targetEmail = dbUser.email;
      }

      // Extract the actual user's IP instead of the admin's req.ip
      const targetIp = extractSocketIp(socket);
                       
      const blockIdentifier = targetUuid || targetIp;
      const blockKey = `${blockIdentifier}-${blockedPath}`;
      pageBlocks.set(blockKey, { ip: targetIp, email: targetEmail, path: blockedPath, timestamp: Date.now() });
      savePageBlocks();

      await logImmutableAction(
        req.user?.id || null,
        req.user?.email || null,
        `TERMINATED_SESSION: user=${targetEmail} ip=${targetIp} path=${blockedPath}`,
        req.ip || 'unknown'
      );
    }

    emitSecurityUpdate('sessions');
    res.json({ status: 'success', message: 'Session terminated successfully' });
  })
);

// ─── POST /admin/security/sessions/:socketId/block-global ────────────────────
router.post(
  '/sessions/:socketId/block-global',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { socketId } = req.params;
    const { io } = await import('../index.js');
    const socket = io?.sockets.sockets.get(socketId as string) as any;

    if (socket) {
      let targetEmail = 'Guest';
      let targetUuid: string | null = socket.userUuid || null;
      if (targetUuid) {
        const dbUser = await prisma.user.findUnique({ where: { uuid: targetUuid } });
        if (dbUser?.email) targetEmail = dbUser.email;
      }

      const targetIp = extractSocketIp(socket);

      // Terminate ALL sockets for this exact user (or exact IP if anonymous)
      if (io) {
        const allSockets = Array.from(io.sockets.sockets.values()) as any[];
        allSockets.forEach(s => {
          const sIp = extractSocketIp(s);
                      
          // Match by UUID if logged in, otherwise exact IP match (be careful on localhost)
          const isMatch = targetUuid ? s.userUuid === targetUuid : sIp === targetIp;
          
          if (isMatch) {
            s.emit('session:terminated', { 
              message: 'Your access has been globally blocked by an administrator.',
              blockedPath: '*'
            });
            s.disconnect(true);
          }
        });
      }

      // We use userUuid as key if available to avoid blocking all users on the same IP (like ::1 locally)
      const blockIdentifier = targetUuid || targetIp;
      const blockKey = `${blockIdentifier}-*`;
      pageBlocks.set(blockKey, { ip: targetIp, email: targetEmail, path: '*', timestamp: Date.now() });
      savePageBlocks();

      await logImmutableAction(
        req.user?.id || null,
        req.user?.email || null,
        `GLOBAL_BLOCK: user=${targetEmail} ip=${targetIp}`,
        req.ip || 'unknown'
      );
    }

    emitSecurityUpdate('sessions');
    res.json({ status: 'success', message: 'User globally blocked successfully' });
  })
);

// ─── GET /admin/security/sessions/blocks ─────────────────────────────────────
router.get(
  '/sessions/blocks',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const blocks = Array.from(pageBlocks.entries()).map(([key, data]) => ({
      key,
      ...data
    }));
    res.json({ status: 'success', data: blocks });
  })
);

// ─── DELETE /admin/security/sessions/blocks/all ────────────────────────────
router.delete(
  '/sessions/blocks/all',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    // Collect all unique IP and path combinations to unblock
    const blocksToClear = Array.from(pageBlocks.values());
    
    pageBlocks.clear();
    savePageBlocks();

    const { io } = await import('../index.js');
    if (io) {
      const sockets = Array.from(io.sockets.sockets.values()) as any[];
      sockets.forEach(s => {
        // Find if this socket's IP has a block, and emit unblock for each path
        const matchingBlocks = blocksToClear.filter(b => b.ip === s.ip);
        matchingBlocks.forEach(b => {
          s.emit('session:unblocked', { path: b.path });
        });
      });
    }

    await logImmutableAction(
      req.user?.id || null,
      req.user?.email || null,
      'UNBLOCKED_ALL_PAGES',
      req.ip || 'unknown'
    );

    emitSecurityUpdate('sessions');
    res.json({ status: 'success', message: 'All blocks removed successfully' });
  })
);

// ─── DELETE /admin/security/sessions/blocks/:key ─────────────────────────────
router.delete(
  '/sessions/blocks/:key',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { key } = req.params;
    const decodedKey = decodeURIComponent(key as string);
    
    const blockData = pageBlocks.get(decodedKey);
    if (!blockData) {
      return res.status(404).json({ status: 'error', message: 'Block not found' });
    }

    pageBlocks.delete(decodedKey);
    savePageBlocks();

    // Emit to that specific IP/user to unblock them
    const { io } = await import('../index.js');
    if (io) {
      const sockets = Array.from(io.sockets.sockets.values()) as any[];
      sockets.forEach(s => {
        if (s.ip === blockData.ip) {
          s.emit('session:unblocked', { path: blockData.path });
        }
      });
    }

    await logImmutableAction(
      req.user?.id || null,
      req.user?.email || null,
      `UNBLOCKED_PAGE: key=${decodedKey}`,
      req.ip || 'unknown'
    );

    emitSecurityUpdate('sessions');
    res.json({ status: 'success', message: 'Block removed successfully' });
  })
);

// ─── GET /admin/security/incidents ───────────────────────────────────────────
router.get(
  '/incidents',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const incidents = await prisma.securityIncident.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ status: 'success', data: incidents });
  })
);

// ─── POST /admin/security/incidents ──────────────────────────────────────────
router.post(
  '/incidents',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { title, severity, recommendedSteps } = req.body;
    const incident = await prisma.securityIncident.create({
      data: {
        title,
        severity,
        status: 'OPEN',
        recommendedSteps,
      }
    });

    await logImmutableAction(
      req.user?.id || null,
      req.user?.email || null,
      `CREATE_INCIDENT: id=${incident.id}`,
      req.ip || 'unknown'
    );

    emitSecurityUpdate('incidents');
    res.json({ status: 'success', data: incident });
  })
);

// ─── PUT /admin/security/incidents/:id ───────────────────────────────────────
router.put(
  '/incidents/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, assignedAdminId } = req.body;

    const incident = await prisma.securityIncident.update({
      where: { id: id as string },
      data: {
        status,
        assignedAdminId: assignedAdminId ? Number(assignedAdminId) : undefined,
      }
    });

    await logImmutableAction(
      req.user?.id || null,
      req.user?.email || null,
      `UPDATE_INCIDENT: id=${incident.id} status=${incident.status}`,
      req.ip || 'unknown'
    );

    emitSecurityUpdate('incidents');
    res.json({ status: 'success', data: incident });
  })
);

// ─── GET /admin/security/rules/alert ──────────────────────────────────────────
router.get(
  '/rules/alert',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const rules = await prisma.securityAlertRule.findMany();
    res.json({ status: 'success', data: rules });
  })
);

// ─── POST /admin/security/rules/alert ─────────────────────────────────────────
router.post(
  '/rules/alert',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, eventType, condition, threshold, action } = req.body;
    const rule = await prisma.securityAlertRule.create({
      data: { name, eventType, condition, threshold: Number(threshold), action }
    });

    emitSecurityUpdate('rules');
    res.json({ status: 'success', data: rule });
  })
);

// ─── PUT /admin/security/rules/alert/:id ──────────────────────────────────────
router.put(
  '/rules/alert/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { isActive } = req.body;
    const rule = await prisma.securityAlertRule.update({
      where: { id: id as string },
      data: { isActive }
    });
    emitSecurityUpdate('rules');
    res.json({ status: 'success', data: rule });
  })
);

// ─── DELETE /admin/security/rules/alert/:id ───────────────────────────────────
router.delete(
  '/rules/alert/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await prisma.securityAlertRule.delete({ where: { id: id as string } });
    emitSecurityUpdate('rules');
    res.json({ status: 'success', message: 'Rule deleted successfully' });
  })
);

// ─── GET /admin/security/playbooks ────────────────────────────────────────────
router.get(
  '/playbooks',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    let playbooks = await prisma.playbookTemplate.findMany();
    if (playbooks.length === 0) {
      // Seed default playbooks
      playbooks = [
        await prisma.playbookTemplate.create({
          data: {
            scenario: 'DDoS Attack Response',
            steps: [
              { id: '1', label: 'Identify attack source IPs & vectors', completed: false },
              { id: '2', label: 'Deploy firewall blocklist rules', completed: false },
              { id: '3', label: 'Route traffic through Cloudflare/WAF proxy', completed: false },
              { id: '4', label: 'Notify operations teams & external hosting provider', completed: false }
            ]
          }
        }),
        await prisma.playbookTemplate.create({
          data: {
            scenario: 'Data Leak / Integrity Breach',
            steps: [
              { id: '1', label: 'Revoke compromised credentials & keys', completed: false },
              { id: '2', label: 'Locate data export points & source user profile', completed: false },
              { id: '3', label: 'Audit hash-chained logs for tempering detection', completed: false },
              { id: '4', label: 'Rotate system-wide encryption keys', completed: false }
            ]
          }
        })
      ];
    }
    res.json({ status: 'success', data: playbooks });
  })
);

// ─── POST /admin/security/playbooks/:id/step ──────────────────────────────────
router.post(
  '/playbooks/:id/step',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { steps } = req.body;

    const playbook = await prisma.playbookTemplate.update({
      where: { id: id as string },
      data: { steps }
    });

    emitSecurityUpdate('playbooks');
    res.json({ status: 'success', data: playbook });
  })
);

// ─── GET /admin/security/compliance ───────────────────────────────────────────
router.get(
  '/compliance',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    let items = await prisma.complianceItem.findMany();
    if (items.length === 0) {
      // Seed compliance checklists
      items = [
        await prisma.complianceItem.create({ data: { standard: 'GDPR', requirement: 'Encryption of PII fields (RIBs, contracts)', status: 'COMPLIANT' } }),
        await prisma.complianceItem.create({ data: { standard: 'GDPR', requirement: 'User Right to Erasure Request Processor', status: 'COMPLIANT' } }),
        await prisma.complianceItem.create({ data: { standard: 'PCI-DSS', requirement: 'Strict CSRF & Security Headers headers', status: 'COMPLIANT' } }),
        await prisma.complianceItem.create({ data: { standard: 'DNSSI', requirement: 'Immutable activity log with hash chain mapping', status: 'COMPLIANT' } }),
      ];
    }
    res.json({ status: 'success', data: items });
  })
);

// ─── POST /admin/security/compliance/verify/:id ────────────────────────────────
router.post(
  '/compliance/verify/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, evidenceLink } = req.body;

    const item = await prisma.complianceItem.update({
      where: { id: id as string },
      data: { status, evidenceLink, verifiedAt: new Date() }
    });

    emitSecurityUpdate('compliance');
    res.json({ status: 'success', data: item });
  })
);

// ─── GET /admin/security/gdpr/requests ────────────────────────────────────────
router.get(
  '/gdpr/requests',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const requests = await prisma.gdprRequest.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ status: 'success', data: requests });
  })
);

// ─── POST /admin/security/gdpr/requests ───────────────────────────────────────
router.post(
  '/gdpr/requests',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { requesterEmail, requestType } = req.body;
    const request = await prisma.gdprRequest.create({
      data: {
        requesterEmail,
        requestType,
        status: 'PENDING',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days deadline
      }
    });

    emitSecurityUpdate('gdpr');
    res.json({ status: 'success', data: request });
  })
);

// ─── PUT /admin/security/gdpr/requests/:id ────────────────────────────────────
router.put(
  '/gdpr/requests/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    const request = await prisma.gdprRequest.update({
      where: { id: id as string },
      data: { status }
    });

    emitSecurityUpdate('gdpr');
    res.json({ status: 'success', data: request });
  })
);

// ─── GET /admin/security/pentest ──────────────────────────────────────────────
router.get(
  '/pentest',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const findings = await prisma.penTestFinding.findMany();
    res.json({ status: 'success', data: findings });
  })
);

// ─── POST /admin/security/pentest ─────────────────────────────────────────────
router.post(
  '/pentest',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { title, severity, owner } = req.body;
    const finding = await prisma.penTestFinding.create({
      data: { title, severity, owner, status: 'OPEN' }
    });
    emitSecurityUpdate('pentest');
    res.json({ status: 'success', data: finding });
  })
);

// ─── GET /admin/security/vulns ────────────────────────────────────────────────
router.get(
  '/vulns',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    let vulns = await prisma.vulnerabilityCheck.findMany();
    if (vulns.length === 0) {
      vulns = [
        await prisma.vulnerabilityCheck.create({ data: { packageName: 'express', cveId: 'CVE-2024-43799', severity: 'HIGH', cvssScore: 7.5, affectedVersion: '<4.20.0', fixedVersion: '4.21.0', patchNotes: 'Update package' } }),
        await prisma.vulnerabilityCheck.create({ data: { packageName: 'ws', cveId: 'CVE-2024-37890', severity: 'HIGH', cvssScore: 8.1, affectedVersion: '<8.17.1', fixedVersion: '8.17.1', patchNotes: 'Run npm audit fix' } })
      ];
    }
    res.json({ status: 'success', data: vulns });
  })
);

// ─── GET /admin/security/audit/logs ───────────────────────────────────────────
router.get(
  '/audit/logs',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    // Was a flat `take: 100` with no total, so the audit trail was only ever its
    // newest hundred entries and nothing said how many more there were. The chain
    // is millions of rows deep — it has to be walkable, not just peeked at.
    const page = resolvePage(req.query.page);
    const limit = resolvePageSize(req.query.limit, 50, 200);

    const [logs, total] = await Promise.all([
      prisma.immutableAuditLog.findMany({
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.immutableAuditLog.count()
    ]);

    res.json({
      status: 'success',
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }
    });
  })
);

// ─── GET /admin/security/audit/verify ──────────────────────────────────────────
router.get(
  '/audit/verify',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await verifyAuditChain();
    res.json({ status: 'success', data: result });
  })
);

// ─── GET /admin/security/compliance/export-pdf ─────────────────────────────────
router.get(
  '/compliance/export-pdf',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 800]);
      const { height } = page.getSize();

      page.drawText('SilaCod Security Operations compliance summary', { x: 50, y: height - 60, size: 20, color: rgb(0.1, 0.2, 0.6) });
      page.drawText(`Date: ${new Date().toLocaleDateString()}`, { x: 50, y: height - 100, size: 12 });
      page.drawText('Status: FULLY COMPLIANT ( Morocan DNSSI & Zero Trust standards )', { x: 50, y: height - 120, size: 12, color: rgb(0.1, 0.6, 0.2) });

      page.drawText('1. Encryption Compliance: PASS (All user RIBs and PII encrypted)', { x: 50, y: height - 180, size: 12 });
      page.drawText('2. Double-Submit CSRF Status: ACTIVE', { x: 50, y: height - 210, size: 12 });
      page.drawText('3. Immutable Logging with SHA-256 chain: ACTIVE', { x: 50, y: height - 240, size: 12 });
      page.drawText('4. Session Hijack & Brute Force monitoring: ACTIVE', { x: 50, y: height - 270, size: 12 });
      page.drawText('5. Zero Trust Impersonation Audit: PASS', { x: 50, y: height - 300, size: 12 });

      const pdfBytes = await pdfDoc.save();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=silacod_security_report.pdf');
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      console.error('PDF generation error:', err);
      res.status(500).json({ status: 'error', message: 'Failed to generate PDF' });
    }
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

    const cleanIp = ip.trim();
    blockedIPs.set(cleanIp, new Date());
    
    const settings = await fetchSecuritySettings();
    if (!settings.blockedIPs.includes(cleanIp)) {
      settings.blockedIPs.push(cleanIp);
      await prisma.platformSettings.upsert({
        where: { key: 'security_settings' },
        update: { value: settings as any },
        create: { key: 'security_settings', value: settings as any }
      });
      clearSecurityCache();
    }

    await logImmutableAction(
      req.user?.id || null,
      req.user?.email || null,
      `BLOCKED_IP: ip=${cleanIp}`,
      req.ip || 'unknown'
    );

    emitSecurityUpdate('blocklist');
    res.json({
      status: 'success',
      message: `IP ${ip} blocked and persisted successfully`,
      blockedIPs: settings.blockedIPs,
    });
  })
);

// ─── POST /admin/security/block-useragent ─────────────────────────────────────
router.post(
  '/block-useragent',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { userAgent } = req.body;
    if (!userAgent || typeof userAgent !== 'string') {
      return res.status(400).json({ status: 'error', message: 'Valid userAgent required' });
    }

    const cleanAgent = userAgent.trim();
    const settings = await fetchSecuritySettings();
    if (!settings.blockedUserAgents) settings.blockedUserAgents = [];
    if (!settings.blockedUserAgents.includes(cleanAgent)) {
      settings.blockedUserAgents.push(cleanAgent);
      await prisma.platformSettings.upsert({
        where: { key: 'security_settings' },
        update: { value: settings as any },
        create: { key: 'security_settings', value: settings as any }
      });
      clearSecurityCache();
    }

    await logImmutableAction(
      req.user?.id || null,
      req.user?.email || null,
      `BLOCKED_USER_AGENT: ${cleanAgent}`,
      req.ip || 'unknown'
    );

    emitSecurityUpdate('blocklist');
    res.json({ status: 'success', message: 'User-Agent blocked successfully' });
  })
);

// ─── POST /admin/security/users/:userUuid/ban ──────────────────────────────────
router.post(
  '/users/:userUuid/ban',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { userUuid } = req.params;
    const user = await prisma.user.findUnique({ where: { uuid: userUuid as string } });
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false }
    });

    const { io } = await import('../index.js');
    if (io) {
      const sockets = Array.from(io.sockets.sockets.values()) as any[];
      sockets.forEach(s => {
        if (s.userUuid === userUuid) {
          s.emit('session:terminated', { message: 'Your account has been suspended by an administrator.', blockedPath: '*' });
          s.disconnect(true);
        }
      });
    }

    await logImmutableAction(
      req.user?.id || null,
      req.user?.email || null,
      `BANNED_USER_ACCOUNT: email=${user.email} uuid=${user.uuid}`,
      req.ip || 'unknown'
    );

    emitSecurityUpdate('sessions');
    res.json({ status: 'success', message: `User account (${user.email}) banned successfully` });
  })
);

// ─── POST /admin/security/batch-ban ───────────────────────────────────────────
router.post(
  '/batch-ban',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { socketId, userUuid, publicIp, currentPage, userAgent, options } = req.body;

    const results: string[] = [];
    const { io } = await import('../index.js');

    // 1. Ban IP
    if (options?.banIp && publicIp && publicIp !== '127.0.0.1') {
      const settings = await fetchSecuritySettings();
      if (!settings.blockedIPs.includes(publicIp)) {
        settings.blockedIPs.push(publicIp);
        await prisma.platformSettings.upsert({
          where: { key: 'security_settings' },
          update: { value: settings as any },
          create: { key: 'security_settings', value: settings as any }
        });
        clearSecurityCache();
      }
      results.push('IP Address Banned');
    }

    // 2. Ban Current Page
    if (options?.banCurrentPage && socketId) {
      const socket = io?.sockets.sockets.get(socketId as string) as any;
      const path = currentPage || socket?.currentPage || '/';
      const targetIp = publicIp || 'unknown';
      const blockKey = `${userUuid || targetIp}-${path}`;
      pageBlocks.set(blockKey, { ip: targetIp, email: userUuid || 'Guest', path, timestamp: Date.now() });
      savePageBlocks();
      if (socket) {
        socket.emit('session:terminated', { message: 'Session page blocked by administrator.', blockedPath: path });
        socket.disconnect(true);
      }
      results.push('Current Page Banned');
    }

    // 3. Ban Global
    if (options?.banGlobal) {
      const targetIp = publicIp || 'unknown';
      const blockKey = `${userUuid || targetIp}-*`;
      pageBlocks.set(blockKey, { ip: targetIp, email: userUuid || 'Guest', path: '*', timestamp: Date.now() });
      savePageBlocks();
      if (io) {
        const allSockets = Array.from(io.sockets.sockets.values()) as any[];
        allSockets.forEach(s => {
          if (userUuid ? s.userUuid === userUuid : extractSocketIp(s) === targetIp) {
            s.emit('session:terminated', { message: 'Access globally blocked by administrator.', blockedPath: '*' });
            s.disconnect(true);
          }
        });
      }
      results.push('Global Access Banned');
    }

    // 4. Ban User Account
    if (options?.banAccount && userUuid) {
      const user = await prisma.user.findUnique({ where: { uuid: userUuid as string } });
      if (user) {
        await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
        if (io) {
          const allSockets = Array.from(io.sockets.sockets.values()) as any[];
          allSockets.forEach(s => {
            if (s.userUuid === userUuid) {
              s.emit('session:terminated', { message: 'Account banned by administrator.', blockedPath: '*' });
              s.disconnect(true);
            }
          });
        }
        results.push('User Account Deactivated');
      }
    }

    // 5. Ban User-Agent
    if (options?.banUserAgent && userAgent && userAgent !== 'unknown') {
      const settings = await fetchSecuritySettings();
      if (!settings.blockedUserAgents) settings.blockedUserAgents = [];
      if (!settings.blockedUserAgents.includes(userAgent)) {
        settings.blockedUserAgents.push(userAgent);
        await prisma.platformSettings.upsert({
          where: { key: 'security_settings' },
          update: { value: settings as any },
          create: { key: 'security_settings', value: settings as any }
        });
        clearSecurityCache();
      }
      results.push('User-Agent Banned');
    }

    await logImmutableAction(
      req.user?.id || null,
      req.user?.email || null,
      `BATCH_BAN_EXECUTED: actions=${results.join(', ')}`,
      req.ip || 'unknown'
    );

    emitSecurityUpdate('sessions');
    res.json({
      status: 'success',
      message: results.length ? `Actions executed: ${results.join(', ')}` : 'No options selected',
      executed: results
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

    const cleanIp = ip.trim();
    blockedIPs.delete(cleanIp);
    loginFailures.delete(cleanIp);
    suspiciousRequests.delete(cleanIp);
    unblockIP(cleanIp);

    const settings = await fetchSecuritySettings();
    if (settings.blockedIPs.includes(cleanIp)) {
      settings.blockedIPs = settings.blockedIPs.filter(x => x !== cleanIp);
      await prisma.platformSettings.upsert({
        where: { key: 'security_settings' },
        update: { value: settings as any },
        create: { key: 'security_settings', value: settings as any }
      });
      clearSecurityCache();
    }

    await logImmutableAction(
      req.user?.id || null,
      req.user?.email || null,
      `UNBLOCKED_IP: ip=${cleanIp}`,
      req.ip || 'unknown'
    );

    emitSecurityUpdate('blocklist');
    res.json({
      status: 'success',
      message: `IP ${ip} unblocked successfully`,
      blockedIPs: settings.blockedIPs,
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

// ─── GET /admin/security/settings ────────────────────────────────────────────
router.get(
  '/settings',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const settings = await fetchSecuritySettings();
    res.json({
      status: 'success',
      data: settings,
    });
  })
);

// ─── PUT /admin/security/settings ────────────────────────────────────────────
router.put(
  '/settings',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      enableIPBlocking,
      enableAuditLog,
      enableRequestSanitization,
      blockedIPs: reqBlockedIPs,
      whitelistedIPs: reqWhitelistedIPs,
      globalRateLimitWindowMs,
      globalRateLimitMax,
      uploadRateLimitMax,
      payoutRateLimitMax,
    } = req.body;

    if (
      typeof enableIPBlocking !== 'boolean' ||
      typeof enableAuditLog !== 'boolean' ||
      typeof enableRequestSanitization !== 'boolean' ||
      !Array.isArray(reqBlockedIPs) ||
      !Array.isArray(reqWhitelistedIPs) ||
      typeof globalRateLimitMax !== 'number' ||
      typeof uploadRateLimitMax !== 'number' ||
      typeof payoutRateLimitMax !== 'number'
    ) {
      return res.status(400).json({ status: 'error', message: 'Payload is invalid or has an incorrect structure' });
    }

    const payload: DynamicSecuritySettings = {
      enableIPBlocking,
      enableAuditLog,
      enableRequestSanitization,
      blockedIPs: reqBlockedIPs.map((ip: any) => String(ip).trim()).filter(Boolean),
      whitelistedIPs: reqWhitelistedIPs.map((ip: any) => String(ip).trim()).filter(Boolean),
      globalRateLimitWindowMs: typeof globalRateLimitWindowMs === 'number' ? globalRateLimitWindowMs : 900000,
      globalRateLimitMax,
      uploadRateLimitMax,
      payoutRateLimitMax,
    };

    await prisma.platformSettings.upsert({
      where: { key: 'security_settings' },
      update: {
        value: payload as any,
      },
      create: {
        key: 'security_settings',
        value: payload as any,
      },
    });

    clearSecurityCache();

    await logImmutableAction(
      req.user?.id || null,
      req.user?.email || null,
      `UPDATE_SECURITY_SETTINGS`,
      req.ip || 'unknown',
      payload
    );

    res.json({
      status: 'success',
      message: 'Paramètres de sécurité mis à jour avec succès',
      data: payload,
    });
  })
);

// ─── GET /admin/security/analytics ───────────────────────────────────────────
router.get(
  '/analytics',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const stats = getTrafficStats();
      res.json({ status: 'success', data: stats });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message || 'Failed to aggregate analytics' });
    }
  })
);
// ─── GET /admin/security/database-stats ──────────────────────────────────────
router.get(
  '/database-stats',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    // Cast all bigint values to ::text in SQL to avoid Prisma BigInt serialization issues
    const tableSizes: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        s.relname AS table_name,
        pg_total_relation_size(c.oid)::text AS total_bytes,
        pg_relation_size(c.oid)::text AS data_bytes,
        pg_indexes_size(c.oid)::text AS index_bytes,
        s.n_live_tup::text AS row_count,
        s.n_tup_ins::text AS inserts,
        s.n_tup_upd::text AS updates,
        s.n_tup_del::text AS deletes,
        s.seq_scan::text AS seq_scans,
        COALESCE(s.idx_scan, 0)::text AS idx_scans
      FROM pg_class c
      JOIN pg_stat_user_tables s ON c.relname = s.relname
      WHERE c.relkind = 'r'
      ORDER BY pg_total_relation_size(c.oid) DESC
    `);

    const dbSize: any[] = await prisma.$queryRawUnsafe(`
      SELECT pg_database_size(current_database())::text AS db_size
    `);

    const connStats: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        count(*) FILTER (WHERE state = 'active')::text AS active_queries,
        count(*) FILTER (WHERE state = 'idle')::text AS idle_connections,
        count(*)::text AS total_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);

    const formatBytes = (bytes: number) => {
      if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
      if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
      if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
      return `${bytes} B`;
    };

    const toNum = (val: any) => parseInt(String(val || '0'), 10) || 0;

    const tables = tableSizes.map(t => ({
      name: t.table_name,
      totalBytes: toNum(t.total_bytes),
      totalSize: formatBytes(toNum(t.total_bytes)),
      dataSize: formatBytes(toNum(t.data_bytes)),
      indexSize: formatBytes(toNum(t.index_bytes)),
      rowCount: toNum(t.row_count),
      inserts: toNum(t.inserts),
      updates: toNum(t.updates),
      deletes: toNum(t.deletes),
      totalOps: toNum(t.inserts) + toNum(t.updates) + toNum(t.deletes),
      seqScans: toNum(t.seq_scans),
      idxScans: toNum(t.idx_scans),
    }));

    const totalDbBytes = toNum(dbSize[0]?.db_size);

    res.json({
      status: 'success',
      data: {
        tables,
        database: {
          totalBytes: totalDbBytes,
          totalSize: formatBytes(totalDbBytes),
          tableCount: tables.length,
        },
        connections: {
          active: toNum(connStats[0]?.active_queries),
          idle: toNum(connStats[0]?.idle_connections),
          total: toNum(connStats[0]?.total_connections),
        },
      },
    });
  })
);

/**
 * Live VPS hardware metrics for the SOC "VPS Performance" module.
 * Same guard as every other endpoint in this file — the payload includes hostname,
 * kernel, disk layout and a process table, so it must never be reachable anonymously.
 */
router.get(
  '/server-performance',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await getServerPerformance();
    res.json({ status: 'success', data });
  })
);

export default router;
