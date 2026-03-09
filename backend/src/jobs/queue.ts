import { Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const redisConnection = {
  host: process.env.REDIS_URL?.split(':')[0] || 'localhost',
  port: parseInt(process.env.REDIS_URL?.split(':')[1] || '6379'),
};

// Lead Assignment Job
export const leadAssignmentQueue = new Queue('lead-assignment', {
  connection: redisConnection,
});

// Order Processing Job
export const orderProcessingQueue = new Queue('order-processing', {
  connection: redisConnection,
});

// Notification Job
export const notificationQueue = new Queue('notifications', {
  connection: redisConnection,
});

// Payout Processing Job
export const payoutQueue = new Queue('payout-processing', {
  connection: redisConnection,
});

// Job: Auto-assign leads to agents
export const autoAssignLeads = async () => {
  const unassignedLeads = await prisma.lead.findMany({
    where: {
      status: 'NEW',
      assignedAgentId: null,
    },
  });

  const activeAgents = await prisma.user.findMany({
    where: {
      role: { name: 'CALL_CENTER_AGENT' },
      isActive: true,
    },
  });

  if (activeAgents.length === 0) {
    console.log('No active agents available');
    return;
  }

  // Round-robin assignment
  for (let i = 0; i < unassignedLeads.length; i++) {
    const agent = activeAgents[i % activeAgents.length];
    const lead = unassignedLeads[i];

    await leadAssignmentQueue.add('assign-lead', {
      leadId: lead.id.toString(),
      agentId: agent.id.toString(),
    });
  }

  console.log(`Queued ${unassignedLeads.length} leads for assignment`);
};

// Job: Process order status updates
export const processOrderStatus = async (orderId: string, newStatus: string, changedBy: string) => {
  await orderProcessingQueue.add('status-update', {
    orderId,
    newStatus,
    changedBy,
    timestamp: new Date().toISOString(),
  });
};

// Job: Send notifications
export const sendNotification = async (
  userId: string,
  type: string,
  title: string,
  body: string,
  channels: ('in_app' | 'email' | 'sms' | 'whatsapp')[] = ['in_app']
) => {
  await notificationQueue.add('send-notification', {
    userId,
    type,
    title,
    body,
    channels,
    timestamp: new Date().toISOString(),
  });
};

// Job: Process payout
export const processPayout = async (payoutId: string) => {
  await payoutQueue.add('process-payout', {
    payoutId,
    timestamp: new Date().toISOString(),
  });
};

// Job: Daily analytics aggregation
export const aggregateDailyAnalytics = async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalOrders,
    totalRevenue,
    newLeads,
    convertedLeads,
    newVendors,
  ] = await Promise.all([
    prisma.order.count({
      where: {
        createdAt: { gte: yesterday, lt: today },
      },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: { gte: yesterday, lt: today },
        status: 'DELIVERED',
      },
      _sum: { totalAmountMad: true },
    }),
    prisma.lead.count({
      where: {
        createdAt: { gte: yesterday, lt: today },
      },
    }),
    prisma.lead.count({
      where: {
        createdAt: { gte: yesterday, lt: today },
        status: 'ORDERED',
      },
    }),
    prisma.user.count({
      where: {
        createdAt: { gte: yesterday, lt: today },
        role: { name: 'VENDOR' },
      },
    }),
  ]);

  console.log('Daily Analytics:', {
    date: yesterday.toISOString().split('T')[0],
    totalOrders,
    totalRevenue: totalRevenue._sum.totalAmountMad || 0,
    newLeads,
    convertedLeads,
    newVendors,
  });
};

export default {
  leadAssignmentQueue,
  orderProcessingQueue,
  notificationQueue,
  payoutQueue,
  autoAssignLeads,
  processOrderStatus,
  sendNotification,
  processPayout,
  aggregateDailyAnalytics,
};
