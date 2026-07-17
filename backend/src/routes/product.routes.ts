import { prisma } from '../lib/prisma.js';
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';

const router = Router();

const checkProductPermission = asyncHandler(async (req: Request, _res: Response, next: any) => {
  const user = req.user;
  if (!user) throw new AppException(401, 'Authentication required');
  
  if (user.roleName === 'SUPER_ADMIN') return next();
  
  if (user.roleName === 'HELPER' && user.canManageProducts) {
    // If it's a specific product operation (id present in params)
    const { id } = req.params;
    if (id && !isNaN(Number(id))) {
      const product = await prisma.product.findUnique({
        where: { id: Number(id) },
        select: { ownerId: true }
      });
      
      if (!product) throw new AppException(404, 'Product not found');
      
      // Check if this vendor is assigned to the helper
      const assignment = await prisma.helperUserAssignment.findUnique({
        where: {
          helperId_targetUserId: {
            helperId: user.id,
            targetUserId: product.ownerId || 0
          }
        }
      });
      
      if (assignment || product.ownerId === user.id) return next();
      throw new AppException(403, 'You are not authorized to manage this product');
    }
    return next(); // For non-specific operations (like list)
  }
  
  throw new AppException(403, 'Permission denied');
});

async function grantProductToOwner(productId: number, ownerId: number, ownerMode: string) {
  if (!ownerId) return;

  const ownerUser = await prisma.user.findUnique({
    where: { id: ownerId },
    include: { role: true }
  });

  if (!ownerUser) return;

  const ownerRole = ownerUser.role.name;
  const product = await prisma.product.findUnique({
    where: { id: productId }
  });
  if (!product) return;

  const targetMode = ownerMode === 'SELLER' ? 'SELLER' : 'AFFILIATE';

  if (ownerRole === 'INFLUENCER') {
    // Influencers can only be in AFFILIATE mode (and optionally INFLUENCER if configured)
    await prisma.affiliateClaim.deleteMany({
      where: { userId: ownerId, productId: product.id, userMode: 'SELLER' }
    });
    await prisma.productInventory.deleteMany({
      where: { userId: ownerId, productId: product.id }
    });

    const existingClaim = await prisma.affiliateClaim.findUnique({
      where: {
        userId_productId_userMode: {
          userId: ownerId,
          productId: product.id,
          userMode: 'AFFILIATE'
        }
      }
    });
    if (!existingClaim) {
      await prisma.affiliateClaim.create({
        data: {
          userId: ownerId,
          productId: product.id,
          status: 'APPROVED',
          userMode: 'AFFILIATE'
        }
      });
    }

    if (product.visibility.includes('INFLUENCER')) {
      const existingClaimInfluencer = await prisma.affiliateClaim.findUnique({
        where: {
          userId_productId_userMode: {
            userId: ownerId,
            productId: product.id,
            userMode: 'INFLUENCER'
          }
        }
      });
      if (!existingClaimInfluencer) {
        await prisma.affiliateClaim.create({
          data: {
            userId: ownerId,
            productId: product.id,
            status: 'APPROVED',
            userMode: 'INFLUENCER'
          }
        });
      }
    }
  } else if (ownerRole === 'VENDOR') {
    if (targetMode === 'SELLER') {
      // Create SELLER claim, delete AFFILIATE claim
      await prisma.affiliateClaim.deleteMany({
        where: { userId: ownerId, productId: product.id, userMode: 'AFFILIATE' }
      });
      
      const existingClaim = await prisma.affiliateClaim.findUnique({
        where: {
          userId_productId_userMode: {
            userId: ownerId,
            productId: product.id,
            userMode: 'SELLER'
          }
        }
      });
      if (!existingClaim) {
        await prisma.affiliateClaim.create({
          data: {
            userId: ownerId,
            productId: product.id,
            status: 'APPROVED',
            userMode: 'SELLER'
          }
        });
      }

      const existingInventory = await prisma.productInventory.findFirst({
        where: {
          userId: ownerId,
          productId: product.id
        }
      });
      if (!existingInventory) {
        await prisma.productInventory.create({
          data: {
            userId: ownerId,
            productId: product.id,
            quantity: product.stockQuantity || 0
          }
        });
      }
    } else {
      // Create AFFILIATE claim, delete SELLER claim and inventory
      await prisma.affiliateClaim.deleteMany({
        where: { userId: ownerId, productId: product.id, userMode: 'SELLER' }
      });
      await prisma.productInventory.deleteMany({
        where: { userId: ownerId, productId: product.id }
      });

      const existingClaim = await prisma.affiliateClaim.findUnique({
        where: {
          userId_productId_userMode: {
            userId: ownerId,
            productId: product.id,
            userMode: 'AFFILIATE'
          }
        }
      });
      if (!existingClaim) {
        await prisma.affiliateClaim.create({
          data: {
            userId: ownerId,
            productId: product.id,
            status: 'APPROVED',
            userMode: 'AFFILIATE'
          }
        });
      }
    }
  }
}

