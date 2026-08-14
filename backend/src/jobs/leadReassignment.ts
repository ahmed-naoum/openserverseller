import { prisma } from '../lib/prisma.js';
import { emitLeadUnassigned } from '../lib/realtime.js';
import {
  CALL_LATER,
  CALL_LATER_GRACE_MS,
  DEAD_NO_REPLY,
  MAX_NO_REPLY_RELEASES,
  MAX_RELEASE_MS,
  RELEASE_TRACKED_STATUSES,
  SYSTEM_NOTE_PREFIX,
  resolveRelease,
} from '../lib/leadRelease.js';


// Check interval: every 10 seconds
const CHECK_INTERVAL_MS = 10 * 1000;

export const startLeadsReassignmentCron = () => {
  console.log('[Cron] Leads Reassignment Job started.');

  setInterval(async () => {
    try {
      const now = new Date();
      // Rows written before `releaseAt` existed carry null and would otherwise
      // never expire. Fall back to the old fixed-window behaviour for those,
      // which drains the backlog without needing a data migration.
      const legacyThreshold = new Date(Date.now() - MAX_RELEASE_MS);
      // CALL_LATER rows written before this feature carry no `releaseAt` at
      // all, so they are matched on the reminder itself: a callback promised
      // more than the grace period ago is overdue by the same rule.
      const overdueCallbackThreshold = new Date(Date.now() - CALL_LATER_GRACE_MS);

      // Every lead whose hold window has run out. The deadline was written with
      // the status (see lib/leadRelease.ts), so this job only enforces it — it
      // never decides the timing itself.
      const expiredLeads = await prisma.lead.findMany({
        where: {
          assignedAgentId: { not: null },
          OR: [
            // Statuses on the randomised 1–2 h hold.
            {
              status: { in: RELEASE_TRACKED_STATUSES },
              OR: [
                { releaseAt: { lte: now } },
                { releaseAt: null, updatedAt: { lte: legacyThreshold } },
              ],
            },
            // CALL_LATER: the deadline is the agent's own reminder plus one
            // hour. A lead whose callback is still ahead is being worked and
            // must not be touched, which is why it cannot share the branch
            // above — the `updatedAt` fallback there would drop it early.
            {
              status: CALL_LATER,
              OR: [
                { releaseAt: { lte: now } },
                { releaseAt: null, callbackAt: { lte: overdueCallbackThreshold } },
                // Parked in CALL_LATER with no reminder to count down to:
                // drain it on the standard window rather than leave it stuck.
                { releaseAt: null, callbackAt: null, updatedAt: { lte: legacyThreshold } },
              ],
            },
          ],
        },
        select: {
          id: true,
          assignedAgentId: true,
          status: true,
          noReplyReleases: true,
        }
      });

      if (expiredLeads.length === 0) {
        // Do nothing if no leads
      } else {
        console.log(`[Cron] Found ${expiredLeads.length} leads with terminal/retry statuses to unassign.`);

        for (const lead of expiredLeads) {
          // NO_REPLY burns one of the lead's five attempts here; every other
          // tracked status recycles without consuming anything.
          const { newStatus, releases, exhausted } = resolveRelease(lead.status, lead.noReplyReleases);

          console.log(
            exhausted
              ? `[Cron] Lead #${lead.id}: ${MAX_NO_REPLY_RELEASES} NO_REPLY attempts exhausted — retiring to ${DEAD_NO_REPLY}.`
              : `[Cron] Lead #${lead.id}: Unassigning due to timeout in status ${lead.status}.`
          );

          // Every note here opens with SYSTEM_NOTE_PREFIX on purpose: the row is
          // stamped with the agent's id, and that prefix is what stops the agent
          // dashboard from reading a timeout as work the agent did.
          const notes = exhausted
            ? `${SYSTEM_NOTE_PREFIX} ${MAX_NO_REPLY_RELEASES} tentatives sans réponse — lead retiré du pool (${DEAD_NO_REPLY}).`
            : lead.status === 'NO_REPLY'
              ? `${SYSTEM_NOTE_PREFIX} Lead désassigné automatiquement après le délai maximum dans le statut NO_REPLY (tentative ${releases}/${MAX_NO_REPLY_RELEASES}).`
              : lead.status === CALL_LATER
                ? `${SYSTEM_NOTE_PREFIX} Rappel non effectué plus d'1 h après l'heure prévue — lead remis dans le pool.`
                : `${SYSTEM_NOTE_PREFIX} Lead désassigné automatiquement après le délai maximum dans le statut ${lead.status}.`;

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
              newStatus,
              changedBy: lead.assignedAgentId!,
              notes,
            }
          });

          // Unassign the lead and reset status. `releaseAt` is cleared either
          // way — an AVAILABLE lead is not counting down towards anything, and
          // a retired one never counts down again.
          await tx.lead.update({
            where: { id: lead.id },
            data: {
              assignedAgentId: null,
              status: newStatus,
              releaseAt: null,
              noReplyReleases: releases,
            }
          });
        });

        // Close the lead page the previous agent may still have open on it.
        emitLeadUnassigned(lead.assignedAgentId!, {
          leadId: lead.id,
          reason: exhausted ? 'NO_REPLY_EXHAUSTED' : 'EXPIRED',
        });
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
                notes: `${SYSTEM_NOTE_PREFIX} Lead désassigné automatiquement pour inactivité (7 minutes).`,
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
          OR: [
            { releaseAt: { lte: now } },
            { releaseAt: null, updatedAt: { lte: shortTimeoutThreshold } },
          ],
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
                notes: `${SYSTEM_NOTE_PREFIX} Agent désassigné après 2 minutes. Statut conservé: ${lead.status}.`,
              }
            });
            
            await tx.lead.update({
              where: { id: lead.id },
              data: { assignedAgentId: null, releaseAt: null }
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
