import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { body, validationResult } from 'express-validator';

const router = Router();

router.put(
  '/settings',
  authenticate,
  [
    body('language')
      .notEmpty()
      .withMessage('Language is required')
      .isIn(['en', 'fr', 'ar'])
      .withMessage('Language must be one of: en, fr, ar'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed', errors.array());
    }

    const { language } = req.body;
    const userId = req.user!.id;

    // Update both User and UserProfile tables to ensure consistency
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { language },
        select: {
          id: true,
          uuid: true,
          email: true,
          phone: true,
          language: true,
        },
      }),
      prisma.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          language,
        },
        update: {
          language,
        },
      }),
    ]);

    res.json({
      status: 'success',
      message: 'User settings updated successfully',
      data: {
        user: updatedUser,
      },
    });
  })
);

export default router;
