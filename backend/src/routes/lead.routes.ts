import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, status, brandId, agentId, search } = req.query;

    const where: any = {};

    if (req.user!.roleName === 'VENDOR') {
      where.vendorId = req.user!.id;
    } else if (req.user!.roleName === 'CALL_CENTER_AGENT') {
      where.assignedAgentId = req.user!.id;
    }

    if (status) where.status = status;
    if (brandId) where.brandId = BigInt(brandId as string);
    if (agentId) where.assignedAgentId = BigInt(agentId as string);

    if (search) {
      where.OR = [
        { fullName: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } },
        { city: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          brand: true,
          assignedAgent: {
            include: { profile: true },
          },
          importBatch: true,
          statusHistory: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
          callLogs: {
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: {
        leads: leads.map((l) => ({
          id: l.id,
          fullName: l.fullName,
          phone: l.phone,
          whatsapp: l.whatsapp,
          city: l.city,
          address: l.address,
          status: l.status,
          conversionProbability: l.conversionProbability,
          notes: l.notes,
          brand: l.brand ? { id: l.brand.id, name: l.brand.name } : null,
          assignedAgent: l.assignedAgent
            ? {
                id: l.assignedAgent.id,
                uuid: l.assignedAgent.uuid,
                fullName: l.assignedAgent.profile?.fullName,
              }
            : null,
          recentCalls: l.callLogs.length,
          lastCall: l.callLogs[0]?.createdAt || null,
          createdAt: l.createdAt,
        })),
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

router.post(
  '/import',
  authenticate,
  authorize('VENDOR'),
  asyncHandler(async (req, res) => {
    const { brandId, leads } = req.body;

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      throw new AppException(400, 'Leads array is required');
    }

    const brand = await prisma.brand.findFirst({
      where: {
        id: BigInt(brandId),
        vendorId: req.user!.id,
      },
    });

    if (!brand) {
      throw new AppException(404, 'Brand not found');
    }

    const batch = await prisma.leadImportBatch.create({
      data: {
        vendorId: req.user!.id,
        fileName: `import-${Date.now()}.csv`,
        totalRows: leads.length,
        status: 'PROCESSING',
      },
    });

    let validRows = 0;
    let duplicateRows = 0;
    const errors: string[] = [];

    const phoneRegex = /^(\+212|0)[0-9]{9}$/;

    for (const lead of leads) {
      try {
        if (!lead.fullName || !lead.phone) {
          errors.push(`Missing required fields for lead: ${JSON.stringify(lead)}`);
          continue;
        }

        const normalizedPhone = lead.phone.replace(/^0/, '+212');

        if (!phoneRegex.test(normalizedPhone)) {
          errors.push(`Invalid phone format: ${lead.phone}`);
          continue;
        }

        const existingLead = await prisma.lead.findFirst({
          where: {
            vendorId: req.user!.id,
            phone: normalizedPhone,
          },
        });

        if (existingLead) {
          duplicateRows++;
          continue;
        }

        await prisma.lead.create({
          data: {
            vendorId: req.user!.id,
            brandId: brand.id,
            importBatchId: batch.id,
            fullName: lead.fullName,
            phone: normalizedPhone,
            whatsapp: lead.whatsapp || normalizedPhone,
            city: lead.city,
            address: lead.address,
            status: 'NEW',
            metadata: lead.metadata || {},
          },
        });

        validRows++;
      } catch (error) {
        errors.push(`Error processing lead: ${error}`);
      }
    }

    await prisma.leadImportBatch.update({
      where: { id: batch.id },
      data: {
        validRows,
        duplicateRows,
        status: 'COMPLETED',
      },
    });

    res.status(201).json({
      status: 'success',
      message: 'Leads imported successfully',
      data: {
        batch: {
          id: batch.id,
          totalRows: leads.length,
          validRows,
          duplicateRows,
          errors: errors.slice(0, 10),
        },
      },
    });
  })
);

router.post(
  '/',
  authenticate,
  authorize('VENDOR'),
  [
    body('fullName').notEmpty().trim(),
    body('phone').matches(/^(\+212|0)[0-9]{9}$/),
    body('brandId').notEmpty(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppException(400, 'Validation failed');
    }

    const { fullName, phone, whatsapp, city, address, brandId, notes } = req.body;

    const brand = await prisma.brand.findFirst({
      where: {
        id: BigInt(brandId),
        vendorId: req.user!.id,
      },
    });

    if (!brand) {
      throw new AppException(404, 'Brand not found');
    }

    const normalizedPhone = phone.replace(/^0/, '+212');

    const existingLead = await prisma.lead.findFirst({
      where: {
        vendorId: req.user!.id,
        phone: normalizedPhone,
      },
    });

    if (existingLead) {
      throw new AppException(409, 'Lead with this phone number already exists');
    }

    const lead = await prisma.lead.create({
      data: {
        vendorId: req.user!.id,
        brandId: brand.id,
        fullName,
        phone: normalizedPhone,
        whatsapp: whatsapp || normalizedPhone,
        city,
        address,
        status: 'NEW',
        notes,
      },
      include: {
        brand: true,
      },
    });

    res.status(201).json({
      status: 'success',
      message: 'Lead created successfully',
      data: { lead },
    });
  })
);

router.patch(
  '/:id/status',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = [
      'NEW',
      'ASSIGNED',
      'CONTACTED',
      'INTERESTED',
      'NOT_INTERESTED',
      'CALLBACK_REQUESTED',
      'ORDERED',
      'UNREACHABLE',
      'INVALID',
    ];

    if (!validStatuses.includes(status)) {
      throw new AppException(400, 'Invalid status');
    }

    const where: any = { id: BigInt(id) };

    if (req.user!.roleName === 'VENDOR') {
      where.vendorId = req.user!.id;
    } else if (req.user!.roleName === 'CALL_CENTER_AGENT') {
      where.assignedAgentId = req.user!.id;
    }

    const lead = await prisma.lead.findFirst({ where });

    if (!lead) {
      throw new AppException(404, 'Lead not found');
    }

    const updatedLead = await prisma.$transaction(async (tx) => {
      await tx.leadStatusHistory.create({
        data: {
          leadId: lead.id,
          oldStatus: lead.status,
          newStatus: status,
          changedBy: req.user!.id,
        },
      });

      return tx.lead.update({
        where: { id: lead.id },
        data: {
          status,
          notes: notes || lead.notes,
        },
      });
    });

    res.json({
      status: 'success',
      message: 'Lead status updated',
      data: { lead: updatedLead },
    });
  })
);

