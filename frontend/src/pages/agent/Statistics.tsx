import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity, RefreshCw, CalendarClock, Filter, X, History, Zap, Headphones,
  Truck, PackageCheck, Inbox, ShoppingCart, Radio, PauseCircle, Clock,
  TrendingUp, BarChart3, ListChecks, AlertTriangle, ArrowRight, Coins,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, BarChart,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
} from 'recharts';
import { leadsApi } from '../../lib/api';
import { useSocket } from '../../contexts/SocketContext';
import {
  PERIOD_PRESETS, DATE_MODES, COUNT_MODES, startOfDaysAgo, fmtDateTimeInput,
  pct, fmtPct, fmtNum, type DateMode, type CountMode,
} from '../../lib/agentPeriod';
import {
  CONFIRMATION_OUTCOMES, IN_PROGRESS_ROW, PUSHED_ROW, AGENT_ACTIONS, actionMeta,
  DELIVERY_GROUPS, DELIVERY_STATUSES, type DeliveryGroup,
} from '../../lib/agentStatusMeta';

type ThemeKey = 'classic' | 'girly' | 'princess';

/**
 * Reads the accent the agent already picked on the dashboard — same storage key,
 * same event — so the two screens don't look like they belong to different apps.
 * Every class string is written out in full: Tailwind can't see through
 * `bg-${accent}-500`, so interpolated utilities would be purged from the build.
 */
const THEME: Record<ThemeKey, {
  heroBg: string; heroBorder: string; chip: string; select: string;
  card: string; icon: string; accentText: string; soft: string;
  link: string; spinner: string; track: string; field: string;
}> = {
  classic: {
    heroBg: 'bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20',
    heroBorder: 'border-indigo-100/60',
    chip: 'bg-indigo-100/60 border-indigo-200/40 text-indigo-700',
    select: 'bg-indigo-600 text-white border-indigo-700 shadow-indigo-500/20',
    card: 'border-indigo-100/40',
    icon: 'text-indigo-500',
    accentText: 'text-indigo-700',
    soft: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    link: 'text-indigo-600 hover:text-indigo-700',
    spinner: 'border-indigo-100 border-t-indigo-500',
    track: 'bg-indigo-50',
    field: 'border-indigo-100 focus:ring-2 focus:ring-indigo-200',
  },
  girly: {
    heroBg: 'bg-gradient-to-br from-rose-50 via-pink-50/60 to-fuchsia-50/30',
    heroBorder: 'border-pink-100/60',
    chip: 'bg-pink-100/60 border-pink-200/40 text-pink-700',
    select: 'bg-gradient-to-r from-pink-500 to-rose-500 text-white border-pink-600 shadow-pink-500/20',
    card: 'border-pink-100/50',
    icon: 'text-pink-500',
    accentText: 'text-pink-700',
    soft: 'bg-pink-50 text-pink-600 border-pink-100',
    link: 'text-pink-600 hover:text-pink-700',
    spinner: 'border-rose-100 border-t-pink-500',
    track: 'bg-pink-50',
    field: 'border-pink-100 focus:ring-2 focus:ring-pink-200',
  },
  princess: {
    heroBg: 'bg-gradient-to-br from-amber-50 via-pink-50/60 to-purple-50/30',
    heroBorder: 'border-amber-200/60',
    chip: 'bg-amber-100/60 border-amber-200/40 text-amber-800',
    select: 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-500 text-white border-amber-600 shadow-amber-500/20',
    card: 'border-amber-100/50',
    icon: 'text-amber-500',
    accentText: 'text-amber-800',
    soft: 'bg-amber-50 text-amber-700 border-amber-100',
    link: 'text-amber-700 hover:text-amber-800',
    spinner: 'border-amber-100 border-t-amber-500',
    track: 'bg-amber-50',
    field: 'border-amber-100 focus:ring-2 focus:ring-amber-200',
  },
};

/**
 * How often the page re-asks the server. "Pause" is a real choice, not a
 * courtesy: an agent reading a figure out loud to a supervisor does not want the
 * column under their finger to move, and four queries every ten seconds is real
 * load on a shared database.
 */
const LIVE_INTERVALS = [
  { key: '10s', label: '10 s', ms: 10_000 },
  { key: '30s', label: '30 s', ms: 30_000 },
  { key: '60s', label: '1 min', ms: 60_000 },
  { key: 'off', label: 'Pause', ms: 0 },
] as const;

type LiveKey = (typeof LIVE_INTERVALS)[number]['key'];

const LIVE_STORAGE_KEY = 'agent-stats-live';

