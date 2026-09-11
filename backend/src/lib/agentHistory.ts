import { SYSTEM_NOTE_PREFIX } from './leadRelease.js';

/**
 * One home for "what counts as work a call-center agent did".
 *
 * Three screens score agents — the agent dashboard (`/leads?withStats=true`),
 * the agent statistics page (`/leads/agent-statistics`) and the admin
 * reconciliation console (`/admin/call-center-analytics`) — and they must all
 * read the same rows through the same filter and file them under the same
 * buckets, or the very mismatch the admin console exists to explain would be
 * baked into its own arithmetic. That is why these helpers live in lib/ and
 * not in a router.
 */

/**
 * Everything an agent can do to a lead that the agent dashboard scores them on,
 * in the order the tiles show it. `ASSIGNED` is the claim itself — a state, not
 * a result — and `PUSHED_TO_DELIVERY` is the hand-off to Coliaty; both are
 * listed so a lead always lands in exactly one bucket.
 *
 * These figures are read off `lead_status_history` rather than off the leads
 * table, because `assignedAgentId` is wiped the moment the reassignment cron
 * sends a lead back to the shared pool — and with it every trace that this
 * agent claimed it, called it and recorded an outcome. `changedBy` survives
 * that, so work stays attributed to whoever actually did it.
 */
export const AGENT_TRACKED_ACTIONS = [
  'ASSIGNED',
  'CALL_LATER',
  'NO_REPLY',
  'CONFIRMED',
  'WRONG_ORDER',
  'CANCEL_REASON_PRICE',
  'CANCEL_ORDER',
  'PUSHED_TO_DELIVERY',
] as const;

/**
 * The notes clause that drops the reassignment cron's rows. The cron writes its
 * history under the agent's own id, so without this an agent would be credited
 * for every automatic release — see SYSTEM_NOTE_PREFIX.
 */
export const AGENT_HISTORY_NOTES_FILTER = {
  OR: [{ notes: null }, { notes: { not: { startsWith: SYSTEM_NOTE_PREFIX } } }],
} as const;

/**
 * The `where` that selects one agent's own actions out of `lead_status_history`.
 *
 * `byLeadArrival` picks which timestamp the window narrows: the action itself
 * (false — "what did I get through today") or the lead's arrival (true — "how are
 * today's arrivals doing").
 */
export const agentHistoryWhere = (
  agentId: number,
  range: { gte?: Date; lte?: Date } | null,
  byLeadArrival: boolean,
): any => {
  const where: any = {
    changedBy: agentId,
    ...AGENT_HISTORY_NOTES_FILTER,
  };
  if (range) {
    if (byLeadArrival) where.lead = { is: { createdAt: range } };
    else where.createdAt = range;
  }
  return where;
};

export type AgentHistoryRow = {
  leadId: number;
  newStatus: string;
  lead?: { status: string } | null;
};

export type AgentHistoryTally = {
  byAction: Record<string, number>;
  byLead: Record<string, number>;
  byLastAction: Record<string, number>;
  totalActions: number;
  leadsWorked: number;
  claimed: number;
  /** Per-lead final word — what byLastAction is summed from. */
  lastActionPerLead: Map<number, string>;
};

/**
 * The three honest readings of a pile of history rows, built in one pass.
 *
 * `byAction` counts the work (a number rung twice is two NO_REPLY), `byLead`
 * counts the customers, and `byLastAction` files each lead once under the agent's
 * final word on it — the only one of the three that sums to `leadsWorked`, which
 * is why the donut and every percentage are built on it.
 *
 * ROWS MUST BE ORDERED NEWEST FIRST: the first row seen for a lead is taken as
 * its last action.
 */
export const tallyAgentHistory = (rows: AgentHistoryRow[]): AgentHistoryTally => {
  const byAction: Record<string, number> = {};
  const leadsPerAction: Record<string, Set<number>> = {};
  const lastActionPerLead = new Map<number, string>();

  for (const row of rows) {
    byAction[row.newStatus] = (byAction[row.newStatus] || 0) + 1;
    (leadsPerAction[row.newStatus] ||= new Set()).add(row.leadId);
    if (lastActionPerLead.has(row.leadId)) continue;
    // A lead already handed to Coliaty is booked as pushed whatever the last row
    // says. The hand-off only started writing its own history row recently, so
    // without this the leads pushed before that would still read as CONFIRMED.
    lastActionPerLead.set(
      row.leadId,
      row.lead?.status === 'PUSHED_TO_DELIVERY' ? 'PUSHED_TO_DELIVERY' : row.newStatus
    );
  }

  const byLastAction: Record<string, number> = {};
  for (const action of lastActionPerLead.values()) {
    byLastAction[action] = (byLastAction[action] || 0) + 1;
  }

  const byLead: Record<string, number> = {};
  for (const [action, leadIds] of Object.entries(leadsPerAction)) {
    byLead[action] = leadIds.size;
  }

  // Zero-fill so a tile the agent never lit renders as 0 instead of vanishing.
  for (const action of AGENT_TRACKED_ACTIONS) {
    byAction[action] ??= 0;
    byLead[action] ??= 0;
    byLastAction[action] ??= 0;
  }

  return {
    byAction,
    byLead,
    byLastAction,
    totalActions: rows.length,
    leadsWorked: lastActionPerLead.size,
    claimed: byLead.ASSIGNED,
    lastActionPerLead,
  };
};
