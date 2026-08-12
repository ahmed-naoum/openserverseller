/**
 * Runs `task` after the page has loaded and the main thread goes idle.
 *
 * For work that has to happen but must not compete with first paint —
 * cache-version checks, page-view beacons, anything fire-and-forget. On a
 * landing page opened from an ad, every request issued during load delays the
 * one request that actually renders the offer, so the cheapest fix for a
 * non-urgent call is to stop making it urgent.
 *
 * `requestIdleCallback` is absent on Safari before 16.4, hence the timer
 * fallback. The same shape is inlined in SocketContext for the guest socket,
 * which is deliberately left alone: its scheduling is entangled with the
 * connect/cleanup lifecycle there.
 *
 * Returns a cleanup function safe to hand straight back from an effect.
 */
export function whenIdle(task: () => void, timeout = 3000): () => void {
  if (typeof window === 'undefined') return () => {};

  let timer: ReturnType<typeof setTimeout> | undefined;
  let idleHandle: number | undefined;
  let cancelled = false;

  const run = () => {
    if (!cancelled) task();
  };

  const schedule = () => {
    if (cancelled) return;
    const ric = (window as any).requestIdleCallback;
    if (ric) idleHandle = ric(run, { timeout });
    else timer = setTimeout(run, 1500);
  };

  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    const cic = (window as any).cancelIdleCallback;
    if (idleHandle !== undefined && cic) cic(idleHandle);
    window.removeEventListener('load', schedule);
  };
}
