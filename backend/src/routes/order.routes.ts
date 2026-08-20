import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { getSecret } from '../lib/secretStore.js';
import { toColiatyCityName, coliatyCityNameResolver } from '../lib/coliatyCityName.js';
import { productScopeOf, applyOrderProductScope } from '../lib/subAccountProductScope.js';
import {
  coliatyRequest,
  getColiatyConfig,
  getParcelLabelPdf,
  getPickupNoteLabelsPdf,
  getPickupNoteDetail as fetchPickupNoteDetail,
  invalidatePickupNoteDetail,
  invalidateLabel,
  decodeColiatyError,
  coliatyQueueStats,
} from '../services/coliaty.service.js';
import { emitNewTickets, type NewTicketPayload } from '../lib/ticketEvents.js';
import { SAFE_USER_SELECT } from '../lib/safeUserSelect.js';
import { maskingVendorId, maskLockedLeads, type LeadMaskAccessors } from '../lib/leadMasking.js';

const router = Router();

/**
 * An order as this file loads it: `customerPhone` sits on the row itself and the
 * lead it was raised from is included beside it. The lead is what the credit
 * gate is about — an order whose lead the seller has not paid for must not hand
 * the number back through the orders screens either.
 *
 * (`ORDER_ROW_MASK` in lib/leadMasking is for rows that WRAP an order — the
 * customers list — so it looks one level deeper than these do.)
 */
const ORDER_SELF_MASK: LeadMaskAccessors<any> = {
  lead: (row) => row?.lead ?? null,
  hide: (row, mask) => {
    if (row.customerPhone) row.customerPhone = mask(row.customerPhone);
    if (row.lead?.phone) row.lead.phone = mask(row.lead.phone);
    if (row.lead?.whatsapp) row.lead.whatsapp = mask(row.lead.whatsapp);
  },
};

const generateOrderNumber = (): string => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `OS-${dateStr}-${random}`;
};

// Helper to call Coliaty API
const callColiatyCreateParcel = async (parcelData: {
  package_reciever: string;
  package_phone: string;
  package_price: number;
  package_addresse: string;
  package_city: string;
  package_content?: string;
  package_code?: string;
  package_no_open?: boolean;
  package_replacement?: boolean;
  package_old_tracking?: string;
  package_note?: string;
}): Promise<{ package_code: string; package_id: number }> => {
  const COLIATY_PUBLIC_KEY = getSecret('COLIATY_PUBLIC_KEY');
  const COLIATY_SECRET_KEY = getSecret('COLIATY_SECRET_KEY');
  const COLIATY_BASE_URL = getSecret('COLIATY_BASE_URL') || 'https://customer-api-v1.coliaty.com';

  if (!COLIATY_PUBLIC_KEY || !COLIATY_SECRET_KEY || COLIATY_PUBLIC_KEY === 'your_coliaty_public_key') {
    throw new AppException(400, '[Coliaty] Clés API non configurées.');
  }

  try {
    const response = await axios.post(
      `${COLIATY_BASE_URL}/parcel/normal`,
      {
        package_content: parcelData.package_content || "Marchandise",
        package_no_open: false,
        package_replacement: false,
        package_old_tracking: '',
        ...parcelData,
      },
      {
        headers: {
          Authorization: `Bearer ${COLIATY_PUBLIC_KEY}:${COLIATY_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (response.data?.success) {
      return {
        package_code: response.data.data.package_code,
        package_id: response.data.data.package_id,
      };
    }
    
    const errorMessage = response.data?.message || JSON.stringify(response.data?.errors) || 'Erreur inconnue (Coliaty)';
    throw new AppException(400, `Coliaty API: ${errorMessage}`);
  } catch (error: any) {
    if (error instanceof AppException) throw error;
    const detail = error.response?.data?.errors 
      ? JSON.stringify(error.response.data.errors) 
      : (error.response?.data?.message || error.message);
    throw new AppException(400, `Coliaty Network/API Error: ${detail}`);
  }
};

/**
 * Why a parcel cannot be sent to Coliaty, or null when it can.
 *
 * These are the rules Coliaty enforces itself and answers 400 for. Checking
 * them here keeps a single bad row from riding along in a batch, where the
 * agent would only see it as an anonymous failure counter afterwards.
 */
const rejectParcel = (parcel: {
  package_phone: string;
  package_price: number;
  package_replacement?: boolean;
  package_old_tracking?: string;
}): string | null => {
  if (!/^0[67]\d{8}$/.test(parcel.package_phone)) {
    return `Numéro refusé par Coliaty (${parcel.package_phone}) : il doit commencer par 06 ou 07 et compter 10 chiffres.`;
  }
  if (!Number.isFinite(parcel.package_price) || parcel.package_price < 0) {
    return 'Prix invalide : le montant ne peut pas être négatif.';
  }
  if (parcel.package_replacement && !String(parcel.package_old_tracking || '').trim()) {
    return 'Colis de remplacement sans numéro de suivi à remplacer.';
  }
  return null;
};

router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, startDate, endDate } = req.query;

    const where: any = {};

    if (req.user!.roleName === 'VENDOR') {
      where.vendorId = req.user!.id;
    }
    applyOrderProductScope(where, productScopeOf(req));

    if (status) where.status = status;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                include: { images: true },
              },
            },
          },
          lead: true,
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);

    // One lock lookup for the page, before the rows are copied into the
    // response. Only a seller is gated — the call centre and the admins have to
    // keep the real number.
    await maskLockedLeads(maskingVendorId(req), orders, ORDER_SELF_MASK);

    res.json({
      status: 'success',
      data: {
        orders: orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          customerPhone: o.customerPhone,
          isLocked: (o as any).isLocked === true,
          customerCity: o.customerCity,
          totalAmountMad: o.totalAmountMad,
          vendorEarningMad: o.vendorEarningMad,
          platformFeeMad: o.platformFeeMad,
          status: o.status,
          paymentMethod: o.paymentMethod,
          items: o.items.map((item) => ({
            id: item.id,
            productName: item.product.nameFr,
            productDescription: item.product.description,
            productImage: item.product.images[0]?.imageUrl,
            productImages: item.product.images.map(img => img.imageUrl),
            quantity: item.quantity,
            unitPriceMad: item.unitPriceMad,
            totalPriceMad: item.totalPriceMad,
          })),
          createdAt: o.createdAt,
        })),
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

router.get(
  '/parcel/:code/label',
  authenticate,
  asyncHandler(async (req, res) => {
    const { code } = req.params;
    if (req.query.refresh === '1') invalidateLabel(`parcel:${code}`);

    try {
      const pdf = await getParcelLabelPdf(code);
      return res.status(200).json({ status: 'success', data: { pdf } });
    } catch (error: any) {
      handleColiatyError(error, `Étiquette ${code}`);
    }
  })
);

/**
 * Merges up to MAX_BATCH_LABELS parcel labels into a single PDF, server side.
 *
 * The packaging desk prints in batches of dozens to hundreds. Doing that from the
 * browser meant one HTTP round-trip per parcel, which tripped both our own
 * limiter and Coliaty's per-IP block. Here the whole batch is one request from the
 * browser, and upstream calls are paced and cached by the shared Coliaty queue.
 */
const MAX_BATCH_LABELS = 400;

router.post(
  '/parcels/labels/batch',
  authenticate,
  // CALL_CENTER_AGENT is included because the single-label route above is open to
  // any authenticated user — batching exposes no extra data, only fewer requests.
  authorize('HELPER', 'SUPER_ADMIN', 'VENDOR', 'FULFILLMENT_OPERATOR', 'CALL_CENTER_AGENT'),
  asyncHandler(async (req, res) => {
    const { codes } = req.body || {};

    if (!Array.isArray(codes) || codes.length === 0) {
      throw new AppException(400, 'codes[] est requis.');
    }

    const unique = [...new Set(codes.map((c: any) => String(c).trim()).filter(Boolean))];
    if (unique.length === 0) {
      throw new AppException(400, 'Aucun code de colis valide fourni.');
    }
    if (unique.length > MAX_BATCH_LABELS) {
      throw new AppException(400, `Maximum ${MAX_BATCH_LABELS} colis par lot (${unique.length} demandés).`);
    }

    const { PDFDocument } = await import('pdf-lib');
    const merged = await PDFDocument.create();

    const succeeded: string[] = [];
    const failed: { code: string; message: string }[] = [];

    // Sequential on purpose: the shared Coliaty queue paces the upstream calls,
    // and appending pages in order keeps the printed stack matching the UI list.
    for (const code of unique) {
      try {
        const base64 = await getParcelLabelPdf(code);
        const doc = await PDFDocument.load(Buffer.from(base64, 'base64'));
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
        succeeded.push(code);
      } catch (error: any) {
        const data = decodeColiatyError(error?.response?.data);
        failed.push({
          code,
          message: data?.message || error?.message || 'Étiquette indisponible',
        });
      }
    }

    if (succeeded.length === 0) {
      throw new AppException(
        502,
        `Aucune étiquette n'a pu être récupérée. ${failed[0]?.message || ''}`.trim()
      );
    }

    const bytes = await merged.save();
    res.status(200).json({
      status: 'success',
      data: {
        pdf: Buffer.from(bytes).toString('base64'),
        merged: succeeded.length,
        requested: unique.length,
        succeeded,
        failed,
      },
    });
  })
);

