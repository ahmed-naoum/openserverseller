import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
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
    const { page = 1, limit = 20, status, brandId, startDate, endDate } = req.query;

    const where: any = {};

    if (req.user!.roleName === 'VENDOR') {
      where.vendorId = req.user!.id;
    }

    if (status) where.status = status;
    if (brandId) where.brandId = Number(brandId as string);

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          brand: true,
          items: {
            include: {
              product: {
                include: { images: { where: { isPrimary: true }, take: 1 } },
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
          brand: { id: o.brand.id, name: o.brand.name },
          items: o.items.map((item) => ({
            id: item.id,
            productName: item.product.nameFr,
            productImage: item.product.images[0]?.imageUrl,
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
        brand: { include: { bankAccounts: true } },
        vendor: { include: { profile: true } },
        items: {
          include: {
            product: {
              include: {
                images: { orderBy: { sortOrder: 'asc' } },
                category: true,
              },
            },
            customization: true,
          },
        },
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
    body('brandId').notEmpty(),
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
      brandId,
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

    const brand = await prisma.brand.findFirst({
      where: {
        id: Number(brandId),
        vendorId,
        status: 'APPROVED',
      },
    });

    if (!brand) {
      throw new AppException(404, 'Brand not found or not approved');
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

      if (item.customizationId) {
        const customization = await prisma.brandProductCustomization.findUnique({
          where: { id: Number(item.customizationId) },
        });
        if (customization && customization.customPriceMad) {
          unitPrice = customization.customPriceMad;
        }
      }

      const totalPrice = Number(unitPrice) * item.quantity;
      totalAmountMad += totalPrice;

      orderItems.push({
        productId: product.id,
        customizationId: item.customizationId ? Number(item.customizationId) : null,
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
          brandId: brand.id,
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
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;

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

    const where: any = { id: BigInt(id) };
    if (req.user!.roleName === 'VENDOR') {
      where.vendorId = req.user!.id;
    }

    const order = await prisma.order.findFirst({ where });

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
          notes,
        },
      });

      const updated = await tx.order.update({
        where: { id: order.id },
        data: { status },
      });

      if (status === 'DELIVERED' && order.paymentMethod === 'COD') {
        const wallet = await tx.wallet.upsert({
          where: { userId: order.vendorId },
          create: {
            userId: order.vendorId,
            balanceMad: order.vendorEarningMad,
            totalEarnedMad: order.vendorEarningMad,
          },
          update: {
            balanceMad: { increment: order.vendorEarningMad },
            totalEarnedMad: { increment: order.vendorEarningMad },
          },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            orderId: order.id,
            type: 'CREDIT',
            amountMad: order.vendorEarningMad,
            balanceAfterMad: wallet.balanceMad,
            description: `Order ${order.orderNumber} delivered - COD collected`,
          },
        });

        // Handled by orderId in walletTransaction.create
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

    await prisma.$transaction(async (tx) => {
      // 1. Delete order items
      await tx.orderItem.deleteMany({
        where: { orderId: order.id },
      });

      // 2. Delete the order
      await tx.order.delete({
        where: { id: order.id },
      });

      // 3. Revert the lead status
      await tx.lead.update({
        where: { id: order.leadId! },
        data: { status: 'ORDERED' },
      });
    });

    res.json({
      status: 'success',
      message: 'Order reverted to lead successfully',
    });
  })
);

export default router;
