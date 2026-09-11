import { prisma } from '../lib/prisma.js';
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { resolvePage, resolvePageSize } from '../lib/pagination.js';
import { registerPushToken, unregisterPushToken } from '../lib/push.js';

const router = Router();

router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { unreadOnly } = req.query;
    // Clamped: `take: Number(limit)` took whatever the caller sent, so `?limit=`
    // with junk in it reached Prisma as NaN and a huge one scanned the table.
    const page = resolvePage(req.query.page);
    const limit = resolvePageSize(req.query.limit, 20, 200);

    const where: any = { userId: req.user!.id };
    if (unreadOnly === 'true') where.isRead = false;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: {
        notifications,
        unreadCount: await prisma.notification.count({
          where: { userId: req.user!.id, isRead: false },
        }),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  })
);

// ---------------------------------------------------------------------------
// Device push tokens (mobile app). Registered before the `/:id` routes so that
// "push-token" is never parsed as a notification id.
// ---------------------------------------------------------------------------
router.post(
  '/push-token',
  authenticate,
  asyncHandler(async (req, res) => {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const platform = typeof req.body?.platform === 'string' ? req.body.platform.trim().toLowerCase() : '';
    const provider = typeof req.body?.provider === 'string' ? req.body.provider.trim().toLowerCase() : 'fcm';

    if (token.length < 20 || token.length > 4096) {
      return res.status(400).json({ status: 'error', message: 'Jeton push invalide' });
    }
    if (!['android', 'ios', 'web'].includes(platform)) {
      return res.status(400).json({ status: 'error', message: 'Plateforme invalide' });
    }
    if (!['fcm', 'apns', 'expo'].includes(provider)) {
      return res.status(400).json({ status: 'error', message: 'Fournisseur push invalide' });
    }

    await registerPushToken(req.user!.id, { token, platform, provider });
    res.json({ status: 'success', message: 'Appareil enregistré pour les notifications push' });
  })
);

router.delete(
  '/push-token',
  authenticate,
  asyncHandler(async (req, res) => {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!token) {
      return res.status(400).json({ status: 'error', message: 'Jeton push requis' });
    }
    const removed = await unregisterPushToken(req.user!.id, token);
    res.json({ status: 'success', message: removed ? 'Appareil désinscrit' : 'Aucun appareil correspondant' });
  })
);

router.patch(
  '/:id/read',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    await prisma.notification.updateMany({
      where: {
        id: Number(id),
        userId: req.user!.id,
      },
      data: { isRead: true },
    });

    res.json({ status: 'success', message: 'Notification marked as read' });
  })
);

router.post(
  '/read-all',
  authenticate,
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: {
        userId: req.user!.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({ status: 'success', message: 'All notifications marked as read' });
  })
);

router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await prisma.notification.deleteMany({
      where: {
        id: Number(id),
        userId: req.user!.id,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ status: 'error', message: 'Notification introuvable' });
    }

    res.json({ status: 'success', message: 'Notification supprimée avec succès' });
  })
);

router.delete(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    await prisma.notification.deleteMany({
      where: {
        userId: req.user!.id,
      },
    });

    res.json({ status: 'success', message: 'Toutes les notifications ont été supprimées' });
  })
);

export default router;