router.get(
  '/products-with-parcels',
  authenticate,
  asyncHandler(async (req, res) => {
    // We want products that have orders in PENDING status (En attente) and have a coliatyPackageCode
    const where: any = {
      status: 'PENDING',
      coliatyPackageCode: { not: null }
    };

    if (req.user!.roleName === 'HELPER') {
      const assignments = await (prisma as any).helperUserAssignment.findMany({
        where: { helperId: req.user!.id }
      });
      const assignedIds = assignments.map((a: any) => a.targetUserId);
      where.vendorId = { in: assignedIds };
    } else if (req.user!.roleName === 'VENDOR') {
      where.vendorId = req.user!.id;
    } else if (req.user!.roleName !== 'SUPER_ADMIN') {
      // Other roles shouldn't see this unless they are admins
      throw new AppException(403, 'Access denied');
    }

    // This one is raw SQL, so the product scope has to be spelled out instead of
    // merged into a `where`. It joins products already, so it filters on p.id
    // directly rather than walking back out through the lead.
    const scope = productScopeOf(req);
    const scopeSql = scope
      ? Prisma.sql`AND p.id IN (${Prisma.join(scope)})`
      : Prisma.sql``;

    // Using a single, comprehensive raw query to ensure we get all fields correctly
    // especially the coliatyPickupRef which might be ignored by an outdated Prisma client.
    const rawData: any[] = await prisma.$queryRaw`
      SELECT 
        o.id as "orderId",
        o."orderNumber",
        o."customerName",
        o."customerPhone",
        o."customerCity",
        o."coliatyPackageCode",
        o."coliatyPickupRef",
        o."totalAmountMad",
        o."createdAt",
        o."vendorId",
        p.id as "productId",
        p.sku as "sku",
        p."nameFr" as "productName",
        (SELECT "imageUrl" FROM product_images WHERE "productId" = p.id AND "isPrimary" = true LIMIT 1) as "productImage"
      FROM orders o
      JOIN order_items oi ON o.id = oi."orderId"
      JOIN products p ON oi."productId" = p.id
      WHERE o.status = 'PENDING' 
        AND o."coliatyPackageCode" IS NOT NULL
        ${req.user!.roleName === 'VENDOR' ? Prisma.sql`AND o."vendorId" = ${req.user!.id}` : Prisma.sql``}
        ${req.user!.roleName === 'HELPER' ? Prisma.sql`AND o."vendorId" IN (SELECT "targetUserId" FROM "helper_user_assignments" WHERE "helperId" = ${req.user!.id})` : Prisma.sql``}
        ${scopeSql}
      ORDER BY o."createdAt" DESC
    `;

    // Group by product
    const productGroups: Record<number, any> = {};

    rawData.forEach(row => {
      const productId = Number(row.productId);
      if (!productGroups[productId]) {
        productGroups[productId] = {
          id: productId,
          name: row.productName,
          sku: row.sku,
          image: row.productImage,
          pendingParcels: []
        };
      }
      
      const orderId = Number(row.orderId);
      if (!productGroups[productId].pendingParcels.find((p: any) => p.id === orderId)) {
          productGroups[productId].pendingParcels.push({
            id: orderId,
            orderNumber: row.orderNumber,
            customerName: row.customerName,
            customerPhone: row.customerPhone,
            customerCity: row.customerCity,
            coliatyPackageCode: row.coliatyPackageCode,
            coliatyPickupRef: row.coliatyPickupRef,
            totalAmountMad: Number(row.totalAmountMad),
            createdAt: row.createdAt
          });
      }
    });

    res.json({
      status: 'success',
      data: Object.values(productGroups)
    });
  })
);

