import { prisma } from '../lib/prisma.js';
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { io } from '../index.js';

const router = Router();

// Helper to log conversation actions
async function logConversationAction(conversationId: number, userId: number | null, action: string, details?: string) {
    try {
        await prisma.conversationLog.create({
            data: {
                conversationId,
                userId,
                action,
                details
            }
        });
    } catch (err) {
        console.error('Failed to log conversation action:', err);
    }
}

// Get all conversations for a user
router.get(
    '/conversations',
    authenticate,
    asyncHandler(async (req, res) => {
        const { status, orderNumber } = req.query;

        let whereClause: any = {};
        
        if (status) {
            whereClause.status = status;
        } else {
            // Default: show both ACTIVE and PENDING_CLAIM conversations
            whereClause.status = { in: ['ACTIVE', 'PENDING_CLAIM'] };
        }

        if (orderNumber) {
            whereClause.metadata = {
                path: ['orderNumber'],
                equals: orderNumber
            };
        }
        const role = req.user!.roleName;

        if (role === 'SYSTEM_SUPPORT') {
            // Support agents only see conversations they are a participant of (claimed ones)
            // They should NOT see unclaimed ones in their main message list
            whereClause.participants = { some: { userId: req.user!.id } };
            if (!status) {
                whereClause.status = { in: ['ACTIVE', 'CLOSED'] };
            }
        } else if (role === 'SUPER_ADMIN') {
            // Super admins see ALL conversations
            if (!status) {
                whereClause.status = { in: ['ACTIVE', 'PENDING_CLAIM', 'CLOSED'] };
            }
        } else if (role === 'FINANCE_ADMIN') {
            // Finance admins only see their own conversations
            if (!status && !orderNumber) {
                whereClause.participants = { some: { userId: req.user!.id } };
                whereClause.status = { in: ['ACTIVE', 'CLOSED'] };
            }
        } else {
            // Normal users see only their own
            whereClause.participants = { some: { userId: req.user!.id } };
            if (!status) {
                whereClause.status = { in: ['ACTIVE', 'PENDING_CLAIM', 'CLOSED'] };
            }
        }

        const conversations = await prisma.conversation.findMany({
            where: whereClause,
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

        // Calculate unread counts for each conversation
        const conversationsWithUnread = await Promise.all(conversations.map(async (c) => {
            const myParticipant = c.participants.find(p => p.userId === req.user!.id);
            
            // If user is not a participant (e.g. support queue), unread count is 0
            if (!myParticipant) {
                return { ...c, unreadCount: 0 };
            }

            const unreadCount = await prisma.message.count({
                where: {
                    conversationId: c.id,
                    senderId: { not: req.user!.id },
                    createdAt: {
                        gt: myParticipant.lastReadAt || new Date(0)
                    }
                }
            });

            return { ...c, unreadCount };
        }));

        const totalUnreadCount = conversationsWithUnread.reduce((sum, c) => sum + c.unreadCount, 0);

        res.json({
            status: 'success',
            data: {
                totalUnreadCount,
                conversations: conversationsWithUnread.map((c) => ({
                    id: c.id,
                    type: c.type,
                    title: c.title,
                    status: c.status,
                    updatedAt: c.updatedAt,
                    unreadCount: c.unreadCount,
                    lastMessage: c.messages[0] || null,
                    participants: c.participants.map((p) => ({
                        userId: p.userId,
                        fullName: p.user.profile?.fullName,
                        email: p.user.email,
                        phone: p.user.phone,
                        role: p.user.role.name,
                    })),
                    metadata: c.metadata,
                })),
            },
        });
    })
);

// Get support conversation queue for agents
router.get(
    '/conversations/queue',
    authenticate,
    asyncHandler(async (req, res) => {
        const role = req.user!.roleName;
        if (role !== 'SUPER_ADMIN' && role !== 'SYSTEM_SUPPORT') {
            throw new AppException(403, 'Not authorized to view support queue');
        }

        const queue = await prisma.conversation.findMany({
            where: {
                type: 'SUPPORT',
                status: 'PENDING_CLAIM',
                claimedByUserId: null
            },
            include: {
                participants: {
                    include: {
                        user: {
                            include: { profile: true, role: true }
                        }
                    }
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        res.json({
            status: 'success',
            data: { queue }
        });
    })
);

// Get a single conversation detail
router.get(
    '/conversations/:id',
    authenticate,
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const convId = Number(id);

        if (isNaN(convId)) {
            throw new AppException(400, 'Invalid conversation ID');
        }

        const role = req.user!.roleName;
        let whereClause: any = { id: convId };

        if (role !== 'SUPER_ADMIN' && role !== 'SYSTEM_SUPPORT') {
            whereClause.participants = { some: { userId: req.user!.id } };
        }

        const c = await prisma.conversation.findFirst({
            where: whereClause,
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
                    take: 1,
                },
            },
        });

        if (!c) {
            throw new AppException(404, 'Conversation not found');
        }

        res.json({
            status: 'success',
            data: {
                conversation: {
                    id: c.id,
                    type: c.type,
                    title: c.title,
                    status: c.status,
                    updatedAt: c.updatedAt,
                    lastMessage: c.messages[0] || null,
                    participants: c.participants.map((p) => ({
                        userId: p.userId,
                        fullName: p.user.profile?.fullName,
                        email: p.user.email,
                        phone: p.user.phone,
                        role: p.user.role.name,
                    })),
                    metadata: c.metadata,
                }
            }
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

        let authWhereClause: any = { id: Number(id) };
        const role = req.user!.roleName;

        if (role !== 'SUPER_ADMIN' && role !== 'SYSTEM_SUPPORT') {
            // Non-admins can only read messages in conversations they are a participant of
            authWhereClause.participants = {
                some: { userId: req.user!.id }
            };
        }

        const conversation = await prisma.conversation.findFirst({
            where: authWhereClause,
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

        const { participantId, type = 'DIRECT', title, metadata } = req.body;

        // Check if support conversation for this product already exists for this user
        if (type === 'SUPPORT' && metadata?.productId) {
            const existingSupport = await prisma.conversation.findFirst({
                where: {
                    type: 'SUPPORT',
                    participants: { some: { userId: req.user!.id } },
                    metadata: {
                        path: ['productId'],
                        equals: metadata.productId
                    }
                }
            });

            if (existingSupport) {
                return res.json({
                    status: 'success',
                    data: { conversation: existingSupport, alreadyExists: true },
                });
            }
        }

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

        let participantsConfig: { userId: number }[] = [{ userId: req.user!.id }];

        // For SUPPORT conversations, they start as UNCLAIMED (only creator is inside) unless explicitly assigning someone.
        if (type === 'SUPPORT') {
            // Do not auto-assign anyone!
        } else if (participantId) {
            participantsConfig.push({ userId: Number(participantId) });
        }

        // Creating conversation
        const newConv = await prisma.conversation.create({
            data: {
                type,
                title,
                status: type === 'SUPPORT' ? 'PENDING_CLAIM' : 'ACTIVE',
                metadata: metadata || {},
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

// Auto-open a support conversation from a Wholesale buy or Product Claim
router.post(
    '/conversations/auto-open',
    authenticate,
    [
        body('orderId').optional().isNumeric(),
        body('supportRequestId').optional().isNumeric(),
        body('affiliateClaimId').optional().isNumeric(),
        body('productId').isNumeric(),
        body('brandName').optional().isString(),
        body('requestedQty').optional().isNumeric(),
        body('brandingLabelPrintUrl').optional().isString(),
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new AppException(400, 'Validation failed');
        }

        const { 
            orderId, 
            supportRequestId, 
            affiliateClaimId,
            productId, 
            brandName, 
            requestedQty, 
            brandingLabelPrintUrl,
            subject,
            type: requestType,
            description
        } = req.body;

        let order = null;
        if (orderId) {
            order = await prisma.order.findFirst({
                where: { id: Number(orderId), vendorId: req.user!.id }
            });
        }

        let supportRequest = null;
        if (supportRequestId) {
            supportRequest = await prisma.supportRequest.findUnique({
                where: { id: Number(supportRequestId) }
            });
        } else if (subject && description) {
            // Create support request inline to avoid double-ticket issue
            supportRequest = await prisma.supportRequest.create({
                data: {
                    userId: req.user!.id,
                    subject,
                    type: requestType || 'PRODUCT_CLAIM',
                    description,
                    productId: productId ? Number(productId) : undefined,
                    status: 'OPEN',
                }
            });
        }

        let affiliateClaim = null;
        if (affiliateClaimId) {
            affiliateClaim = await prisma.affiliateClaim.findUnique({
                where: { id: Number(affiliateClaimId) }
            });
        }

        const product = await prisma.product.findUnique({
            where: { id: Number(productId) }
        });
        if (!product) throw new AppException(404, 'Product not found');

        // Determine title
        let title = `Demande — ${product.nameFr}`;
        if (order) title = `Commande #${order.orderNumber} — ${product.nameFr}`;
        else if (affiliateClaim) title = `Claim #${affiliateClaim.id} — ${product.nameFr}`;

        // Create the pending conversation
        const conversation = await prisma.conversation.create({
            data: {
                type: 'SUPPORT',
                status: 'PENDING_CLAIM',
                title: title,
                metadata: {
                    orderId: orderId ? Number(orderId) : undefined,
                    supportRequestId: supportRequest?.id || undefined,
                    affiliateClaimId: affiliateClaimId ? Number(affiliateClaimId) : undefined,
                    productId,
                    brandName,
                    requestedQty,
                    brandingLabelPrintUrl,
                    orderNumber: order?.orderNumber,
                    productName: product.nameFr,
                    productSku: product.sku,
                    retailPriceMad: product.retailPriceMad,
                    subject: subject || undefined,
                    category: requestType || undefined,
                    description: description || undefined,
                },
                supportRequestId: supportRequest?.id,
                participants: {
                    create: [{ userId: req.user!.id, role: 'MEMBER' }]
                }
            },
            include: {
                participants: { include: { user: { include: { profile: true } } } }
            }
        });

        // Log creation
        await logConversationAction(conversation.id, req.user!.id, 'CREATED', 'Conversation de support créée');

        let systemContent = '';
        if (order) {
            systemContent = `🛍️ Nouvelle demande d'achat\n\nProduit : ${product.nameFr} (SKU: ${product.sku})\nCommande : #${order.orderNumber}\nMarque : ${brandName || 'N/A'}\nQuantité : ${requestedQty || 0} unités\nPrix unitaire : ${product.retailPriceMad} MAD\nTotal : ${order.totalAmountMad} MAD\n\n📎 Étiquette PDF jointe`;
        } else {
            systemContent = `🛠️ Nouvelle demande de Stock/Branding\n\nProduit : ${product.nameFr} (SKU: ${product.sku})\nMarque : ${brandName || 'N/A'}\nQuantité souhaitée : ${requestedQty || 0} unités\n\nL'utilisateur attend votre approbation avant de procéder au paiement.`;
        }

        // Find or create a system user to send the message
        let systemUser = await prisma.user.findFirst({ where: { email: 'system@silacod.ma' } });
        if (!systemUser) {
            systemUser = await prisma.user.findFirst({ where: { role: { name: 'SUPER_ADMIN' } } });
        }

        const sysMessage = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                senderId: systemUser!.id,
                content: systemContent,
                messageType: 'SYSTEM'
            }
        });

        const ticketData = {
            ...conversation,
            messages: [sysMessage]
        };

        io.to('support-queue').emit('new-support-ticket', { conversation: ticketData });

        res.status(201).json({
            status: 'success',
            data: {
                conversationId: conversation.id,
                orderNumber: order?.orderNumber,
                affiliateClaimId: affiliateClaim?.id
            }
        });
    })
);

// Claim a SUPPORT conversation
router.post(
    '/conversations/:id/claim',
    authenticate,
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const role = req.user!.roleName;

        if (role !== 'SYSTEM_SUPPORT' && role !== 'SUPER_ADMIN') {
            throw new AppException(403, 'Not authorized to claim conversations');
        }

        const conversation = await prisma.conversation.findFirst({
            where: { id: Number(id), type: 'SUPPORT' }
        });

        if (!conversation) {
            throw new AppException(404, 'Support conversation not found');
        }

        // Check if ANY agent has already claimed this conversation
        if (conversation.claimedByUserId) {
            if (conversation.claimedByUserId === req.user!.id) {
                return res.json({ status: 'success', message: 'Already claimed by you' });
            }
            throw new AppException(400, 'This conversation was already claimed by another agent');
        }

        // Add user to conversation and update status
        const [updatedConversation, participant] = await prisma.$transaction(async (tx: any) => {
            const updated = await tx.conversation.update({
                where: { id: conversation.id },
                data: {
                    status: 'ACTIVE',
                    claimedByUserId: req.user!.id,
                    claimedAt: new Date()
                }
            });

            const p = await tx.conversationParticipant.create({
                data: {
                    conversationId: conversation.id,
                    userId: req.user!.id,
                    role: 'ADMIN'
                },
                include: { user: { include: { profile: true, role: true } } }
            });

            // IF linked to a SupportRequest, update its status too
            if (conversation.supportRequestId) {
                await tx.supportRequest.update({
                    where: { id: conversation.supportRequestId },
                    data: { status: 'IN_PROGRESS' }
                });
            }

            return [updated, p];
        });

        // Broadcast claim events
        io.to(`support-queue`).emit('conversation-claimed', {
            conversationId: conversation.id,
            participant: {
                userId: participant.userId,
                fullName: participant.user.profile?.fullName,
                role: participant.user.role.name
            }
        });

        // Notify user that an agent joined
        const systemUser = await prisma.user.findFirst({ where: { email: 'system@silacod.ma' } }) || await prisma.user.findFirst({ where: { role: { name: 'SUPER_ADMIN' } } });
        const joinMessage = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                senderId: systemUser!.id,
                content: `✅ ${participant.user.profile?.fullName || 'Un agent de support'} a rejoint la conversation`,
                messageType: 'SYSTEM'
            },
            include: { sender: { include: { profile: true, role: true } } }
        });

        io.to(`conversation-${conversation.id}`).emit('new-message', {
            conversationId: conversation.id,
            message: {
                ...joinMessage,
                sender: {
                    id: joinMessage.senderId,
                    fullName: joinMessage.sender.profile?.fullName,
                    role: joinMessage.sender.role.name,
                    isMe: false
                }
            }
        });

        // Log claim
        await logConversationAction(conversation.id, req.user!.id, 'CLAIMED', `Assignée à ${participant.user.profile?.fullName || 'un agent'}`);

        res.json({
            status: 'success',
            data: { participant, conversation: updatedConversation }
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
            where: { id: Number(id) },
            include: { participants: true }
        });

        if (!conversation) {
            throw new AppException(404, 'Conversation not found');
        }

        if (conversation.status === 'CLOSED') {
            throw new AppException(403, 'Cette conversation est terminée. Vous ne pouvez plus envoyer de messages.');
        }

        // Allow sending messages if ACTIVE, or if PENDING_CLAIM (for support)
        const isAllowedStatus = conversation.status === 'ACTIVE' || (conversation.status === 'PENDING_CLAIM' && conversation.type === 'SUPPORT');
        
        if (!isAllowedStatus) {
            throw new AppException(403, 'Conversation is not active');
        }

        const isParticipant = conversation.participants.some(p => p.userId === req.user!.id);
        // Only SUPER_ADMIN can bypass participant check for support conversations
        const isAdminBypass = req.user!.roleName === 'SUPER_ADMIN' && conversation.type === 'SUPPORT';

        if (!isParticipant && !isAdminBypass) {
            throw new AppException(403, 'Not authorized to send messages in this conversation');
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

        // Emit real-time event to all participants in the conversation room
        const participants = await prisma.conversationParticipant.findMany({
            where: { conversationId: conversation.id },
            include: { user: true },
        });

        const messagePayload = {
            id: message.id,
            conversationId: conversation.id,
            content: message.content,
            messageType: message.messageType,
            attachmentUrl: message.attachmentUrl,
            createdAt: message.createdAt,
            sender: {
                id: message.senderId,
                fullName: message.sender.profile?.fullName,
                role: message.sender.role.name,
            },
        };

        participants.forEach((p) => {
            // Emit to each participant's personal room using their UUID
            io.to(`user:${p.user.uuid}`).emit('new-message', {
                message: {
                    ...messagePayload,
                    sender: { ...messagePayload.sender, isMe: p.userId === req.user!.id },
                },
                conversationId: conversation.id,
            });
        });

        // ALSO: Broadcast to the specific conversation room for anyone "viewing" it (even if not a participant)
        io.to(`conversation:${conversation.id}`).emit('new-message', {
            message: {
                ...messagePayload,
                sender: { ...messagePayload.sender, isMe: false }, // "isMe" will be determined by the client listener logic
            },
            conversationId: conversation.id,
        });

        res.status(201).json({
            status: 'success',
            data: { message },
        });
    })
);

// Mark conversation as read
router.patch(
    '/conversations/:id/read',
    authenticate,
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        await prisma.conversationParticipant.updateMany({
            where: {
                conversationId: Number(id),
                userId: req.user!.id
            },
            data: {
                lastReadAt: new Date()
            }
        });

        res.json({ status: 'success' });
    })
);

// Close a conversation
router.post(
    '/conversations/:id/close',
    authenticate,
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const role = req.user!.roleName;

        if (role !== 'SYSTEM_SUPPORT' && role !== 'SUPER_ADMIN') {
            throw new AppException(403, 'Not authorized to close conversations');
        }

        const conversation = await prisma.conversation.findUnique({
            where: { id: Number(id) }
        });

        if (!conversation) {
            throw new AppException(404, 'Conversation not found');
        }

        const updatedConversation = await prisma.$transaction(async (tx) => {
            const updated = await tx.conversation.update({
                where: { id: conversation.id },
                data: { status: 'CLOSED' }
            });

            if (conversation.supportRequestId) {
                await tx.supportRequest.update({
                    where: { id: conversation.supportRequestId },
                    data: { status: 'CLOSED' }
                });
            }

            return updated;
        });

        // Notify participants
        io.to(`conversation:${conversation.id}`).emit('conversation-closed', {
            conversationId: conversation.id
        });

        // Log close
        await logConversationAction(conversation.id, req.user!.id, 'CLOSED', 'Ticket clôturé par un agent');

        res.json({
            status: 'success',
            data: { conversation: updatedConversation }
        });
    })
);