router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, category, search, status, myProducts, visibility } = req.query;

    const where: any = { isActive: true };

    // Filter by visibility: REGULAR, AFFILIATE, or both
    const userRole = req.user?.roleName;
    if (visibility && visibility !== 'ALL') {
      where.visibility = { has: visibility };
    } else if (!req.user || (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN' && userRole !== 'INFLUENCER' && userRole !== 'HELPER')) {
      // Public/regular users see REGULAR products
      where.visibility = { has: 'REGULAR' };
    }

    if (myProducts === 'true' && req.user) {
      where.ownerId = req.user.id;
      if (status && status !== 'ALL') {
        where.status = status;
      }
    } else if (req.user?.roleName === 'SUPER_ADMIN') {
      if (status && status !== 'ALL') {
        where.status = status;
      }
    } else if (req.user?.roleName === 'HELPER') {
      // Helper sees all products
      if (status && status !== 'ALL') {
        where.status = status;
      }
    } else {
      where.status = 'APPROVED';
    }

    if (category) {
      const categoryRecord = await prisma.category.findUnique({
        where: { slug: category as string },
      });
      if (categoryRecord) where.categories = { some: { id: categoryRecord.id } };
    }

    if (search) {
      where.OR = [
        { nameAr: { contains: search as string, mode: 'insensitive' } },
        { nameFr: { contains: search as string, mode: 'insensitive' } },
        { sku: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          categories: true,
          owner: { select: { id: true, profile: { select: { fullName: true } } } },
          images: {
            where: { isPrimary: true },
            take: 1,
          },
          claims: {
            select: { userId: true, userMode: true }
          }
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: {
        products: products.map((p) => ({
          id: p.id,
          sku: p.sku,
          nameAr: p.nameAr,
          nameFr: p.nameFr,
          description: p.description,
          baseCostMad: p.baseCostMad,
          retailPriceMad: p.retailPriceMad,
          affiliatePriceMad: p.affiliatePriceMad,
          influencerPriceMad: p.influencerPriceMad,
          isCustomizable: p.isCustomizable,
          minProductionDays: p.minProductionDays,
          visibility: p.visibility,
          status: p.status,
           ownerId: p.ownerId,
          ownerName: (p as any).owner?.profile?.fullName || 'SILACOD',
          ownerMode: (p as any).claims?.find((c: any) => c.userId === p.ownerId && c.userMode === 'SELLER') ? 'SELLER' : 'AFFILIATE',
          categories: (p as any).categories, // Bypass strict types if necessary since include was used
          primaryImage: (p as any).images?.[0]?.imageUrl,
          createdAt: p.createdAt,
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
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (isNaN(Number(id))) {
      throw new AppException(400, 'Invalid product ID');
    }

    const [product, inventory, claim, pendingPurchase, pendingClaim] = await Promise.all([
      prisma.product.findUnique({
        where: { id: Number(id) },
        include: {
          categories: true,
          images: { orderBy: { sortOrder: 'asc' } },
          claims: {
            select: { userId: true, userMode: true }
          }
        },
      }),
      req.user ? prisma.productInventory.findFirst({
        where: { userId: req.user.id, productId: Number(id) }
      }) : Promise.resolve(null),
      req.user ? prisma.affiliateClaim.findFirst({
        where: { userId: req.user.id, productId: Number(id), status: 'APPROVED' }
      }) : Promise.resolve(null),
      req.user ? prisma.supportRequest.findFirst({
        where: {
          userId: req.user.id,
          productId: Number(id),
          status: { in: ['OPEN', 'IN_PROGRESS'] }
        }
      }) : Promise.resolve(null),
      req.user ? prisma.affiliateClaim.findFirst({
        where: {
          userId: req.user.id,
          productId: Number(id),
          status: 'PENDING'
        }
      }) : Promise.resolve(null)
    ]);

    const brandingInfo = {
      brandingLabelMockupUrl: (inventory as any)?.brandingLabelMockupUrl || (claim as any)?.brandingLabelMockupUrl || null,
      brandingLabelPrintUrl: (inventory as any)?.brandingLabelPrintUrl || (claim as any)?.brandingLabelPrintUrl || null,
    };

    if (!product) {
      throw new AppException(404, 'Product not found');
    }

    // Public (unauthenticated): only return image, title, price, and category
    if (!req.user) {
      const primaryImage = (product as any).images?.[0]?.imageUrl || null;
      res.json({
        status: 'success',
        data: {
          product: {
            id: product.id,
            nameFr: product.nameFr,
            nameAr: product.nameAr,
            retailPriceMad: product.retailPriceMad,
            affiliatePriceMad: product.affiliatePriceMad,
            influencerPriceMad: product.influencerPriceMad,
            visibility: product.visibility,
            category: product?.categories?.[0] || null,
            images: (product as any).images || [],
          },
          userStatus: null
        },
      });
      return;
    }

    res.json({
      status: 'success',
      data: {
        product: {
          ...product,
          category: product?.categories?.[0] || null,
          ownerMode: (product as any).claims?.find((c: any) => c.userId === product.ownerId && c.userMode === 'SELLER') ? 'SELLER' : 'AFFILIATE'
        },
        userStatus: {
          isBought: !!inventory,
          isClaimed: !!claim,
          isPending: !!pendingPurchase || !!pendingClaim,
          isPurchasePending: !!pendingPurchase,
          isClaimPending: !!pendingClaim,
          pendingRequestId: pendingPurchase?.id || pendingClaim?.id,
          ...brandingInfo
        }
      },
    });
  })
);

router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'GROSSELLER', 'HELPER'),
  [
    body('sku').notEmpty().trim(),
    body('nameAr').notEmpty().trim(),
    body('nameFr').notEmpty().trim(),
    body('categoryIds').isArray({ min: 1 }),
    body('categoryIds.*').isInt(),
    body('retailPriceMad').isFloat({ min: 0 }),
    body('affiliatePriceMad').optional({ nullable: true }).isFloat({ min: 0 }),
    body('influencerPriceMad').optional({ nullable: true }).isFloat({ min: 0 }),
    body('longDescription').optional().isString(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation Errors:', errors.array());
      throw new AppException(400, 'Validation failed', errors.array());
    }

    const { sku, nameAr, nameFr, nameEn, description, longDescription, categoryIds, baseCostMad, retailPriceMad, affiliatePriceMad, influencerPriceMad, isCustomizable, minProductionDays, stockQuantity, imageUrl, imageUrls, isActive, showInHomepage, visibility, status, videoUrls, landingPageUrls, commissionMad, canvaLink, ownerMode } = req.body;

    const existingProduct = await prisma.product.findUnique({
      where: { sku },
    });

    if (existingProduct) {
      throw new AppException(409, 'Product with this SKU already exists');
    }

    const isGrosseller = req.user!.roleName === 'GROSSELLER';
    const finalStatus = isGrosseller ? 'PENDING' : (status ?? 'APPROVED');

    const isAdmin = req.user!.roleName === 'SUPER_ADMIN' || req.user!.roleName === 'ADMIN';
    const finalOwnerId = (isAdmin && req.body.ownerId) ? Number(req.body.ownerId) : Number(req.user!.id);

    if (req.user!.roleName === 'HELPER' && !req.user!.canManageProducts) {
      throw new AppException(403, 'Permission denied');
    }

    // Support both imageUrls (array) and legacy imageUrl (single string)
    const allImageUrls: string[] = Array.isArray(imageUrls) && imageUrls.length > 0
      ? imageUrls.filter((u: string) => u && u.trim())
      : (imageUrl ? [imageUrl] : []);

    const product = await prisma.product.create({
      data: {
        sku,
        nameAr,
        nameFr,
        nameEn,
        description,
        longDescription,
        categories: { connect: categoryIds.map((id: any) => ({ id: Number(id) })) },
        baseCostMad: baseCostMad ? Number(baseCostMad) : 0,
        retailPriceMad,
        affiliatePriceMad: affiliatePriceMad ? Number(affiliatePriceMad) : null,
        influencerPriceMad: influencerPriceMad ? Number(influencerPriceMad) : null,
        isCustomizable: isCustomizable ?? true,
        minProductionDays: Number(minProductionDays ?? 3),
        stockQuantity: stockQuantity ? Number(stockQuantity) : 0,
        isActive: isActive ?? true,
        showInHomepage: showInHomepage === true || showInHomepage === 'true',
        visibility: Array.isArray(visibility) ? visibility : typeof visibility === 'string' ? [visibility] : ['REGULAR'],
        status: finalStatus,
        owner: finalOwnerId ? { connect: { id: finalOwnerId } } : undefined,
        videoUrls: Array.isArray(videoUrls) ? videoUrls : [],
        landingPageUrls: Array.isArray(landingPageUrls) ? landingPageUrls : [],
        commissionMad: commissionMad ? Number(commissionMad) : 0,
        canvaLink: canvaLink || null,
        ...(allImageUrls.length > 0 ? {
          images: {
            create: allImageUrls.map((url: string, index: number) => ({
              imageUrl: url.trim(),
              isPrimary: index === 0,
              sortOrder: index,
            }))
          }
        } : {})
      },
      include: { categories: true, images: { orderBy: { sortOrder: 'asc' } } },
    });

    if (finalOwnerId) {
      await grantProductToOwner(product.id, finalOwnerId, ownerMode || 'AFFILIATE');
    }

    res.status(201).json({
      status: 'success',
      message: 'Product created successfully',
      data: { product },
    });
  })
);

router.patch(
  '/:id/status',
  authenticate,
  checkProductPermission,
  [body('status').isIn(['APPROVED', 'REJECTED'])],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed');
    }

    const { id } = req.params;
    const { status } = req.body;

    const product = await prisma.product.update({
      where: { id: Number(id) },
      data: { status },
    });

    res.json({
      status: 'success',
      message: `Product ${status.toLowerCase()} successfully`,
      data: { product },
    });
  })
);

