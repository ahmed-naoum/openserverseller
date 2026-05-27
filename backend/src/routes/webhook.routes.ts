import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import webhookEmitter from '../lib/webhookEmitter.js';

const router = Router();
const prisma = new PrismaClient();

// Exact status mapping from Coliaty API (shared by both event types)
const COLIATY_TO_INTERNAL: Record<string, string> = {
  // --- Cycle de vie / Stock ---
  'NEW_PARCEL': 'NEW_PARCEL',
  'WAITING_PICKUP': 'WAITING_PICKUP',
  'WAITING_PREPARATION': 'WAITING_PREPARATION',
  'PREPARED': 'PREPARED',
  'ENCORE_PREPARED': 'ENCORE_PREPARED',
  // --- En transit ---
  'PICKED_UP': 'PICKED_UP',
  'SENT': 'SENT',
  'RECEIVED': 'RECEIVED',
  'DISTRIBUTION': 'DISTRIBUTION',
  'PROGRAMMER_AUTO': 'PROGRAMMER_AUTO',
  'POSTPONED': 'POSTPONED',
  'NOANSWER': 'NOANSWER',
  'ERR': 'ERR',
  'PROGRAMMER': 'PROGRAMMER',
  'INCORRECT_ADDRESS': 'INCORRECT_ADDRESS',

  // --- Livraison terminée ---
  'DELIVERED': 'DELIVERED',
  'RETURNED': 'RETURNED',

  // --- Annulations ---
  'CANCELED_BY_SELLER': 'CANCELED_BY_SELLER',
  'CANCELED_BY_SYSTEM': 'CANCELED_BY_SYSTEM',
  'CANCELED': 'CANCELED',
  'REFUSE': 'REFUSE',
};

