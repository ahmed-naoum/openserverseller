import { describe, it, expect, afterAll } from 'vitest';
import {
  getServerPerformance,
  startSampler,
  stopSampler,
  isSamplerRunning,
} from '../src/services/serverMetrics.service.js';

/**
 * The two things on this feature that can actually cause harm are (a) the payload
 * leaking process command lines, which routinely carry DATABASE_URL and API keys, and
 * (b) the sampler running forever on an unwatched server. Neither is exercised by
 * `tsc --noEmit` or by clicking the tab as an admin, so they are asserted here.
 */

const FORBIDDEN_KEYS = ['command', 'params', 'path', 'user'];

describe('server performance collector', () => {
  afterAll(() => stopSampler());

  it('never exposes process command lines, argv, paths or owners', async () => {
    const snap: any = await getServerPerformance();

    const top = snap.processes?.top ?? [];
    for (const p of top) {
      for (const key of FORBIDDEN_KEYS) {
        expect(p, `process entry must not carry "${key}"`).not.toHaveProperty(key);
      }
      expect(Object.keys(p).sort()).toEqual(['cpu', 'mem', 'name', 'pid']);
    }

    // Belt and braces: the key must not appear anywhere in the serialised payload,
    // so a future refactor that nests raw process objects elsewhere also fails here.
    const blob = JSON.stringify(snap);
    for (const key of FORBIDDEN_KEYS) {
      expect(blob.includes(`"${key}"`), `payload must not contain "${key}" anywhere`).toBe(false);
    }
  }, 30_000);

  it('caps the process list at 10 regardless of how many are running', async () => {
    const snap: any = await getServerPerformance();
    expect((snap.processes?.top ?? []).length).toBeLessThanOrEqual(10);
  }, 30_000);

  it('reports capability flags so the UI can hide unavailable sensors', async () => {
    const snap: any = await getServerPerformance();
    expect(snap.capabilities).toBeDefined();
    for (const k of ['cpuTemperature', 'gpu', 'disks', 'processes', 'perCore']) {
      expect(typeof snap.capabilities[k]).toBe('boolean');
    }
    // A missing sensor must be null, never a fabricated zero.
    if (!snap.capabilities.cpuTemperature) expect(snap.temperature).toBeNull();
    if (!snap.capabilities.gpu) expect(snap.gpu).toBeNull();
  }, 30_000);

  it('never reports a negative network rate (the un-primed -1 sentinel)', async () => {
    const snap: any = await getServerPerformance();
    for (const n of snap.network ?? []) {
      if (n.rxSec !== null) expect(n.rxSec).toBeGreaterThanOrEqual(0);
      if (n.txSec !== null) expect(n.txSec).toBeGreaterThanOrEqual(0);
    }
  }, 30_000);

  it('starts on demand, does not stack ticks, and stops when told', async () => {
    let ticks = 0;
    expect(isSamplerRunning()).toBe(false);

    startSampler(() => { ticks++; });
    startSampler(() => { ticks++; }); // idempotent: must not create a second loop
    expect(isSamplerRunning()).toBe(true);

    await new Promise((r) => setTimeout(r, 12_000));
    // 5s cadence -> 2-3 ticks. More would mean overlapping timers.
    expect(ticks).toBeGreaterThanOrEqual(1);
    expect(ticks).toBeLessThanOrEqual(3);

    stopSampler();
    expect(isSamplerRunning()).toBe(false);

    const after = ticks;
    await new Promise((r) => setTimeout(r, 7_000));
    expect(ticks, 'sampler must be fully stopped, not merely paused').toBe(after);
  }, 40_000);
});
