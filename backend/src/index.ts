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

  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    try {
      const parsedFrontend = new URL(frontendUrl);
      const parsedOrigin = new URL(origin);
      
      const frontendHost = parsedFrontend.hostname.replace(/^www\./, '');
      const originHost = parsedOrigin.hostname.replace(/^www\./, '');
      
      if (originHost === frontendHost) {
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
    lastActive: number;
  }> = {};

  sockets.forEach((s) => {
    const ip = s.handshake.headers['x-forwarded-for']?.split(',')[0].trim() || s.handshake.address || 'unknown';
    const userAgent = s.handshake.headers['user-agent'] || 'unknown';
    const deviceKey = `${ip}::${userAgent}`;
    const page = s.currentPage || '/';

    if (s.userUuid) {
      const uuid = s.userUuid;
      const dbUser = usersInfo.find(u => u.uuid === uuid);
      const roleName = s.userRole || dbUser?.role?.name || 'Guest';

      if (!groupedUsers[uuid]) {
        groupedUsers[uuid] = {
          key: uuid,
          type: 'AUTHENTICATED',
          userUuid: uuid,
          email: dbUser?.email,
          phone: dbUser?.phone,
          fullName: dbUser?.profile?.fullName || dbUser?.email || 'Utilisateur',
          avatarUrl: dbUser?.profile?.avatarUrl,
          role: roleName,
          ip,
          userAgent,
          tabsCount: 0,
          pages: [],
          lastActive: Date.now()
        };
      }
      
      groupedUsers[uuid].tabsCount++;
      const existingPage = groupedUsers[uuid].pages.find(p => p.path === page);
      if (existingPage) {
        existingPage.count++;
      } else {
        groupedUsers[uuid].pages.push({ path: page, count: 1 });
      }
    } else {
      if (!groupedUsers[deviceKey]) {
        groupedUsers[deviceKey] = {
          key: deviceKey,
          type: 'ANONYMOUS',
          ip,
          userAgent,
          tabsCount: 0,
          pages: [],
          lastActive: Date.now()
        };
      }
      
      groupedUsers[deviceKey].tabsCount++;
      const existingPage = groupedUsers[deviceKey].pages.find(p => p.path === page);
      if (existingPage) {
        existingPage.count++;
      } else {
        groupedUsers[deviceKey].pages.push({ path: page, count: 1 });
      }
    }
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
      if (user && user.isActive) {
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

    broadcastActiveUsersCount(io);

    socket.on('realtime:request-counts', () => {
      broadcastActiveUsersCount(io);
    });

    socket.on('page-view', (data: { path: string }) => {
      socket.currentPage = data?.path || '/';
      broadcastActiveUsersCount(io);
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

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      broadcastActiveUsersCount(io);
    });
  });
};

setupChatSocket();

export { io };

import { BackupService } from './services/backup.service.js';

// Start background jobs
startLeadsReassignmentCron();

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


