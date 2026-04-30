import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { io } from '../index.js';

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
        user: {
          include: {
            profile: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    // Also find associated conversations
    const conversations = await prisma.conversation.findMany({
      where: {
        type: 'SUPPORT',
        supportRequestId: {
          in: requests.map(r => r.id)
        }
      },
      select: {
        id: true,
        status: true,
        supportRequestId: true
      }
    });

    const requestsWithConv = requests.map(r => ({
      ...r,
      conversationId: conversations.find((c: any) => c.supportRequestId === r.id)?.id
    }));

    res.json({
      status: 'success',
      data: requestsWithConv,
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

    const result = await (prisma as any).$transaction(async (tx: any) => {
      const request = await tx.supportRequest.create({
        data: {
          userId,
          subject,
          type,
          description,
          productId: productId ? parseInt(productId) : undefined,
          status: 'OPEN',
        },
      });

      // Create a support conversation
      const conversation = await tx.conversation.create({
        data: {
          type: 'SUPPORT',
          status: 'PENDING_CLAIM',
          supportRequestId: request.id,
          metadata: {
            subject,
            category: type,
            description,
            productName: productId ? (await tx.product.findUnique({ where: { id: parseInt(productId) } }))?.nameFr : undefined
          }
        }
      });

      // Add user as participant
      await tx.conversationParticipant.create({
        data: {
          conversationId: conversation.id,
          userId: userId,
          role: 'MEMBER'
        }
      });

      // Create first message
      const firstMessage = await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: userId,
          content: description,
          messageType: 'TEXT'
        },
        include: {
          sender: { include: { profile: true, role: true } }
        }
      });

      return { request, conversation, firstMessage };
    });

    // Notify support queue
    io.to('role:SYSTEM_SUPPORT').to('role:SUPER_ADMIN').emit('new-support-ticket', {
      conversation: {
        ...result.conversation,
        participants: [{
          role: 'MEMBER',
          user: await prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true, role: true }
          })
        }]
      }
    });

    res.status(201).json({
      status: 'success',
      data: result.request,
    });
  })
);

export default router;
