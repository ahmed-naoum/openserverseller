import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import webhookEmitter from '../lib/webhookEmitter.js';

const router = Router();
const prisma = new PrismaClient();

// Open Webhook Endpoint for Coliaty
router.post(
  '/coliaty',
  asyncHandler(async (req, res) => {
    const payload = req.body;
    let packageCode = payload.package_code || payload.tracking_code || payload.tracking || payload.code_tracking;
    let coliatyStatus = payload.status || payload.statut || payload.etat_livraison;
    
    // Default assumptions
    let processed = false;
    let orderMatched: any = null;
    let internalStatus = '';
    let errorMessage = '';

    // Step 1: Save log immediately so we have a record
    let webhookLogId = 0;
    try {
      if ((prisma as any).webhookLog) {
        const webhookLog = await (prisma as any).webhookLog.create({
          data: {
            provider: 'COLIATY',
            payload: payload || {},
            processed: false,
            status: 'RECEIVED'
          }
        });
        webhookLogId = webhookLog.id;
      }
    } catch (e) {
      console.error("Could not write to webhook_logs yet (might need prisma generate)", e);
    }

    try {
      if (packageCode) {
        orderMatched = await prisma.order.findFirst({
          where: { coliatyPackageCode: packageCode }
        });

        if (orderMatched && coliatyStatus) {
          // Dynamic status mapping based on Coliaty general terminology
          let normalizedColiatyStatus = String(coliatyStatus).toUpperCase().trim();
          
          if (normalizedColiatyStatus.includes('LIVRE') || normalizedColiatyStatus.includes('DELIVERED')) {
            internalStatus = 'DELIVERED';
          } else if (normalizedColiatyStatus.includes('RETOUR') || normalizedColiatyStatus.includes('RETURNED') || normalizedColiatyStatus.includes('NON LIVRE')) {
            internalStatus = 'RETURNED';
          } else if (normalizedColiatyStatus.includes('REFUSE') || normalizedColiatyStatus.includes('REJECTED') || normalizedColiatyStatus.includes('ANNULE')) {
            internalStatus = 'CANCELLED';
          } else if (normalizedColiatyStatus.includes('EXPEDIE') || normalizedColiatyStatus.includes('EN COURS') || normalizedColiatyStatus.includes('RAMASSE') || normalizedColiatyStatus.includes('SHIPPED')) {
            internalStatus = 'SHIPPED';
          }

          if (internalStatus && internalStatus !== orderMatched.status) {
            // Update order and create history record
            await prisma.$transaction([
              prisma.order.update({
                where: { id: orderMatched.id },
                data: { status: internalStatus }
              }),
              prisma.orderStatusHistory.create({
                data: {
                  orderId: orderMatched.id,
                  oldStatus: orderMatched.status,
                  newStatus: internalStatus,
                  // Webhooks don't have a user, default to vendor (system) or generic generic ID
                  changedBy: orderMatched.vendorId, 
                  notes: `Automated status update via Coliaty Webhook (${normalizedColiatyStatus})`
                }
              }),
              // Safe update of log
              ...( (prisma as any).webhookLog && webhookLogId ? [(prisma as any).webhookLog.update({
                where: { id: webhookLogId },
                data: {
                  processed: true,
                  status: `MAPPED_TO_${internalStatus}`
                }
              })] : [])
            ]);
            processed = true;

            // 🔔 Broadcast real-time update to all connected SSE clients
            webhookEmitter.emit('status_update', {
              orderId: orderMatched.id,
              packageCode,
              oldStatus: orderMatched.status,
              newStatus: internalStatus,
              vendorId: orderMatched.vendorId,
            });
          } else {
            errorMessage = `Status '${coliatyStatus}' either unmapped or already set on the Order.`;
          }
        } else if (!orderMatched) {
           errorMessage = `No internal order found for package code: ${packageCode}`;
        } else {
           errorMessage = `Payload missing recognizable 'status' field: ${JSON.stringify(payload)}`;
        }
      } else {
        errorMessage = `Payload missing recognizable 'package_code' or tracking identifier: ${JSON.stringify(payload)}`;
      }
    } catch (err: any) {
      errorMessage = err.message;
    }

    if (!processed && webhookLogId && (prisma as any).webhookLog) {
      await (prisma as any).webhookLog.update({
         where: { id: webhookLogId },
         data: {
           errorMsg: errorMessage,
           status: 'FAILED_TO_PROCESS'
         }
      });
    }

    // Always respond 200 OK
    res.status(200).json({ success: true, loggedId: webhookLogId });
  })
);

// SSE endpoint: agents/admins connect here to get real-time parcel status updates
// NOTE: EventSource cannot set custom headers, so we accept token via query param

router.get(
  '/stream',
  (req, res) => {
    // Authenticate via query param token (EventSource limitation)
    const token = req.query.token as string || req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      res.status(401).end();
      return;
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_key_change_in_production_64_chars_long_string_1234567890');
    } catch {
      res.status(401).end();
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send a heartbeat every 25s to keep the connection alive
    const heartbeatInterval = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 25000);

    // Send initial connected event
    res.write(`event: connected\ndata: ${JSON.stringify({ userId: req.user!.id })}\n\n`);

    // Listen for status_update events and forward to this client
    const onStatusUpdate = (data: any) => {
      res.write(`event: status_update\ndata: ${JSON.stringify(data)}\n\n`);
    };

    webhookEmitter.on('status_update', onStatusUpdate);

    // Cleanup when client disconnects
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      webhookEmitter.off('status_update', onStatusUpdate);
    });
  }
);

router.get(
  '/logs',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, provider, status } = req.query;

    const where: any = {};
    if (provider) where.provider = String(provider).toUpperCase();
    if (status) where.status = String(status);

    const [logs, total] = await Promise.all([
      (prisma as any).webhookLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      (prisma as any).webhookLog.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: {
        logs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  })
);

router.delete(
  '/logs',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    await (prisma as any).webhookLog.deleteMany({});
    res.json({ status: 'success', message: 'Tous les logs ont été supprimés.' });
  })
);

export default router;
