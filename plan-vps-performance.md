# Plan: VPS Performance Monitor — Real-Time Server Metrics Dashboard

> Status: **corrected draft, not implemented.** Nothing in this plan has been built yet
> and `systeminformation` has **not** been installed into `backend/`.
> Corrections below are based on an audit against the real codebase plus measurements
> taken on the Windows dev machine (`systeminformation@5.33.1`, Node 22.12).

Add a **"VPS Performance"** module to the `/admin/security` SOC dashboard showing live
hardware metrics: per-core CPU, RAM, disk, GPU, temperatures, network I/O and OS details,
refreshing over WebSocket.

---

## Decisions still needed from you

1. **Approve installing `systeminformation`?** (pinned `^5.33.1`, into `dependencies`, not dev)
2. **Duplication:** a new tab, or fold into the existing `ModInfrastructure`? (see §7)
3. **Scope:** fix the pre-existing unguarded `join-room` here, or as a separate change? (see §2)

---

## 1. Backend route — auth is mandatory

**[MODIFY]** `backend/src/routes/security.routes.ts`

All 37 existing handlers in this file are guarded. The router is mounted bare at
`routes/index.ts:77` (it does not even receive `auditLog`), and nothing in the global
middleware chain authenticates. Without the chain below, an anonymous `curl` returns
hostname, kernel, disk layout and a process table.

```ts
router.get(
  '/server-performance',
  authenticate,
  authorize('SUPER_ADMIN'),          // both already imported at security.routes.ts:3
  asyncHandler(async (req, res) => {
    res.json({ status: 'success', data: getLatestSnapshot() });
  }),
);
```

Response envelope must be `{ status: 'success', data }` — every SOC module reads
`res.data.data`.

### Collector — extract to a service

**[NEW]** `backend/src/services/serverMetrics.service.ts` exporting
`collectServerPerformance()`, `getLatestSnapshot()`, `startSampler()`, `stopSampler()`.
Both the REST route and the socket emitter read **one shared snapshot** so they never
double-sample.

| Metric | Source | Cadence |
|---|---|---|
| CPU model, cores, speed | `si.cpu()` | **once at init, cached forever** |
| OS / kernel / arch / hostname | `si.osInfo()` | **once at init** |
| Boot time | `si.time()` | **once at init** |
| GPU model / VRAM / driver | `si.graphics()` | **once at init** |
| Overall + per-core load | `si.currentLoad()` | live tick |
| RAM + swap | `si.mem()` | live tick |
| CPU temperature | `si.cpuTemperature()` | live tick |
| Network rx/tx per sec | `si.networkStats()` | live tick |
| Disk per-partition | `si.fsSize()` | slow timer (30 s) |
| Top processes | `si.processes()` | slow timer (30 s) |
| Node heap / RSS / uptime | `process.*` | live tick (free) |

Required behaviours:

- **`Promise.allSettled` + a per-call timeout** (~2 s). One dead sensor must yield `null`,
  not a 500. The plan promises graceful "N/A" — this is what delivers it.
- **Prime the delta calls at init**: call `si.currentLoad()` and `si.networkStats()` once
  and discard. The first sample is since-boot, not a delta; `rx_sec`/`tx_sec` can be `-1`.
- **Redact processes** (see §4).
- **Capability probe at init**: record which collectors returned data so the UI can hide
  dead sections rather than render a wall of "N/A".

## 2. WebSocket delivery — the current options are all exploitable

**[MODIFY]** `backend/src/index.ts`

"Emitted to subscribed admin sockets" names a mechanism that does not exist. Both obvious
implementations leak:

```ts
// index.ts:425-427 — no role check, no room whitelist
socket.on('join-room', (room: string) => { socket.join(room); });
```

Anonymous sockets are admitted by design (`if (!token) return next();`, index.ts:355) and
`SocketProvider` opens one for every public storefront visitor. So **`io.to('role:SUPER_ADMIN')`
is not safe either** — a visitor can `socket.emit('join-room','role:SUPER_ADMIN')` first.

> ⚠️ This is a **pre-existing hole**. `security:update` and `realtime:active-users` are
> already reachable this way today, independently of this feature.

Three changes:

1. **Restrict `join-room` to an allow-list** — `['support-queue', 'callcenter']` are the
   only rooms the frontend actually joins (`lib/socket.ts:18`, `DashboardLayout.tsx:671`,
   `admin/Support.tsx:41`, `common/Chat.tsx:471`, `common/SupportTickets.tsx:73`).