router.patch(
  '/:id',
  authenticate,
  checkProductPermission,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { 
      imageUrls, 
      categoryIds, 
      categoryId, // extracting to prevent it from going into rest
      ownerId, 
      ownerMode,
      videoUrlsInput, 
      landingPageUrlsInput, 
      videoUrls, 
      landingPageUrls, 
      canvaLink,
      ...rest 
    } = req.body;

    // Build clean Prisma update data
    const updateData: any = { ...rest };

    // Handle category relation
    if (categoryIds && Array.isArray(categoryIds)) {
      updateData.categories = { set: categoryIds.map((id: any) => ({ id: Number(id) })) };
    }

    // Handle owner relation
    if (ownerId) {
      updateData.owner = { connect: { id: Number(ownerId) } };
    }

    // Handle video URLs
    if (videoUrls && Array.isArray(videoUrls)) {
      updateData.videoUrls = videoUrls;
    }

    // Handle landing page URLs
    if (landingPageUrls && Array.isArray(landingPageUrls)) {
      updateData.landingPageUrls = landingPageUrls;
    }

    if (rest.visibility && Array.isArray(rest.visibility)) {
      updateData.visibility = rest.visibility;
    } else if (rest.visibility) {
      updateData.visibility = [rest.visibility];
    }
    delete updateData.visibility; // Remove the string prop if it was in `rest`
    if (rest.visibility) {
       updateData.visibility = Array.isArray(rest.visibility) ? rest.visibility : [rest.visibility];
    }

    // Ensure numeric fields are numbers
    if (rest.retailPriceMad) updateData.retailPriceMad = Number(rest.retailPriceMad);
    if (rest.affiliatePriceMad) updateData.affiliatePriceMad = Number(rest.affiliatePriceMad);
    if (rest.influencerPriceMad) updateData.influencerPriceMad = Number(rest.influencerPriceMad);
    if (rest.stockQuantity !== undefined) updateData.stockQuantity = Number(rest.stockQuantity);
    if (rest.minProductionDays !== undefined) updateData.minProductionDays = Number(rest.minProductionDays);
    if (rest.commissionMad !== undefined) updateData.commissionMad = Number(rest.commissionMad);
    if (canvaLink !== undefined) updateData.canvaLink = canvaLink;
    if (rest.showInHomepage !== undefined) {
      updateData.showInHomepage = rest.showInHomepage === true || rest.showInHomepage === 'true';
    }


    // If imageUrls array is provided, replace all images
    if (Array.isArray(imageUrls)) {
      const validUrls = imageUrls.filter((u: string) => u && u.trim());
      await prisma.$transaction(async (tx) => {
        // Delete existing images
        await tx.productImage.deleteMany({ where: { productId: Number(id) } });
        // Create new images
        if (validUrls.length > 0) {
          await tx.productImage.createMany({
            data: validUrls.map((url: string, index: number) => ({
              productId: Number(id),
              imageUrl: url.trim(),
              isPrimary: index === 0,
              sortOrder: index,
            }))
          });
        }
      });
    }

    const product = await prisma.product.update({
      where: { id: Number(id) },
      data: updateData,
      include: { categories: true, images: { orderBy: { sortOrder: 'asc' } } },
    });

    const targetOwnerId = ownerId || product.ownerId;
    if (targetOwnerId) {
      await grantProductToOwner(product.id, Number(targetOwnerId), ownerMode || 'AFFILIATE');
    }

    res.json({
      status: 'success',
      message: 'Product updated successfully',
      data: { product },
    });
  })
);

