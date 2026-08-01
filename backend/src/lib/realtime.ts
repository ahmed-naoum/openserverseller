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
