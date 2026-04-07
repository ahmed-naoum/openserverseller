import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler.js';

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

export default router;