router.post(
  '/:id/assign',
  authenticate,
  authorize('SUPER_ADMIN', 'CALL_CENTER_AGENT'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { agentId } = req.body;

    const lead = await prisma.lead.findUnique({
      where: { id: BigInt(id) },
    });

    if (!lead) {
      throw new AppException(404, 'Lead not found');
    }

    const agent = await prisma.user.findFirst({
      where: {
        id: BigInt(agentId),
        role: { name: 'CALL_CENTER_AGENT' },
        isActive: true,
      },
    });

    if (!agent) {
      throw new AppException(404, 'Agent not found');
    }

    const updatedLead = await prisma.$transaction(async (tx) => {
      if (lead.assignedAgentId) {
        await tx.leadAssignment.updateMany({
          where: {
            leadId: lead.id,
            agentId: lead.assignedAgentId,
            unassignedAt: null,
          },
          data: { unassignedAt: new Date() },
        });
      }

      await tx.leadAssignment.create({
        data: {
          leadId: lead.id,
          agentId: agent.id,
        },
      });

      await tx.leadStatusHistory.create({
        data: {
          leadId: lead.id,
          oldStatus: lead.status,
          newStatus: 'ASSIGNED',
          changedBy: req.user!.id,
        },
      });

      return tx.lead.update({
        where: { id: lead.id },
        data: {
          assignedAgentId: agent.id,
          status: 'ASSIGNED',
        },
      });
    });

    res.json({
      status: 'success',
      message: 'Lead assigned successfully',
      data: { lead: updatedLead },
    });
  })
);

router.post(
  '/auto-assign',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const { brandId, limit = 50 } = req.body;

    const unassignedLeads = await prisma.lead.findMany({
      where: {
        status: 'NEW',
        assignedAgentId: null,
        ...(brandId && { brandId: BigInt(brandId) }),
      },
      take: Number(limit),
    });

    const agents = await prisma.user.findMany({
      where: {
        role: { name: 'CALL_CENTER_AGENT' },
        isActive: true,
      },
    });

    if (agents.length === 0) {
      throw new AppException(400, 'No active agents available');
    }

    let assignedCount = 0;

    for (let i = 0; i < unassignedLeads.length; i++) {
      const agent = agents[i % agents.length];
      const lead = unassignedLeads[i];

      await prisma.$transaction(async (tx) => {
        await tx.leadAssignment.create({
          data: {
            leadId: lead.id,
            agentId: agent.id,
          },
        });

        await tx.lead.update({
          where: { id: lead.id },
          data: {
            assignedAgentId: agent.id,
            status: 'ASSIGNED',
          },
        });
      });

      assignedCount++;
    }

    res.json({
      status: 'success',
      message: `Successfully assigned ${assignedCount} leads`,
      data: { assignedCount, agentCount: agents.length },
    });
  })
);

router.post(
  '/:id/call-log',
  authenticate,
  authorize('CALL_CENTER_AGENT'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { duration, outcome, recordingUrl } = req.body;

    const lead = await prisma.lead.findFirst({
      where: {
        id: BigInt(id),
        assignedAgentId: req.user!.id,
      },
    });

    if (!lead) {
      throw new AppException(404, 'Lead not found or not assigned to you');
    }

    const callLog = await prisma.callLog.create({
      data: {
        leadId: lead.id,
        agentId: req.user!.id,
        callDurationSeconds: duration,
        outcome,
        recordingUrl,
      },
    });

    res.status(201).json({
      status: 'success',
      message: 'Call logged successfully',
      data: { callLog },
    });
  })
);

export default router;
