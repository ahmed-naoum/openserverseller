import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';

const prisma = new PrismaClient();

export const getStats = async (req: Request, res: Response) => {
  const vendorId = req.user!.id;

  const [totalLeads, newLeads, convertedLeads, totalOrders, pendingOrders, revenue] = await Promise.all([
    prisma.lead.count({ where: { vendorId } }),
    prisma.lead.count({ where: { vendorId, status: 'NEW' } }),
    prisma.lead.count({ where: { vendorId, status: { in: ['ORDERED', 'CONFIRMED'] } } }),
    prisma.order.count({ where: { vendorId } }),
    prisma.order.count({ where: { vendorId, status: 'PENDING' } }),
    prisma.order.aggregate({
      where: { vendorId, status: 'DELIVERED' },
      _sum: { vendorEarningMad: true },
    }),
  ]);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const ordersByDay = await prisma.$queryRaw`
    SELECT DATE(created_at) as date, COUNT(*) as count, SUM(vendor_earning_mad) as revenue
    FROM orders
    WHERE vendor_id = ${vendorId} AND created_at >= ${thirtyDaysAgo}
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `;

  res.json({
    status: 'success',
    data: {
      stats: {
        totalLeads,
        newLeads,
        convertedLeads,
        conversionRate: totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0,
        totalOrders,
        pendingOrders,
        totalRevenue: revenue._sum.vendorEarningMad || 0,
      },
      charts: {
        ordersByDay,
      },
    },
  });
};

export const getAgentStats = async (req: Request, res: Response) => {
  const agentId = req.user!.id;

  const [totalLeads, contactedLeads, interestedLeads, orderedLeads, callLogs] = await Promise.all([
    prisma.lead.count({ where: { assignedAgentId: agentId } }),
    prisma.lead.count({ where: { assignedAgentId: agentId, status: 'CONTACTED' } }),
    prisma.lead.count({ where: { assignedAgentId: agentId, status: 'INTERESTED' } }),
    prisma.lead.count({ where: { assignedAgentId: agentId, status: { in: ['ORDERED', 'CONFIRMED'] } } }),
    prisma.callLog.count({ where: { agentId } }),
  ]);

  const conversionRate = contactedLeads > 0 ? ((orderedLeads / contactedLeads) * 100).toFixed(1) : 0;

  res.json({
    status: 'success',
    data: {
      stats: {
        totalLeads,
        contactedLeads,
        interestedLeads,
        orderedLeads,
        callLogs,
        conversionRate,
      },
    },
  });
};

export const getAnalytics = async (req: Request, res: Response) => {
  const vendorId = req.user!.id;
  const { startDate, endDate } = req.query;

  const where: any = { vendorId };
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate as string);
    if (endDate) where.createdAt.lte = new Date(endDate as string);
  }

  const [
    ordersByStatus,
    leadsByStatus,
    topProducts,
    topCities,
    revenueByProduct,
  ] = await Promise.all([
    prisma.order.groupBy({
      by: ['status'],
      where,
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ['status'],
      where,
      _count: true,
    }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: where },
      _sum: { quantity: true, totalPriceMad: true },
      orderBy: { _sum: { totalPriceMad: 'desc' } },
      take: 10,
    }),
    prisma.lead.groupBy({
      by: ['city'],
      where,
      _count: true,
      orderBy: { _count: { city: 'desc' } },
      take: 10,
    }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: where },
      _sum: { vendorEarningMad: true } as any,
      orderBy: { _sum: { vendorEarningMad: 'desc' } as any },
      take: 5,
    }),
  ]);

  res.json({
    status: 'success',
    data: {
      ordersByStatus,
      leadsByStatus,
      topProducts,
      topCities,
      revenueByProduct,
    },
  });
};

export default {
  getStats,
  getAgentStats,
  getAnalytics,
};
