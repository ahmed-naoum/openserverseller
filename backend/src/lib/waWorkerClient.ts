/**
 * Talking to the `silacod-wa` worker process.
 *
 * Deliberately thin, and deliberately fire-and-forget. The database already
 * holds the desired state — `WhatsappSession.desiredState` and the two outbox
 * tables — and the worker reconciles against it on a timer. This call only
 * skips the polling delay, so a worker that is restarting, or a request that is
 * dropped, costs a few seconds of latency and nothing else.
 *
 * It must never turn a settings save into a 500, which is why every failure is
 * swallowed with a warning.
 */

import { getSecret } from './secretStore.js';

export type WorkerAction = 'connect' | 'disconnect' | 'logout' | 'drain' | 'turns' | 'reconnect';

export async function nudgeWorker(action: WorkerAction, userId: number): Promise<void> {
  const base = getSecret('WA_WORKER_URL');
  const token = getSecret('WA_WORKER_TOKEN');

  // Not configured means single-process development, or the agent is not
  // deployed. Either way the reconcile tick is the fallback.
  if (!base || !token) return;

  try {
    await fetch(`${base.replace(/\/$/, '')}/control/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId }),
      // Short: this is on the request path of a UI action, and the worker is on
      // loopback. If it has not answered in four seconds it is not going to.
      signal: AbortSignal.timeout(4000),
    });
  } catch (err) {
    console.warn(`[wa] worker nudge "${action}" failed for user ${userId}:`, (err as Error).message);
  }
}
