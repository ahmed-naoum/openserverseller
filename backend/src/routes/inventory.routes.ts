import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

// Get the user's purchased inventory (SELLER / GROSSELLER)
router.get(
    '/purchased',
    authenticate,
    authorize('SELLER', 'GROSSELLER', 'VENDOR'),
    asyncHandler(async (req, res) => {
        const { page = 1, limit = 20 } = req.query;

        const where: any = { userId: req.user!.id };

        const [inventory, total] = await Promise.all([
            prisma.productInventory.findMany({
                where,
                include: {
                    product: {
                        include: {
                            category: true,
                            images: {
                                where: { isPrimary: true },
                                take: 1
                            }
                        }
                    }
                },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                orderBy: { acquiredAt: 'desc' },
            }),
            prisma.productInventory.count({ where }),
        ]);

        res.json({
            status: 'success',
            data: {
                inventory: inventory.map(inv => ({
                    ...inv,
                    product: {
                        ...inv.product,
                        primaryImage: inv.product.images[0]?.imageUrl
                    }
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

// Get the user's claimed affiliate products (AFFILIATE)
router.get(
    '/claimed',
    authenticate,
    authorize('AFFILIATE'),
    asyncHandler(async (req, res) => {
        const { page = 1, limit = 20 } = req.query;

        const where: any = { userId: req.user!.id, status: 'ACTIVE' };

        const [claims, total] = await Promise.all([
            prisma.affiliateClaim.findMany({
                where,
                include: {
                    product: {
                        include: {
                            category: true,
                            images: {
                                where: { isPrimary: true },
                                take: 1
                            }
                        }
                    }
                },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                orderBy: { claimedAt: 'desc' },
            }),
            prisma.affiliateClaim.count({ where }),
        ]);

        res.json({
            status: 'success',
            data: {
                claims: claims.map(claim => ({
                    ...claim,
                    product: {
                        ...claim.product,
                        primaryImage: claim.product.images[0]?.imageUrl
                    }
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

export default router;
