import { prisma } from '../lib/prisma.js';
import { sendPushToUser } from '../lib/push.js';


/**
 * Creates a notification in the database, broadcasts it to the target user via Socket.io
 * (app open) and pushes it through Firebase to their phones (app closed / offline).
 * 
 * @param userId The integer ID of the user in the database
 * @param type The category of the notification (e.g. 'PRODUCT_CLAIM_STATUS', 'NEW_LEAD', etc.)
 * @param title The headline text
 * @param body The descriptive message
 */
export async function createNotification(userId: number, type: string, title: string, body: string) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        isRead: false,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { uuid: true },
    });

    const { io } = await import('../index.js');
    if (io) {
      // 1. Broadcast to target user by UUID
      if (user?.uuid) {
        io.to(`user:${user.uuid}`).emit('new-notification', notification);
        io.to(`user:${user.uuid}`).emit('notification', notification);
      }
      // 2. Broadcast to target user by numeric ID (e.g. mobile app or legacy sessions)
      io.to(`user:${userId}`).emit('new-notification', notification);
      io.to(`user:${userId}`).emit('notification', notification);

      // 3. Broadcast to mobile devices room
      io.to('mobile').emit('broadcast:notification', notification);
    }

    // Push to the user's phones. Fire-and-forget: a Firebase hiccup must not fail the caller.
    void sendPushToUser(userId, {
      notificationId: notification.id,
      type,
      title,
      body,
    });

    return notification;
  } catch (error) {
    console.error('[NotificationService] Failed to create or broadcast notification:', error);
    return null;
  }
}

