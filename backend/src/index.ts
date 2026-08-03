import { prisma } from './lib/prisma.js';
import * as dotenv from 'dotenv';
dotenv.config({ override: true });

// Enable BigInt serialization to JSON
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import path from 'path';

import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { setupPassport } from './config/passport.js';
import { securityHeaders, ipFilter, sanitizeInput, validateRequestSize, globalRateLimiter, rateLimitCheckMiddleware } from './middleware/security.js';
import { maintenanceMiddleware } from './middleware/maintenance.js';
import { startLeadsReassignmentCron } from './jobs/leadReassignment.js';
import { seedTrafficData } from './lib/trafficTracker.js';
import zlib from 'zlib';
import { startSessionCleanupCron } from './jobs/sessionCleanup.js';
import { setIO } from './lib/realtime.js';
import { isSessionRecordingEnabled } from './lib/sessionRecording.js';

// ── Real-time session streaming state ────────────────────────────────────────
// One buffer per *socket* (per browser tab), NOT per logical user. Streaming two
// different documents into one rrweb Replayer corrupts playback, so we key by
// socket.id and never mix tabs.
interface SessionBuffer {
  userUuid?: string;
  ip: string;
  userAgent?: string;
  path: string;
  startTime: number;
  events: any[];
  hasLead: boolean;
  capped: boolean;
}

// Hard caps so a long-lived tab can never OOM the server.
const MAX_EVENTS_PER_SESSION = 6000; // ~a few MB raw; truncated beyond this
const MIN_EVENTS_TO_SAVE = 6;
const MIN_DURATION_TO_SAVE_SEC = 3;

const activeSessionBuffers = new Map<string, SessionBuffer>();
// targetSocketId -> set of admin socket ids currently watching it.
const streamWatchers = new Map<string, Set<string>>();

// Live checkout progress per socket, so the admin's visitor list can show a
// "phone entered" badge in real time. Persisted separately in CheckoutAttempt.
interface CheckoutState {
  fullName?: string; phone?: string; city?: string; address?: string;
  filled: number; completed: boolean; code?: string;
}
const checkoutState = new Map<string, CheckoutState>();

// Live sign-up progress per socket (/register funnel). Same sticky-capture idea as
// checkoutState, but for the "I'm a Seller" / "I'm an Influencer" registration.
interface SignupState {
  role?: string; fullName?: string; email?: string; phone?: string;
  maxStep: number; filled: number; completed: boolean;
}
const signupState = new Map<string, SignupState>();

// Return only the events needed to bootstrap a Replayer: from the last Meta(4)+
// FullSnapshot(2) onward. Sending the whole history would replay stale DOM.
const eventsFromLastSnapshot = (events: any[]): any[] => {
  let snapIdx = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === 2) { snapIdx = i; break; }
  }
  if (snapIdx < 0) return [];
  let start = snapIdx;
  if (start > 0 && events[start - 1]?.type === 4) start -= 1; // include preceding Meta
  return events.slice(start);
};

const app = express();
app.set('trust proxy', true);
const server = createServer(app);
const PORT = parseInt(process.env.PORT || '3001', 10);
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:3001',
];

const checkOrigin = (origin: string | undefined, callback: (err: Error | null, origin?: any) => void) => {
  if (!origin) {
    callback(null, true);
    return;
  }

  if (allowedOrigins.includes(origin)) {
    callback(null, origin);
    return;
  }

  // Support local development subdomains on localhost (e.g., http://seller.localhost:5173)
  try {
    const parsedOrigin = new URL(origin);
    const hostname = parsedOrigin.hostname;
    if ((hostname === 'localhost' || hostname.endsWith('.localhost')) && parsedOrigin.port === '5173') {
      callback(null, origin);
      return;
    }
  } catch (e) {
    // Ignore URL parsing errors
  }

  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    try {
      const parsedFrontend = new URL(frontendUrl);
      const parsedOrigin = new URL(origin);
      
      const frontendHost = parsedFrontend.hostname.replace(/^www\./, '');
      const originHost = parsedOrigin.hostname.replace(/^www\./, '');
      
      if (originHost === frontendHost || originHost.endsWith('.' + frontendHost)) {
        callback(null, origin);
        return;
      }
    } catch (e) {
      // Ignore URL parsing errors
    }
  }

  callback(null, false);
};

