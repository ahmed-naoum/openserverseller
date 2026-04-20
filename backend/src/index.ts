import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { setupPassport } from './config/passport.js';
import { securityHeaders, ipFilter, sanitizeInput, validateRequestSize } from './middleware/security.js';
import { maintenanceMiddleware } from './middleware/maintenance.js';
import { startLeadsReassignmentCron } from './jobs/leadReassignment.js';

const app = express();
const server = createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});

const PORT = parseInt(process.env.PORT || '3001', 10);
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-maintenance-bypass'],
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));
app.use(requestLogger);

app.use(securityHeaders);
app.use(ipFilter);
app.use(sanitizeInput);
app.use(validateRequestSize(5 * 1024 * 1024));

app.use('/uploads', express.static('uploads'));

setupPassport();

app.use(maintenanceMiddleware);

app.use(`${API_PREFIX}`, routes);

app.use(notFoundHandler);
app.use(errorHandler);

const setupChatSocket = () => {
  const jwt = require('jsonwebtoken');
  const { PrismaClient } = require('@prisma/client');
  const prismaSocket = new PrismaClient();

  io.use(async (socket: any, next: any) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(); // allow unauthenticated (will just not join user room)
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      const user = await prismaSocket.user.findUnique({
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

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
};

setupChatSocket();

export { io };

// Start background jobs
startLeadsReassignmentCron();

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
