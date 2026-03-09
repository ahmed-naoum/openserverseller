import { Server as SocketServer, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

export const setupSocketHandlers = (io: SocketServer) => {
  io.use(async (socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      
      const user = await prisma.user.findUnique({
        where: { uuid: decoded.userId },
        include: { role: true },
      });

      if (!user || !user.isActive) {
        return next(new Error('User not found or inactive'));
      }

      socket.userId = user.uuid;
      socket.userRole = user.role.name;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User connected: ${socket.userId} (${socket.userRole})`);

    // Join user-specific room
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // Join role-specific room
    if (socket.userRole) {
      socket.join(`role:${socket.userRole}`);
    }

    // Handle lead assignment
    socket.on('lead:assigned', async (data: { leadId: string; agentId: string }) => {
      try {
        const lead = await prisma.lead.update({
          where: { id: Number(data.leadId) },
          data: { 
            assignedAgentId: Number(data.agentId),
            status: 'ASSIGNED',
          },
          include: {
            assignedAgent: { include: { profile: true } },
          },
        });

        // Notify the agent
        io.to(`user:${data.agentId}`).emit('notification', {
          type: 'LEAD_ASSIGNED',
          message: `Nouveau prospect assigné: ${lead.fullName}`,
          data: lead,
        });

        // Broadcast update to admins
        io.to('role:SUPER_ADMIN').emit('lead:updated', lead);
      } catch (error) {
        socket.emit('error', { message: 'Failed to assign lead' });
      }
    });

    // Handle order status change
    socket.on('order:status-change', async (data: { orderId: string; status: string }) => {
      try {
        const order = await prisma.order.update({
          where: { id: Number(data.orderId) },
          data: { status: data.status as any },
          include: {
            vendor: true,
            brand: true,
          },
        });

        // Notify the vendor
        io.to(`user:${order.vendorId}`).emit('notification', {
          type: 'ORDER_STATUS_CHANGED',
          message: `Commande ${order.orderNumber} - ${data.status}`,
          data: order,
        });

        // Broadcast to admins
        io.to('role:SUPER_ADMIN').emit('order:updated', order);
      } catch (error) {
        socket.emit('error', { message: 'Failed to update order status' });
      }
    });

    // Handle new notification
    socket.on('notification:send', async (data: { userId: string; type: string; title: string; body: string }) => {
      try {
        const notification = await prisma.notification.create({
          data: {
            userId: Number(data.userId),
            type: data.type,
            title: data.title,
            body: data.body,
          },
        });

        io.to(`user:${data.userId}`).emit('notification', notification);
      } catch (error) {
        socket.emit('error', { message: 'Failed to send notification' });
      }
    });

    // Handle typing indicator for chat
    socket.on('typing:start', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('typing', {
        userId: socket.userId,
        isTyping: true,
      });
    });

    socket.on('typing:stop', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('typing', {
        userId: socket.userId,
        isTyping: false,
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });
};

export const broadcastToVendors = (io: SocketServer, event: string, data: any) => {
  io.to('role:VENDOR').emit(event, data);
};

export const broadcastToAgents = (io: SocketServer, event: string, data: any) => {
  io.to('role:CALL_CENTER_AGENT').emit(event, data);
};

export const broadcastToAdmins = (io: SocketServer, event: string, data: any) => {
  io.to('role:SUPER_ADMIN').emit(event, data);
};

export const notifyUser = (io: SocketServer, userId: string, event: string, data: any) => {
  io.to(`user:${userId}`).emit(event, data);
};
