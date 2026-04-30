import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Check interval: every 10 seconds
const CHECK_INTERVAL_MS = 10 * 1000;
// Test expiration limit: 20 seconds (Change to 3 * 60 * 60 * 1000 for production)
const EXPIRATION_LIMIT_MS = 20 * 1000;

// Max tries per agent before unassigning
const MAX_TRIES_PER_AGENT = 2;
// Max different agents that can be assigned to a lead
// On the last assignment (6th), the lead stays permanently
const MAX_AGENTS = 6;

export const startLeadsReassignmentCron = () => {
  console.log('[Cron] Leads Reassignment Job started.');

  setInterval(async () => {
    try {
      const thresholdDate = new Date(Date.now() - EXPIRATION_LIMIT_MS);

      const statusesToDrop = [
        'NO_REPLY',
        'WRONG_ORDER',
        'CANCEL_REASON_PRICE',
        'CANCEL_ORDER',
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

      if (expiredLeads.length === 0) return;

      console.log(`[Cron] Found ${expiredLeads.length} leads to check for inactivity.`);

      for (const lead of expiredLeads) {
        // Count how many total assignments this lead has had (including same agent reclaiming)
        const totalAssignments = await prisma.leadAssignment.count({
          where: { leadId: lead.id },
        });

        // If this lead has had 3+ assignments total, it stays permanently with the current agent
        if (totalAssignments >= MAX_AGENTS) {
          console.log(`[Cron] Lead #${lead.id} has reached max ${MAX_AGENTS} assignments. Keeping with current agent.`);
          continue;
        }

        // Count how many status changes the CURRENT agent has made on this lead
        const currentAgentTries = await prisma.leadStatusHistory.count({
          where: {
            leadId: lead.id,
            changedBy: lead.assignedAgentId!,
          }
        });

        // If the current agent hasn't used all their tries yet, skip
        if (currentAgentTries < MAX_TRIES_PER_AGENT) {
          continue;
        }

        // Agent has used all tries and lead is not ORDERED → unassign
        console.log(`[Cron] Lead #${lead.id}: Agent #${lead.assignedAgentId} used ${currentAgentTries}/${MAX_TRIES_PER_AGENT} tries. Unassigning.`);

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
              notes: `Système : Lead désassigné automatiquement après ${MAX_TRIES_PER_AGENT} tentatives sans commande. (Assignation ${totalAssignments}/${MAX_AGENTS})`,
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
      }

    } catch (error) {
      console.error('[Cron] Error in lead reassignment check:', error);
    }
  }, CHECK_INTERVAL_MS);
};