// Update user-specific branding URLs for a product
router.patch(
  '/:id/branding',
  authenticate,
  [
    body('brandingLabelMockupUrl').optional({ checkFalsy: true }),
    body('brandingLabelPrintUrl').optional({ checkFalsy: true }),
  ],
  asyncHandler(async (req: any, res: Response) => {
    const { id } = req.params;
    const { brandingLabelMockupUrl, brandingLabelPrintUrl } = req.body;

    const [inventory, claim] = await Promise.all([
      prisma.productInventory.findFirst({
        where: { userId: req.user.id, productId: Number(id) }
      }),
      prisma.affiliateClaim.findFirst({
        where: { userId: req.user.id, productId: Number(id) }
      })
    ]);

    if (!inventory && !claim) {
      throw new AppException(404, 'Product not found in your inventory or claims');
    }

    const updateData: any = {};
    if (brandingLabelMockupUrl !== undefined) updateData.brandingLabelMockupUrl = brandingLabelMockupUrl;
    if (brandingLabelPrintUrl !== undefined) updateData.brandingLabelPrintUrl = brandingLabelPrintUrl;

    if (inventory) {
      await prisma.productInventory.update({
        where: { id: inventory.id },
        data: updateData
      });
    } else if (claim) {
      await prisma.affiliateClaim.update({
        where: { id: claim.id },
        data: updateData
      });
    }

    res.json({
      status: 'success',
      message: 'Branding info updated successfully',
      data: { brandingInfo: updateData }
    });
  })
);

