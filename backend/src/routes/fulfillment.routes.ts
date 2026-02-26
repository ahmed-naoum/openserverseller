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
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new AppException(400, 'Validation failed');
        }

        const { type, subject, description, productId } = req.body;

        const request = await prisma.supportRequest.create({
            data: {
                userId: req.user!.id,
                type,
                subject,
                description: productId ? `${description} (Product ID: ${productId})` : description,
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

// Admin: Get all fulfillment requests
router.get(
    '/',
    authenticate,
    authorize('SUPER_ADMIN'),
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

// Admin: Fulfill a request (assigns inventory or claim)
router.post(
    '/:id/fulfill',
    authenticate,
    authorize('SUPER_ADMIN'),
    [
        body('actionType').notEmpty().isIn(['GRANT_INVENTORY', 'GRANT_CLAIM', 'CLOSE_ONLY']),
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
            // 1. Process the inventory or claim grant
            if (actionType === 'GRANT_INVENTORY') {
                if (!productId) throw new AppException(400, 'Product ID is required for inventory grant');

                await tx.productInventory.create({
                    data: {
                        userId: supportRequest.userId,
                        productId: Number(productId),
                        quantity: quantity ? Number(quantity) : 1
                    }
                });
            } else if (actionType === 'GRANT_CLAIM') {
                if (!productId) throw new AppException(400, 'Product ID is required for claim grant');

                await tx.affiliateClaim.create({
                    data: {
                        userId: supportRequest.userId,
                        productId: Number(productId),
                        status: 'ACTIVE'
                    }
                });
            }

            // 2. Mark request as resolved
            await tx.supportRequest.update({
                where: { id: Number(id) },
                data: { status: 'RESOLVED' }
            });
        });

        res.json({
            status: 'success',
            message: 'Request fulfilled securely and closed.'
        });
    })
);

export default router;