const io = new SocketServer(server, {
  path: `${API_PREFIX}/socket.io`,
  cors: {
    origin: checkOrigin,
    credentials: true,
  },
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: checkOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-maintenance-bypass',
    'x-client-device-type', 'x-client-js', 'x-client-screen', 'x-client-window',
    'x-client-cookies', 'x-client-platform', 'x-client-browser-version'
  ],
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));
app.use(requestLogger);

app.use(securityHeaders);
app.use((req, res, next) => {
  const url = req.originalUrl || req.url || '';
  const sensitivePatterns = [
    '/.env', 
    '/wp-admin', 
    '/phpmyadmin', 
    '/.git', 
    '/.config', 
    '/composer.json', 
    '/package.json'
  ];
  if (sensitivePatterns.some(pattern => url.toLowerCase().includes(pattern))) {
    return res.status(403).json({
      status: 'error',
      message: 'Access denied. Restricted resource.'
    });
  }
  next();
});
app.use((req, res, next) => {
  res.header('Accept-CH', 'Sec-CH-UA-Platform-Version');
  next();
});
app.use(ipFilter);
app.use(sanitizeInput);
app.use(validateRequestSize(5 * 1024 * 1024));

app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
}, express.static(path.join(process.cwd(), 'uploads')));

setupPassport();

app.use(maintenanceMiddleware);

app.use(`${API_PREFIX}`, rateLimitCheckMiddleware, globalRateLimiter, routes);

app.use(notFoundHandler);
app.use(errorHandler);