2. **Add guarded subscribe handlers**, using the existing `isSuperAdmin()` helper
   (index.ts:440, same pattern as `stream:watch` at :615):

```ts
socket.on('perf:subscribe', () => {
  if (!isSuperAdmin()) return;
  socket.join('perf:watchers');
  socket.emit('server:performance', getLatestSnapshot()); // no 3s blank screen
  startSampler();
});
socket.on('perf:unsubscribe', () => socket.leave('perf:watchers'));
```

3. **Emit** via the circular-import workaround already used at `security.routes.ts:28`:
   `const { io } = await import('../index.js'); io.to('perf:watchers').emit('server:performance', snap)`.

Socket.IO 4.x removes disconnected sockets from rooms automatically — no edit to the
disconnect handler needed.

## 3. Sampler lifecycle — 3 s is shorter than one sample takes

Measured on this machine, `systeminformation@5.33.1`, Node 22.12:

| Strategy | Wall time | Peak event-loop stall |
|---|---|---|
| All 10 calls, sequential (cold) | **7241 ms** | 361 ms |
| All 10 calls, sequential (warm) | **4435 ms** | 351 ms |
| All 10 calls, `Promise.all` | **2233 ms** | 459 ms |
| Lean tick (load + mem + temp + net) | 615–1130 ms | 327 ms |

Per-call warm: `si.cpu()` **1329 ms**, `si.networkStats()` **1106 ms**,
`si.graphics()` 596 ms, `si.processes()` 357 ms, `si.osInfo()` 353 ms.

`si.cpu()` and `si.osInfo()` return **immutable** data and cost 1.3 s / 0.35 s on *every*
call — hence the "cache at init" column in §1. Production is Linux and cheaper, but the
design flaw is cadence-independent.

Required:

- **Self-rescheduling `setTimeout`, not `setInterval`**, re-armed in a `finally`, plus an
  `inFlight` guard. The codebase already does this for presence broadcasts
  (`broadcastPending`, index.ts:338-343). A bare `setInterval(3000)` stacks overlapping
  child processes indefinitely.
- **Interval starts on first subscriber, clears when `perf:watchers` is empty.** Otherwise a
  closed tab leaves the VPS shelling out to `ps`/`df`/`sensors` forever — 28 800 cycles/day
  with zero viewers, under a pm2 `max_memory_restart: '500M'` cap.
- **Cadence 5 s**, not 3 s.
- **`try/catch` around the whole tick.** An unhandled rejection in a timer kills the process.

## 4. Redact the process table

`si.processes()` returned **369 processes** here — the "top 10" slice happens *after* the
full walk, so it is not a safeguard. Each object carries:

```
pid, parentPid, name, cpu, cpuu, cpus, mem, priority, memVsz, memRss,
nice, started, state, tty, user, command, path, params
```

`command` / `params` contain full argv — `DATABASE_URL`, API keys, anything passed on a
command line. Nothing on this route sanitises responses.

**Allow-list projection, server-side, before `res.json`:** `{ pid, name, cpu, mem }`.
Explicitly drop `command`, `params`, `path`, `user`.

## 5. Frontend module

**[NEW]** `frontend/src/pages/admin/security/ModVpsPerformance.tsx`

- **Zero props.** `SecurityFirewall.tsx:42` builds `props = { key: refreshKey }`; React
  consumes `key` and forwards nothing. Declare `export default function ModVpsPerformance()`.
  Keep `{...props}` at the call site anyway — `key` is what makes the Refresh button remount.
- **HTTP fetch on mount** (`securityApi.getServerPerformance()`, unwrap `res.data.data`),
  with the socket tick patching that baseline. Socket-only means a blank panel forever if
  the socket is down or the subscribe never lands.
- **Use `useSocket()` from `SocketContext`** — `frontend/src/lib/socket.ts` builds its socket
  with **no `auth` field** and never authenticates, so it would be silently refused by the
  role guard. Follow `ModInfrastructure.tsx:14`.
- **Cleanup must do both** `socket.off('server:performance', handler)` **and**
  `socket.emit('perf:unsubscribe')`, or listeners stack on every Refresh.
- **States:** `loading` skeleton and `!data` error branch (copy `ModOverview.tsx:53-54`),
  `toast.error` on catch, shared card const `S = 'bg-slate-900 rounded-2xl border border-slate-800 p-5'`.
- **Stale-feed badge.** Data is pushed, so a dead socket leaves the last tick on screen
  while the header "LIVE" badge keeps pulsing. Track `lastTick` and show
  "stale — no update for Ns".

