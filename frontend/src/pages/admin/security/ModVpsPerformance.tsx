import { useState, useEffect, useCallback, useRef } from 'react';
import { securityApi } from '../../../lib/api';
import toast from 'react-hot-toast';
import { useSocket } from '../../../contexts/SocketContext';
import {
  Cpu, MemoryStick, HardDrive, Monitor, Thermometer, Network,
  Server, Activity, AlertTriangle,
} from 'lucide-react';

const S = 'bg-slate-900 rounded-2xl border border-slate-800 p-5';

/** A pushed feed can go silent without erroring — never present stale numbers as live. */
const STALE_AFTER_MS = 15_000;

const fmtBytes = (b?: number | null, digits = 1) => {
  if (b == null || !Number.isFinite(b)) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, v = b;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : digits)} ${u[i]}`;
};

const fmtRate = (b?: number | null) => (b == null ? '—' : `${fmtBytes(b)}/s`);

const fmtUptime = (s?: number | null) => {
  if (s == null) return '—';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}j ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const pct = (n?: number | null) => (n == null ? '—' : `${n.toFixed(1)}%`);

/** Shared scale: green until 60, amber until 80, red beyond — used for load and heat. */
const tone = (v?: number | null) => {
  if (v == null) return { bar: 'bg-slate-600', text: 'text-slate-400' };
  if (v < 60) return { bar: 'bg-emerald-500', text: 'text-emerald-400' };
  if (v < 80) return { bar: 'bg-amber-500', text: 'text-amber-400' };
  return { bar: 'bg-red-500', text: 'text-red-400' };
};

function Bar({ value, label, right }: { value?: number | null; label?: string; right?: string }) {
  const t = tone(value);
  return (
    <div>
      {(label || right) && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
          <span className={`text-[10px] font-black ${t.text}`}>{right}</span>
        </div>
      )}
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${t.bar} rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }}
        />
      </div>
    </div>
  );
}

function Gauge({ icon: Icon, label, value, sub }: { icon: any; label: string; value?: number | null; sub?: string }) {
  const t = tone(value);
  return (
    <div className={S}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${t.text}`} />
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      </div>
      <div className={`text-3xl font-black ${t.text} tabular-nums transition-colors duration-500`}>{pct(value)}</div>
      {sub && <p className="text-[10px] text-slate-500 font-bold mt-1 truncate">{sub}</p>}
      <div className="mt-3"><Bar value={value} /></div>
    </div>
  );
}