router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const where: any = { id: BigInt(id) };
    if (req.user!.roleName === 'VENDOR') {
      where.vendorId = req.user!.id;
    }
    applyOrderProductScope(where, productScopeOf(req));

    const order = await prisma.order.findFirst({
      where,
      include: {
        vendor: { select: SAFE_USER_SELECT },
        statusHistory: {
          include: { changedByUser: { include: { profile: true } } },
          orderBy: { createdAt: 'desc' },
        },
        shipment: {
          include: {
            courier: true,
            trackingEvents: { orderBy: { eventTime: 'desc' } },
            deliveryProof: true,
          },
        },
        lead: true,
        returns: true,
        walletTransactions: true,
      },
    });

    if (!order) {
      throw new AppException(404, 'Order not found');
    }

    // Same rule one row at a time: the detail screen is just another read of the
    // number the list masks.
    await maskLockedLeads(maskingVendorId(req), [order], ORDER_SELF_MASK);

    res.json({
      status: 'success',
      data: { order },
    });
  })
);

router.post(
  '/',
  authenticate,
  authorize('VENDOR', 'CALL_CENTER_AGENT'),
  [
    body('customerName').notEmpty().trim(),
    body('customerPhone').matches(/^(\+212|0)[0-9]{9}$/),
    body('customerCity').notEmpty(),
    body('customerAddress').notEmpty(),
    body('items').isArray({ min: 1 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed');
    }

    const {
      leadId,
      customerName,
      customerPhone,
      customerCity,
      customerAddress,
      items,
      paymentMethod = 'COD',
    } = req.body;

    let vendorId = req.user!.id;

    if (req.user!.roleName === 'CALL_CENTER_AGENT' && leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: Number(leadId) },
      });
      if (lead) vendorId = lead.vendorId;
    }

    let totalAmountMad = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: Number(item.productId) },
      });

      if (!product || !product.isActive) {
        throw new AppException(400, `Product ${item.productId} not found or inactive`);
      }

      let unitPrice = product.retailPriceMad;

      const totalPrice = Number(unitPrice) * item.quantity;
      totalAmountMad += totalPrice;

      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPriceMad: unitPrice,
        totalPriceMad: totalPrice,
      });
    }

    const commissionPercentage = parseFloat(
      getSecret('PLATFORM_COMMISSION_PERCENTAGE') || '15'
    );
    const platformFeeMad = totalAmountMad * (commissionPercentage / 100);
    const vendorEarningMad = totalAmountMad - platformFeeMad;

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          vendorId,
          leadId: leadId ? Number(leadId) : null,
          customerName,
          customerPhone: customerPhone.replace(/^0/, '+212'),
          customerCity,
          customerAddress,
          totalAmountMad,
          vendorEarningMad,
          platformFeeMad,
          status: 'PENDING',
          paymentMethod,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: { include: { product: true } },
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: newOrder.id,
          oldStatus: null,
          newStatus: 'PENDING',
          changedBy: req.user!.id,
          notes: 'Order created',
        },
      });

      if (leadId) {
        await tx.lead.update({
          where: { id: Number(leadId) },
          data: { status: 'ORDERED' },
        });

        await tx.leadStatusHistory.create({
          data: {
            leadId: Number(leadId),
            oldStatus: 'INTERESTED',
            newStatus: 'ORDERED',
            changedBy: req.user!.id,
          },
        });
      }

      return newOrder;
    });

    res.status(201).json({
      status: 'success',
      message: 'Order created successfully',
      data: { order },
    });
  })
);

router.patch(
  '/:id/status',
  authenticate,
  authorize('VENDOR', 'CALL_CENTER_AGENT', 'SUPER_ADMIN', 'HELPER'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, notes, actionType, cloneName, cloneDescription, clonePrice, cloneQuantity, cloneImageUrls } = req.body;

    const validStatuses = [
      // Internal lifecycle
      'PENDING',
      'CONFIRMED',
      'IN_PRODUCTION',
      'READY_FOR_SHIPPING',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
      'RETURNED',
      'REFUNDED',
      'PUSHED_TO_DELIVERY',
      'CALL_LATER',
      // Coliaty lifecycle (mirrors COLIATY_TO_INTERNAL in webhook.routes.ts)
      'NEW_PARCEL',
      'WAITING_PICKUP',
      'WAITING_PREPARATION',
      'PREPARED',
      'ENCORE_PREPARED',
      'PICKED_UP',
      'SENT',
      'RECEIVED',
      'DISTRIBUTION',
      'PROGRAMMER_AUTO',
      'PROGRAMMER',
      'POSTPONED',
      'NOANSWER',
      'ERR',
      'INCORRECT_ADDRESS',
      'INTERESTED',
      'CANCELED_BY_SELLER',
      'CANCELED_BY_SYSTEM',
      'CANCELED',
      'REFUSE',
    ];

    if (!validStatuses.includes(status)) {
      throw new AppException(400, 'Invalid status');
    }

    // A helper must justify closing a parcel: "Livré" and "Retourné" are final,
    // money-impacting states, so they always require a written reason.
    const REASON_REQUIRED_STATUSES: Record<string, string> = {
      DELIVERED: 'Livré',
      RETURNED: 'Retourné',
    };
    const MIN_REASON_LENGTH = 10;
    const reason = typeof notes === 'string' ? notes.trim() : '';

    if (req.user!.roleName === 'HELPER' && REASON_REQUIRED_STATUSES[status]) {
      if (reason.length < MIN_REASON_LENGTH) {
        throw new AppException(
          400,
          `Une raison d'au moins ${MIN_REASON_LENGTH} caractères est obligatoire pour passer un colis en "${REASON_REQUIRED_STATUSES[status]}".`
        );
      }
    }

    const where: any = { id: Number(id) };
    if (req.user!.roleName === 'VENDOR') {
      where.vendorId = req.user!.id;
    }

    const order = await prisma.order.findFirst({ 
      where,
      include: { items: { include: { product: { include: { categories: true, images: true } } } } }
    });

    if (!order) {
      throw new AppException(404, 'Order not found');
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          oldStatus: order.status,
          newStatus: status,
          changedBy: req.user!.id,
          notes: actionType === 'CLONE_PRODUCT' ? `Produit cloné et commande confirmée. ${reason}` : (reason || null),
        },
      });

      if (actionType === 'CLONE_PRODUCT' && order.items.length > 0) {
        const original = order.items[0].product;
        const vendorId = order.vendorId;

        const cloneSku = `${original.sku}-ORD${order.id}-U${vendorId}`;
        const existingSku = await tx.product.findUnique({ where: { sku: cloneSku } });
        const finalSku = existingSku ? `${cloneSku}-${Date.now()}` : cloneSku;

        const clonedProduct = await tx.product.create({
          data: {
            sku: finalSku,
            nameAr: cloneName || original.nameAr,
            nameFr: cloneName || original.nameFr,
            nameEn: cloneName || original.nameEn,
            description: cloneDescription || original.description,
            longDescription: cloneDescription || original.longDescription,
            baseCostMad: Number(original.baseCostMad),
            retailPriceMad: clonePrice ? Number(clonePrice) : Number(original.retailPriceMad),
            affiliatePriceMad: original.affiliatePriceMad ? Number(original.affiliatePriceMad) : null,
            influencerPriceMad: original.influencerPriceMad ? Number(original.influencerPriceMad) : null,
            isCustomizable: original.isCustomizable,
            minProductionDays: original.minProductionDays,
            stockQuantity: original.stockQuantity,
            visibility: ['NONE'],
            status: 'APPROVED',
            ownerId: vendorId,
            videoUrls: original.videoUrls,
            landingPageUrls: original.landingPageUrls,
            commissionMad: Number(original.commissionMad),
            categories: {
              connect: original.categories.map((c: any) => ({ id: c.id })),
            },
            ...((Array.isArray(cloneImageUrls) && cloneImageUrls.length > 0) ? {
              images: {
                create: cloneImageUrls.filter((u: any) => u && typeof u === 'string').map((url: string, idx: number) => ({
                  imageUrl: url,
                  isPrimary: idx === 0,
                  sortOrder: idx,
                })),
              },
            } : (original.images?.length > 0) ? {
              images: {
                create: original.images.map((img: any, idx: number) => ({
                  imageUrl: img.imageUrl,
                  isPrimary: img.isPrimary,
                  sortOrder: img.sortOrder,
                })),
              },
            } : {}),
          },
        });

        // Update order item to point to the cloned product and update qty/price
        await tx.orderItem.update({
          where: { id: order.items[0].id },
          data: { 
            productId: clonedProduct.id,
            quantity: cloneQuantity ? Number(cloneQuantity) : order.items[0].quantity,
            unitPriceMad: clonePrice ? Number(clonePrice) : order.items[0].unitPriceMad,
            totalPriceMad: (cloneQuantity || order.items[0].quantity) * (clonePrice || order.items[0].unitPriceMad)
          }
        });

        // Recalculate order totals
        const allItems = await tx.orderItem.findMany({ where: { orderId: order.id } });
        const newTotalAmount = allItems.reduce((sum, item) => sum + Number(item.totalPriceMad), 0);
        
        const commissionPercentage = parseFloat(getSecret('PLATFORM_COMMISSION_PERCENTAGE') || '15');
        const newPlatformFee = (newTotalAmount * commissionPercentage) / 100;
        const newVendorEarning = newTotalAmount - newPlatformFee;

        await tx.order.update({
          where: { id: order.id },
          data: {
            totalAmountMad: newTotalAmount,
            platformFeeMad: newPlatformFee,
            vendorEarningMad: newVendorEarning,
          }
        });
      }

      const updated = await tx.order.update({
        where: { id: order.id },
        data: { status },
      });

      // Keep the linked Lead status in sync with the Order status
      if (order.leadId) {
        await tx.lead.update({
          where: { id: order.leadId },
          data: { status },
        });
      }



      return updated;
    });

    res.json({
      status: 'success',
      message: 'Order status updated',
      data: { order: updatedOrder },
    });
  })
);

