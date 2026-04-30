import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

const generateOrderNumber = (): string => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `OS-${dateStr}-${random}`;
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

    res.json({
      status: 'success',
      data: {
        orders: orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          customerPhone: o.customerPhone,
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

    const COLIATY_PUBLIC_KEY = process.env.COLIATY_PUBLIC_KEY;
    const COLIATY_SECRET_KEY = process.env.COLIATY_SECRET_KEY;
    const COLIATY_BASE_URL = process.env.COLIATY_BASE_URL || 'https://customer-api-v1.coliaty.com';

    if (!COLIATY_PUBLIC_KEY || !COLIATY_SECRET_KEY || COLIATY_PUBLIC_KEY === 'your_coliaty_public_key') {
      throw new AppException(500, '[Coliaty] Clés API non configurées.');
    }

    try {
      const response = await axios.get(`${COLIATY_BASE_URL.replace(/\/$/, '')}/parcel/generate-label/${code}`, {
        headers: {
          Authorization: `Bearer ${COLIATY_PUBLIC_KEY}:${COLIATY_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      res.status(200).json({
        status: 'success',
        data: response.data?.data
      });
    } catch (error: any) {
      console.error('[Coliaty] Label Generation Error:', error.response?.data || error.message);
      const status = error.response?.status || 500;
      const data = error.response?.data;
      throw new AppException(status, data?.message || 'Erreur lors de la génération de l\'étiquette');
    }
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

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              include: { images: { where: { isPrimary: true }, take: 1 } }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Group by product
    const productGroups: Record<number, any> = {};

    orders.forEach(order => {
      order.items.forEach(item => {
        const product = item.product;
        if (!productGroups[product.id]) {
          productGroups[product.id] = {
            id: product.id,
            name: product.nameFr,
            image: product.images[0]?.imageUrl,
            pendingParcels: []
          };
        }
        
        // Add order to this product's pending parcels if not already added
        if (!productGroups[product.id].pendingParcels.find((p: any) => p.id === order.id)) {
            productGroups[product.id].pendingParcels.push({
              id: order.id,
              orderNumber: order.orderNumber,
              customerName: order.customerName,
              customerPhone: order.customerPhone,
              customerCity: order.customerCity,
              coliatyPackageCode: order.coliatyPackageCode,
              totalAmountMad: order.totalAmountMad,
              createdAt: order.createdAt
            });
        }
      });
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

    const order = await prisma.order.findFirst({
      where,
      include: {
        vendor: { include: { profile: true } },
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
      process.env.PLATFORM_COMMISSION_PERCENTAGE || '15'
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
      'PENDING',
      'CONFIRMED',
      'IN_PRODUCTION',
      'READY_FOR_SHIPPING',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
      'RETURNED',
      'REFUNDED',
    ];

    if (!validStatuses.includes(status)) {
      throw new AppException(400, 'Invalid status');
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
          notes: actionType === 'CLONE_PRODUCT' ? `Produit cloné et commande confirmée. ${notes || ''}` : notes,
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
        
        const commissionPercentage = parseFloat(process.env.PLATFORM_COMMISSION_PERCENTAGE || '15');
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
      const COLIATY_PUBLIC_KEY = process.env.COLIATY_PUBLIC_KEY;
      const COLIATY_SECRET_KEY = process.env.COLIATY_SECRET_KEY;
      const COLIATY_BASE_URL = process.env.COLIATY_BASE_URL || 'https://customer-api-v1.coliaty.com';

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
        data: { status: 'ORDERED' },
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

    const COLIATY_PUBLIC_KEY = process.env.COLIATY_PUBLIC_KEY;
    const COLIATY_SECRET_KEY = process.env.COLIATY_SECRET_KEY;
    const COLIATY_BASE_URL = process.env.COLIATY_BASE_URL || 'https://customer-api-v1.coliaty.com';

    if (!COLIATY_PUBLIC_KEY || !COLIATY_SECRET_KEY || COLIATY_PUBLIC_KEY === 'your_coliaty_public_key') {
      throw new AppException(500, '[Coliaty] Clés API non configurées.');
    }

    try {
      const response = await axios.post(`${COLIATY_BASE_URL.replace(/\/$/, '')}/parcel-change-demand/create`, {
        package_code: (order as any).coliatyPackageCode,
        request_type,
        package_phone,
        package_reciever,
        package_price,
        package_note,
        ...(request_type === 'CHANGE_DESTINATION' ? { package_city, package_address } : {})
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
          totalAmountMad: package_price ? Number(package_price) : order.totalAmountMad,
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

    const COLIATY_PUBLIC_KEY = process.env.COLIATY_PUBLIC_KEY;
    const COLIATY_SECRET_KEY = process.env.COLIATY_SECRET_KEY;
    const COLIATY_BASE_URL = process.env.COLIATY_BASE_URL || 'https://customer-api-v1.coliaty.com';

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
          totalAmountMad: package_price ? Number(package_price) : order.totalAmountMad,
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



export default router;
