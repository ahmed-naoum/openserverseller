import { prisma } from '../lib/prisma.js';
import { Server as SocketServer, Socket } from 'socket.io';


interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

function broadcastActiveUsersCount(io: any) {
  const sockets = Array.from(io.sockets.sockets.values()) as AuthenticatedSocket[];
  
  let anonymousCount = 0;
  const activeRoles: Record<string, number> = {
    SUPER_ADMIN: 0,
    FINANCE_ADMIN: 0,
    CALL_CENTER_AGENT: 0,
    VENDOR: 0,
    INFLUENCER: 0,
    HELPER: 0
  };

  sockets.forEach((s) => {
    if (s.userId && s.userRole) {
      activeRoles[s.userRole] = (activeRoles[s.userRole] || 0) + 1;
    } else {
      anonymousCount++;
    }
  });

  io.to('role:SUPER_ADMIN').emit('realtime:active-users', {
    anonymousCount,
    activeRoles,
    totalActive: sockets.length
  });
}

export const setupSocketHandlers = (io: SocketServer) => {
  io.use(async (socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token;
    
    if (!token) {
      return next();
    }

    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      
      const user = await prisma.user.findUnique({
        where: { uuid: decoded.userId },
        include: { role: true },
      });

      if (user) {
        socket.userId = user.uuid;
        socket.userRole = user.role.name;
      }
      next();
    } catch (error) {
      next();
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User connected: ${socket.userId || 'Anonymous'} (${socket.userRole || 'Guest'})`);

    // Join user-specific room
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // Join role-specific room
    if (socket.userRole) {
      socket.join(`role:${socket.userRole}`);
    }

    broadcastActiveUsersCount(io);

    socket.on('realtime:request-counts', () => {
      broadcastActiveUsersCount(io);
    });

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
        });

        // Which order moved, and where to — everything the screens listening for
        // this event read off it. The whole Order row used to be emitted
        // instead, which sent the customer's phone and address to the seller's
        // tab whether or not their credits had paid for that lead; the
        // `vendor: true` include also put the seller's own User row — password
        // hash and all — in the same payload, and in the admin broadcast below.
        const summary = {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          vendorId: order.vendorId,
          updatedAt: order.updatedAt,
        };

        // Notify the vendor
        io.to(`user:${order.vendorId}`).emit('notification', {
          type: 'ORDER_STATUS_CHANGED',
          message: `Commande ${order.orderNumber} - ${data.status}`,
          data: summary,
        });

        // Broadcast to admins
        io.to('role:SUPER_ADMIN').emit('order:updated', summary);
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
      console.log(`User disconnected: ${socket.userId || 'Anonymous'}`);
      broadcastActiveUsersCount(io);
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
