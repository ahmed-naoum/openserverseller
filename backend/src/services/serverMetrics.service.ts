import si from 'systeminformation';

/**
 * Server hardware metrics for the SOC "VPS Performance" module.
 *
 * Design constraints, all measured rather than assumed (systeminformation@5.33.1):
 *  - si.cpu() ~1330ms, si.osInfo() ~350ms, si.graphics() ~600ms EVERY call — none of them
 *    self-cache, and all return data that cannot change while the process lives. They are
 *    collected once at init and never polled again.
 *  - si.networkStats() ~1100ms and si.processes() ~360ms (it walks ALL processes — 369 on
 *    the dev box — so slicing to the top 10 afterwards saves nothing). fsSize/processes/
 *    graphics therefore run on a slow tier, not on the live tick.
 *  - The full call set takes ~2.2s even with Promise.all, so a 3s interval would overlap
 *    itself. The live tick is 5s, self-rescheduling, and guarded against re-entry.
 *  - Everything is wrapped in a timeout: a VPS with no lm-sensors or no GPU must yield
 *    null (rendered as "unavailable"), never a hung request.
 */

const LIVE_INTERVAL_MS = 5_000;
const SLOW_INTERVAL_MS = 30_000;
const CALL_TIMEOUT_MS = 2_000;
const INIT_TIMEOUT_MS = 8_000;

type Json = Record<string, any>;

/** Resolve to null instead of hanging or throwing when a sensor is missing. */
const soft = async <T>(p: Promise<T> | T, ms = CALL_TIMEOUT_MS): Promise<T | null> => {
  let handle: NodeJS.Timeout | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      handle = setTimeout(() => resolve(null), ms);
    });
    const result = await Promise.race([Promise.resolve(p), timeout]);
    return (result ?? null) as T | null;
  } catch {
    return null;
  } finally {
    if (handle) clearTimeout(handle);
  }
};

const round = (n: unknown, digits = 1) =>
  typeof n === 'number' && Number.isFinite(n) ? Number(n.toFixed(digits)) : null;

/** Negative means systeminformation has no previous sample to diff against yet. */
const rate = (n: unknown) =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;

/**
 * Pick the real GPU. Indexing controllers[0] is wrong: on the dev box it returns
 * "Parsec Virtual Display Adapter" ahead of the physical card.
 */
const VIRTUAL_GPU = /virtual|basic display|parsec|remote|rdp|meta driver|mirror/i;
const pickGpu = (controllers: Json[] | undefined) => {
  if (!controllers?.length) return null;
  const real = controllers.filter((c) => !VIRTUAL_GPU.test(String(c.model || '')));
  const pool = real.length ? real : controllers;
  const best = pool.reduce((a, b) => ((b.vram || 0) > (a.vram || 0) ? b : a), pool[0]);
  return {
    model: best.model || null,
    vendor: best.vendor || null,
    vramMB: best.vram ?? null,
    driverVersion: best.driverVersion || null,
    temperature: round(best.temperatureGpu),
    utilization: round(best.utilizationGpu),
  };
};

/**
 * Top processes, allow-listed. si.processes() returns command/params/path/user, and full
 * argv routinely contains DATABASE_URL and API keys — those fields must never leave the
 * server. Add fields here deliberately, never spread the raw object.
 */
const topProcesses = (procs: Json | null) => {
  if (!procs?.list) return null;
  return {
    all: procs.all ?? null,
    running: procs.running ?? null,
    sleeping: procs.sleeping ?? null,
    top: [...procs.list]
      .sort((a, b) => (b.cpu || 0) - (a.cpu || 0))
      .slice(0, 10)
      .map((p) => ({
        pid: p.pid,
        name: p.name,
        cpu: round(p.cpu),
        mem: round(p.mem),
      })),
  };
};

// ── Immutable data, collected once ────────────────────────────────────────────
let staticInfo: Json | null = null;
let staticPromise: Promise<Json> | null = null;

const loadStatic = async (): Promise<Json> => {
  const [cpu, osInfo, graphics] = await Promise.all([
    soft(si.cpu(), INIT_TIMEOUT_MS),
    soft(si.osInfo(), INIT_TIMEOUT_MS),
    soft(si.graphics(), INIT_TIMEOUT_MS),
  ]);
  const time = si.time();

  // Prime the delta-based collectors and discard: their first call reports since-boot
  // averages and rx_sec/tx_sec of -1, which would render as a bogus first sample.
  await Promise.all([soft(si.currentLoad(), INIT_TIMEOUT_MS), soft(si.networkStats(), INIT_TIMEOUT_MS)]);

  return {
    cpu: {
      manufacturer: cpu?.manufacturer || null,
      brand: cpu?.brand || null,
      speedGHz: cpu?.speed ?? null,
      cores: cpu?.cores ?? null,
      physicalCores: cpu?.physicalCores ?? null,
    },
    os: {
      hostname: osInfo?.hostname || null,
      distro: osInfo?.distro || null,
      release: osInfo?.release || null,
      kernel: osInfo?.kernel || null,
      arch: osInfo?.arch || null,
      platform: osInfo?.platform || null,
    },
    gpu: pickGpu(graphics?.controllers),
    bootTime: time?.uptime != null ? new Date(Date.now() - time.uptime * 1000).toISOString() : null,
  };
};

const ensureStatic = async () => {
  if (staticInfo) return staticInfo;
  if (!staticPromise) staticPromise = loadStatic().then((s) => (staticInfo = s));
  return staticPromise;
};

