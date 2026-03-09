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

        const inventoryWhere: any = { userId: req.user!.id };
        const myProductsWhere: any = { ownerId: req.user!.id }; // Products the grosseller created

        const [inventory, myProducts, myRequests] = await Promise.all([
            prisma.productInventory.findMany({
                where: inventoryWhere,
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
                orderBy: { acquiredAt: 'desc' },
            }),
            req.user?.roleName === 'GROSSELLER' ? prisma.product.findMany({
                where: myProductsWhere,
                include: {
                    category: true,
                    images: {
                        where: { isPrimary: true },
                        take: 1
                    }
                },
                orderBy: { createdAt: 'desc' }
            }) : Promise.resolve([]),
            prisma.supportRequest.findMany({
                where: {
                    userId: req.user!.id,
                    status: { in: ['OPEN', 'IN_PROGRESS'] },
                    productId: { not: null }
                },
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
                orderBy: { createdAt: 'desc' }
            })
        ]);

        // Map purchased inventory
        const purchasedItems = inventory.map(inv => ({
            id: inv.id,
            quantity: inv.quantity,
            acquiredAt: inv.acquiredAt,
            product: {
                ...inv.product,
                primaryImage: inv.product.images[0]?.imageUrl
            }
        }));

        // Map owned products as inventory items
        const ownedItems = myProducts.map((prod: any) => ({
            id: `owned-${prod.id}`,
            quantity: prod.stockQuantity || 0,
            acquiredAt: prod.createdAt,
            isOwned: true,
            status: prod.status, // PENDING, APPROVED, etc.
            product: {
                ...prod,
                primaryImage: prod.images[0]?.imageUrl
            }
        }));

        // Map requested items (pending approvals from marketplace)
        const requestedItems = myRequests
            .filter((req: any) => req.product)
            .map((req: any) => ({
                id: `req-${req.id}`,
                quantity: 0,
                acquiredAt: req.createdAt,
                isOwned: false,
                isPendingRequest: true,
                status: 'PENDING',
                product: {
                    ...req.product,
                    primaryImage: req.product.images?.[0]?.imageUrl
                }
            }));

        // Combine and sort
        const rawCombined = [...purchasedItems, ...ownedItems, ...requestedItems];

        // Deduplicate by product ID
        // Priority: 1. Purchased (>0 quantity usually), 2. Pending Request, 3. Owned (0 quantity base)
        const uniqueProducts = new Map();

        const getRank = (i: any) => {
            if (i.isOwned) return 3;
            if (i.isPendingRequest) return 2;
            return 1;
        };

        for (const item of rawCombined) {
            const prodId = item.product?.id;
            if (prodId) {
                const existing = uniqueProducts.get(prodId);
                if (!existing) {
                    uniqueProducts.set(prodId, item);
                } else {
                    if (getRank(item as any) < getRank(existing as any)) {
                        uniqueProducts.set(prodId, item);
                    }
                }
            }
        }

        const combinedInventory = Array.from(uniqueProducts.values()).sort((a, b) =>
            new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime()
        );

        // Manual Pagination
        const startIndex = (Number(page) - 1) * Number(limit);
        const endIndex = startIndex + Number(limit);
        const paginatedInventory = combinedInventory.slice(startIndex, endIndex);

        res.json({
            status: 'success',
            data: {
                inventory: paginatedInventory,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total: combinedInventory.length,
                    totalPages: Math.ceil(combinedInventory.length / Number(limit)),
                },
            },
        });
    })
);

// Get the user's claimed affiliate products (AFFILIATE)
router.get(
    '/claimed',
    authenticate,
    authorize('VENDOR', 'INFLUENCER', 'AFFILIATE'),
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
