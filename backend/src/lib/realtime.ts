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
  | 'EXPIRED'         // terminal/retry status aged out
  | 'NO_REPLY_EXHAUSTED'; // out of NO_REPLY attempts — retired, not recycled

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

/** Why a session ended — picks the notice the login page shows. */
export type SessionEndReason = 'logout' | 'expired' | 'revoked';

/**
 * Tell every socket signed in as this user that their session is over.
 *
 * Sockets join both `user:<uuid>` and `user:<id>` (see index.ts), so either
 * identifier reaches them; chaining both rooms is a union, not a double send.
 *
 * This is the arm that reaches OTHER DEVICES. A browser's own tabs are already
 * handled without the server — they share one localStorage and talk over a
 * BroadcastChannel — so this exists for the phone left open on the dashboard
 * while the laptop signs out, and for anything server-side that needs to end a
 * session it did not start.
 */
export const emitSessionEnded = (
  target: { userId?: number | null; userUuid?: string | null },
  reason: SessionEndReason = 'revoked',
) => {
  if (!ioRef) return;
  const rooms = [
    target.userUuid ? `user:${target.userUuid}` : null,
    target.userId ? `user:${target.userId}` : null,
  ].filter(Boolean) as string[];
  if (!rooms.length) return;

  try {
    rooms.reduce((channel, room) => channel.to(room), ioRef as any).emit('auth:session-ended', { reason });
  } catch (err) {
    // A signed-out user is signed out whether or not the broadcast lands.
    console.error('[realtime] session-ended emit failed:', err);
  }
};
