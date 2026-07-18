import { prisma } from '../lib/prisma.js';
import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';

const router = Router();

// 1. Submit a custom product request
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, category, productLink, quantity, description, imageUrl, userType } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new AppException(400, 'Le nom du produit est requis.');
    }
    if (!category || typeof category !== 'string' || category.trim() === '') {
      throw new AppException(400, 'Le nom de la catégorie est requis.');
    }
    if (!quantity || isNaN(Number(quantity)) || Number(quantity) < 1) {
      throw new AppException(400, 'La quantité demandée doit être au moins de 1.');
    }
    if (!description || typeof description !== 'string' || description.trim() === '') {
      throw new AppException(400, 'La description est requise.');
    }
    if (userType && !['INFLUENCER', 'SELLER'].includes(userType)) {
      throw new AppException(400, 'Le type de profil est invalide.');
    }

    const request = await prisma.customProductRequest.create({
      data: {
        userId: req.user!.id,
        name: name.trim(),
        category: category.trim(),
        productLink: productLink ? productLink.trim() : null,
        quantity: Math.floor(Number(quantity)),
        description: description.trim(),
        imageUrl: imageUrl || null,
        userType: userType || null,
        status: 'PENDING'
      },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    // Notify all admins about the new custom product sourcing request
    try {
      const admins = await prisma.user.findMany({
        where: {
          role: {
            name: { in: ['SUPER_ADMIN', 'SYSTEM_SUPPORT'] }
          }
        },
        select: { id: true }
      });

      if (admins.length > 0) {
        const { createNotification } = await import('../utils/notification.js');
        const submitterName = req.user?.email || 'Un utilisateur';
        const userTypeLabel = userType === 'INFLUENCER' ? 'Influenceur' : userType === 'SELLER' ? 'Vendeur' : '';
        const notifTitle = userTypeLabel ? `📦 Nouvelle Demande (${userTypeLabel})` : '📦 Nouvelle Demande de Produit';
        const notifBody = `${submitterName} (${userTypeLabel || 'Utilisateur'}) a soumis une demande de produit personnalisé "${name.trim()}" (${category.trim()}).`;

        for (const admin of admins) {
          await createNotification(admin.id, 'CUSTOM_PRODUCT_REQUEST', notifTitle, notifBody);
        }
      }
    } catch (notifErr) {
      console.error('[CustomProductRequest] Failed to send admin notifications:', notifErr);
    }

    res.status(201).json({
      status: 'success',
      data: request
    });
  })
);

// 2. Get list of custom product requests
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const statusFilter = req.query.status as string;
    const isAdmin = ['SUPER_ADMIN', 'SYSTEM_SUPPORT'].includes(req.user!.roleName);

    const where: any = {};
    
    // Scoped request visibility
    if (!isAdmin) {
      where.userId = req.user!.id;
    }

    if (statusFilter && statusFilter !== 'ALL') {
      where.status = statusFilter;
    }

    const requests = await prisma.customProductRequest.findMany({
      where,
      include: {
        user: {
          include: {
            profile: true,
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      status: 'success',
      data: requests
    });
  })
);

// 3. Update the status of a request (Approve / Reject)
router.patch(
  '/:id/status',
  authenticate,
  authorize('SUPER_ADMIN', 'SYSTEM_SUPPORT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      throw new AppException(400, 'Statut invalide. Choisissez PENDING, APPROVED ou REJECTED.');
    }

    const requestExists = await prisma.customProductRequest.findUnique({
      where: { id: Number(id) }
    });

    if (!requestExists) {
      throw new AppException(404, 'Demande de produit personnalisé introuvable.');
    }

    const updatedRequest = await prisma.customProductRequest.update({
      where: { id: Number(id) },
      data: { status },
      include: {
        user: {
          include: {
            profile: true,
            role: true
          }
        }
      }
    });

    res.json({
      status: 'success',
      data: updatedRequest
    });
  })
);

export default router;