// Re-open a closed conversation
router.post(
    '/conversations/:id/open',
    authenticate,
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const role = req.user!.roleName;

        if (role !== 'SYSTEM_SUPPORT' && role !== 'SUPER_ADMIN') {
            throw new AppException(403, 'Not authorized to open conversations');
        }

        const conversation = await prisma.conversation.findUnique({
            where: { id: Number(id) }
        });

        if (!conversation) {
            throw new AppException(404, 'Conversation not found');
        }

        const updatedConversation = await prisma.$transaction(async (tx) => {
            const updated = await tx.conversation.update({
                where: { id: conversation.id },
                data: { status: 'ACTIVE' }
            });

            if (conversation.supportRequestId) {
                await tx.supportRequest.update({
                    where: { id: conversation.supportRequestId },
                    data: { status: 'IN_PROGRESS' }
                });
            }

            return updated;
        });

        // Notify participants
        io.to(`conversation:${conversation.id}`).emit('conversation-opened', {
            conversationId: conversation.id
        });

        // Log open
        await logConversationAction(conversation.id, req.user!.id, 'OPENED', 'Ticket ré-ouvert par un agent');

        res.json({
            status: 'success',
            data: { conversation: updatedConversation }
        });
    })
);

// Get conversation logs
router.get(
    '/conversations/:id/logs',
    authenticate,
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        const logs = await prisma.conversationLog.findMany({
            where: { conversationId: Number(id) },
            include: {
                user: {
                    include: { profile: true, role: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            status: 'success',
            data: { logs }
        });
    })
);

export default router;