/** French relative time, to the unit that is actually useful at that distance. */
const timeAgo = (iso: string | number | Date, now: number) => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 5) return "à l'instant";
  if (s < 60) return `il y a ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `il y a ${d} j`;
  return new Date(t).toLocaleDateString('fr-FR');
};

const fmtClock = (iso: string | Date) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** `2026-08-18` → `18/08`. Chart axes only, so no year. */
const fmtDayShort = (key: string) => {
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
};

export default function AgentStatistics() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const [theme, setTheme] = useState<ThemeKey>(
    () => (localStorage.getItem('agent-theme') as ThemeKey) || 'girly'
  );
  useEffect(() => {
    const sync = () => setTheme((localStorage.getItem('agent-theme') as ThemeKey) || 'girly');
    window.addEventListener('agent-theme-change', sync);
    return () => window.removeEventListener('agent-theme-change', sync);
  }, []);
  const t = THEME[theme];

  // --- Period ---------------------------------------------------------------
  // Defaults to the last 7 days rather than today: this page is about shape over
  // time, and a single day draws one column.
  const [dateFrom, setDateFrom] = useState(() => startOfDaysAgo(6));
  const [dateTo, setDateTo] = useState('');
  const [dateMode, setDateMode] = useState<DateMode>('updatedAt');
  const [countMode, setCountMode] = useState<CountMode>('leads');

  const hasRange = Boolean(dateFrom || dateTo);
  const range = useMemo(
    () => ({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      dateField: dateMode,
      dateType: dateMode,
    }),
    [dateFrom, dateTo, dateMode]
  );

  const activePreset = useMemo(() => {
    if (!hasRange) return 'all';
    return PERIOD_PRESETS.find(p => {
      const { from, to } = p.range();
      return from === dateFrom && to === dateTo;
    })?.key ?? null;
  }, [dateFrom, dateTo, hasRange]);

  const rangeLabel = useMemo(() => {
    if (!hasRange) return null;
    if (dateFrom && dateTo) return `du ${fmtDateTimeInput(dateFrom)} au ${fmtDateTimeInput(dateTo)}`;
    if (dateFrom) return `depuis le ${fmtDateTimeInput(dateFrom)}`;
    return `jusqu'au ${fmtDateTimeInput(dateTo)}`;
  }, [dateFrom, dateTo, hasRange]);

  // --- Live -----------------------------------------------------------------
  const [live, setLive] = useState<LiveKey>(
    () => (localStorage.getItem(LIVE_STORAGE_KEY) as LiveKey) || '30s'
  );
  const changeLive = (next: LiveKey) => {
    setLive(next);
    localStorage.setItem(LIVE_STORAGE_KEY, next);
  };
  const intervalMs = LIVE_INTERVALS.find(i => i.key === live)?.ms ?? 30_000;
  const isLive = intervalMs > 0;

  // A one-second heartbeat, purely so the "il y a X" labels age on screen. It
  // touches no query — the polling is `refetchInterval` below.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // --- Data -----------------------------------------------------------------
  // `keepPreviousData` holds the outgoing window on screen while the new one
  // loads; without it every poll and every change of period would drop the page
  // back to the full-page spinner, which reads as a reload rather than a refresh.
  const common = {
    placeholderData: keepPreviousData,
    refetchInterval: isLive ? intervalMs : (false as const),
    refetchOnWindowFocus: true,
  };

  const statsQuery = useQuery({
    queryKey: ['agent-statistics', dateFrom, dateTo, dateMode],
    queryFn: () => leadsApi.agentStatistics({ ...range, recentLimit: 40 }),
    ...common,
  });

  const deliveryQuery = useQuery({
    queryKey: ['agent-stats-delivery', dateFrom, dateTo, dateMode],
    queryFn: () => leadsApi.livraison({ limit: 1, ...range }),
    ...common,
  });

  const availableQuery = useQuery({
    queryKey: ['agent-stats-available', dateFrom, dateTo, dateMode],
    queryFn: () => leadsApi.available({ limit: 1, ...range }),
    ...common,
  });

  const cartsQuery = useQuery({
    queryKey: ['agent-stats-carts', dateFrom, dateTo, dateMode],
    queryFn: () => leadsApi.abandonedCarts({ limit: 1, ...range }),
    ...common,
  });

  const queries = [statsQuery, deliveryQuery, availableQuery, cartsQuery];
  const isLoading = statsQuery.isLoading;
  const isFetching = queries.some(q => q.isFetching);

  const refreshAll = () => queries.forEach(q => q.refetch());

  /**
   * Server-pushed invalidation on top of the poll.
   *
   * These three events are the only ones an agent's socket receives that can
   * change a figure on this page without the agent doing anything: a lead
   * entering the pool, the cron taking one back, or a colleague force-claiming
   * one. Refetching on them closes the gap between poll ticks — the poll stays as
   * the backstop, because the agent's own status writes happen on other pages and
   * are never broadcast back to them.
   */
  useEffect(() => {
    if (!socket) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['agent-statistics'] });
      queryClient.invalidateQueries({ queryKey: ['agent-stats-available'] });
      queryClient.invalidateQueries({ queryKey: ['agent-stats-delivery'] });
      queryClient.invalidateQueries({ queryKey: ['agent-stats-carts'] });
    };
    const events = ['new-available-lead', 'lead-unassigned', 'lead-force-claimed'];
    events.forEach(e => socket.on(e, invalidate));
    return () => { events.forEach(e => socket.off(e, invalidate)); };
  }, [socket, queryClient]);

  const data = statsQuery.data?.data?.data;
  const summary = data?.summary;
  const byAction: Record<string, number> = data?.byAction || {};
  const byLead: Record<string, number> = data?.byLead || {};
  const byLastAction: Record<string, number> = data?.byLastAction || {};
  const daily: any[] = data?.daily || [];
  const hourly: { hour: number; total: number }[] = data?.hourly || [];
  const recent: any[] = data?.recent || [];
  const statuses: string[] = data?.statuses || [];
  const truncated: boolean = data?.truncated ?? false;

  const deliveryStats = deliveryQuery.data?.data?.data?.stats;
  const byDeliveryStatus: Record<string, number> = deliveryStats?.byStatus || {};
  const parcelsTotal: number = deliveryStats?.total ?? 0;
  const deliveredTotal: number = byDeliveryStatus.DELIVERED || 0;
  const agentEarnings: number = deliveryStats?.agentEarningsDelivered ?? 0;
  const agentRate: number | null = deliveryStats?.agentRatePerParcel ?? null;
  const revenueDelivered: number = deliveryStats?.revenueDelivered ?? 0;

  const availableCount: number = availableQuery.data?.data?.data?.totalAvailable ?? 0;
  const cartCounts = cartsQuery.data?.data?.counts;
  const cartsConverted: number = cartCounts?.converted ?? 0;
  const cartsTotal: number = cartCounts?.all ?? 0;

  // --- Confirmation arithmetic ----------------------------------------------
  // Deliberately the same rules as the dashboard: per lead, a confirmation that
  // shipped is folded back into CONFIRMED so the lead sits in exactly one slice;
  // per action, a confirm and a push are two separate things and stay separate.
  const counts = countMode === 'actions' ? byAction : byLastAction;

  const outcomes = useMemo(
    () =>
      CONFIRMATION_OUTCOMES.map(o => {
        if (o.key !== 'CONFIRMED') return { ...o, value: counts[o.key] || 0 };
        const queued = counts.CONFIRMED || 0;
        const pushed = countMode === 'actions' ? 0 : counts.PUSHED_TO_DELIVERY || 0;
        return { ...o, value: queued + pushed };
      }),
    [counts, countMode]
  );

  const assignedValue = counts.ASSIGNED || 0;
  const treatedTotal = outcomes.reduce((sum, o) => sum + o.value, 0);
  const pipelineTotal = treatedTotal + assignedValue;
  const confirmedTotal = outcomes.find(o => o.key === 'CONFIRMED')?.value ?? 0;
  const confirmationRate = pct(confirmedTotal, treatedTotal);
  const deliveryRate = pct(deliveredTotal, parcelsTotal);
  const actionGrandTotal = useMemo(
    () => Object.values(byAction).reduce((a, b) => a + b, 0),
    [byAction]
  );

  // --- Delivery rows --------------------------------------------------------
  const deliveryRows = useMemo(
    () =>
      Object.entries(byDeliveryStatus)
        .filter(([, count]) => count > 0)
        .map(([key, count]) => {
          const meta = DELIVERY_STATUSES[key];
          return {
            key,
            count,
            label: meta?.label ?? key.replace(/_/g, ' ').toLowerCase(),
            emoji: meta?.emoji ?? '📦',
            group: (meta?.group ?? 'pipeline') as DeliveryGroup,
            color: meta?.color ?? '#94a3b8',
          };
        })
        .sort((a, b) => {
          const g = DELIVERY_GROUPS[a.group].order - DELIVERY_GROUPS[b.group].order;
          return g !== 0 ? g : b.count - a.count;
        }),
    [byDeliveryStatus]
  );

  const groupTotals = useMemo(() => {
    const totals: Record<DeliveryGroup, number> = { pipeline: 0, transit: 0, issue: 0, done: 0, return: 0 };
    for (const row of deliveryRows) totals[row.group] += row.count;
    return totals;
  }, [deliveryRows]);

  // --- Charts ---------------------------------------------------------------
  const dailyChart = useMemo(
    () => daily.map(d => ({ ...d, label: fmtDayShort(d.date) })),
    [daily]
  );
  const hourlyPeak = useMemo(
    () => hourly.reduce((max, h) => Math.max(max, h.total), 0),
    [hourly]
  );

  /**
   * Every status that actually occurred, in the server's order — an empty series
   * is a dead legend entry, and a status the tiles don't score (ORDERED and other
   * legacy or intermediate ones) is still work that has to appear somewhere.
   * `actionMeta` gives the unscored ones a neutral grey rather than dropping them.
   */
  const activeActions = useMemo(
    () => (statuses.length ? statuses : AGENT_ACTIONS.map(a => a.key))
      .filter(key => (byAction[key] || 0) > 0)
      .map(actionMeta),
    [statuses, byAction]
  );

  /** Statuses outside the eight scored ones, listed under the table so nothing hides. */
  const extraRows = useMemo(
    () => activeActions.filter(a => !AGENT_ACTIONS.some(known => known.key === a.key)),
    [activeActions]
  );

  const lastUpdated = statsQuery.dataUpdatedAt;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative w-12 h-12">
          <div className={`absolute inset-0 border-4 rounded-full animate-spin ${t.spinner}`} />
          <Activity className={`w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse ${t.icon}`} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto px-1 sm:px-4 pb-6">
      {/* ------------------------------------------------------------- Hero */}
      <div className={`rounded-3xl p-5 sm:p-6 border shadow-sm relative overflow-hidden ${t.heroBg} ${t.heroBorder}`}>
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider mb-2.5 ${t.chip}`}>
              <BarChart3 className={`w-3.5 h-3.5 ${t.icon}`} />
              Statistiques détaillées
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mb-1.5">
              Mes Statistiques 📈
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm font-medium max-w-2xl">
              Tout ce que vous avez fait, compté sur{' '}
              <span className={`font-black ${t.accentText}`}>
                {dateMode === 'createdAt' ? "la date d'arrivée du lead" : 'la date de votre action'}
              </span>
              {rangeLabel ? <> — <span className={`font-black ${t.accentText}`}>{rangeLabel}</span></> : ' — sur la totalité'}.
            </p>
          </div>

          {/* Live control. The dot is the honest signal: green pulsing while
              polling, amber while a request is in flight, grey when paused. */}
          <div className="flex flex-col items-start xl:items-end gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {isLive && !isFetching && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  !isLive ? 'bg-gray-300' : isFetching ? 'bg-amber-400' : 'bg-emerald-500'
                }`} />
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-600">
                {!isLive ? 'En pause' : isFetching ? 'Mise à jour…' : 'En direct'}
              </span>
              {lastUpdated > 0 && (
                <span className="text-[10px] font-semibold text-gray-400">· {timeAgo(lastUpdated, now)}</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {LIVE_INTERVALS.map(i => (
                <button
                  key={i.key}
                  type="button"
                  onClick={() => changeLive(i.key)}
                  aria-pressed={live === i.key}
                  title={i.ms ? `Actualiser toutes les ${i.label}` : 'Figer les chiffres'}
                  className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1 ${
                    live === i.key ? t.select : 'bg-white text-gray-500 border-gray-200 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  {i.key === 'off' ? <PauseCircle className="w-3 h-3" /> : <Radio className="w-3 h-3" />}
                  {i.label}
                </button>
              ))}
              <button
                onClick={refreshAll}
                disabled={isFetching}
                title="Actualiser maintenant"
                className="p-2 bg-white text-gray-500 rounded-xl border border-gray-200 shadow-sm hover:text-gray-900 hover:border-gray-300 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? `animate-spin ${t.icon}` : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Période — scopes every figure on this page */}
        <div className={`relative z-10 mt-4 rounded-2xl border bg-white/70 backdrop-blur-sm shadow-sm p-3 ${t.card}`}>
          <div className="flex flex-col xl:flex-row xl:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <CalendarClock className={`w-4 h-4 ${t.icon}`} />
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-600">Période</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {PERIOD_PRESETS.map(preset => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => {
                    const { from, to } = preset.range();
                    setDateFrom(from);
                    setDateTo(to);
                  }}
                  aria-pressed={activePreset === preset.key}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                    activePreset === preset.key ? t.select : 'bg-white text-gray-500 border-gray-200 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
              <input
                type="datetime-local"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={e => setDateFrom(e.target.value)}
                aria-label="Statistiques à partir de"
                className={`w-full sm:w-[175px] py-2 px-2.5 border rounded-xl bg-white text-xs font-bold text-gray-700 outline-none shadow-sm ${t.field}`}
              />
              <span className="text-[10px] font-black text-gray-300 uppercase">à</span>
              <input
                type="datetime-local"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={e => setDateTo(e.target.value)}
                aria-label="Statistiques jusqu'à"
                className={`w-full sm:w-[175px] py-2 px-2.5 border rounded-xl bg-white text-xs font-bold text-gray-700 outline-none shadow-sm ${t.field}`}
              />
              {hasRange && (
                <button
                  type="button"
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="flex items-center gap-1 px-2.5 py-2 text-[10px] font-black uppercase tracking-wider text-rose-600 hover:bg-rose-50 rounded-xl"
                >
                  <X className="w-3.5 h-3.5" />
                  Effacer
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-dashed border-gray-200">
            <div className="flex items-center gap-2 shrink-0">
              <Filter className={`w-3.5 h-3.5 ${t.icon}`} />
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-600">Filtrer par date de</span>
            </div>
            {DATE_MODES.map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => setDateMode(m.key)}
                aria-pressed={dateMode === m.key}
                title={m.hint}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                  dateMode === m.key ? t.select : 'bg-white text-gray-500 border-gray-200 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                {m.label}
              </button>
            ))}
            <span className="text-[10px] font-semibold text-gray-400 sm:ml-1">
              {DATE_MODES.find(m => m.key === dateMode)?.hint}
            </span>
          </div>
        </div>
      </div>

      {truncated && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold leading-relaxed">
            Cette période dépasse la limite de lecture du serveur : les chiffres ci-dessous ne
            couvrent que vos actions les plus récentes. Choisissez une période plus courte pour un
            total exact.
          </p>
        </div>
      )}

      {/* --------------------------------------------------------- KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi icon={<History className="w-4 h-4" />} label="Actions" value={fmtNum(summary?.totalActions ?? 0)}
             sub="Changements de statut" tone="indigo" />
        <Kpi icon={<Headphones className="w-4 h-4" />} label="Leads traités" value={fmtNum(summary?.leadsWorked ?? 0)}
             sub={`${(summary?.actionsPerLead ?? 0).toFixed(1)} actions / lead`} tone="blue" />
        <Kpi icon={<Zap className="w-4 h-4" />} label="Réclamés" value={fmtNum(summary?.claimed ?? 0)}
             sub="Sortis du pool, rendus inclus" tone="cyan" />
        <Kpi icon={<TrendingUp className="w-4 h-4" />} label="Taux confirmation"
             value={`${fmtPct(confirmationRate)} %`}
             sub={`${confirmedTotal} / ${treatedTotal} traités`} tone="emerald" />
        <Kpi icon={<PackageCheck className="w-4 h-4" />} label="Taux livraison"
             value={`${fmtPct(deliveryRate)} %`}
             sub={`${deliveredTotal} / ${parcelsTotal} colis`} tone="violet" />
        <Kpi icon={<Coins className="w-4 h-4" />} label="Gains livrés" value={`${fmtNum(agentEarnings)} MAD`}
             sub={agentRate !== null ? `${agentRate} MAD / colis livré` : 'sur colis livrés'} tone="amber" />
      </div>

      {/* ------------------------------------------------- Charts + activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        <div className="xl:col-span-2 space-y-5">
          {/* Daily */}
          <section className={`bg-white p-5 rounded-3xl border shadow-sm ${t.card}`}>
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <BarChart3 className={`w-4 h-4 ${t.icon}`} />
                  Activité par jour
                </h2>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
                  Barres empilées : vos actions · Ligne : leads distincts touchés
                </p>
              </div>
              {summary?.busiestDay && (
                <span className={`px-3 py-1.5 text-[10px] font-black rounded-xl border w-fit ${t.soft}`}>
                  Meilleur jour : {fmtDayShort(summary.busiestDay)} ({summary.busiestDayCount})
                </span>
              )}
            </header>

            {dailyChart.length > 0 ? (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dailyChart} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <RechartsTooltip content={<DayTooltip />} />
                    {activeActions.map(a => (
                      <Bar key={a.key} dataKey={a.key} stackId="actions" fill={a.color} isAnimationActive={false} />
                    ))}
                    <Line type="monotone" dataKey="leads" stroke="#0f172a" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyBlock label="Aucune action sur cette période" />
            )}

            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
              {activeActions.map(a => (
                <span key={a.key} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                  {a.label}
                  <span className="text-gray-900 font-black tabular-nums">{byAction[a.key] || 0}</span>
                </span>
              ))}
            </div>
          </section>

          {/* Hourly */}
          <section className={`bg-white p-5 rounded-3xl border shadow-sm ${t.card}`}>
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <Clock className={`w-4 h-4 ${t.icon}`} />
                  Vos heures de travail
                </h2>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
                  Répartition de vos actions sur 24 h
                </p>
              </div>
              {summary?.busiestHour !== null && summary?.busiestHour !== undefined && (
                <span className={`px-3 py-1.5 text-[10px] font-black rounded-xl border w-fit ${t.soft}`}>
                  Pic : {String(summary.busiestHour).padStart(2, '0')} h
                </span>
              )}
            </header>

            {hourlyPeak > 0 ? (
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourly} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="hour" tickFormatter={(h: number) => `${h}h`} interval={1}
                           tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      cursor={{ fill: '#f8fafc' }}
                      formatter={(v: any) => [`${v} action${Number(v) > 1 ? 's' : ''}`, '']}
                      labelFormatter={(h: any) => `${String(h).padStart(2, '0')} h — ${String(h).padStart(2, '0')}:59`}
                    />
                    <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyBlock label="Aucune action sur cette période" />
            )}
          </section>

          {/* The three readings side by side */}
          <section className={`bg-white p-5 rounded-3xl border shadow-sm ${t.card}`}>
            <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <ListChecks className={`w-4 h-4 ${t.icon}`} />
                  Résultats de confirmation
                </h2>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
                  Les trois lectures, côte à côte
                </p>
              </div>
              <div className="flex items-center gap-1">
                {COUNT_MODES.map(m => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setCountMode(m.key)}
                    aria-pressed={countMode === m.key}
                    title={m.hint}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                      countMode === m.key ? t.select : 'bg-white text-gray-500 border-gray-200 hover:text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </header>

            {/* Why three columns: "combien de NO_REPLY" has three honest answers,
                and putting them next to each other is the only way an agent can
                see that they are not the same question. */}
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-2 text-[9px] font-black uppercase tracking-wider text-gray-400">Résultat</th>
                    <th className="pb-2 text-[9px] font-black uppercase tracking-wider text-gray-400 text-right" title="Chaque lead compté une fois, sous sa dernière action">Par lead</th>
                    <th className="pb-2 text-[9px] font-black uppercase tracking-wider text-gray-400 text-right" title="Chaque changement de statut compté">Par action</th>
                    <th className="pb-2 text-[9px] font-black uppercase tracking-wider text-gray-400 text-right" title="Leads distincts ayant reçu ce résultat au moins une fois">Leads distincts</th>
                    <th className="pb-2 text-[9px] font-black uppercase tracking-wider text-gray-400 w-[28%] pl-3">Part</th>
                  </tr>
                </thead>
                <tbody>
                  {[...CONFIRMATION_OUTCOMES, IN_PROGRESS_ROW, PUSHED_ROW, ...extraRows].map(o => {
                    const perLead = byLastAction[o.key] || 0;
                    const share = countMode === 'actions'
                      ? pct(byAction[o.key] || 0, actionGrandTotal)
                      : pct(perLead, pipelineTotal);
                    return (
                      <tr key={o.key} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                        <td className="py-2">
                          <span className="flex items-center gap-2">
                            <span className="w-1.5 h-6 rounded-full shrink-0" style={{ backgroundColor: o.color }} />
                            <span className="text-[11px] font-bold text-gray-700">{o.emoji} {o.label}</span>
                          </span>
                        </td>
                        <td className="py-2 text-right text-sm font-black text-gray-900 tabular-nums">{perLead}</td>
                        <td className="py-2 text-right text-sm font-bold text-gray-500 tabular-nums">{byAction[o.key] || 0}</td>
                        <td className="py-2 text-right text-sm font-bold text-gray-500 tabular-nums">{byLead[o.key] || 0}</td>
                        <td className="py-2 pl-3">
                          <span className="flex items-center gap-2">
                            <span className={`flex-1 h-1.5 rounded-full overflow-hidden ${t.track}`}>
                              <span className="block h-full rounded-full" style={{ width: `${share}%`, backgroundColor: o.color }} />
                            </span>
                            <span className="text-[9px] font-black text-gray-400 tabular-nums w-9 text-right">{fmtPct(share)}%</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] font-semibold text-gray-400 mt-3 leading-relaxed">
              <b className="text-gray-600">Par lead</b> classe chaque lead sous votre dernière action —
              le total s'additionne aux leads traités. <b className="text-gray-600">Par action</b> compte
              chaque changement de statut : rappeler deux fois le même numéro fait deux NO&nbsp;REPLY.
              Le taux ({fmtPct(confirmationRate)} %) exclut les leads ASSIGNED, sans résultat enregistré.
            </p>
          </section>
        </div>

        {/* ------------------------------------------------------- Live feed */}
        <section className={`bg-white rounded-3xl border shadow-sm overflow-hidden ${t.card}`}>
          <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Activity className={`w-4 h-4 ${isLive ? 'animate-pulse' : ''} ${t.icon}`} />
                Flux en direct
              </h2>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
                Vos {recent.length} dernières actions
              </p>
            </div>
            <Link to="/agent/assigned-leads" className={`text-[11px] font-bold flex items-center gap-1 shrink-0 ${t.link}`}>
              Leads <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-gray-50 max-h-[620px] overflow-y-auto">
            {recent.length > 0 ? (
              recent.map((r: any) => {
                const meta = actionMeta(r.newStatus);
                return (
                  <Link
                    key={r.id}
                    to={`/agent/leads/${r.leadId}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/70 transition-colors"
                  >
                    <span className="w-1.5 h-9 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: meta.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-black text-gray-900 truncate max-w-[150px]">
                          {r.leadName || `Lead #${r.leadId}`}
                        </span>
                        {r.city && <span className="text-[10px] font-semibold text-gray-400 truncate">· {r.city}</span>}
                      </div>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {r.oldStatus && r.oldStatus !== r.newStatus && (
                          <>
                            <span className="text-[9px] font-bold text-gray-400 line-through">{r.oldStatus}</span>
                            <ArrowRight className="w-2.5 h-2.5 text-gray-300" />
                          </>
                        )}
                        <span
                          className="text-[9px] font-black px-1.5 py-0.5 rounded-md"
                          style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
                        >
                          {meta.emoji} {meta.label}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-black text-gray-500 tabular-nums">{fmtClock(r.at)}</div>
                      <div className="text-[9px] font-semibold text-gray-400">{timeAgo(r.at, now)}</div>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="p-10 text-center">
                <Activity className="w-9 h-9 mx-auto mb-2 text-gray-200" />
                <p className="text-xs font-bold text-gray-400">Aucune action sur cette période</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* -------------------------------------------------------- Livraison */}
      <section className={`bg-white p-5 rounded-3xl border shadow-sm ${t.card}`}>
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
              <Truck className={`w-4 h-4 ${t.icon}`} />
              Livraison Coliaty
            </h2>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
              Colis de vos leads · comptés à la date de création du colis
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-3 py-1.5 text-[11px] font-black rounded-xl border ${t.soft}`}>
              {fmtNum(revenueDelivered)} MAD livrés
            </span>
            <span className={`px-3 py-1.5 text-[11px] font-black rounded-xl border ${t.soft}`}>
              Taux : {fmtPct(deliveryRate)}% ({deliveredTotal}/{parcelsTotal})
            </span>
          </div>
        </header>

        {parcelsTotal > 0 ? (
          <>
            <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-gray-100 mb-2.5">
              {deliveryRows.map(row => (
                <div
                  key={row.key}
                  className="h-full"
                  style={{ width: `${pct(row.count, parcelsTotal)}%`, backgroundColor: row.color }}
                  title={`${row.label} — ${row.count}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mb-4">
              {(Object.keys(DELIVERY_GROUPS) as DeliveryGroup[])
                .sort((a, b) => DELIVERY_GROUPS[a].order - DELIVERY_GROUPS[b].order)
                .filter(g => groupTotals[g] > 0)
                .map(g => (
                  <span key={g} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500">
                    <span className={`w-2 h-2 rounded-full ${DELIVERY_GROUPS[g].dot}`} />
                    {DELIVERY_GROUPS[g].label}
                    <span className="text-gray-900 font-black tabular-nums">{groupTotals[g]}</span>
                  </span>
                ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {deliveryRows.map(row => (
                <Link
                  key={row.key}
                  to={`/agent/livraison?status=${row.key}`}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-gray-100 bg-gray-50/40 hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all"
                  title={`Voir les colis « ${row.label} »`}
                >
                  <span className="w-1.5 h-7 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                  <span className="text-sm shrink-0">{row.emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[11px] font-bold text-gray-700 truncate capitalize">{row.label}</span>
                    <span className="block text-[9px] font-semibold text-gray-400 tabular-nums">
                      {fmtPct(pct(row.count, parcelsTotal))}% · {DELIVERY_GROUPS[row.group].label}
                    </span>
                  </span>
                  <span className="text-base font-black text-gray-900 tabular-nums shrink-0">{row.count}</span>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <EmptyBlock label="Aucun colis sur cette période" />
        )}
      </section>

      {/* ------------------------------------------------------------ Footer */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FooterStat to="/agent/leads" icon={<Inbox className="w-4 h-4" />} label="Leads disponibles"
                    value={availableCount} sub="Pool partagé à réclamer" tone="emerald" />
        <FooterStat to="/agent/live-stream-paniers" icon={<ShoppingCart className="w-4 h-4" />} label="Paniers convertis"
                    value={cartsConverted} sub={`sur ${cartsTotal} panier${cartsTotal > 1 ? 's' : ''} visibles`} tone="rose" />
        <FooterStat to="/agent/facturation" icon={<Coins className="w-4 h-4" />} label="Jours travaillés"
                    value={summary?.workedDays ?? 0}
                    sub={`${(summary?.actionsPerWorkedDay ?? 0).toFixed(1)} actions / jour actif`} tone="amber" />
      </div>

      <p className="text-[10px] font-semibold text-gray-400 text-center leading-relaxed px-4">
        Les chiffres de confirmation sont reconstruits à partir de votre historique de statuts —
        un lead rendu au pool garde donc votre travail. Les chiffres de livraison et de paniers
        suivent l'assignation actuelle et disparaissent si le lead vous quitte.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

const KPI_TONES: Record<string, { wrap: string; icon: string }> = {
  indigo: { wrap: 'bg-indigo-50/70 border-indigo-100', icon: 'bg-indigo-100 text-indigo-600' },
  blue: { wrap: 'bg-blue-50/70 border-blue-100', icon: 'bg-blue-100 text-blue-600' },
  cyan: { wrap: 'bg-cyan-50/70 border-cyan-100', icon: 'bg-cyan-100 text-cyan-600' },
  emerald: { wrap: 'bg-emerald-50/70 border-emerald-100', icon: 'bg-emerald-100 text-emerald-600' },
  violet: { wrap: 'bg-violet-50/70 border-violet-100', icon: 'bg-violet-100 text-violet-600' },
  amber: { wrap: 'bg-amber-50/70 border-amber-100', icon: 'bg-amber-100 text-amber-600' },
  rose: { wrap: 'bg-rose-50/70 border-rose-100', icon: 'bg-rose-100 text-rose-600' },
};

function Kpi({ icon, label, value, sub, tone }: {
  icon: React.ReactNode; label: string; value: string | number; sub: string; tone: keyof typeof KPI_TONES;
}) {
  const c = KPI_TONES[tone];
  return (
    <div className={`px-3.5 py-3 rounded-2xl border shadow-sm ${c.wrap}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${c.icon}`}>{icon}</div>
      <p className="text-xl font-black text-gray-900 leading-none tabular-nums">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-wider text-gray-600 mt-1.5 leading-tight">{label}</p>
      <p className="text-[9px] font-semibold text-gray-400 truncate leading-tight">{sub}</p>
    </div>
  );
}

function FooterStat({ to, icon, label, value, sub, tone }: {
  to: string; icon: React.ReactNode; label: string; value: number; sub: string; tone: keyof typeof KPI_TONES;
}) {
  const c = KPI_TONES[tone];
  return (
    <Link to={to} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all ${c.wrap}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${c.icon}`}>{icon}</div>
      <div className="min-w-0">
        <span className="text-xl font-black text-gray-900 leading-none tabular-nums">{value}</span>
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-600 mt-0.5 leading-tight">{label}</p>
        <p className="text-[9px] font-semibold text-gray-400 truncate">{sub}</p>
      </div>
    </Link>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="py-12 flex flex-col items-center justify-center text-gray-300">
      <BarChart3 className="w-8 h-8 mb-2" />
      <p className="text-xs font-bold text-gray-400">{label}</p>
    </div>
  );
}

/** Only the series that actually have a value that day — a stack of zeroes is noise. */
function DayTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p: any) => p.value > 0 && p.dataKey !== 'leads');
  const leads = payload.find((p: any) => p.dataKey === 'leads')?.value ?? 0;
  const total = rows.reduce((s: number, p: any) => s + p.value, 0);
  return (
    <div className="bg-white p-3 rounded-2xl shadow-xl border border-gray-100 min-w-[170px]">
      <div className="text-[10px] font-black text-gray-900 uppercase tracking-wider mb-1.5">{label}</div>
      {rows.map((p: any) => {
        const meta = actionMeta(p.dataKey);
        return (
          <div key={p.dataKey} className="flex items-center gap-2 text-[10px] py-0.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <span className="font-bold text-gray-500 flex-1 truncate">{meta.label}</span>
            <span className="font-black text-gray-900 tabular-nums">{p.value}</span>
          </div>
        );
      })}
      <div className="flex items-center gap-2 text-[10px] pt-1.5 mt-1 border-t border-gray-100">
        <span className="font-black text-gray-600 flex-1">Total actions</span>
        <span className="font-black text-gray-900 tabular-nums">{total}</span>
      </div>
      <div className="flex items-center gap-2 text-[10px]">
        <span className="font-bold text-gray-400 flex-1">Leads distincts</span>
        <span className="font-black text-gray-900 tabular-nums">{leads}</span>
      </div>
    </div>
  );
}
