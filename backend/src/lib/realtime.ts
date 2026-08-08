import type { Server as SocketServer } from 'socket.io';

/**
 * Holds a reference to the live Socket.io server instance.
 *
 * This exists to break the circular import between `index.ts` (which creates the
 * io server) and route modules that need to push events to connected clients.
 * `index.ts` calls `setIO(io)` once during boot; everything else imports `getIO()`.
 */
let ioRef: SocketServer | null = null;

export const setIO = (io: SocketServer) => {
  ioRef = io;
};

export const getIO = (): SocketServer | null => ioRef;

/**
 * Broadcast the current auto-recording state to every connected client so their
 * LiveSessionTracker starts or stops rrweb capture immediately (no reconnect needed).
 */
export const broadcastRecordingState = (enabled: boolean) => {
  if (!ioRef) return;
  ioRef.emit('stream:config', { record: enabled });
};

/** Why a lead stopped being assigned — drives the message the agent sees. */
export type LeadUnassignReason =
  | 'FORCE_CLAIMED'   // another agent took it over
  | 'REASSIGNED'      // an admin moved it to somebody else
  | 'TIMEOUT_IDLE'    // auto-unassigned for inactivity
  | 'TIMEOUT_STATUS'  // auto-unassigned after too long in a holding status
  | 'EXPIRED';        // terminal/retry status aged out

/**
 * Tell an agent that a lead just left their hands.
 *
 * Every path that clears or moves `assignedAgentId` calls this, so an agent
 * sitting on /agent/leads/:id can close the page the moment it stops being
 * theirs instead of discovering it on the next action. Addressed by numeric
 * user id — sockets join both `user:<uuid>` and `user:<id>` (see index.ts).
 */
export const emitLeadUnassigned = (
  agentId: number,
  payload: { leadId: number; leadName?: string | null; reason: LeadUnassignReason; byAgent?: string },
) => {
  if (!ioRef || !agentId) return;
  try {
    ioRef.to(`user:${agentId}`).emit('lead-unassigned', payload);
  } catch (err) {
    // Never let a realtime hiccup break the write that just succeeded.
    console.error('[realtime] lead-unassigned emit failed:', err);
  }
};
