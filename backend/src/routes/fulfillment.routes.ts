import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

// Create a new support/fulfillment request
router.post(
    '/',
    authenticate,
    [
        body('type').notEmpty().isIn(['DELIVERY_FULFILLMENT', 'PRODUCT_CLAIM', 'GENERAL_SUPPORT']),
        body('subject').notEmpty().trim(),
        body('description').notEmpty().trim(),
        body('productId').optional().isInt()
    ],
    asyncHandler(async (req: any, res: any) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new AppException(400, 'Validation failed');
        }

        const { type, subject, description, productId } = req.body;

        // Duplicate Check: Prevent multiple OPEN/IN_PROGRESS requests for the same product
        if (productId) {
            const existingRequest = await (prisma.supportRequest as any).findFirst({
                where: {
                    userId: req.user!.id,
                    productId: Number(productId),
                    status: { in: ['OPEN', 'IN_PROGRESS'] }
                } as any
            });

            if (existingRequest) {
                throw new AppException(400, 'Une demande est déjà en cours pour ce produit.');
            }
        }

        const request = await prisma.supportRequest.create({
            data: {
                userId: req.user!.id,
                type,
                subject,
                description: description,
                productId: productId ? Number(productId) : null,
                status: 'OPEN',
            },
        });

        res.status(201).json({
            status: 'success',
            message: 'Support request submitted successfully',
            data: { request },
        });
    })
);

// Get current user's fulfillment requests
router.get(
    '/my-requests',
    authenticate,
    asyncHandler(async (req, res) => {
        const { page = 1, limit = 20, status, type } = req.query;

        const where: any = { userId: req.user!.id };
        if (status) where.status = status;
        if (type) where.type = type;

        const [requests, total] = await Promise.all([
            prisma.supportRequest.findMany({
                where,
                include: {
                    product: {
                        include: {
                            images: {
                                where: { isPrimary: true },
                                take: 1
                            }
                        }
                    }
                },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                orderBy: { createdAt: 'desc' },
            }),
            prisma.supportRequest.count({ where }),
        ]);

        res.json({
            status: 'success',
            data: {
                requests,
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

// Admin/Agent: Get all fulfillment requests
router.get(
    '/',
    authenticate,
    authorize('SUPER_ADMIN', 'CONFIRMATION_AGENT'),
    asyncHandler(async (req, res) => {
        const { page = 1, limit = 20, status, type } = req.query;

        const where: any = {};
        if (status) where.status = status;
        if (type) where.type = type;

        const [requests, total] = await Promise.all([
            prisma.supportRequest.findMany({
                where,
                include: {
                    user: {
                        select: { id: true, email: true, profile: true }
                    },
                    product: {
                        include: {
                            images: {
                                where: { isPrimary: true },
                                take: 1
                            }
                        }
                    }
                },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                orderBy: { createdAt: 'desc' },
            }),
            prisma.supportRequest.count({ where }),
        ]);

        res.json({
            status: 'success',
            data: {
                requests,
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

// Admin/Agent: Fulfill a request (assigns inventory or claim)
router.post(
    '/:id/fulfill',
    authenticate,
    authorize('SUPER_ADMIN', 'CONFIRMATION_AGENT'),
    [
        body('actionType').notEmpty().isIn(['GRANT_INVENTORY', 'GRANT_CLAIM', 'CLOSE_ONLY', 'CLOSE']),
        body('productId').optional().isInt(),
        body('quantity').optional().isInt({ min: 1 })
    ],
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { actionType, productId, quantity } = req.body;

        const supportRequest = await prisma.supportRequest.findUnique({
            where: { id: Number(id) }
        });

        if (!supportRequest) {
            throw new AppException(404, 'Support request not found');
        }

        if (supportRequest.status === 'RESOLVED' || supportRequest.status === 'CLOSED') {
            throw new AppException(400, 'Request is already resolved or closed');
        }

        await prisma.$transaction(async (tx) => {
            // Use the productId from the request if payload doesn't provide one
            const finalProductId = productId ? Number(productId) : (supportRequest as any).productId;

            // 1. Process the inventory or claim grant
            if (actionType === 'GRANT_INVENTORY') {
                if (!finalProductId) throw new AppException(400, 'Product ID is required for inventory grant');

                await tx.productInventory.create({
                    data: {
                        userId: supportRequest.userId,
                        productId: Number(finalProductId),
                        quantity: quantity ? Number(quantity) : 1
                    }
                });
            } else if (actionType === 'GRANT_CLAIM') {
                if (!finalProductId) throw new AppException(400, 'Product ID is required for claim grant');

                await tx.affiliateClaim.create({
                    data: {
                        userId: supportRequest.userId,
                        productId: Number(finalProductId),
                        status: 'ACTIVE'
                    }
                });
            }

            // 2. Mark request as resolved or closed
            const newStatus = (actionType === 'CLOSE' || actionType === 'CLOSE_ONLY') ? 'CLOSED' : 'RESOLVED';
            await tx.supportRequest.update({
                where: { id: Number(id) },
                data: { status: newStatus }
            });
        });

        res.json({
            status: 'success',
            message: 'Request fulfilled securely and closed.'
        });
    })
);

// Admin/Agent: Reject or Revoke a request (even if already approved)
router.patch(
    '/:id/reject',
    authenticate,
    authorize('SUPER_ADMIN', 'CONFIRMATION_AGENT'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        const supportRequest = await prisma.supportRequest.findUnique({
            where: { id: Number(id) }
        });

        if (!supportRequest) {
            throw new AppException(404, 'Support request not found');
        }

        await prisma.$transaction(async (tx) => {
            const productId = (supportRequest as any).productId;

            // If the request was already RESOLVED, revoke the granted items
            if (supportRequest.status === 'RESOLVED' && productId) {
                // Remove affiliate claim if it exists
                await tx.affiliateClaim.deleteMany({
                    where: {
                        userId: supportRequest.userId,
                        productId: Number(productId),
                    }
                });

                // Remove inventory grant if it exists
                await tx.productInventory.deleteMany({
                    where: {
                        userId: supportRequest.userId,
                        productId: Number(productId),
                    }
                });
            }

            // Mark the request as REJECTED
            await tx.supportRequest.update({
                where: { id: Number(id) },
                data: { status: 'CLOSED' }
            });
        });

        res.json({
            status: 'success',
            message: 'Demande rejetée et droits révoqués avec succès.'
        });
    })
);

export default router;