function Section({ icon: Icon, title, children, right }: { icon: any; title: string; children: any; right?: any }) {
  return (
    <div className={S}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-500" /> {title}
        </h3>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function ModVpsPerformance() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastTick, setLastTick] = useState<number>(0);
  const [stale, setStale] = useState(false);
  const { socket } = useSocket();
  const handlerRef = useRef<((d: any) => void) | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await securityApi.getServerPerformance();
      setData(res.data.data);
      setLastTick(Date.now());
    } catch {
      toast.error('Failed to load server performance');
    } finally {
      setLoading(false);
    }
  }, []);

  // HTTP baseline on mount: the socket tick only patches this. Without it the panel
  // would stay blank forever whenever the feed never arrives.
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const onSample = (snap: any) => { setData(snap); setLastTick(Date.now()); setLoading(false); };
    handlerRef.current = onSample;
    socket.on('server:performance', onSample);
    socket.emit('perf:subscribe');
    return () => {
      // Both halves matter: off() stops listener stacking across SOC refreshes,
      // unsubscribe lets the server stop sampling when the last admin leaves.
      socket.off('server:performance', onSample);
      socket.emit('perf:unsubscribe');
    };
  }, [socket]);

  useEffect(() => {
    const t = setInterval(() => setStale(lastTick > 0 && Date.now() - lastTick > STALE_AFTER_MS), 2000);
    return () => clearInterval(t);
  }, [lastTick]);

  if (loading) return <div className="text-slate-500 text-sm text-center py-20 animate-pulse">Loading server performance…</div>;
  if (!data) return <div className="text-red-400 text-sm text-center py-20">Failed to connect</div>;

  const cap = data.capabilities || {};
  const diskWorst = Array.isArray(data.disks) && data.disks.length
    ? data.disks.reduce((a: any, b: any) => ((b.usePct ?? 0) > (a.usePct ?? 0) ? b : a))
    : null;

  return (
    <div className="space-y-6">
      {stale && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
          <AlertTriangle className="w-4 h-4" />
          Feed silencieux depuis {Math.round((Date.now() - lastTick) / 1000)}s — valeurs possiblement obsolètes.
        </div>
      )}

      {/* Top gauges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Gauge icon={Cpu} label="CPU" value={data.cpu?.loadPct} sub={data.cpu?.brand || undefined} />
        <Gauge
          icon={MemoryStick}
          label="RAM"
          value={data.memory?.usedPct}
          sub={data.memory ? `${fmtBytes(data.memory.used)} / ${fmtBytes(data.memory.total)}` : undefined}
        />
        <Gauge
          icon={HardDrive}
          label="Disque"
          value={diskWorst?.usePct}
          sub={diskWorst ? `${diskWorst.mount} · ${fmtBytes(diskWorst.size)}` : undefined}
        />
        {cap.cpuTemperature ? (
          <Gauge icon={Thermometer} label="Température" value={data.temperature?.main} sub={`max ${data.temperature?.max ?? '—'}°C`} />
        ) : (
          <div className={S}>
            <div className="flex items-center gap-2 mb-3">
              <Thermometer className="w-4 h-4 text-slate-600" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Température</span>
            </div>
            <div className="text-lg font-black text-slate-600">Indisponible</div>
            <p className="text-[10px] text-slate-500 font-bold mt-1">Aucun capteur exposé par cet hôte</p>
          </div>
        )}
      </div>

      {/* CPU per-core */}
      <Section
        icon={Cpu}
        title="Processeur"
        right={
          <span className="text-[10px] font-bold text-slate-500">
            {data.cpu?.cores ?? '—'} threads · {data.cpu?.physicalCores ?? '—'} cœurs · {data.cpu?.speedGHz ?? '—'} GHz
          </span>
        }
      >
        <div className="mb-4"><Bar value={data.cpu?.loadPct} label="Charge globale" right={pct(data.cpu?.loadPct)} /></div>
        {cap.perCore ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {data.cpu.perCore.map((c: number | null, i: number) => (
              <div key={i}>
                <div className="flex justify-between mb-1">
                  <span className="text-[9px] font-bold text-slate-500">#{i}</span>
                  <span className={`text-[9px] font-black ${tone(c).text} tabular-nums`}>{c == null ? '—' : Math.round(c)}%</span>
                </div>
                <Bar value={c} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600 font-medium">Charge par cœur indisponible sur cet hôte.</p>
        )}
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Memory */}
        <Section icon={MemoryStick} title="Mémoire">
          <div className="space-y-4">
            <Bar
              value={data.memory?.usedPct}
              label="RAM"
              right={data.memory ? `${fmtBytes(data.memory.used)} / ${fmtBytes(data.memory.total)}` : '—'}
            />
            {data.memory?.swapTotal ? (
              <Bar
                value={data.memory.swapPct}
                label="Swap"
                right={`${fmtBytes(data.memory.swapUsed)} / ${fmtBytes(data.memory.swapTotal)}`}
              />
            ) : (
              <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Aucun swap configuré</p>
            )}
          </div>
        </Section>

        {/* Disks */}
        <Section icon={HardDrive} title="Stockage">
          {cap.disks ? (
            <div className="space-y-4">
              {data.disks.map((d: any, i: number) => (
                <div key={i}>
                  <Bar
                    value={d.usePct}
                    label={`${d.mount}${d.type ? ` · ${d.type}` : ''}`}
                    right={`${fmtBytes(d.used)} / ${fmtBytes(d.size)}`}
                  />
                  <p className="text-[9px] text-slate-600 font-medium mt-1">{d.fs} · {fmtBytes(d.available)} libre</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600 font-medium">Aucune partition rapportée.</p>
          )}
        </Section>

        {/* GPU */}
        {cap.gpu && (
          <Section icon={Monitor} title="Carte graphique">
            <p className="text-sm font-black text-slate-200">{data.gpu.model}</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {[
                ['Fabricant', data.gpu.vendor || '—'],
                ['VRAM', data.gpu.vramMB ? `${data.gpu.vramMB} MB` : '—'],
                ['Pilote', data.gpu.driverVersion || '—'],
                ['Température', data.gpu.temperature != null ? `${data.gpu.temperature}°C` : '—'],
              ].map(([k, v]) => (
                <div key={k as string} className="bg-slate-800/50 rounded-xl px-3 py-2">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{k}</p>
                  <p className="text-xs font-black text-slate-300 truncate">{v as string}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Network */}
        <Section icon={Network} title="Réseau">
          {Array.isArray(data.network) && data.network.length ? (
            <div className="space-y-3">
              {data.network.map((n: any, i: number) => (
                <div key={i} className="bg-slate-800/50 rounded-xl px-3 py-2.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-black text-slate-300 truncate">{n.iface}</span>
                  <div className="flex gap-4 text-right shrink-0">
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase">↓ Rx</p>
                      <p className="text-[11px] font-black text-emerald-400 tabular-nums">{fmtRate(n.rxSec)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase">↑ Tx</p>
                      <p className="text-[11px] font-black text-cyan-400 tabular-nums">{fmtRate(n.txSec)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600 font-medium">Aucune interface rapportée.</p>
          )}
        </Section>
      </div>

      {/* OS + Node */}
      <Section icon={Server} title="Système & Runtime">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {[
            ['Hôte', data.os?.hostname],
            ['OS', data.os?.distro],
            ['Noyau', data.os?.kernel],
            ['Arch', data.os?.arch],
            ['Uptime', fmtUptime(data.os?.uptime)],
            ['Node', data.node?.version],
            ['PID', data.node?.pid],
            ['Heap', data.node?.heapUsedMB != null ? `${data.node.heapUsedMB} MB` : null],
            ['RSS', data.node?.rssMB != null ? `${data.node.rssMB} MB` : null],
            ['Node uptime', fmtUptime(data.node?.uptime)],
          ].map(([k, v]) => (
            <div key={k as string} className="bg-slate-800/50 rounded-xl px-3 py-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{k}</p>
              <p className="text-xs font-black text-slate-300 truncate">{(v as string) ?? '—'}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Processes */}
      <Section
        icon={Activity}
        title="Top processus (CPU)"
        right={<span className="text-[10px] font-bold text-slate-500">{data.processes?.all ?? '—'} processus au total</span>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[9px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-800">
                <th className="pb-2 pr-3">PID</th>
                <th className="pb-2 pr-3">Nom</th>
                <th className="pb-2 pr-3 text-right">CPU</th>
                <th className="pb-2 text-right">Mém</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.processes?.top?.length ? (
                data.processes.top.map((p: any) => (
                  <tr key={p.pid} className="text-xs">
                    <td className="py-2 pr-3 font-mono text-slate-500">{p.pid}</td>
                    <td className="py-2 pr-3 font-bold text-slate-300 truncate max-w-[280px]">{p.name}</td>
                    <td className={`py-2 pr-3 text-right font-black tabular-nums ${tone(p.cpu).text}`}>{p.cpu == null ? '—' : `${p.cpu}%`}</td>
                    <td className="py-2 text-right font-bold text-slate-400 tabular-nums">{p.mem == null ? '—' : `${p.mem}%`}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className="py-6 text-center text-slate-600 text-xs font-medium">Liste des processus indisponible.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