Sections: top gauge row (CPU/RAM/Disk/GPU) · per-core bars · RAM + swap · per-partition
disk cards · GPU · CPU temp gauge · network interfaces · OS/Node info · top-10 processes.

### GPU and temperature will be empty more often than the plan assumes

Measured here:

- `si.cpuTemperature()` → `main: null, cores: []` — the colour-coded gauge
  (green<60 / yellow<80 / red≥80) has **no data source on this machine**.
- `si.graphics()` → 3 controllers, and `controllers[0]` is
  **"Parsec Virtual Display Adapter"** with `temperatureGpu: undefined` — *not* the GTX/RTX.
  **Select by VRAM or vendor; never index `[0]`.**

On a headless Linux VPS both sections are typically empty (no lm-sensors, no GPU). The
process runs unprivileged under pm2 — no `CAP_SYS_ADMIN`, no sudo — so anything needing
elevation is out of scope, not a bug to chase. **Hide sections with no data source** rather
than rendering "N/A" everywhere.

Containerised VPS (OpenVZ/LXC/Docker): `si.mem()` and `si.fsSize()` report **host** values,
not the container's cgroup limit. Worth a caveat in the UI.

## 6. Wiring

**[MODIFY]** `frontend/src/pages/admin/SecurityFirewall.tsx`

- Add `Cpu` to the lucide-react import — **it is not currently imported** (`:2-5`, `:17`).
- Add `import ModVpsPerformance from './security/ModVpsPerformance';`
- Nav entry: `{ id: 'vps', label: 'VPS Performance', icon: Cpu, color: 'text-lime-400' }`
- `case 'vps': return <ModVpsPerformance {...props} />;`
- **Fix `:111`** — it hardcodes `Module {n} / 10` while `MODULES` already has 11 entries.
  Change to `/ {MODULES.length}` or the new tab reads "Module 12 / 10".

**[MODIFY]** `frontend/src/lib/api.ts` — add to `securityApi`:

```ts
getServerPerformance: () => api.get('/admin/security/server-performance'),
```

## 7. Reconcile with what already exists

`security.routes.ts:131` already returns
`system: { uptime, heapUsedMB, freeMemPct, nodeVersion, platform }`, and
`ModInfrastructure.tsx:39-56` already renders exactly those five tiles.

Two SOC tabs would show the same uptime/heap/free-memory from different sources at
different refresh rates, and visibly disagree. **Pick one owner** — either fold the VPS
panels into `ModInfrastructure`, or keep the new tab and have `/overview`'s `system` block
delegate to the same collector.

## 8. Dependency

**[MODIFY]** `backend/package.json`

```bash
npm install systeminformation@^5.33.1
```

Into `dependencies`, **not** devDependencies — `deploy.sh` runs `npm install && npm run
build && pm2 restart`, so a dev-only placement crashes in production only.
Run `npm audit` after. The package shells out; CVE-2021-21315 was a command injection, so
**never pass request-derived strings** to `si.fsSize()` or any other collector.

## 9. Deployment assumption

`backend/ecosystem.config.cjs:7` sets `instances: 1` and no Socket.IO Redis adapter is
configured. This design is correct **only** under a single process. Raising `instances`
would break room targeting and make `process.memoryUsage()`/`uptime` flip between workers.
Note the dependency; label the Node card with `process.pid` so multi-worker behaviour is
at least visible.

## 10. Verification

**Automated**

- `npx tsc --noEmit` in `backend/` and `frontend/`
- **[NEW]** `backend/tests/serverPerformance.test.ts` (vitest + supertest are already set
  up; `backend/tests/auth.test.ts` is the precedent):
  - 401 with no token
  - 403 as `VENDOR`, 403 as `HELPER`
  - 200 as `SUPER_ADMIN`
  - **no object in the process list carries `command`, `params`, `path` or `user`**
- `npm test`

**Manual**

- `curl` **without** a token → expect **401** (the original plan's "curl the endpoint" only
  passes if the route is unauthenticated — that is how the omission survives review)
- `curl` with a SUPER_ADMIN bearer token → 200
- In devtools as an **anonymous** visitor: `socket.emit('join-room','perf:watchers')` then
  listen for `server:performance` → expect **nothing**
- `/admin/security` → VPS Performance tab: metrics render, update live, sections with no
  sensor are hidden
- Close the tab, confirm server-side sampling stops (log a line on sampler stop)

---

## Note unrelated to this feature

`plan.md` (repo root, **tracked in git**) contains a live Cloudinary **API Secret** in
plaintext. It is in git history, so deleting the file is not sufficient — the credential
should be **rotated** in the Cloudinary dashboard.
