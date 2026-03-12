import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';

const prisma = new PrismaClient();

export const getWarehouseDashboard = async (req: Request, res: Response) => {
  const [
    pendingJobs,
    inProgressJobs,
    completedJobs,
    lowStockItems,
  ] = await Promise.all([
    prisma.productionJob.count({ where: { status: 'PENDING' } }),
    prisma.productionJob.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.productionJob.count({ where: { status: 'COMPLETED' } }),
    prisma.inventory.findMany({
      where: { quantity: { lte: 10 } },
      include: { product: true, warehouse: true },
      take: 10,
    }),
  ]);

  res.json({
    status: 'success',
    data: {
      stats: {
        pendingJobs,
        inProgressJobs,
        completedJobs,
        lowStockCount: lowStockItems.length,
      },
      lowStockItems,
    },
  });
};

export const getProductionJobs = async (req: Request, res: Response) => {
  const { status, warehouseId, page = 1, limit = 20 } = req.query;

  const where: any = {};
  if (status) where.status = status;
  if (warehouseId) where.batch = { warehouseId: Number(warehouseId as string) };

  const [jobs, total] = await Promise.all([
    prisma.productionJob.findMany({
      where,
      include: {
        order: {
          include: {
            brand: true,
            items: { include: { product: true } },
          },
        },
        batch: { include: { warehouse: true } },
        assignedUser: { include: { profile: true } },
      },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.productionJob.count({ where }),
  ]);

  res.json({
    status: 'success',
    data: {
      jobs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    },
  });
};

export const updateJobStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const job = await prisma.productionJob.findUnique({
    where: { id: Number(id) },
  });

  if (!job) {
    throw new AppException(404, 'Production job not found');
  }

  const updatedJob = await prisma.productionJob.update({
    where: { id: Number(id) },
    data: {
      status,
      ...(status === 'IN_PROGRESS' && { startedAt: new Date(), assignedTo: req.user!.id }),
      ...(status === 'COMPLETED' && { completedAt: new Date() }),
    },
  });

  if (status === 'COMPLETED') {
    const allJobs = await prisma.productionJob.findMany({
      where: { batchId: job.batchId },
    });

    const allCompleted = allJobs.every((j) => j.status === 'COMPLETED');

    if (allCompleted && job.batchId) {
      await prisma.productionBatch.update({
        where: { id: job.batchId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    }
  }

  res.json({
    status: 'success',
    message: 'Job status updated',
    data: { job: updatedJob },
  });
};

export const getInventory = async (req: Request, res: Response) => {
  const { warehouseId, lowStock, page = 1, limit = 50 } = req.query;

  const where: any = {};
  if (warehouseId) where.warehouseId = Number(warehouseId as string);
  if (lowStock === 'true') where.quantity = { lte: 10 };

  const [inventory, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      include: {
        product: {
          include: {
            images: { where: { isPrimary: true }, take: 1 },
            categories: true,
          },
        },
        warehouse: true,
      },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { product: { nameFr: 'asc' } },
    }),
    prisma.inventory.count({ where }),
  ]);

  res.json({
    status: 'success',
    data: {
      inventory: inventory.map((item) => ({
        ...item,
        availableQuantity: item.quantity - item.reservedQuantity,
        isLowStock: item.quantity <= 10,
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    },
  });
};

export const updateInventory = async (req: Request, res: Response) => {
  const { productId, warehouseId, quantity, operation = 'set' } = req.body;

  const existing = await prisma.inventory.findUnique({
    where: {
      warehouseId_productId: {
        warehouseId: Number(warehouseId),
        productId: Number(productId),
      },
    },
  });

  let inventory;
  if (existing) {
    inventory = await prisma.inventory.update({
      where: {
        warehouseId_productId: {
          warehouseId: Number(warehouseId),
          productId: Number(productId),
        },
      },
      data: {
        quantity:
          operation === 'add'
            ? { increment: quantity }
            : operation === 'subtract'
            ? { decrement: quantity }
            : quantity,
      },
    });
  } else {
    inventory = await prisma.inventory.create({
      data: {
        warehouseId: Number(warehouseId),
        productId: Number(productId),
        quantity,
        reservedQuantity: 0,
      },
    });
  }

  res.json({
    status: 'success',
    message: 'Inventory updated',
    data: { inventory },
  });
};

export const createProductionBatch = async (req: Request, res: Response) => {
  const { warehouseId, orderIds } = req.body;

  const batchNumber = `BATCH-${Date.now()}`;

  const batch = await prisma.productionBatch.create({
    data: {
      batchNumber,
      warehouseId: Number(warehouseId),
      status: 'PENDING',
    },
  });

  if (orderIds && orderIds.length > 0) {
    await prisma.productionJob.createMany({
      data: orderIds.map((orderId: string) => ({
        batchId: batch.id,
        orderId: Number(orderId),
        status: 'PENDING',
      })),
    });
  }

  res.status(201).json({
    status: 'success',
    message: 'Production batch created',
    data: { batch },
  });
};
