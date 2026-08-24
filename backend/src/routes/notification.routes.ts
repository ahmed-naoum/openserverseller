import { prisma } from '../lib/prisma.js';
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { resolvePage, resolvePageSize } from '../lib/pagination.js';

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