router.delete(
  '/:id',
  authenticate,
  checkProductPermission,
  asyncHandler(async (req: Request, res: Response) => {
    const productId = Number(req.params.id);

    await prisma.$transaction(async (tx) => {
      // 1. Find all referral links for this product
      const referralLinks = await tx.referralLink.findMany({
        where: { productId },
        select: { id: true }
      });
      const referralLinkIds = referralLinks.map(rl => rl.id);

      // 2. Find all order items for this product
      const orderItems = await tx.orderItem.findMany({
        where: { productId },
        select: { orderId: true }
      });
      const orderIds = Array.from(new Set(orderItems.map(item => item.orderId)));

      // 3. Find orders linked to those order items to get their lead IDs
      const orders = await tx.order.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, leadId: true }
      });
      const leadIdsFromOrders = orders.map(o => o.leadId).filter(Boolean) as number[];

      // 4. Find leads linked to the referral links
      const leadsFromReferrals = await tx.lead.findMany({
        where: { referralLinkId: { in: referralLinkIds } },
        select: { id: true }
      });
      const leadIdsFromReferrals = leadsFromReferrals.map(l => l.id);

      // 5. Combine all unique lead IDs
      const leadIds = Array.from(new Set([...leadIdsFromOrders, ...leadIdsFromReferrals]));

      // 6. Find all order IDs connected to the leads (to clean up orders completely)
      const additionalOrders = await tx.order.findMany({
        where: { leadId: { in: leadIds } },
        select: { id: true }
      });
      const allOrderIdsToDelete = Array.from(new Set([
        ...orderIds,
        ...additionalOrders.map(o => o.id)
      ]));

      // 7. Clean up Order-related dependent tables
      if (allOrderIdsToDelete.length > 0) {
        // a. Production jobs
        await tx.productionJob.deleteMany({ where: { orderId: { in: allOrderIdsToDelete } } });
        
        // b. Shipments and tracking
        const shipments = await tx.shipment.findMany({
          where: { orderId: { in: allOrderIdsToDelete } },
          select: { id: true }
        });
        const shipmentIds = shipments.map(s => s.id);
        if (shipmentIds.length > 0) {
          await tx.shipmentTrackingEvent.deleteMany({ where: { shipmentId: { in: shipmentIds } } });
          await tx.shipmentDeliveryProof.deleteMany({ where: { shipmentId: { in: shipmentIds } } });
        }
        await tx.shipment.deleteMany({ where: { orderId: { in: allOrderIdsToDelete } } });

        // c. Order returns
        await tx.orderReturn.deleteMany({ where: { orderId: { in: allOrderIdsToDelete } } });

        // d. Wallet transactions referencing these orders
        await tx.walletTransaction.deleteMany({ where: { orderId: { in: allOrderIdsToDelete } } });

        // e. Influencer commissions referencing these orders
        await tx.influencerCommission.deleteMany({ where: { orderId: { in: allOrderIdsToDelete } } });

        // f. Order status histories
        await tx.orderStatusHistory.deleteMany({ where: { orderId: { in: allOrderIdsToDelete } } });

        // g. Order items
        await tx.orderItem.deleteMany({ where: { orderId: { in: allOrderIdsToDelete } } });

        // h. Orders
        await tx.order.deleteMany({ where: { id: { in: allOrderIdsToDelete } } });
      }

      // 8. Clean up Lead-related dependent tables
      if (leadIds.length > 0) {
        await tx.leadStatusHistory.deleteMany({ where: { leadId: { in: leadIds } } });
        await tx.callLog.deleteMany({ where: { leadId: { in: leadIds } } });
        await tx.leadAssignment.deleteMany({ where: { leadId: { in: leadIds } } });
        await tx.lead.deleteMany({ where: { id: { in: leadIds } } });
      }

      // 9. Clean up ReferralLink dependent tables
      if (referralLinkIds.length > 0) {
        await tx.influencerCommission.deleteMany({ where: { referralLinkId: { in: referralLinkIds } } });
        await tx.referralLink.deleteMany({ where: { id: { in: referralLinkIds } } });
      }

      // 10. Clean up product relationships
      await tx.productImage.deleteMany({ where: { productId } });
      await tx.wholesalePriceTier.deleteMany({ where: { productId } });
      await tx.favorite.deleteMany({ where: { productId } });
      await tx.supportRequest.updateMany({ where: { productId }, data: { productId: null } });
      await tx.inventory.deleteMany({ where: { productId } });
      await tx.productInventory.deleteMany({ where: { productId } });
      await tx.affiliateClaim.deleteMany({ where: { productId } });

      // 11. Finally delete the product
      await tx.product.delete({
        where: { id: productId },
      });
    });

    res.json({
      status: 'success',
      message: 'Product and all associated leads, orders, and assignments deleted successfully',
    });
  })
);

