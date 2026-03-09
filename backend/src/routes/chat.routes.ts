import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

// Get all conversations for a user
router.get(
    '/conversations',
    authenticate,
    asyncHandler(async (req, res) => {
        const { status = 'ACTIVE' } = req.query;

        const conversations = await prisma.conversation.findMany({
            where: {
                status: status as string,
                participants: {
                    some: {
                        userId: req.user!.id,
                    },
                },
            },
            include: {
                participants: {
                    include: {
                        user: {
                            include: { profile: true, role: true },
                        },
                    },
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1, // Get latest message
                },
            },
            orderBy: { updatedAt: 'desc' },
        });

        res.json({
            status: 'success',
            data: {
                conversations: conversations.map((c) => ({
                    id: c.id,
                    type: c.type,
                    title: c.title,
                    status: c.status,
                    updatedAt: c.updatedAt,
                    lastMessage: c.messages[0] || null,
                    participants: c.participants.map((p) => ({
                        userId: p.userId,
                        fullName: p.user.profile?.fullName,
                        role: p.user.role.name,
                    })),
                })),
            },
        });
    })
);

// Get a specific conversation and its messages
router.get(
    '/conversations/:id/messages',
    authenticate,
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const conversation = await prisma.conversation.findFirst({
            where: {
                id: Number(id),
                participants: {
                    some: {
                        userId: req.user!.id,
                    },
                },
            },
        });

        if (!conversation) {
            throw new AppException(404, 'Conversation not found');
        }

        const [messages, total] = await Promise.all([
            prisma.message.findMany({
                where: { conversationId: conversation.id },
                include: {
                    sender: {
                        include: { profile: true, role: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
            }),
            prisma.message.count({ where: { conversationId: conversation.id } }),
        ]);

        res.json({
            status: 'success',
            data: {
                messages: messages.map((m) => ({
                    id: m.id,
                    content: m.content,
                    messageType: m.messageType,
                    attachmentUrl: m.attachmentUrl,
                    createdAt: m.createdAt,
                    sender: {
                        id: m.senderId,
                        fullName: m.sender.profile?.fullName,
                        role: m.sender.role.name,
                        isMe: m.senderId === req.user!.id,
                    },
                })).reverse(), // Reverse to get chronological order for chat UI
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

// Create a new conversation (e.g., direct message)
router.post(
    '/conversations',
    authenticate,
    [
        body('participantId').optional().isNumeric(),
        body('type').optional().isString(),
        body('title').optional().isString(),
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new AppException(400, 'Validation failed');
        }

        const { participantId, type = 'DIRECT', title } = req.body;

        // Check if direct conversation already exists
        if (type === 'DIRECT' && participantId) {
            const existingConv = await prisma.conversation.findFirst({
                where: {
                    type: 'DIRECT',
                    AND: [
                        { participants: { some: { userId: req.user!.id } } },
                        { participants: { some: { userId: Number(participantId) } } },
                    ],
                },
            });

            if (existingConv) {
                return res.json({
                    status: 'success',
                    data: { conversation: existingConv },
                });
            }
        }

        let participantsConfig = [{ userId: req.user!.id }];
        if (participantId) {
            participantsConfig.push({ userId: Number(participantId) });
        }

        // Creating conversation
        const newConv = await prisma.conversation.create({
            data: {
                type,
                title,
                status: 'ACTIVE',
                participants: {
                    create: participantsConfig,
                },
            },
            include: {
                participants: {
                    include: {
                        user: { include: { profile: true, role: true } },
                    },
                },
            },
        });

        res.status(201).json({
            status: 'success',
            data: { conversation: newConv },
        });
    })
);

// Send a message
router.post(
    '/conversations/:id/messages',
    authenticate,
    [
        body('content').notEmpty().isString(),
        body('messageType').optional().isString(),
    ],
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { content, messageType = 'TEXT', attachmentUrl } = req.body;

        const conversation = await prisma.conversation.findFirst({
            where: {
                id: Number(id),
                participants: {
                    some: { userId: req.user!.id },
                },
            },
        });

        if (!conversation || conversation.status !== 'ACTIVE') {
            throw new AppException(400, 'Cannot send message to this conversation');
        }

        const message = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                senderId: req.user!.id,
                content,
                messageType,
                attachmentUrl,
            },
            include: {
                sender: { include: { profile: true, role: true } },
            },
        });

        // Update conversation updatedAt
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() },
        });

        res.status(201).json({
            status: 'success',
            data: { message },
        });
    })
);

export default router;
