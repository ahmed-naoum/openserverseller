import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

// Get all support requests for current user
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: any, res) => {
    const { status, search } = req.query;
    const userId = req.user.id;

    const where: any = {
      userId,
    };

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const requests = await prisma.supportRequest.findMany({
      where,
      include: {
        product: {
          select: {
            nameFr: true,
            sku: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      status: 'success',
      data: requests,
    });
  })
);

// Create a new support request
router.post(
  '/',
  authenticate,
  [
    body('subject').notEmpty().withMessage('Subject is required'),
    body('type').notEmpty().withMessage('Type/Category is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('productId').optional().isInt().withMessage('Invalid product ID'),
  ],
  asyncHandler(async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed', errors.array());
    }

    const { subject, type, description, productId } = req.body;
    const userId = req.user.id;

    const request = await prisma.supportRequest.create({
      data: {
        userId,
        subject,
        type, // This is the Category (General, Payment, etc.)
        description,
        productId: productId ? parseInt(productId) : undefined,
        status: 'OPEN',
      },
    });

    res.status(201).json({
      status: 'success',
      data: request,
    });
  })
);

export default router;