const broadcastActiveUsersCount = async (io: any) => {
  const sockets = Array.from(io.sockets.sockets.values()) as any[];
  
  const userUuids = Array.from(new Set(sockets.map(s => s.userUuid).filter(Boolean))) as string[];
  
  let usersInfo: any[] = [];
  if (userUuids.length > 0) {
    try {
      usersInfo = await prisma.user.findMany({
        where: { uuid: { in: userUuids } },
        include: { 
          role: true,
          profile: true
        }
      });
    } catch (err) {
      console.error('Failed to fetch user profiles for active tracking:', err);
    }
  }

  const groupedUsers: Record<string, {
    key: string;
    type: 'AUTHENTICATED' | 'ANONYMOUS';
    userUuid?: string;
    email?: string | null;
    phone?: string | null;
    fullName?: string | null;
    avatarUrl?: string | null;
    role?: string;
    ip: string;
    userAgent: string;
    tabsCount: number;
    pages: { path: string; count: number }[];
    // Individual live sockets (tabs) behind this identity. The admin watches ONE
    // of these socketIds — never the logical key — to avoid interleaved streams.
    sessions: { socketId: string; path: string; lastActive: number; checkout?: CheckoutState | null }[];
    lastActive: number;
  }> = {};

  sockets.forEach((s) => {
    const rawIp = s.handshake.headers['cf-connecting-ip'] ||
                  s.handshake.headers['x-real-ip'] ||
                  s.handshake.headers['x-forwarded-for']?.split(',')[0].trim() ||
                  s.handshake.address ||
                  '127.0.0.1';
    const ip = (rawIp === '::1' || rawIp === '::ffff:127.0.0.1') ? '127.0.0.1' : rawIp.replace(/^::ffff:/, '');
    const userAgent = s.handshake.headers['user-agent'] || 'unknown';
    const deviceKey = `${ip}::${userAgent}`;
    const page = s.currentPage || '/';
    const groupKey = s.userUuid || deviceKey;

    if (!groupedUsers[groupKey]) {
      if (s.userUuid) {
        const dbUser = usersInfo.find(u => u.uuid === s.userUuid);
        groupedUsers[groupKey] = {
          key: groupKey,
          type: 'AUTHENTICATED',
          userUuid: s.userUuid,
          email: dbUser?.email,
          phone: dbUser?.phone,
          fullName: dbUser?.profile?.fullName || dbUser?.email || 'Utilisateur',
          avatarUrl: dbUser?.profile?.avatarUrl,
          role: s.userRole || dbUser?.role?.name || 'Guest',
          ip,
          userAgent,
          tabsCount: 0,
          pages: [],
          sessions: [],
          lastActive: Date.now(),
        };
      } else {
        groupedUsers[groupKey] = {
          key: groupKey,
          type: 'ANONYMOUS',
          ip,
          userAgent,
          tabsCount: 0,
          pages: [],
          sessions: [],
          lastActive: Date.now(),
        };
      }
    }

    const group = groupedUsers[groupKey];
    group.tabsCount++;
    group.sessions.push({ socketId: s.id, path: page, lastActive: Date.now(), checkout: checkoutState.get(s.id) || null });
    const existingPage = group.pages.find(p => p.path === page);
    if (existingPage) existingPage.count++;
    else group.pages.push({ path: page, count: 1 });
  });

  const activeList = Object.values(groupedUsers);

  let anonymousCount = 0;
  const activeRoles: Record<string, number> = {
    SUPER_ADMIN: 0,
    FINANCE_ADMIN: 0,
    CALL_CENTER_AGENT: 0,
    VENDOR: 0,
    INFLUENCER: 0,
    HELPER: 0
  };

  activeList.forEach((item) => {
    if (item.type === 'AUTHENTICATED') {
      if (item.role) {
        activeRoles[item.role] = (activeRoles[item.role] || 0) + 1;
      }
    } else {
      anonymousCount++;
    }
  });

  io.to('role:SUPER_ADMIN').emit('realtime:active-users', {
    anonymousCount,
    activeRoles,
    totalActive: activeList.length,
    activeUsersList: activeList
  });
};

// Coalesce presence broadcasts: many socket events (connect/disconnect/page-view)
// can fire in a burst; we run the DB-backed broadcast at most once per window.
let broadcastPending = false;
const scheduleBroadcast = (io: any) => {
  if (broadcastPending) return;
  broadcastPending = true;
  setTimeout(() => {
    broadcastPending = false;
    broadcastActiveUsersCount(io).catch((err) =>
      console.error('[presence] broadcast failed:', err),
    );
  }, 1200);
};

