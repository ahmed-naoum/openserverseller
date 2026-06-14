import { prisma } from '../lib/prisma.js';


/**
 * Creates a notification in the database and broadcasts it to the target user via Socket.io.
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

    if (user?.uuid) {
      // Dynamically import io to avoid circular dependencies during initialization
      const { io } = await import('../index.js');
      if (io) {
        io.to(`user:${user.uuid}`).emit('new-notification', notification);
      }
    }

    return notification;
  } catch (error) {
    console.error('[NotificationService] Failed to create or broadcast notification:', error);
    return null;
  }
}