/**
 * Collect the immutable half at boot so the first admin request does not pay for it
 * (~6s cold, dominated by si.cpu() + si.graphics()). Fire-and-forget: this starts no
 * sampling loop, so a server nobody is watching still costs nothing after startup.
 */
export const warmupServerMetrics = () => {
  ensureStatic().catch((err) => console.error('[serverMetrics] warmup failed:', err));
};

// ── Slow tier: expensive and slow-changing ────────────────────────────────────
let slow: Json = { disks: null, processes: null };
let slowAt = 0;

const refreshSlow = async () => {
  const [fs, procs] = await Promise.all([soft(si.fsSize()), soft(si.processes(), 4_000)]);
  slow = {
    disks: Array.isArray(fs)
      ? fs.map((d) => ({
          fs: d.fs,
          mount: d.mount,
          type: d.type,
          size: d.size,
          used: d.used,
          available: d.available,
          usePct: round(d.use),
        }))
      : null,
    processes: topProcesses(procs as Json | null),
  };
  slowAt = Date.now();
};

// ── Live tick ─────────────────────────────────────────────────────────────────
const collect = async (): Promise<Json> => {
  const stat = await ensureStatic();
  if (Date.now() - slowAt >= SLOW_INTERVAL_MS) await refreshSlow();

  const [load, mem, temp, net] = await Promise.all([
    soft(si.currentLoad()),
    soft(si.mem()),
    soft(si.cpuTemperature()),
    soft(si.networkStats()),
  ]);

  const heap = process.memoryUsage();
  const toMB = (b: number) => Math.round((b / 1024 / 1024) * 10) / 10;

  return {
    sampledAt: new Date().toISOString(),
    cpu: {
      ...stat.cpu,
      loadPct: round(load?.currentLoad),
      userPct: round(load?.currentLoadUser),
      systemPct: round(load?.currentLoadSystem),
      perCore: Array.isArray(load?.cpus) ? load!.cpus.map((c: Json) => round(c.load)) : null,
    },
    memory: mem
      ? {
          total: mem.total,
          used: mem.active ?? mem.used,
          free: mem.available ?? mem.free,
          usedPct: round(((mem.active ?? mem.used) / mem.total) * 100),
          swapTotal: mem.swaptotal,
          swapUsed: mem.swapused,
          swapPct: mem.swaptotal ? round((mem.swapused / mem.swaptotal) * 100) : null,
        }
      : null,
    disks: slow.disks,
    gpu: stat.gpu,
    temperature:
      temp && temp.main != null
        ? { main: round(temp.main), max: round(temp.max), cores: (temp.cores || []).map((c: number) => round(c)) }
        : null,
    network: Array.isArray(net)
      ? net.map((n) => ({
          iface: n.iface,
          rxBytes: n.rx_bytes,
          txBytes: n.tx_bytes,
          rxSec: rate(n.rx_sec),
          txSec: rate(n.tx_sec),
        }))
      : null,
    os: { ...stat.os, uptime: Math.round(si.time().uptime || 0), bootTime: stat.bootTime },
    processes: slow.processes,
    node: {
      version: process.version,
      pid: process.pid,
      uptime: Math.round(process.uptime()),
      heapUsedMB: toMB(heap.heapUsed),
      heapTotalMB: toMB(heap.heapTotal),
      rssMB: toMB(heap.rss),
    },
    // Lets the UI hide dead sections instead of painting a wall of "N/A".
    capabilities: {
      cpuTemperature: !!(temp && temp.main != null),
      gpu: !!stat.gpu,
      disks: Array.isArray(slow.disks) && slow.disks.length > 0,
      processes: !!slow.processes,
      perCore: Array.isArray(load?.cpus) && load!.cpus.length > 0,
    },
  };
};

// ── Sampler lifecycle ─────────────────────────────────────────────────────────
let snapshot: Json | null = null;
let timer: NodeJS.Timeout | null = null;
let running = false;
let sampling = false;
let publish: ((snap: Json) => void) | null = null;

const schedule = () => {
  if (!running) return;
  timer = setTimeout(() => void tick(), LIVE_INTERVAL_MS);
};

const tick = async () => {
  timer = null;
  // Re-entry guard: a slow sample must be skipped, never queued behind itself.
  if (sampling) return schedule();
  sampling = true;
  try {
    snapshot = await collect();
    if (publish) publish(snapshot);
  } catch (err) {
    // An unhandled rejection inside a timer would take the process down.
    console.error('[serverMetrics] sample failed:', err);
  } finally {
    sampling = false;
    schedule();
  }
};

/** Start the live feed. Idempotent — safe to call on every new subscriber. */
export const startSampler = (onSample?: (snap: Json) => void) => {
  if (onSample) publish = onSample;
  if (running) return;
  running = true;
  void tick();
};

/** Stop sampling entirely. Called when the last watcher leaves. */
export const stopSampler = () => {
  running = false;
  if (timer) clearTimeout(timer);
  timer = null;
};

export const isSamplerRunning = () => running;

/** Most recent sample, collecting one on demand if the sampler has never run. */
export const getServerPerformance = async (): Promise<Json> => {
  if (!snapshot) snapshot = await collect();
  return snapshot;
};

/** Cached sample without triggering collection — for the socket's initial push. */
export const peekSnapshot = () => snapshot;