// Clone a product for a specific user (admin only)
router.post(
  '/:id/clone',
  authenticate,
  checkProductPermission,
  [
    body('userId').isInt({ min: 1 }),
    body('newSku').optional().isString(),
    body('newName').optional().isString(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed', errors.array());
    }

    const { id } = req.params;
    const { userId, newSku, newName } = req.body;

    // Fetch original product with all relations
    const original = await prisma.product.findUnique({
      where: { id: Number(id) },
      include: {
        categories: true,
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!original) {
      throw new AppException(404, 'Product not found');
    }

    // Generate unique SKU
    const cloneSku = newSku || `${original.sku}-U${userId}`;
    
    // Check if SKU already exists
    const existingSku = await prisma.product.findUnique({ where: { sku: cloneSku } });
    if (existingSku) {
      throw new AppException(409, `Le SKU "${cloneSku}" existe déjà. Veuillez en choisir un autre.`);
    }

    // Get user info for naming
    const targetUser = await prisma.user.findUnique({
      where: { id: Number(userId) },
      include: { profile: true, role: true },
    });

    if (!targetUser) {
      throw new AppException(404, 'User not found');
    }

    const clonedProduct = await prisma.$transaction(async (tx) => {
      // 1. Create cloned product
      const cloneName = newName || `${original.nameFr} (${targetUser.profile?.fullName || targetUser.email})`;
      
      const product = await tx.product.create({
        data: {
          sku: cloneSku,
          nameAr: original.nameAr,
          nameFr: cloneName,
          nameEn: original.nameEn,
          description: original.description,
          longDescription: original.longDescription,
          baseCostMad: Number(original.baseCostMad),
          retailPriceMad: Number(original.retailPriceMad),
          affiliatePriceMad: original.affiliatePriceMad ? Number(original.affiliatePriceMad) : null,
          influencerPriceMad: original.influencerPriceMad ? Number(original.influencerPriceMad) : null,
          isCustomizable: original.isCustomizable,
          minProductionDays: original.minProductionDays,
          stockQuantity: original.stockQuantity,
          visibility: ['NONE'], // Private — only for this user
          status: 'APPROVED',
          owner: { connect: { id: Number(userId) } },
          videoUrls: original.videoUrls,
          landingPageUrls: original.landingPageUrls,
          commissionMad: Number(original.commissionMad),
          canvaLink: original.canvaLink,
          categories: {
            connect: (original as any).categories.map((c: any) => ({ id: c.id })),
          },
          // Clone images
          ...(((original as any).images?.length > 0) ? {
            images: {
              create: (original as any).images.map((img: any, index: number) => ({
                imageUrl: img.imageUrl,
                isPrimary: index === 0,
                sortOrder: index,
              })),
            },
          } : {}),
        },
        include: { categories: true, images: { orderBy: { sortOrder: 'asc' } } },
      });

      // 2. Grant the cloned product to the user
      const userRole = targetUser.role.name;
      if (userRole === 'INFLUENCER') {
        await tx.affiliateClaim.create({
          data: {
            userId: Number(userId),
            productId: product.id,
            status: 'ACTIVE',
          },
        });
      } else {
        await tx.productInventory.create({
          data: {
            userId: Number(userId),
            productId: product.id,
            quantity: 1,
          },
        });
      }

      return product;
    });

    res.status(201).json({
      status: 'success',
      message: 'Product cloned successfully',
      data: { product: clonedProduct },
    });
  })
);

export default router;
