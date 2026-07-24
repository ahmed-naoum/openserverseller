import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/v1/event/status
 * Public endpoint to check if event registration is currently enabled/active
 */
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    const setting = await prisma.platformSettings.findUnique({
      where: { key: 'event_page_settings' },
    });

    const data = (setting?.value as any) || { enabled: true };

    res.json({
      success: true,
      data: {
        enabled: data.enabled !== false,
      },
    });
  })
);

/**
 * POST /api/v1/event/register
 * Public endpoint to submit event registration
 */
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    // Check if event page is enabled
    const setting = await prisma.platformSettings.findUnique({
      where: { key: 'event_page_settings' },
    });
    const settingData = (setting?.value as any) || { enabled: true };
    if (settingData.enabled === false) {
      res.status(403).json({ 
        success: false, 
        message: 'التسجيل في هذا الميتينغ مغلق حالياً. شكراً لاهتمامك!' 
      });
      return;
    }

    const { fullName, phone, whatsapp, email, experience, stock, ordersVolume, biggestChallenge } = req.body;

    if (!fullName || !phone || !whatsapp || !email || !experience || !stock || !ordersVolume) {
      res.status(400).json({ 
        success: false, 
        message: 'يرجى ملء جميع الحقول المطلوبة' 
      });
      return;
    }

    const registration = await prisma.eventRegistration.create({
      data: {
        fullName: fullName.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim().toLowerCase(),
        experience: String(experience),
        stock: String(stock),
        ordersVolume: String(ordersVolume),
        biggestChallenge: biggestChallenge ? String(biggestChallenge).trim() : null,
      },
    });

    res.json({
      success: true,
      message: 'تم حجز مقعدك فـ الميتينغ بنجاح! سنقوم بالتواصل معك عبر الواتساب والبريد الإلكتروني.',
      data: registration,
    });
  })
);

/**
 * GET /api/v1/admin/event/registrations
 * Admin endpoint to list all registrations & stats
 */
router.get(
  '/admin/registrations',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const registrations = await prisma.eventRegistration.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const setting = await prisma.platformSettings.findUnique({
      where: { key: 'event_page_settings' },
    });
    const settingData = (setting?.value as any) || { enabled: true };

    res.json({
      success: true,
      data: {
        enabled: settingData.enabled !== false,
        total: registrations.length,
        registrations,
      },
    });
  })
);

/**
 * PUT /api/v1/admin/event/status
 * Admin endpoint to toggle event registration ON/OFF
 */
router.put(
  '/admin/status',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const { enabled } = req.body;

    await prisma.platformSettings.upsert({
      where: { key: 'event_page_settings' },
      update: { value: { enabled: !!enabled } },
      create: { key: 'event_page_settings', value: { enabled: !!enabled } },
    });

    res.json({
      success: true,
      message: `تم ${enabled ? 'تفعيل' : 'إيقاف'} صفحة التسجيل في الميتينغ بنجاح!`,
      data: { enabled: !!enabled },
    });
  })
);

/**
 * DELETE /api/v1/admin/event/registrations/:id
 * Admin endpoint to delete a registration
 */
router.delete(
  '/admin/registrations/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'ID غير صالحة' });
      return;
    }

    await prisma.eventRegistration.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'تم حذف التسجيل بنجاح',
    });
  })
);

export default router;