router.post(
  '/bulk-dispatch',
  authenticate,
  authorize('CALL_CENTER_AGENT', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const { leadIds } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      throw new AppException(400, 'leadIds array is required');
    }

    const agent = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        role: { select: { name: true } },
        saisieFeeMad: true,
        profile: { select: { fullName: true } },
      }
    });

    const feePerLead = agent?.saisieFeeMad ?? 8.0;

    const leads = await prisma.lead.findMany({
      where: { 
        id: { in: leadIds.map(Number) },
        status: 'ORDERED', // queued leads
        order: { isNot: null }
      },
      include: {
        order: {
          include: { items: { include: { product: true } } }
        },
        vendor: true
      }
    });

    if (leads.length === 0) {
      throw new AppException(404, 'Aucun lead valide trouvé pour l\'expédition.');
    }

    const results: any[] = [];
    const successfulLeadIdsByVendor: Record<number, number[]> = {};
    const newTickets: NewTicketPayload[] = [];

    // Resolved for the whole batch up front: the map below is synchronous, and
    // a per-parcel lookup would be one query each.
    const resolveDispatchCity = await coliatyCityNameResolver(
      leads.map((lead) => lead.order?.customerCity)
    );

    // 1. Prepare parcels array
    const entries = leads.map((lead) => {
      const order = lead.order!;
      const product = order.items[0]?.product;
      
      let normalizedColiatyPhone = order.customerPhone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
      if (normalizedColiatyPhone.startsWith('+212')) normalizedColiatyPhone = '0' + normalizedColiatyPhone.slice(4);
      else if (normalizedColiatyPhone.startsWith('212')) normalizedColiatyPhone = '0' + normalizedColiatyPhone.slice(3);
      else if (!normalizedColiatyPhone.startsWith('0')) normalizedColiatyPhone = '0' + normalizedColiatyPhone;

      // Use pack name (productVariant) if available, combined with product name, otherwise fall back to product name
      const packName = lead.productVariant || (order as any).productVariant;
      const productName = product?.nameFr || product?.nameAr || '';
      let baseContent = '';
      if (productName && packName) {
        baseContent = `${productName} - ${packName}`;
      } else {
        baseContent = packName || productName || 'Marchandise';
      }
      if (baseContent.trim().length < 5) {
        baseContent = `${baseContent} - Colis`;
      }
      if (baseContent.trim().length < 5) {
        baseContent = 'Marchandise';
      }

      // Extract package_note from the lead notes
      const packageNote = lead.notes || '';

      const o = order as any;
      // Sent in Coliaty's own spelling rather than ours. Bulk dispatch takes
      // only lead ids, so no picker or warning stands between the stored city
      // and the carrier — this is the only place the two can be reconciled.
      const dispatchCity = resolveDispatchCity(order.customerCity);
      const parcel = {
        package_reciever: order.customerName,
        package_phone: normalizedColiatyPhone,
        // Coliaty rejects a price with more than 2 decimals, which float maths
        // produces on its own (49.9 * 3 = 149.70000000000002).
        package_price: Math.round(Number(order.totalAmountMad) * 100) / 100,
        package_addresse: order.customerAddress,
        package_city: dispatchCity,
        package_content: baseContent.substring(0, 100),
        // Read off the order instead of being pinned to false — these are the
        // options the agent actually ticked on the insert form.
        package_no_open: o.packageNoOpen ?? false,
        package_replacement: o.packageReplacement ?? false,
        package_note: packageNote,
        package_old_tracking: o.packageOldTracking || '',
      };

      return { lead, parcel, reject: rejectParcel(parcel) };
    });

    type Outcome =
      | { status: 'success'; coliatyCode: string }
      | { status: 'error'; error: string };

    const outcomes = new Map<number, Outcome>();
    for (const entry of entries) {
      if (entry.reject) outcomes.set(entry.lead.id, { status: 'error', error: entry.reject });
    }

    // Coliaty caps /parcel/normal/mass at 100 parcels and answers 400 for the
    // whole request past that — so "tout sélectionner" over a queue of 120 used
    // to ship nothing at all. Send it in slices of 100, each one independent:
    // a slice that fails is recorded against its own parcels instead of
    // discarding the ones that already went through.
    const MASS_LIMIT = 100;
    const dispatchable = entries.filter((e) => !e.reject);
    const cfg = getColiatyConfig();

    for (let start = 0; start < dispatchable.length; start += MASS_LIMIT) {
      const chunk = dispatchable.slice(start, start + MASS_LIMIT);

      try {
        // Through coliatyRequest, not raw axios: several batch calls back to
        // back is exactly the pattern that gets the VPS IP rate-limited.
        const response = await coliatyRequest<any>({
          method: 'POST',
          url: `${cfg.base}/parcel/normal/mass`,
          headers: cfg.headers,
          data: { parcels: chunk.map((e) => e.parcel) },
          timeout: 30000, // Batch may take longer
          context: `Expédition en lot (${chunk.length} colis)`,
        });

        if (!(response.data?.success || response.data?.code === 200)) {
          throw new Error(response.data?.message || 'Erreur lors de la création en lot (Coliaty)');
        }

        const successParcels: Record<string, string> = response.data.data?.success_parcels || {};
        const errorParcels: Record<string, any> = response.data.data?.error_parcels || {};

        // Coliaty keys its answer by position *within the request*, so the
        // index is the one inside this chunk, not inside the whole selection.
        chunk.forEach((entry, i) => {
          const parcelKey = `parcel_${i}`;
          if (successParcels[parcelKey]) {
            outcomes.set(entry.lead.id, { status: 'success', coliatyCode: successParcels[parcelKey] });
          } else if (errorParcels[parcelKey]) {
            outcomes.set(entry.lead.id, { status: 'error', error: JSON.stringify(errorParcels[parcelKey]) });
          } else {
            outcomes.set(entry.lead.id, { status: 'error', error: 'Le colis n\'a pas été traité par Coliaty.' });
          }
        });
      } catch (err: any) {
        const payload = err.response?.data;
        const detail = payload
          ? (typeof payload === 'string'
              ? payload.substring(0, 200)
              : [payload.message, payload.errors ? JSON.stringify(payload.errors) : ''].filter(Boolean).join(' '))
          : err.message;

        for (const entry of chunk) {
          outcomes.set(entry.lead.id, { status: 'error', error: `Erreur Coliaty: ${detail}` });
        }
      }
    }

    // 2. Process results
    for (const lead of leads) {
      const outcome: Outcome = outcomes.get(lead.id)
        ?? { status: 'error', error: 'Le colis n\'a pas été traité par Coliaty.' };

      if (outcome.status === 'success') {
        const coliatyCode = outcome.coliatyCode;

        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: lead.order!.id },
            data: { coliatyPackageCode: coliatyCode }
          });
          await tx.lead.update({
            where: { id: lead.id },
            data: { status: 'PUSHED_TO_DELIVERY' }
          });
          await tx.leadStatusHistory.create({
            data: {
              leadId: lead.id,
              oldStatus: 'ORDERED',
              newStatus: 'PUSHED_TO_DELIVERY',
              changedBy: req.user!.id,
              notes: 'Lead expédié en lot via Coliaty',
            }
          });
        });

        if (!successfulLeadIdsByVendor[lead.vendorId]) successfulLeadIdsByVendor[lead.vendorId] = [];
        successfulLeadIdsByVendor[lead.vendorId].push(lead.id);

        newTickets.push({
          orderNumber: lead.order!.orderNumber,
          packageCode: coliatyCode,
          customerName: lead.order!.customerName,
          customerCity: lead.order!.customerCity,
          vendorId: lead.vendorId,
          productName: lead.order!.items[0]?.product?.nameFr || null,
          amountMad: Number(lead.order!.totalAmountMad) || 0,
        });

        results.push({ leadId: lead.id, status: 'success', coliatyCode });
      } else {
        results.push({ leadId: lead.id, status: 'error', error: outcome.error });
      }
    }

    const generateInvoiceNumber = () => `INV-FEE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 3. Charge vendors and create Invoice
    const vendorFees: Record<number, number> = {};
    for (const [vendorIdStr, vendorLeadIds] of Object.entries(successfulLeadIdsByVendor)) {
      const vendorId = Number(vendorIdStr);
      const count = vendorLeadIds.length;
      const fee = count * feePerLead;
      vendorFees[vendorId] = fee;

      if (fee > 0) {
        await prisma.$transaction(async (tx) => {
          const wallet = await tx.wallet.findUnique({ where: { userId: vendorId } });
          if (!wallet) return;

          const balanceAfterMad = wallet.balanceMad - fee;
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balanceMad: balanceAfterMad }
          });

          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              amountMad: -fee,
              type: 'DEBIT',
              balanceAfterMad,
              description: `Frais de saisie & expédition pour ${count} lead(s) par l'agent`,
            }
          });

          await tx.invoice.create({
            data: {
              invoiceNumber: generateInvoiceNumber(),
              userId: vendorId,
              totalAmountMad: fee,
              status: 'PAID', // Direct deduction
              leads: {
                connect: vendorLeadIds.map(id => ({ id }))
              }
            }
          });
        });
      }
    }

    // Ring the packaging desk: these parcels just appeared in their "En attente" queue.
    await emitNewTickets(newTickets, {
      id: req.user!.id,
      name: agent?.profile?.fullName || agent?.email || req.user!.email,
      role: agent?.role?.name || req.user!.roleName,
    });

    res.json({
      status: 'success',
      message: 'Expédition en lot terminée',
      data: { results, vendorFees }
    });
  })
);

