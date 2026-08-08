import { prisma } from '../lib/prisma.js';
import { emitLeadUnassigned } from '../lib/realtime.js';


// Check interval: every 10 seconds
const CHECK_INTERVAL_MS = 10 * 1000;
// Expiration limit for terminal/retry statuses: 2 hours
const EXPIRATION_LIMIT_MS = 2 * 60 * 60 * 1000;

export const startLeadsReassignmentCron = () => {
  console.log('[Cron] Leads Reassignment Job started.');

  setInterval(async () => {
    try {
      const thresholdDate = new Date(Date.now() - EXPIRATION_LIMIT_MS);

      const statusesToDrop = [
        'NO_REPLY',
        'INVALID',
        'CONTACTED',
        'INTERESTED',
        'CALLBACK_REQUESTED',
        'NOT_INTERESTED',
        'UNREACHABLE'
      ];

      // Find all leads assigned to ANY agent that have these statuses
      // and haven't been updated since the thresholdDate
      const expiredLeads = await prisma.lead.findMany({
        where: {
          assignedAgentId: { not: null },
          status: { in: statusesToDrop },
          updatedAt: { lte: thresholdDate }
        },
        select: {
          id: true,
          assignedAgentId: true,
          status: true,
        }
      });

      if (expiredLeads.length === 0) {
        // Do nothing if no leads
      } else {
        console.log(`[Cron] Found ${expiredLeads.length} leads with terminal/retry statuses to unassign.`);

        for (const lead of expiredLeads) {
          console.log(`[Cron] Lead #${lead.id}: Unassigning due to timeout in status ${lead.status}.`);

        await prisma.$transaction(async (tx) => {
          // Close the current assignment
          await tx.leadAssignment.updateMany({
            where: {
              leadId: lead.id,
              agentId: lead.assignedAgentId!,
              unassignedAt: null
            },
            data: { unassignedAt: new Date() }
          });

          // Add a history record
          await tx.leadStatusHistory.create({
            data: {
              leadId: lead.id,
              oldStatus: lead.status,
              newStatus: 'AVAILABLE',
              changedBy: lead.assignedAgentId!,
              notes: `Système : Lead désassigné automatiquement après le délai maximum dans le statut ${lead.status}.`,
            }
          });

          // Unassign the lead and reset status
          await tx.lead.update({
            where: { id: lead.id },
            data: {
              assignedAgentId: null,
              status: 'AVAILABLE'
            }
          });
        });

        // Close the lead page the previous agent may still have open on it.
        emitLeadUnassigned(lead.assignedAgentId!, { leadId: lead.id, reason: 'EXPIRED' });
        }
      }

      // Check 2: Idle ASSIGNED leads
      const idleThresholdDate = new Date(Date.now() - 7 * 60 * 1000); // 7 minutes
      const idleLeads = await prisma.lead.findMany({
        where: {
          assignedAgentId: { not: null },
          status: 'ASSIGNED',
          updatedAt: { lte: idleThresholdDate }
        },
        select: { id: true, assignedAgentId: true, status: true }
      });
 
      if (idleLeads.length > 0) {
        console.log(`[Cron] Found ${idleLeads.length} idle ASSIGNED leads to unassign.`);
        for (const lead of idleLeads) {
          await prisma.$transaction(async (tx) => {
            await tx.leadAssignment.updateMany({
              where: { leadId: lead.id, agentId: lead.assignedAgentId!, unassignedAt: null },
              data: { unassignedAt: new Date() }
            });
            
            await tx.leadStatusHistory.create({
              data: {
                leadId: lead.id,
                oldStatus: lead.status,
                newStatus: 'AVAILABLE',
                changedBy: lead.assignedAgentId!,
                notes: 'Système : Lead désassigné automatiquement pour inactivité (7 minutes).',
              }
            });
            
            await tx.lead.update({
              where: { id: lead.id },
              data: { assignedAgentId: null, status: 'AVAILABLE' }
            });
          });

          emitLeadUnassigned(lead.assignedAgentId!, { leadId: lead.id, reason: 'TIMEOUT_IDLE' });
        }
      }

      // Check 3: WRONG_ORDER and CANCEL_ORDER leads unassignment after 2 minutes
      const shortTimeoutThreshold = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes
      const shortTimeoutLeads = await prisma.lead.findMany({
        where: {
          assignedAgentId: { not: null },
          status: { in: ['WRONG_ORDER', 'CANCEL_ORDER'] },
          updatedAt: { lte: shortTimeoutThreshold }
        },
        select: { id: true, assignedAgentId: true, status: true }
      });

      if (shortTimeoutLeads.length > 0) {
        console.log(`[Cron] Found ${shortTimeoutLeads.length} WRONG_ORDER/CANCEL_ORDER leads to unassign after 2 minutes.`);
        for (const lead of shortTimeoutLeads) {
          await prisma.$transaction(async (tx) => {
            await tx.leadAssignment.updateMany({
              where: { leadId: lead.id, agentId: lead.assignedAgentId!, unassignedAt: null },
              data: { unassignedAt: new Date() }
            });
            
            await tx.leadStatusHistory.create({
              data: {
                leadId: lead.id,
                oldStatus: lead.status,
                newStatus: lead.status,
                changedBy: lead.assignedAgentId!,
                notes: `Système : Agent désassigné après 2 minutes. Statut conservé: ${lead.status}.`,
              }
            });
            
            await tx.lead.update({
              where: { id: lead.id },
              data: { assignedAgentId: null }
            });
          });

          emitLeadUnassigned(lead.assignedAgentId!, { leadId: lead.id, reason: 'TIMEOUT_STATUS' });
        }
      }

    } catch (error) {
      console.error('[Cron] Error in lead reassignment check:', error);
    }
  }, CHECK_INTERVAL_MS);
};