// Open Webhook Endpoint for Coliaty
router.post(
  '/coliaty',
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const eventType = payload.EVENT || '';
    let packageCode = payload.TRACKING || payload.package_code || payload.tracking_code || payload.tracking || payload.code_tracking || payload.PACKAGE_CODE;
    let coliatyStatus = payload.STATUS || payload.status || payload.statut || payload.etat_livraison || payload.STATUT;
    
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
      if (!packageCode) {
        errorMessage = `Payload missing recognizable 'TRACKING' or tracking identifier: ${JSON.stringify(payload)}`;
      } else {
        orderMatched = await prisma.order.findFirst({
          where: { coliatyPackageCode: packageCode },
          include: { lead: true }
        });

        if (!orderMatched) {
          errorMessage = `No internal order found for package code: ${packageCode}`;
        } else if (eventType === 'PARCEL_SITUATION_CHANGED') {
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          // PARCEL_SITUATION_CHANGED — e.g. invoice paid
          // Fields: SITUATION, INVOICE_REF, STATUS, PRICE, FEES, NET, COMMENT, DATE
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          const situation = payload.SITUATION;
          const invoiceRef = payload.INVOICE_REF || '';
          const price = typeof payload.PRICE === 'number' ? payload.PRICE : parseFloat(payload.PRICE) || 0;
          const fees = typeof payload.FEES === 'number' ? payload.FEES : parseFloat(payload.FEES) || 0;
          const net = typeof payload.NET === 'number' ? payload.NET : parseFloat(payload.NET) || 0;
          const comment = payload.COMMENT || '';
          const normalizedStatus = coliatyStatus ? String(coliatyStatus).toUpperCase().trim() : '';
          internalStatus = normalizedStatus ? (COLIATY_TO_INTERNAL[normalizedStatus] || normalizedStatus) : '';

          // User Request: PAID -> Payé, else -> no Payé
          const internalPaymentSituation = situation === 'PAID' ? 'Payé' : 'no Payé';

          await prisma.$transaction(async (tx) => {
            // 1. Update order status if provided and different
            const orderUpdateData: any = {};
            if (internalStatus && internalStatus !== orderMatched.status) {
              orderUpdateData.status = internalStatus;
            }
            if (Object.keys(orderUpdateData).length > 0) {
              await tx.order.update({
                where: { id: orderMatched.id },
                data: orderUpdateData
              });

              // Create Order History
              await tx.orderStatusHistory.create({
                data: {
                  orderId: orderMatched.id,
                  oldStatus: orderMatched.status,
                  newStatus: internalStatus,
                  changedBy: orderMatched.vendorId,
                  notes: `PARCEL_SITUATION_CHANGED: ${situation} — ${comment} (Invoice: ${invoiceRef})`
                }
              });
            }

            // 2. Update linked Lead — mark payment situation
            if (orderMatched.leadId) {
              const leadUpdateData: any = {
                paymentSituation: internalPaymentSituation,
              };
              if (internalStatus) {
                leadUpdateData.status = internalStatus;
              }

              await tx.lead.update({
                where: { id: orderMatched.leadId },
                data: leadUpdateData
              });

              await tx.leadStatusHistory.create({
                data: {
                  leadId: orderMatched.leadId,
                  oldStatus: orderMatched.lead?.status || orderMatched.status,
                  newStatus: internalStatus || orderMatched.status,
                  changedBy: orderMatched.vendorId,
                  notes: `Situation ${situation} (Mapped to ${internalPaymentSituation}) — Invoice: ${invoiceRef}, Prix: ${price} MAD, Frais: ${fees} MAD, Net: ${net} MAD`
                }
              });
            }

              // 3. Restore stock if the resulting status is a cancellation/return
              const cancellationStatuses = ['CANCELED', 'CANCELED_BY_SELLER', 'CANCELED_BY_SYSTEM', 'REFUSE', 'RETURNED', 'CANCELLED'];
              if (internalStatus && cancellationStatuses.includes(internalStatus) && !cancellationStatuses.includes(orderMatched.status)) {
                const orderWithItems = await tx.order.findUnique({
                  where: { id: orderMatched.id },
                  include: { items: true }
                });
                if (orderWithItems) {
                  for (const item of orderWithItems.items) {
                    await tx.product.update({
                      where: { id: item.productId },
                      data: { stockQuantity: { increment: item.quantity } }
                    });
                  }
                }
              }

              // 4. Update Webhook Log
              if ((prisma as any).webhookLog && webhookLogId) {
                await (prisma as any).webhookLog.update({
                  where: { id: webhookLogId },
                  data: {
                    processed: true,
                    status: `SITUATION_PAID_${internalStatus || 'NO_STATUS'}`
                  }
                });
              }
            });
            processed = true;

            // 🔔 Broadcast real-time update
            webhookEmitter.emit('status_update', {
              orderId: orderMatched.id,
              packageCode,
              event: 'PARCEL_SITUATION_CHANGED',
              situation,
              invoiceRef,
              price,
              fees,
              net,
              oldStatus: orderMatched.status,
              newStatus: internalStatus || orderMatched.status,
              vendorId: orderMatched.vendorId,
            });
        } else {
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          // PARCEL_STATUS_CHANGED (default) — status update
          // Fields: TRACKING, STATUS, COMMENT, DATE
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          if (!coliatyStatus) {
            errorMessage = `Payload missing recognizable 'STATUS' field: ${JSON.stringify(payload)}`;
          } else {
            let normalizedColiatyStatus = String(coliatyStatus).toUpperCase().trim();
            internalStatus = COLIATY_TO_INTERNAL[normalizedColiatyStatus] || '';

            if (internalStatus && internalStatus !== orderMatched.status) {
              await prisma.$transaction(async (tx) => {
                // 1. Update order status
                await tx.order.update({
                  where: { id: orderMatched.id },
                  data: { status: internalStatus }
                });

                // 2. Create Order History
                await tx.orderStatusHistory.create({
                  data: {
                    orderId: orderMatched.id,
                    oldStatus: orderMatched.status,
                    newStatus: internalStatus,
                    changedBy: orderMatched.vendorId, 
                    notes: `Automated status update Webhook (${normalizedColiatyStatus})`
                  }
                });

                // 3. Keep linked Lead status in sync and create Lead History
                if (orderMatched.leadId) {
                  await tx.lead.update({
                    where: { id: orderMatched.leadId },
                    data: { 
                      status: internalStatus,
                      // Auto-mark as PAID for Payment Monitoring when delivered
                      ...(internalStatus === 'DELIVERED' ? { paymentSituation: 'Payé' } : {})
                    }
                  });

                  await tx.leadStatusHistory.create({
                    data: {
                      leadId: orderMatched.leadId,
                      oldStatus: orderMatched.lead?.status || orderMatched.status,
                      newStatus: internalStatus,
                      changedBy: orderMatched.vendorId,
                      notes: `Mise à jour automatique via Livraison (${normalizedColiatyStatus})`
                    }
                  });
                }

                // 4. Restore Stock if CANCELLED or RETURNED
                const cancellationStatuses = ['CANCELED', 'CANCELED_BY_SELLER', 'CANCELED_BY_SYSTEM', 'REFUSE', 'RETURNED', 'CANCELLED'];
                if (cancellationStatuses.includes(internalStatus)) {
                  const orderWithItems = await tx.order.findUnique({
                    where: { id: orderMatched.id },
                    include: { items: true }
                  });
                  
                  if (orderWithItems) {
                    for (const item of orderWithItems.items) {
                      await tx.product.update({
                        where: { id: item.productId },
                        data: { stockQuantity: { increment: item.quantity } }
                      });
                    }
                  }
                }

                // 5. Update Webhook Log
                if ((prisma as any).webhookLog && webhookLogId) {
                  await (prisma as any).webhookLog.update({
                    where: { id: webhookLogId },
                    data: {
                      processed: true,
                      status: `MAPPED_TO_${internalStatus}`
                    }
                  });
                }
              });
              processed = true;

              // 🔔 Broadcast real-time update to all connected SSE clients
              webhookEmitter.emit('status_update', {
                orderId: orderMatched.id,
                packageCode,
                event: 'PARCEL_STATUS_CHANGED',
                oldStatus: orderMatched.status,
                newStatus: internalStatus,
                vendorId: orderMatched.vendorId,
              });
            } else {
              errorMessage = internalStatus
                ? `Status '${coliatyStatus}' already set on the Order.`
                : `Status '${coliatyStatus}' is unmapped.`;
            }
          }
        }
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

    if (processed && orderMatched && orderMatched.leadId) {
      try {
        const lead = await prisma.lead.findUnique({
          where: { id: orderMatched.leadId }
        });
        
        if (lead && lead.referralLinkId) {
          const statusesToNotify = ['CONFIRMED', 'DELIVERED', 'CANCEL_REASON_PRICE', 'RETURNED'];
          if (statusesToNotify.includes(lead.status)) {
            const link = await prisma.referralLink.findUnique({
              where: { id: lead.referralLinkId },
              include: { product: true }
            });
            if (link) {
              const statusLabels: Record<string, string> = {
                'CONFIRMED': 'CONFIRMÉ',
                'DELIVERED': 'LIVRÉ',
                'CANCEL_REASON_PRICE': 'ANNULÉ (PRIX)',
                'RETURNED': 'RETOURNÉ'
              };
              const label = statusLabels[lead.status] || lead.status;
              const productName = link.product?.nameFr || link.product?.nameAr || 'Produit';
              const { createNotification } = await import('../utils/notification.js');
              await createNotification(
                link.influencerId,
                'LEAD_STATUS_CHANGED',
                `📈 Statut du lead mis à jour via Livraison : ${label}`,
                `Le lead de ${lead.fullName} pour le produit "${productName}" est maintenant ${label}.`
              );
            }
          }
        }
      } catch (err) {
        console.error('Failed to trigger webhook lead status notification:', err);
      }
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

    let decodedToken: any;
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_key_change_in_production_64_chars_long_string_1234567890');
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
    res.write(`event: connected\ndata: ${JSON.stringify({ userId: decodedToken?.id || 'unknown' })}\n\n`);

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