router.post(
  '/:id/revert-to-lead',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: Number(id) },
      include: { items: true },
    });

    if (!order) {
      throw new AppException(404, 'Order not found');
    }

    if (!order.leadId) {
      throw new AppException(400, 'This order was not created from a lead');
    }

    // Unlink and delete from Coliaty if it was pushed
    if ((order as any).coliatyPackageCode) {
      const COLIATY_PUBLIC_KEY = getSecret('COLIATY_PUBLIC_KEY');
      const COLIATY_SECRET_KEY = getSecret('COLIATY_SECRET_KEY');
      const COLIATY_BASE_URL = getSecret('COLIATY_BASE_URL') || 'https://customer-api-v1.coliaty.com';

      if (COLIATY_PUBLIC_KEY && COLIATY_SECRET_KEY && COLIATY_PUBLIC_KEY !== 'your_coliaty_public_key') {
        try {
          // Changed to match exact documentation URL if necessary, though base URL might include it.
          // Following the exact same path format as the creation route /parcel/normal
          const deleteUrl = `${COLIATY_BASE_URL.replace(/\/$/, '')}/parcel/delete/${(order as any).coliatyPackageCode}`;
          console.log('[Coliaty] Tentative de suppression du colis via:', deleteUrl);
          
          const deleteRes = await axios.delete(deleteUrl, {
            headers: {
              Authorization: `Bearer ${COLIATY_PUBLIC_KEY}:${COLIATY_SECRET_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          });

          console.log('[Coliaty] Delete Parcel Success:', deleteRes.data);
        } catch (error: any) {
          const status = error.response?.status;
          console.error('[Coliaty] Delete Parcel Error Response:', error.response?.data || error.message);
          
          if (status === 400) {
            // Coliaty returns 400 when parcel is no longer "NEW_PARCEL"
            throw new AppException(400, "Annulation refusée: le colis est déjà en cours de traitement par Coliaty et n'est plus 'Nouveau'.");
          } else if (status === 404) {
            // Force block deletion if 404 occurs. DO NOT silently proceed.
            throw new AppException(404, "Coliaty n'a pas trouvé ce colis (404). Il n'a pas été supprimé de Coliaty, l'action est bloquée !");
          } else {
            // Any other error, we block the action so the user knows it failed.
            throw new AppException(status || 500, "Erreur lors de la communication avec Coliaty pour annuler le colis.");
          }
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete order items
      await tx.orderItem.deleteMany({
        where: { orderId: order.id },
      });

      // 2. Delete the order status history
      await tx.orderStatusHistory.deleteMany({
         where: { orderId: order.id }
      });

      // 3. Delete the order
      await tx.order.delete({
        where: { id: order.id },
      });

      // 4. Revert the lead status
      await tx.lead.update({
        where: { id: order.leadId! },
        data: { status: 'CONFIRMED' },
      });

      // 5. Restore stock
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } }
        });
      }
    });

    res.json({
      status: 'success',
      message: 'Order reverted to lead successfully',
    });
  })
);

router.post(
  '/:id/change-demand',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { request_type, package_phone, package_reciever, package_price, package_note, package_city, package_address } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: Number(id) }
    });

    if (!order) throw new AppException(404, 'Order not found');
    if (!(order as any).coliatyPackageCode) throw new AppException(400, 'This order is not synchronized with Coliaty.');
    if (order.status !== 'PENDING') throw new AppException(400, 'Seuls les colis en attente peuvent être modifiés.');

    const COLIATY_PUBLIC_KEY = getSecret('COLIATY_PUBLIC_KEY');
    const COLIATY_SECRET_KEY = getSecret('COLIATY_SECRET_KEY');
    const COLIATY_BASE_URL = getSecret('COLIATY_BASE_URL') || 'https://customer-api-v1.coliaty.com';

    if (!COLIATY_PUBLIC_KEY || !COLIATY_SECRET_KEY || COLIATY_PUBLIC_KEY === 'your_coliaty_public_key') {
      throw new AppException(500, '[Coliaty] Clés API non configurées.');
    }

    // Redirecting a parcel is the one case where the wrong spelling is most
    // costly — it is already in the carrier's network — so the new destination
    // goes over in their naming. Our own record below deliberately keeps the
    // spelling the agent entered: that is what the customer and the exports read.
    const redirectCity =
      request_type === 'CHANGE_DESTINATION' ? await toColiatyCityName(package_city) : package_city;

    try {
      const response = await axios.post(`${COLIATY_BASE_URL.replace(/\/$/, '')}/parcel-change-demand/create`, {
        package_code: (order as any).coliatyPackageCode,
        request_type,
        package_phone,
        package_reciever,
        package_price,
        package_note,
        ...(request_type === 'CHANGE_DESTINATION' ? { package_city: redirectCity, package_address } : {})
      }, {
        headers: {
          Authorization: `Bearer ${COLIATY_PUBLIC_KEY}:${COLIATY_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      // Update local BD to stay in sync based on Coliaty's approval
      await prisma.order.update({
        where: { id: order.id },
        data: {
          customerName: package_reciever || order.customerName,
          customerPhone: package_phone || order.customerPhone,
          totalAmountMad: (package_price !== undefined && package_price !== null && package_price !== '') ? Number(package_price) : order.totalAmountMad,
          ...(request_type === 'CHANGE_DESTINATION' ? {
             customerCity: package_city,
             customerAddress: package_address
          } : {})
        }
      });

      res.status(200).json({
        status: 'success',
        message: 'Demande de modification acceptée',
        data: response.data?.data
      });
    } catch (error: any) {
      console.error('[Coliaty] Parcel Change Demand Error:', error.response?.data || error.message);
      
      const status = error.response?.status;
      const data = error.response?.data;
      
      if (status === 400 || status === 403 || status === 404 || status === 422) {
         // Pass through Coliaty's precise error messages. Look for the 'message' or detailed validation 'errors'
         let exactError = "Erreur de validation de modification.";
         if (data?.errors) {
            if (typeof data.errors === 'object' && !Array.isArray(data.errors) && Object.values(data.errors).length > 0) {
               exactError = String(Object.values(data.errors)[0]);
            } else if (Array.isArray(data.errors) && data.errors.length > 0) {
               exactError = String(data.errors[0]);
            }
         } else if (data?.message) {
            exactError = data.message;
         }
         
         throw new AppException(status, `Coliaty: ${exactError}`);
      }

      // If we reach here, it implies a network error, a 500 server error from Coliaty, or an unexpected status code.
      throw new AppException(500, `Échec de la communication avec Coliaty (Status: ${status || 'Aucun'}). Détail: ${error.message}`);
    }
  })
);

router.put(
  '/:id/update-normal',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { 
      package_reciever, 
      package_phone, 
      package_price, 
      package_addresse, 
      package_city, 
      city, // Fallback
      package_content,
      package_no_open 
    } = req.body;

    const finalCity = package_city || city;

    const order = await prisma.order.findUnique({
      where: { id: Number(id) }
    });

    if (!order) throw new AppException(404, 'Order not found');
    if (!(order as any).coliatyPackageCode) throw new AppException(400, 'This order is not synchronized with Coliaty.');

    const COLIATY_PUBLIC_KEY = getSecret('COLIATY_PUBLIC_KEY');
    const COLIATY_SECRET_KEY = getSecret('COLIATY_SECRET_KEY');
    const COLIATY_BASE_URL = getSecret('COLIATY_BASE_URL') || 'https://customer-api-v1.coliaty.com';

    try {
      const response = await axios.put(`${COLIATY_BASE_URL.replace(/\/$/, '')}/parcel/normal/${(order as any).coliatyPackageCode}`, {
        package_reciever,
        package_phone,
        package_price: Number(package_price),
        package_addresse,
        package_city: finalCity,
        // Guaranteed required fields by Coliaty
        package_content: (() => {
          let baseContent = package_content || order.packageContent || "Marchandise";
          // Try to find the product SKU and Variant if possible
          // In update-normal, we don't have productVariant in body necessarily, but we can check order
          const variant = (order as any).productVariant || "";
          // We'd need to fetch items to get SKU, but for now let's just use what's in the body or order
          // If the user manually provided package_content, we use it.
          // If not, we try to append details if they aren't already there.
          if (!package_content && variant && !baseContent.includes(`PK:${variant}`)) {
             baseContent = `${baseContent} (PK:${variant})`.substring(0, 100);
          }
          return baseContent;
        })(),
        package_no_open: package_no_open ?? false,
        package_replacement: false,
        package_old_tracking: ""
      }, {
        headers: {
          Authorization: `Bearer ${COLIATY_PUBLIC_KEY}:${COLIATY_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      // Update local BD
      await prisma.order.update({
        where: { id: order.id },
        data: {
          customerName: package_reciever || order.customerName,
          customerPhone: package_phone || order.customerPhone,
          totalAmountMad: (package_price !== undefined && package_price !== null && package_price !== '') ? Number(package_price) : order.totalAmountMad,
          customerCity: package_city || order.customerCity,
          customerAddress: package_addresse || order.customerAddress,
          packageContent: package_content || order.packageContent,
          packageNoOpen: package_no_open ?? order.packageNoOpen,
        }
      });

      res.status(200).json({
        status: 'success',
        message: 'Colis mis à jour avec succès',
        data: response.data?.data
      });
    } catch (error: any) {
      console.error('[Coliaty] Parcel Normal Update Error:', error.response?.data || error.message);
      
      const status = error.response?.status;
      const data = error.response?.data;
      
      if (status === 400 || status === 403 || status === 404 || status === 422) {
         let exactError = "Erreur de validation Coliaty.";
         if (data?.errors) {
            if (typeof data.errors === 'object' && !Array.isArray(data.errors) && Object.values(data.errors).length > 0) {
               exactError = String(Object.values(data.errors)[0]);
            } else if (Array.isArray(data.errors) && data.errors.length > 0) {
               exactError = String(data.errors[0]);
            }
         } else if (data?.message) {
            exactError = data.message;
         }
         throw new AppException(status, `Coliaty: ${exactError}`);
      }

      throw new AppException(500, `Échec de mise à jour Coliaty (Status: ${status || 'Aucun'}). Détail: ${error.message}`);
    }
  })
);
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pickup Notes — Coliaty proxy
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.post(
  '/pickup-note/create',
  authenticate,
  authorize('HELPER', 'SUPER_ADMIN', 'VENDOR', 'FULFILLMENT_OPERATOR'),
  asyncHandler(async (req, res) => {
    const cfg = getColiatyConfig();
    try {
      const response = await coliatyRequest({
        method: 'POST',
        url: `${cfg.base}/pickup-note/create`,
        data: {},
        headers: cfg.headers,
        context: 'Création Bon',
      });
      res.json({ status: 'success', data: (response.data as any)?.data || response.data });
    } catch (error: any) {
      handleColiatyError(error, 'Création Bon');
    }
  })
);

router.get(
  '/pickup-note/detail/:reference',
  authenticate,
  authorize('HELPER', 'SUPER_ADMIN', 'VENDOR', 'FULFILLMENT_OPERATOR'),
  asyncHandler(async (req, res) => {
    const { reference } = req.params;
    try {
      const data = await fetchPickupNoteDetail(reference, req.query.refresh === '1');
      res.json({ status: 'success', data });
    } catch (error: any) {
      handleColiatyError(error, 'Détail Bon');
    }
  })
);

/**
 * Details for many pickup notes in a single round-trip.
 *
 * The tickets page needs the live status of every open bon to split them between
 * its tabs. Fetching them one-by-one from the browser is what got the server IP
 * blocked by Coliaty; here they share one request and the throttled queue.
 */
const MAX_BATCH_PICKUP_DETAILS = 120;

router.post(
  '/pickup-notes/details',
  authenticate,
  authorize('HELPER', 'SUPER_ADMIN', 'VENDOR', 'FULFILLMENT_OPERATOR'),
  asyncHandler(async (req, res) => {
    const { references, refresh } = req.body || {};

    if (!Array.isArray(references) || references.length === 0) {
      throw new AppException(400, 'references[] est requis.');
    }

    const unique = [...new Set(references.map((r: any) => String(r).trim()).filter(Boolean))]
      .slice(0, MAX_BATCH_PICKUP_DETAILS);

    const details: Record<string, any> = {};
    const errors: Record<string, string> = {};

    for (const reference of unique) {
      try {
        details[reference] = await fetchPickupNoteDetail(reference, refresh === true);
      } catch (error: any) {
        const data = decodeColiatyError(error?.response?.data);
        errors[reference] = data?.message || error?.message || 'Détail indisponible';
      }
    }

    res.json({
      status: 'success',
      data: {
        details,
        errors,
        truncated: references.length > unique.length,
        queue: coliatyQueueStats(),
      },
    });
  })
);

router.post(
  '/pickup-note/add-parcels',
  authenticate,
  authorize('HELPER', 'SUPER_ADMIN', 'VENDOR', 'FULFILLMENT_OPERATOR'),
  asyncHandler(async (req, res) => {
    const { pickup_note_reference, parcel_codes } = req.body;
    if (!pickup_note_reference || !Array.isArray(parcel_codes) || parcel_codes.length === 0) {
      throw new AppException(400, 'pickup_note_reference et parcel_codes[] sont requis.');
    }
    const cfg = getColiatyConfig();
    try {
      const response = await coliatyRequest({
        method: 'POST',
        url: `${cfg.base}/pickup-note/add-parcels`,
        data: { pickup_note_reference, parcel_codes },
        headers: cfg.headers,
        context: 'Ajout Colis Bon',
      });
      const responseData = (response.data as any)?.data || response.data;

      // Check for ignorable duplicate errors
      const errorParcels = responseData?.error_parcels || {};
      const ignorableIds = Object.values(errorParcels)
        .filter((err: any) => err.error_can_ignore === true && err.error_id)
        .map((err: any) => err.error_id);

      if (ignorableIds.length > 0) {
        console.log(`[Coliaty] Automatically ignoring ${ignorableIds.length} duplicate errors...`);
        for (const error_id of ignorableIds) {
          try {
            await coliatyRequest({
              method: 'POST',
              url: `${cfg.base}/parcel/error/ignore`,
              data: { error_id },
              headers: cfg.headers,
              context: 'Ignorer Erreur Colis',
            });
          } catch (e: any) {
            console.error(`[Coliaty] Failed to ignore error ${error_id}:`, e.message);
          }
        }

        // Retry adding parcels after ignoring errors
        console.log(`[Coliaty] Retrying add-parcels for ${parcel_codes.length} parcels...`);
        const retryRes = await coliatyRequest({
          method: 'POST',
          url: `${cfg.base}/pickup-note/add-parcels`,
          data: { pickup_note_reference, parcel_codes },
          headers: cfg.headers,
          context: 'Ajout Colis Bon (retry)',
        });
        const retryData = (retryRes.data as any)?.data || retryRes.data;

        // Update responseData with the retry result
        Object.assign(responseData, retryData);
      }

      // 1. Persist to DB for successful ones
      const successParcels = responseData?.success_parcels || {};
      const successfulCodes = Array.isArray(successParcels) ? successParcels : Object.keys(successParcels);

      if (successfulCodes.length > 0) {
        console.log(`[Coliaty] Persisting pickup ref ${pickup_note_reference} for ${successfulCodes.length} parcels via raw SQL`);
        await prisma.$executeRaw`
          UPDATE orders 
          SET "coliatyPickupRef" = ${pickup_note_reference} 
          WHERE "coliatyPackageCode" IN (${Prisma.join(successfulCodes)})
        `;
      }

      // 2. Handle self-healing for "already in pickup" errors
      const finalErrorParcels = responseData?.error_parcels || {};
      const errorCodes = Object.keys(finalErrorParcels);

      for (const code of errorCodes) {
        const errorEntry = finalErrorParcels[code];
        const errorMsg = errorEntry?.message || errorEntry?.error_message || "";
        if (errorMsg.includes('déjà dans un bon de ramassage')) {
          console.log(`[Coliaty] Self-healing pickup ref for ${code}...`);
          try {
            // 1. First: use the pickup_note_reference directly from the error response
            let actualRef = errorEntry?.pickup_note_reference;

            // 2. Fallback: fetch parcel info if not provided in the error
            if (!actualRef) {
              const parcelInfo = await coliatyRequest<any>({
                method: 'GET',
                url: `${cfg.base}/parcel/${code}`,
                headers: cfg.headers,
                context: `Info colis ${code}`,
              });
              actualRef = parcelInfo.data?.data?.pickup_note_reference ||
                          parcelInfo.data?.pickup_note_reference ||
                          parcelInfo.data?.data?.pickup_note_ref ||
                          parcelInfo.data?.pickup_note_ref;
            }
            
            if (actualRef) {
              console.log(`[Coliaty] Found actual ref ${actualRef} for ${code}. Updating DB via raw SQL.`);
              await prisma.$executeRaw`
                UPDATE orders 
                SET "coliatyPickupRef" = ${actualRef} 
                WHERE "coliatyPackageCode" = ${code}
              `;
            }
          } catch (e: any) {
            console.error(`[Coliaty] Failed to self-heal ${code}:`, e.message);
          }
        }
      }

      // The bon changed upstream, so any cached detail/label for it is stale.
      invalidatePickupNoteDetail(pickup_note_reference);
      invalidateLabel(`pickup:${pickup_note_reference}`);

      res.json({ status: 'success', data: responseData });
    } catch (error: any) {
      handleColiatyError(error, 'Ajout Colis Bon');
    }
  })
);

router.post(
  '/pickup-note/remove-parcels',
  authenticate,
  authorize('HELPER', 'SUPER_ADMIN', 'VENDOR', 'FULFILLMENT_OPERATOR'),
  asyncHandler(async (req, res) => {
    const { pickup_note_reference, parcel_codes } = req.body;
    if (!pickup_note_reference || !Array.isArray(parcel_codes) || parcel_codes.length === 0) {
      throw new AppException(400, 'pickup_note_reference et parcel_codes[] sont requis.');
    }
    const cfg = getColiatyConfig();
    try {
      const response = await coliatyRequest({
        method: 'POST',
        url: `${cfg.base}/pickup-note/remove-parcels`,
        data: { pickup_note_reference, parcel_codes },
        headers: cfg.headers,
        context: 'Retrait Colis Bon',
      });

      // Drop the local reference too, otherwise the parcel stays hidden from the
      // "en attente" tab even though Coliaty no longer has it in the bon.
      const codes = parcel_codes.map((c: any) => String(c)).filter(Boolean);
      if (codes.length > 0) {
        await prisma.$executeRaw`
          UPDATE orders
          SET "coliatyPickupRef" = NULL
          WHERE "coliatyPackageCode" IN (${Prisma.join(codes)})
            AND "coliatyPickupRef" = ${pickup_note_reference}
        `;
      }

      invalidatePickupNoteDetail(pickup_note_reference);
      invalidateLabel(`pickup:${pickup_note_reference}`);

      res.json({ status: 'success', data: (response.data as any)?.data || response.data });
    } catch (error: any) {
      handleColiatyError(error, 'Retrait Colis Bon');
    }
  })
);

router.get(
  '/pickup-note/:reference/generate-labels',
  authenticate,
  authorize('HELPER', 'SUPER_ADMIN', 'VENDOR', 'FULFILLMENT_OPERATOR'),
  asyncHandler(async (req, res) => {
    const { reference } = req.params;
    try {
      const pdf = await getPickupNoteLabelsPdf(reference, req.query.refresh === '1');
      res.json({ status: 'success', data: { pdf } });
    } catch (error: any) {
      handleColiatyError(error, 'Génération PDF Bon');
    }
  })
);

// Helper to handle Coliaty specific errors
function handleColiatyError(error: any, context: string) {
  const data = decodeColiatyError(error?.response?.data);
  const status = error?.response?.status;

  console.error(`[Coliaty] ${context} Error:`, data || error.message);

  // Coliaty throttles per IP and answers 429 once the quota is spent. Surface it
  // as a 429 with an actionable message instead of a generic 500 — the shared
  // Coliaty queue has already retried with backoff by the time we get here.
  if (status === 429) {
    throw new AppException(
      429,
      `Coliaty a temporairement limité nos requêtes (${context}). Les envois sont mis en file d'attente — réessayez dans une minute.`
    );
  }

  if (status && [400, 401, 403, 404, 422].includes(status)) {
    let msg = data?.message || "Erreur API Coliaty";
    if (data?.details) {
      msg += ` (${data.details})`;
    }
    if (data?.errors) {
      const firstErr = Array.isArray(data.errors) ? data.errors[0] : Object.values(data.errors)[0];
      if (firstErr) msg = String(firstErr);
    }
    throw new AppException(status, `Coliaty (${context}): ${msg}`);
  }
  throw new AppException(500, `Erreur ${context} (Status: ${status || '?'}). Détail: ${error.message}`);
}

export default router;
