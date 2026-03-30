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
import { securityHeaders, ipFilter, auditLog, sanitizeInput, validateRequestSize } from './middleware/security.js';
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
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

app.use(`${API_PREFIX}`, routes);

app.use(notFoundHandler);
app.use(errorHandler);

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join-room', (room: string) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room ${room}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

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