const setupChatSocket = () => {
  const jwt = require('jsonwebtoken');

  io.use(async (socket: any, next: any) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(); // allow unauthenticated (will just not join user room)
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      const user = await prisma.user.findUnique({
        where: { uuid: decoded.userId },
        include: { role: true },
      });
      if (user) {
        socket.userUuid = user.uuid;
        socket.userRole = user.role.name;
      }
      next();
    } catch {
      next(); // still allow, just not in personal room
    }
  });

  io.on('connection', (socket: any) => {
    if (socket.userUuid) {
      socket.join(`user:${socket.userUuid}`);
      socket.join(`role:${socket.userRole}`);
    }

    // Tell the client whether global auto-recording is on. If it is, the client's
    // LiveSessionTracker starts rrweb immediately; if not, it stays idle until an
    // admin chooses to watch this specific socket.
    isSessionRecordingEnabled()
      .then((record) => socket.emit('stream:config', { record }))
      .catch(() => socket.emit('stream:config', { record: false }));

    // The client re-requests config once its listeners are attached, closing the
    // race where the initial emit above arrives before the handler is bound.
    socket.on('stream:sync', async () => {
      const record = await isSessionRecordingEnabled().catch(() => false);
      socket.emit('stream:config', { record });
    });

    scheduleBroadcast(io);

    socket.on('realtime:request-counts', () => {
      broadcastActiveUsersCount(io).catch(() => {});
    });

    socket.on('page-view', (data: { path: string }) => {
      socket.currentPage = data?.path || '/';
      scheduleBroadcast(io);
    });

    socket.on('join-conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('leave-conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('typing:start', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('typing', {
        userId: socket.userUuid,
        isTyping: true,
      });
    });

    socket.on('typing:stop', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('typing', {
        userId: socket.userUuid,
        isTyping: false,
      });
    });

    socket.on('join-room', (room: string) => {
      socket.join(room);
    });

    socket.on('leave-room', (room: string) => {
      socket.leave(room);
    });

    const rawIp = socket.handshake.headers['cf-connecting-ip'] ||
                  socket.handshake.headers['x-real-ip'] ||
                  socket.handshake.headers['x-forwarded-for']?.split(',')[0].trim() ||
                  socket.handshake.address ||
                  '127.0.0.1';
    const clientIp = (rawIp === '::1' || rawIp === '::ffff:127.0.0.1') ? '127.0.0.1' : rawIp.replace(/^::ffff:/, '');

    const isSuperAdmin = () => socket.userRole === 'SUPER_ADMIN';

    // ── Visitor → server: captured DOM events for the CURRENT tab only ─────────
    socket.on('rrweb:events', (data: { events: any[]; path?: string }) => {
      if (!data?.events || !Array.isArray(data.events) || data.events.length === 0) return;

      let buffer = activeSessionBuffers.get(socket.id);
      if (!buffer) {
        buffer = {
          userUuid: socket.userUuid,
          ip: clientIp,
          userAgent: socket.handshake.headers['user-agent'],
          path: data.path || socket.currentPage || '/',
          startTime: Date.now(),
          events: [],
          hasLead: false,
          capped: false,
        };
        activeSessionBuffers.set(socket.id, buffer);
      }

      if (data.path) {
        buffer.path = data.path;
        // Heuristic: reaching the thank-you page means a lead/order was created.
        if (data.path.includes('/thank-you')) buffer.hasLead = true;
      }

      // Live relay to any admin watching THIS socket. Emitting to an empty room
      // is a no-op, so no watchers === no cost.
      io.to(`stream-room:${socket.id}`).emit('stream:delta', {
        socketId: socket.id,
        events: data.events,
      });

      // Persist into a bounded buffer for later save-on-disconnect.
      if (!buffer.capped) {
        buffer.events.push(...data.events);
        if (buffer.events.length > MAX_EVENTS_PER_SESSION) {
          buffer.events.length = MAX_EVENTS_PER_SESSION;
          buffer.capped = true;
        }
      }
    });

    // ── Visitor → server: live checkout form progress (abandoned-cart capture) ─
    socket.on('checkout:progress', async (data: { code?: string; productName?: string; fields?: any }) => {
      const f = data?.fields || {};
      const clean = (v: any) => (String(v ?? '').trim() || undefined);
      const incoming = { fullName: clean(f.fullName), phone: clean(f.phone), city: clean(f.city), address: clean(f.address) };

      // Sticky merge: keep the LAST non-empty value per field, so if the visitor
      // types a number and then clears it, we still remember what they entered.
      const prev = checkoutState.get(socket.id);
      const merged = {
        fullName: incoming.fullName ?? prev?.fullName,
        phone: incoming.phone ?? prev?.phone,
        city: incoming.city ?? prev?.city,
        address: incoming.address ?? prev?.address,
      };
      const filled = [merged.fullName, merged.phone, merged.city, merged.address].filter(Boolean).length;
      if (filled === 0) return; // never captured anything

      checkoutState.set(socket.id, {
        ...merged, filled, completed: prev?.completed || false, code: data.code || prev?.code,
      });

      try {
        await prisma.checkoutAttempt.upsert({
          where: { sessionId: socket.id },
          create: {
            sessionId: socket.id,
            referralCode: data.code,
            productName: data.productName,
            ip: clientIp,
            userAgent: socket.handshake.headers['user-agent'],
            path: socket.currentPage || '/',
            fullName: merged.fullName || null,
            phone: merged.phone || null,
            city: merged.city || null,
            address: merged.address || null,
            fieldsFilled: filled,
            completed: false,
          },
          update: {
            referralCode: data.code,
            productName: data.productName,
            fullName: merged.fullName || null,
            phone: merged.phone || null,
            city: merged.city || null,
            address: merged.address || null,
            fieldsFilled: filled,
          },
        });
      } catch (err) {
        console.error('[Checkout] Failed to persist attempt:', err);
      }
      scheduleBroadcast(io);
    });

    // Visitor completed the order → mark the attempt as converted.
    socket.on('checkout:complete', async () => {
      const st = checkoutState.get(socket.id);
      if (st) st.completed = true;
      try {
        await prisma.checkoutAttempt.updateMany({ where: { sessionId: socket.id }, data: { completed: true } });
      } catch { /* noop */ }
      scheduleBroadcast(io);
    });

    // ── Visitor → server: live /register progress (abandoned sign-up capture) ──
    socket.on('signup:progress', async (data: { role?: string; step?: number; fields?: any }) => {
      const f = data?.fields || {};
      const clean = (v: any) => (String(v ?? '').trim() || undefined);
      // NEVER capture passwords — only identity fields.
      const incoming = { fullName: clean(f.fullName), email: clean(f.email), phone: clean(f.phone) };

      // Sticky merge: keep the last non-empty value per field so clearing an input
      // does not erase what we already learned about this visitor.
      const prev = signupState.get(socket.id);
      const merged = {
        fullName: incoming.fullName ?? prev?.fullName,
        email: incoming.email ?? prev?.email,
        phone: incoming.phone ?? prev?.phone,
      };
      const filled = [merged.fullName, merged.email, merged.phone].filter(Boolean).length;
      const maxStep = Math.max(Number(data?.step) || 1, prev?.maxStep || 1);
      const role = data?.role || prev?.role;

      if (filled === 0) return; // nothing worth recording yet

      signupState.set(socket.id, {
        ...merged, role, maxStep, filled, completed: prev?.completed || false,
      });

      try {
        await prisma.signupAttempt.upsert({
          where: { sessionId: socket.id },
          create: {
            sessionId: socket.id,
            role,
            fullName: merged.fullName || null,
            email: merged.email || null,
            phone: merged.phone || null,
            maxStep,
            fieldsFilled: filled,
            completed: false,
            ip: clientIp,
            userAgent: socket.handshake.headers['user-agent'],
            path: socket.currentPage || '/register',
          },
          update: {
            role,
            fullName: merged.fullName || null,
            email: merged.email || null,
            phone: merged.phone || null,
            maxStep,
            fieldsFilled: filled,
          },
        });
      } catch (err) {
        console.error('[Signup] Failed to persist attempt:', err);
      }
    });

    // Visitor finished registering → mark the sign-up attempt as converted.
    socket.on('signup:complete', async () => {
      const st = signupState.get(socket.id);
      if (st) st.completed = true;
      try {
        await prisma.signupAttempt.updateMany({ where: { sessionId: socket.id }, data: { completed: true } });
      } catch { /* noop */ }
    });

    // ── Admin → server: start watching a specific visitor socket ──────────────
    socket.on('stream:watch', ({ socketId }: { socketId: string }) => {
      if (!isSuperAdmin() || !socketId) return;

      socket.join(`stream-room:${socketId}`);
      const set = streamWatchers.get(socketId) ?? new Set<string>();
      set.add(socket.id);
      streamWatchers.set(socketId, set);

      // Force the target to (re)start recording and hand us a fresh snapshot.
      io.to(socketId).emit('stream:record-state', { active: true });
      io.to(socketId).emit('stream:request-snapshot');

      // Give the admin an instant picture from whatever we already buffered.
      const buffer = activeSessionBuffers.get(socketId);
      if (buffer && buffer.events.length > 0) {
        const slice = eventsFromLastSnapshot(buffer.events);
        if (slice.length) {
          socket.emit('stream:snapshot', { socketId, events: slice, path: buffer.path });
        }
      }
    });

    // ── Admin → server: stop watching a visitor socket ────────────────────────
    socket.on('stream:unwatch', async ({ socketId }: { socketId: string }) => {
      if (!socketId) return;
      socket.leave(`stream-room:${socketId}`);
      const set = streamWatchers.get(socketId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          streamWatchers.delete(socketId);
          // Nobody watching + global recording off → tell the tab to stop capturing.
          const globalRecord = await isSessionRecordingEnabled().catch(() => false);
          if (!globalRecord) io.to(socketId).emit('stream:record-state', { active: false });
        }
      }
    });

    socket.on('disconnect', async () => {
      // Save this tab's recording if it captured anything meaningful.
      const buffer = activeSessionBuffers.get(socket.id);
      if (buffer && buffer.events.length >= MIN_EVENTS_TO_SAVE) {
        const durationSec = Math.round((Date.now() - buffer.startTime) / 1000);
        if (durationSec >= MIN_DURATION_TO_SAVE_SEC) {
          try {
            const gzipBuffer = zlib.gzipSync(JSON.stringify(buffer.events));
            await prisma.sessionRecording.create({
              data: {
                sessionId: socket.id,
                userUuid: buffer.userUuid,
                ip: buffer.ip,
                userAgent: buffer.userAgent,
                path: buffer.path,
                durationSec,
                hasLead: buffer.hasLead,
                eventDataGzip: gzipBuffer,
              },
            });
          } catch (err) {
            console.error('[SessionRecording] Error saving compressed session:', err);
          }
        }
      }
      activeSessionBuffers.delete(socket.id);
      checkoutState.delete(socket.id);
      signupState.delete(socket.id);

      // Notify admins watching this tab that the stream ended, and clean rooms.
      io.to(`stream-room:${socket.id}`).emit('stream:ended', { socketId: socket.id });
      streamWatchers.delete(socket.id);

      // If this socket was itself an admin-watcher, remove it everywhere. When a
      // target loses its last watcher and global recording is off, stop its capture.
      const globalRecord = await isSessionRecordingEnabled().catch(() => false);
      for (const [targetId, set] of streamWatchers) {
        if (set.delete(socket.id) && set.size === 0) {
          streamWatchers.delete(targetId);
          if (!globalRecord) io.to(targetId).emit('stream:record-state', { active: false });
        }
      }

      scheduleBroadcast(io);
    });
  });
};

setupChatSocket();

// Expose io to route modules (e.g. the recording-toggle endpoint) without a
// circular import back into this file.
setIO(io);

export { io };
export const getIO = () => io;

import { BackupService } from './services/backup.service.js';

// Start background jobs
startLeadsReassignmentCron();

// Purge expired / over-cap session recordings on a schedule.
startSessionCleanupCron();

// Start dynamic automated backup scheduler
BackupService.startScheduler();

// Seed initial traffic tracker history
try {
  seedTrafficData();
} catch (err) {
  console.error('Failed to seed traffic data:', err);
}

server.listen(PORT, () => {
  console.log(`
  🚀 SILACOD Backend Server Started
  ─────────────────────────────────────
  Environment: ${process.env.NODE_ENV || 'development'}
  URL: http://localhost:${PORT}
  API: http://localhost:${PORT}${API_PREFIX}
  ─────────────────────────────────────
  `);
});

export default app;
// Hot-reload trigger: Coliaty API credentials updated & /livraison permission updated & helper user edit permissions fix


