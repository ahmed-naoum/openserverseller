import { useEffect, useRef } from 'react';
import { record } from 'rrweb';
import { useSocket } from '../../contexts/SocketContext';
import { useLocation } from 'react-router-dom';

/**
 * Mounted globally, but IDLE by default. It only runs rrweb capture when the
 * server tells it to — either because global auto-recording is enabled, or
 * because a SUPER_ADMIN is actively watching this exact tab. When neither is
 * true it does nothing, so normal visitors pay zero CPU / bandwidth cost.
 *
 * Privacy: inputs are recorded raw per platform config, EXCEPT password fields,
 * which stay masked (capturing passwords has no debugging value and is a
 * credential-theft risk). Flip `maskInputOptions.password` to remove that.
 */
export default function LiveSessionTracker() {
  const { socket } = useSocket();
  const location = useLocation();

  const eventsBufferRef = useRef<any[]>([]);
  const stopRecordRef = useRef<(() => void) | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef(false);
  const pathRef = useRef(location.pathname + location.search);

  // Keep the latest path available to the flush closure without re-subscribing.
  useEffect(() => {
    pathRef.current = location.pathname + location.search;
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!socket) return;

    const flush = () => {
      if (eventsBufferRef.current.length === 0 || !socket.connected) return;
      const events = eventsBufferRef.current;
      eventsBufferRef.current = [];
      socket.emit('rrweb:events', { events, path: pathRef.current });
    };

    const startCapture = () => {
      if (recordingRef.current) return;
      recordingRef.current = true;
      eventsBufferRef.current = [];
      try {
        stopRecordRef.current = record({
          emit(event) {
            eventsBufferRef.current.push(event);
          },
          maskAllInputs: false, // raw capture per platform config
          maskInputOptions: { password: true }, // never capture password keystrokes
          // `input: 'last'` makes rrweb listen to `change` ONLY, so a field the
          // visitor types into and never blurs (they abandon the page, or submit
          // straight from the last field) records nothing at all — which is why
          // replays of carts full of data reported no input. Capture every
          // keystroke instead; a 4-field form adds a handful of tiny events next
          // to mousemove at 50ms.
          sampling: { mousemove: 50, scroll: 150, media: 800, input: 'all' },
          recordCanvas: false,
          collectFonts: false,
          // Periodic fresh full snapshot: lets an admin joining mid-session get a
          // clean picture and bounds how far back a replay must reconstruct.
          checkoutEveryNms: 2 * 60 * 1000,
        }) || null;
      } catch (err) {
        console.warn('[LiveSessionTracker] Failed to start recorder:', err);
        recordingRef.current = false;
        return;
      }
      flushTimerRef.current = setInterval(flush, 1000);
    };

    const stopCapture = () => {
      if (!recordingRef.current) return;
      recordingRef.current = false;
      if (flushTimerRef.current) { clearInterval(flushTimerRef.current); flushTimerRef.current = null; }
      try { stopRecordRef.current?.(); } catch { /* noop */ }
      stopRecordRef.current = null;
      flush(); // send whatever is left
    };

    // Force a fresh full snapshot (used when an admin starts watching an
    // already-recording tab). Falls back to a recorder restart if the direct
    // API isn't available in this rrweb build.
    const forceSnapshot = () => {
      if (!recordingRef.current) return;
      try {
        const take = (record as any).takeFullSnapshot;
        if (typeof take === 'function') {
          take(true);
        } else {
          stopCapture();
          startCapture();
        }
      } catch {
        stopCapture();
        startCapture();
      }
      setTimeout(flush, 30);
    };

    const applyRecordingState = (active: boolean) => {
      if (active) startCapture();
      else stopCapture();
    };

    const handleConfig = (data: { record?: boolean }) => applyRecordingState(!!data?.record);
    const handleRecordState = (data: { active?: boolean }) => applyRecordingState(!!data?.active);
    const handleSnapshotRequest = () => forceSnapshot();
    const handleConnect = () => socket.emit('stream:sync');

    socket.on('stream:config', handleConfig);
    socket.on('stream:record-state', handleRecordState);
    socket.on('stream:request-snapshot', handleSnapshotRequest);
    socket.on('connect', handleConnect);

    // Ask the server for the current recording state now that we're listening.
    if (socket.connected) socket.emit('stream:sync');

    return () => {
      socket.off('stream:config', handleConfig);
      socket.off('stream:record-state', handleRecordState);
      socket.off('stream:request-snapshot', handleSnapshotRequest);
      socket.off('connect', handleConnect);
      stopCapture();
    };
  }, [socket]);

  // On SPA navigation while recording, emit a fresh full snapshot so each page
  // is a clean replay segment (rrweb won't otherwise re-snapshot on route change).
  useEffect(() => {
    if (!recordingRef.current) return;
    try {
      const take = (record as any).takeFullSnapshot;
      if (typeof take === 'function') take(true);
    } catch { /* noop */ }
  }, [location.pathname]);

  return null;
}
