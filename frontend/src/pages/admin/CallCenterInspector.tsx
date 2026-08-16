import { useState, useMemo, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { format } from 'date-fns';
import {
  Headphones, Search, Filter, ChevronLeft, ChevronRight, ChevronDown,
  Phone, MapPin, Calendar, Clock, Truck, Package, Users, ArrowLeft, Eye,
  Activity, TrendingUp, CalendarDays, X, MousePointerClick,
  MessageCircle, PhoneCall, Repeat, History, ShieldAlert, Target,
  CheckCircle2, ArrowUpDown, Hash, Layers,
} from 'lucide-react';
import {
  getStatusMeta, normalizeStatus, groupTotals,
  GROUP_META, GROUP_ORDER, GROUPS_BY_PHASE, PHASE_META, PHASE_ORDER,
  type StatusGroup, type Phase,
} from '../../lib/leadStatusCatalog';
import { paymentSituationLabel } from '../../lib/paymentSituation';

const LIMIT = 20;

// The backend already buckets and rates everything (buildAgentMetrics in
// admin.routes.ts). This is only the shape, and a zeroed fallback so an agent
// with no leads renders as zeros instead of blanks.
interface Metrics {
  total: number; treated: number; open: number; lost: number; confirmed: number;
  delivered: number; deliveryFailed: number; inTransit: number;
  confirmationRate: number; deliveryRate: number; lossRate: number;
  unknownStatuses: string[]; unknown: number;
}

interface AgentActivity {
  assignments: number; distinctLeads: number; manualClaims: number;
  forcedClaims: number; claimTotal: number; reclaimed: number;
  statusChanges: number; whatsappClicks: number; callClicks: number;
  totalClicks: number; lastWhatsappAt: string | null;
  lastCallAt: string | null; lastAssignedAt: string | null;
}

const EMPTY_METRICS: Metrics = {
  total: 0, treated: 0, open: 0, lost: 0, confirmed: 0, delivered: 0,
  deliveryFailed: 0, inTransit: 0, confirmationRate: 0, deliveryRate: 0,
  lossRate: 0, unknownStatuses: [], unknown: 0,
};

const EMPTY_ACTIVITY: AgentActivity = {
  assignments: 0, distinctLeads: 0, manualClaims: 0, forcedClaims: 0,
  claimTotal: 0, reclaimed: 0, statusChanges: 0, whatsappClicks: 0,
  callClicks: 0, totalClicks: 0, lastWhatsappAt: null, lastCallAt: null,
  lastAssignedAt: null,
};

const DATE_PRESETS = [
  { key: 'today', days: 0 },
  { key: 'days7', days: 6 },
  { key: 'days30', days: 29 },
  { key: 'days90', days: 89 },
];

const iso = (d: Date) => format(d, 'yyyy-MM-dd');

type Translate = (key: string, fallback?: string) => string;

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
const fmtPct = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/**
 * The six outcomes an agent can pick under "✅ Résultat de la confirmation" on
 * the lead page — same list, same order, same colours as the agent's own
 * dashboard (pages/agent/Dashboard.tsx). `label` is the literal button name the
 * agent clicks, so it stays untranslated; the description under it comes from
 * the status catalogue and follows the language switcher.
 */
const CONFIRMATION_OUTCOMES = [
  { key: 'CALL_LATER', label: 'CALL LATER', color: '#3b82f6', tile: 'bg-blue-50/70 border-blue-100 text-blue-700', bar: 'bg-blue-500' },
  { key: 'NO_REPLY', label: 'NO REPLY', color: '#64748b', tile: 'bg-slate-50 border-slate-200 text-slate-700', bar: 'bg-slate-500' },
  { key: 'CONFIRMED', label: 'CONFIRMED', color: '#10b981', tile: 'bg-emerald-50/70 border-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
  { key: 'WRONG_ORDER', label: 'WRONG ORDER', color: '#f59e0b', tile: 'bg-amber-50/70 border-amber-100 text-amber-700', bar: 'bg-amber-500' },
  { key: 'CANCEL_REASON_PRICE', label: 'CANCEL REASON PRICE', color: '#a855f7', tile: 'bg-purple-50/70 border-purple-100 text-purple-700', bar: 'bg-purple-500' },
  { key: 'CANCEL_ORDER', label: 'CANCEL ORDER', color: '#ef4444', tile: 'bg-red-50/70 border-red-100 text-red-700', bar: 'bg-red-500' },
];

/**
 * Claimed but not yet called — a state, not a result. Listed with the six
 * outcomes so the whole pipeline is visible, but kept out of the
 * confirmation-rate denominator (see `treated` in admin.routes.ts).
 */
const IN_PROGRESS_ROW = {
  key: 'ASSIGNED', label: 'ASSIGNED', color: '#06b6d4',
  tile: 'bg-cyan-50/70 border-cyan-100 text-cyan-700', bar: 'bg-cyan-500',
};

const OUTCOME_KEYS = [...CONFIRMATION_OUTCOMES.map((o) => o.key), IN_PROGRESS_ROW.key];

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${tone}`}>
      <p className="text-xl font-black leading-none tabular-nums">{value}</p>
      <p className="text-[9px] font-black uppercase tracking-wider mt-1 opacity-70">{label}</p>
    </div>
  );
}

function StackedBar({
  breakdown, total, groupLabel,
}: { breakdown: Record<string, number>; total: number; groupLabel: (g: StatusGroup) => string }) {
  if (total <= 0) return <div className="h-1.5 rounded-full bg-gray-100" />;
  const totals = groupTotals(breakdown);
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100">
      {GROUP_ORDER.map((group) => {
        const count = totals[group];
        if (!count) return null;
        return (
          <div
            key={group}
            style={{ width: `${(count / total) * 100}%`, backgroundColor: GROUP_META[group].hex }}
            title={`${groupLabel(group)} : ${count} (${((count / total) * 100).toFixed(1)}%)`}
          />
        );
      })}
    </div>
  );
}

export default function CallCenterInspector() {
  const { t } = useLanguage();

  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [sortBy, setSortBy] = useState<'leads' | 'claims' | 'confirmation' | 'delivery' | 'name'>('leads');
  const [expandedLead, setExpandedLead] = useState<number | null>(null);

  const tc: Translate = (key, fallback) => t(key, 'call-center', fallback);

  /** `t()` has no interpolation of its own — fill `{name}` placeholders here. */
  const tv = (key: string, vars: Record<string, string | number>, fallback?: string) =>
    Object.entries(vars).reduce(
      (acc, [name, value]) => acc.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value)),
      tc(key, fallback)
    );

  // The catalogue's own label is the fallback, so an unmapped carrier code —
  // which the webhook can write at any time — still renders as readable text
  // rather than a missing translation key.
  const statusLabel = (status?: string | null) =>
    tc(`status.${normalizeStatus(status)}`, getStatusMeta(status).label);
  const groupLabel = (group: StatusGroup) => tc(`group.${group}`, GROUP_META[group].label);
  const phaseLabel = (phase: Phase) => tc(`phase.${phase}`, PHASE_META[phase].label);
  const phaseSubtitle = (phase: Phase) =>
    tc(`phase.${phase}Subtitle`, PHASE_META[phase].subtitle);

  const fmtDateTime = (value?: string | null) =>
    value ? format(new Date(value), 'dd MMM yyyy · HH:mm') : '—';

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ['call-center-agents', startDate, endDate],
    queryFn: () => adminApi.getCallCenterAgents({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
  });

  const allAgents = agentsData?.data?.data || [];

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['call-center-agent-leads', selectedAgent?.id, statusFilter, search, page, startDate, endDate],
    queryFn: () => adminApi.getCallCenterAgentLeads(selectedAgent.id, {
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      search: search || undefined,
      page,
      limit: LIMIT,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    enabled: !!selectedAgent,
  });

  const leads = leadsData?.data?.data?.leads || [];
  const statusBreakdown: Record<string, number> = leadsData?.data?.data?.statusBreakdown || selectedAgent?.statusBreakdown || {};
  const metrics: Metrics = leadsData?.data?.data?.metrics || selectedAgent?.metrics || EMPTY_METRICS;
  const activity: AgentActivity = leadsData?.data?.data?.activity || selectedAgent?.activity || EMPTY_ACTIVITY;
  const pagination = leadsData?.data?.data?.pagination || { totalPages: 1, total: 0, page: 1 };

  // Roster-wide roll-up shown in the header. Summing the per-agent metrics is
  // safe because a lead has exactly one assigned agent.
  const roster = useMemo(() => {
    const sum = (key: keyof Metrics) =>
      allAgents.reduce((s: number, a: any) => s + Number(a.metrics?.[key] || 0), 0);
    const totalLeads = sum('total');
    const confirmed = sum('confirmed');
    const delivered = sum('delivered');
    const failed = sum('deliveryFailed');
    const claims = allAgents.reduce((s: number, a: any) => s + Number(a.activity?.claimTotal || 0), 0);
    const clicks = allAgents.reduce((s: number, a: any) => s + Number(a.activity?.totalClicks || 0), 0);
    const resolved = delivered + failed;
    return {
      totalLeads, confirmed, delivered, claims, clicks,
      active: allAgents.filter((a: any) => a.isActive).length,
      confirmationRate: totalLeads > 0 ? ((confirmed / totalLeads) * 100).toFixed(1) : '0.0',
      deliveryRate: resolved > 0 ? ((delivered / resolved) * 100).toFixed(1) : '0.0',
    };
  }, [allAgents]);

  const agents = useMemo(() => {
    const q = agentSearch.trim().toLowerCase();
    const filtered = q
      ? allAgents.filter((a: any) =>
        (a.fullName || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q))
      : [...allAgents];

    const value = (a: any) => {
      switch (sortBy) {
        case 'claims': return Number(a.activity?.claimTotal || 0);
        case 'confirmation': return Number(a.metrics?.confirmationRate || 0);
        case 'delivery': return Number(a.metrics?.deliveryRate || 0);
        default: return Number(a.metrics?.total ?? a.totalLeads ?? 0);
      }
    };
    return filtered.sort((a: any, b: any) =>
      sortBy === 'name' ? (a.fullName || '').localeCompare(b.fullName || '') : value(b) - value(a));
  }, [allAgents, agentSearch, sortBy]);

  // Only statuses this agent actually has, grouped the same way the agent's own
  // dashboard groups them. Chips for statuses with no leads are noise on a
  // 47-value catalogue.
  const chipGroups = useMemo(() => (
    GROUP_ORDER.map((group) => ({
      group,
      phase: GROUP_META[group].phase,
      statuses: Object.entries(statusBreakdown)
        .filter(([status]) => getStatusMeta(status).group === group)
        .map(([status, count]) => ({ status: normalizeStatus(status), count: Number(count) }))
        .filter((s) => s.count > 0)
        .sort((a, b) => b.count - a.count),
    })).filter((g) => g.statuses.length > 0)
  ), [statusBreakdown]);

  const groups = useMemo(() => groupTotals(statusBreakdown), [statusBreakdown]);

  const breakdownTotal = useMemo(
    () => Object.values(statusBreakdown).reduce((s: number, c: any) => s + Number(c), 0),
    [statusBreakdown]
  );

  // --- Phase 2: every parcel status this agent's leads ended up in ---------
  const deliveryRows = useMemo(() => (
    Object.entries(statusBreakdown)
      .filter(([s]) => GROUP_META[getStatusMeta(s).group].phase === 'delivery')
      .map(([s, count]) => ({ status: normalizeStatus(s), count: Number(count) }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
  ), [statusBreakdown]);

  const parcelsTotal = deliveryRows.reduce((s, r) => s + r.count, 0);

  // --- Phase 1: the six outcomes + the in-progress row --------------------
  const count = (key: string) => Number(statusBreakdown[key] || 0);

  const phase1Rows = [
    ...CONFIRMATION_OUTCOMES.map((o) => {
      if (o.key !== 'CONFIRMED') {
        return { ...o, value: count(o.key), hint: statusLabel(o.key), filter: o.key };
      }
      // A lead that shipped was confirmed first, but leaves the confirmation
      // scope once Coliaty stamps it — add the parcels back so CONFIRMED
      // reflects all the work done, not only what is still queued. Same
      // treatment the agent's own dashboard applies.
      const queued = count('CONFIRMED');
      return {
        ...o,
        value: queued + parcelsTotal,
        hint: parcelsTotal > 0
          ? tv('metrics.confirmedHint', { queued, shipped: parcelsTotal })
          : statusLabel('CONFIRMED'),
        filter: ['CONFIRMED', ...deliveryRows.map((r) => r.status)].join(','),
      };
    }),
    { ...IN_PROGRESS_ROW, value: count('ASSIGNED'), hint: statusLabel('ASSIGNED'), filter: 'ASSIGNED' },
  ];

  // Statuses the agent's dashboard never shows (legacy values, admin-set
  // statuses, unmapped carrier codes) but that leads here really do carry.
  // Surfaced rather than dropped, so the tiles account for every lead.
  const phase1Other = useMemo(() => (
    Object.entries(statusBreakdown)
      .filter(([s]) => {
        const key = normalizeStatus(s);
        return GROUP_META[getStatusMeta(s).group].phase === 'confirmation'
          && !OUTCOME_KEYS.includes(key);
      })
      .map(([s, c]) => ({ status: normalizeStatus(s), count: Number(c) }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
  ), [statusBreakdown]);

  const otherTotal = phase1Other.reduce((s, r) => s + r.count, 0);

  const handleSelectAgent = (agent: any) => {
    setSelectedAgent(agent);
    setStatusFilter('ALL');
    setSearch('');
    setPage(1);
    setExpandedLead(null);
  };

  const handleBack = () => {
    setSelectedAgent(null);
    setStatusFilter('ALL');
    setSearch('');
    setPage(1);
    setExpandedLead(null);
  };

  const handleClearDates = () => {
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(iso(start));
    setEndDate(iso(end));
    setPage(1);
  };

  const dateBar = (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 flex-shrink-0">
          <CalendarDays className="w-4 h-4 text-cyan-500" />
          {tc('period.label')}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.days)}
              className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 text-[10px] font-black uppercase tracking-wider border border-gray-200 hover:bg-cyan-50 hover:text-cyan-600 hover:border-cyan-200 transition-all"
            >
              {tc(`period.${p.key}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 lg:ms-auto">
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all w-[150px]"
          />
          <span className="text-xs font-bold text-gray-300 rtl:rotate-180">→</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all w-[150px]"
          />
          {(startDate || endDate) && (
            <button
              onClick={handleClearDates}
              className="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-red-100 transition-all border border-red-100"
            >
              <X className="w-3 h-3" /> {tc('period.clear')}
            </button>
          )}
        </div>
      </div>
      <p className="text-[10px] font-medium text-gray-400 mt-2.5">{tc('period.hint')}</p>
    </div>
  );

  // ---------------------------------------------------------------- Overview
  if (!selectedAgent) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 text-white shadow-2xl">
          <div className="absolute top-0 end-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2" />
          <div className="absolute bottom-0 start-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl translate-y-1/2" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-cyan-300 text-xs font-bold mb-4 backdrop-blur-sm">
              <Activity className="w-3.5 h-3.5 animate-pulse" /> {tc('badge')}
            </div>
            <h1 className="text-3xl font-black tracking-tight leading-none mb-2">{tc('title')}</h1>
            <p className="text-base text-white/60 font-medium">{tc('subtitle')}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
              {[
                { label: tc('overview.activeAgents'), value: `${roster.active}/${allAgents.length}`, icon: Headphones },
                { label: tc('overview.leadsHandled'), value: roster.totalLeads, icon: Users },
                { label: tc('overview.confirmed'), value: roster.confirmed, icon: CheckCircle2 },
                { label: tc('overview.delivered'), value: roster.delivered, icon: Package },
                { label: tc('overview.confirmationRateShort'), value: `${roster.confirmationRate}%`, icon: TrendingUp },
                { label: tc('overview.claimClicks'), value: roster.claims, icon: MousePointerClick },
              ].map((s) => (
                <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-sm">
                  <s.icon className="w-4 h-4 text-cyan-400 mb-1.5" />
                  <p className="text-xl font-black leading-none">{s.value}</p>
                  <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {dateBar}

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={tc('search.agents')}
              className="w-full ps-10 pe-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-cyan-500 transition-all font-medium text-sm"
              value={agentSearch}
              onChange={(e) => setAgentSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-cyan-500 flex-shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
            >
              <option value="leads">{tc('sort.leads')}</option>
              <option value="claims">{tc('sort.claims')}</option>
              <option value="confirmation">{tc('sort.confirmation')}</option>
              <option value="delivery">{tc('sort.delivery')}</option>
              <option value="name">{tc('sort.name')}</option>
            </select>
          </div>
        </div>

        {agentsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded-lg w-32" />
                    <div className="h-3 bg-gray-100 rounded-lg w-20" />
                  </div>
                </div>
                <div className="h-28 bg-gray-50 rounded-xl" />
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
            <Headphones className="w-16 h-16 mx-auto text-gray-200 mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {agentSearch ? tc('empty.noAgentsFound') : tc('empty.noAgents')}
            </h3>
            <p className="text-sm text-gray-400">
              {agentSearch ? tc('empty.noAgentsFoundHint') : tc('empty.noAgentsHint')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {agents.map((agent: any) => {
              const m: Metrics = agent.metrics || EMPTY_METRICS;
              const act: AgentActivity = agent.activity || EMPTY_ACTIVITY;
              const breakdown: Record<string, number> = agent.statusBreakdown || {};
              const topStatuses = Object.entries(breakdown)
                .sort(([, a]: any, [, b]: any) => Number(b) - Number(a))
                .slice(0, 4);

              return (
                <button
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent)}
                  className="bg-white rounded-2xl border border-gray-100 p-5 text-start hover:shadow-xl hover:shadow-gray-100/80 hover:border-gray-200 transition-all duration-300 group hover:scale-[1.01] active:scale-[0.99]"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white shadow-lg flex-shrink-0 ${
                      agent.isActive
                        ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-200/50'
                        : 'bg-gradient-to-br from-gray-400 to-gray-500 shadow-gray-200/50'
                    }`}>
                      {agent.fullName?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black text-gray-900 truncate group-hover:text-cyan-600 transition-colors">{agent.fullName}</h3>
                      <p className="text-[11px] text-gray-400 font-medium truncate">{agent.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {agent.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> {tc('card.active')}
                          </span>
                        ) : (
                          <span className="text-[9px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md uppercase tracking-wider">{tc('card.inactive')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <div className="text-2xl font-black text-gray-900">{m.total}</div>
                      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{tc('card.leads')}</div>
                    </div>
                  </div>

                  {/* Where this agent's leads stand right now — every status
                      counted, so the bar always accounts for 100% of them. */}
                  <StackedBar breakdown={breakdown} total={m.total} groupLabel={groupLabel} />

                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {[
                      { label: groupLabel('in_progress'), value: m.open, color: 'text-cyan-600' },
                      { label: groupLabel('confirmed'), value: m.confirmed, color: 'text-emerald-600' },
                      { label: groupLabel('done'), value: m.delivered, color: 'text-green-600' },
                      { label: groupLabel('lost'), value: m.lost, color: 'text-rose-600' },
                    ].map((s) => (
                      <div key={s.label} className="bg-gray-50/80 rounded-xl px-2 py-2 text-center">
                        <p className={`text-base font-black leading-none ${s.color}`}>{s.value}</p>
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-wider mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {topStatuses.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {topStatuses.map(([status, count]: any) => {
                        const badge = getStatusMeta(status);
                        return (
                          <span key={status} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${badge.color}`}>
                            <span aria-hidden>{badge.emoji}</span>
                            {statusLabel(status)} <span className="opacity-70">({count})</span>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Button presses, not lead outcomes — the only place the
                      difference between "claimed a lot" and "sold a lot" shows. */}
                  <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                      <MousePointerClick className="w-3 h-3" /> {tc('card.agentActivity')}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { icon: MousePointerClick, value: act.claimTotal, label: tc('card.claimsShort'), title: tv('card.claimsTitle', { manual: act.manualClaims, forced: act.forcedClaims }) },
                        { icon: Repeat, value: act.reclaimed, label: tc('card.reclaimsShort'), title: tc('card.reclaimsTitle') },
                        { icon: MessageCircle, value: act.whatsappClicks, label: tc('card.whatsapp'), title: tc('card.whatsappTitle') },
                        { icon: PhoneCall, value: act.callClicks, label: tc('card.calls'), title: tc('card.callsTitle') },
                      ].map((s) => (
                        <div key={s.label} className="text-center" title={s.title}>
                          <s.icon className="w-3 h-3 mx-auto text-slate-400 mb-1" />
                          <p className="text-sm font-black text-slate-800 leading-none">{s.value}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="bg-cyan-50/50 rounded-xl p-2.5 border border-cyan-100/50">
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-cyan-700 uppercase tracking-wider mb-1">
                        <TrendingUp className="w-3 h-3" /> {tc('card.confirmationRate')}
                      </div>
                      <span className="text-base font-black text-cyan-900 leading-none">{m.confirmationRate}%</span>
                      <div className="w-full bg-cyan-100 rounded-full h-1 mt-1.5">
                        <div className="bg-cyan-500 h-1 rounded-full transition-all" style={{ width: `${Math.min(100, m.confirmationRate)}%` }} />
                      </div>
                    </div>
                    <div
                      className="bg-emerald-50/50 rounded-xl p-2.5 border border-emerald-100/50"
                      title={tv('card.deliveryRateTitle', { delivered: m.delivered, resolved: m.delivered + m.deliveryFailed, transit: m.inTransit })}
                    >
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-700 uppercase tracking-wider mb-1">
                        <Truck className="w-3 h-3" /> {tc('card.deliveryRate')}
                      </div>
                      <span className="text-base font-black text-emerald-900 leading-none">{m.deliveryRate}%</span>
                      <div className="w-full bg-emerald-100 rounded-full h-1 mt-1.5">
                        <div className="bg-emerald-500 h-1 rounded-full transition-all" style={{ width: `${Math.min(100, m.deliveryRate)}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 mt-4 text-[10px] font-bold text-gray-300 group-hover:text-cyan-500 transition-colors">
                    <Eye className="w-3.5 h-3.5" /> {tc('card.inspect')}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------------ Detail
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
          </button>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white shadow-lg ${
            selectedAgent.isActive
              ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-200/50'
              : 'bg-gradient-to-br from-gray-400 to-gray-500 shadow-gray-200/50'
          }`}>
            {selectedAgent.fullName?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">{selectedAgent.fullName}</h1>
            <p className="text-xs text-gray-400 font-medium">
              {selectedAgent.email} · {selectedAgent.phone || tc('card.noPhone')}
            </p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">
              {tc('card.lastClaim')} : {fmtDateTime(activity.lastAssignedAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Scoreboard, split and itemised the way the agent's own dashboard is.
          Every tile doubles as a filter on the table below. */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        {/* ---------------------------------------- Phase 1: Confirmation */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Headphones className="w-5 h-5 text-cyan-500" />
                {phaseLabel('confirmation')}
              </h2>
              <p className="text-[11px] font-semibold text-gray-400 mt-0.5 uppercase tracking-wider">
                {phaseSubtitle('confirmation')}
              </p>
            </div>
            <span
              className="px-3 py-1.5 text-xs font-black rounded-xl border w-fit bg-cyan-50 text-cyan-700 border-cyan-100"
              title={tc('metrics.confirmationRateHint')}
            >
              {tv('phase1.rate', {
                rate: fmtPct(metrics.confirmationRate),
                confirmed: metrics.confirmed,
                treated: metrics.treated,
              })}
            </span>
          </header>

          {/* Legend rows — every outcome, including the zeroes, so a gap in an
              agent's work is as visible as their wins. */}
          <div className="space-y-1.5 mb-5">
            {phase1Rows.map((o) => (
              <div
                key={o.key}
                className={`flex items-center gap-2.5 ${
                  o.key === 'ASSIGNED' ? 'pt-2 mt-0.5 border-t border-dashed border-gray-200' : ''
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: o.color }} />
                <span className="text-[11px] font-bold text-gray-600 truncate flex-1">
                  {getStatusMeta(o.key).emoji} {o.label}
                </span>
                <div className="hidden sm:block w-16 h-1.5 rounded-full overflow-hidden shrink-0 bg-gray-100">
                  <div
                    className={`h-full rounded-full ${o.bar} transition-all duration-500`}
                    style={{ width: `${pct(o.value, breakdownTotal)}%` }}
                  />
                </div>
                <span className="text-xs font-black text-gray-900 tabular-nums w-8 text-end shrink-0">{o.value}</span>
              </div>
            ))}
          </div>

          {/* The six outcome tiles, in the same order as the lead-page buttons.
              ASSIGNED closes the grid full-width: same visual language, but its
              shape says "state in progress", not "seventh result". */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
            {phase1Rows.map((o) => {
              const isActive = statusFilter === o.filter;
              return (
                <button
                  key={o.key}
                  onClick={() => { setStatusFilter(o.filter); setPage(1); }}
                  title={tv('phase1.filterTitle', { label: o.label })}
                  className={`p-3.5 rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-start ${o.tile} ${
                    isActive ? 'ring-2 ring-offset-1 ring-gray-900/20' : ''
                  } ${o.key === 'ASSIGNED' ? 'col-span-2 lg:col-span-3 flex items-center gap-3' : 'block'}`}
                >
                  {o.key === 'ASSIGNED' ? (
                    <>
                      <span className="text-base leading-none shrink-0">{getStatusMeta(o.key).emoji}</span>
                      <span className="text-2xl font-black leading-none tabular-nums shrink-0">{o.value}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[9px] font-black tracking-wider uppercase opacity-90 leading-tight">{o.label}</span>
                        <span className="block text-[9px] font-semibold opacity-60 leading-tight">{o.hint}</span>
                      </span>
                      <span className="text-[9px] font-black opacity-60 tabular-nums shrink-0">
                        {fmtPct(pct(o.value, breakdownTotal))}%
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-base leading-none">{getStatusMeta(o.key).emoji}</span>
                        <span className="text-[9px] font-black opacity-60 tabular-nums">
                          {fmtPct(pct(o.value, breakdownTotal))}%
                        </span>
                      </div>
                      <p className="text-2xl font-black mt-1.5 leading-none tabular-nums">{o.value}</p>
                      <p className="text-[9px] font-black tracking-wider uppercase mt-1.5 opacity-90 leading-tight">{o.label}</p>
                      <p className="text-[9px] font-semibold opacity-60 leading-tight">{o.hint}</p>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {/* Anything the six buttons can't produce — legacy statuses, values an
              admin set, carrier codes. Hidden when there are none. */}
          {phase1Other.length > 0 && (
            <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">
                {tc('phase1.other')} ({otherTotal})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {phase1Other.map(({ status, count: c }) => {
                  const badge = getStatusMeta(status);
                  return (
                    <button
                      key={status}
                      onClick={() => { setStatusFilter(status); setPage(1); }}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all hover:shadow-sm ${badge.color}`}
                    >
                      <span aria-hidden>{badge.emoji}</span>
                      {statusLabel(status)} <span className="opacity-70">({c})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ------------------------------------ Phase 2: Livraison Coliaty */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-500" />
                {phaseLabel('delivery')}
              </h2>
              <p className="text-[11px] font-semibold text-gray-400 mt-0.5 uppercase tracking-wider">
                {phaseSubtitle('delivery')}
              </p>
            </div>
            <span className="px-3 py-1.5 text-xs font-black rounded-xl border w-fit bg-emerald-50 text-emerald-700 border-emerald-100">
              {tv('phase2.rate', {
                rate: fmtPct(metrics.deliveryRate),
                delivered: metrics.delivered,
                parcels: parcelsTotal,
              })}
            </span>
          </header>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
            <MiniStat label={tc('phase2.parcelsSent')} value={parcelsTotal} tone="bg-slate-50 border-slate-200 text-slate-700" />
            <MiniStat label={groupLabel('done')} value={groups.done} tone="bg-emerald-50 border-emerald-100 text-emerald-700" />
            <MiniStat label={tc('phase2.inProgress')} value={groups.pipeline + groups.transit + groups.issue} tone="bg-blue-50 border-blue-100 text-blue-700" />
            <MiniStat label={groupLabel('return')} value={groups.return} tone="bg-red-50 border-red-100 text-red-700" />
          </div>

          {parcelsTotal > 0 ? (
            <>
              <div className="mb-4">
                <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-gray-100">
                  {deliveryRows.map((row) => (
                    <div
                      key={row.status}
                      className="h-full transition-all duration-500"
                      style={{ width: `${pct(row.count, parcelsTotal)}%`, backgroundColor: getStatusMeta(row.status).hex }}
                      title={`${statusLabel(row.status)} — ${row.count}`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5">
                  {GROUPS_BY_PHASE.delivery.filter((g) => groups[g] > 0).map((g) => (
                    <span key={g} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: GROUP_META[g].hex }} />
                      {groupLabel(g)}
                      <span className="text-gray-900 font-black tabular-nums">{groups[g]}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[300px] overflow-y-auto pe-1">
                {deliveryRows.map((row) => {
                  const meta = getStatusMeta(row.status);
                  const isActive = statusFilter === row.status;
                  return (
                    <button
                      key={row.status}
                      onClick={() => { setStatusFilter(row.status); setPage(1); }}
                      title={tv('phase1.filterTitle', { label: statusLabel(row.status) })}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all group text-start ${
                        isActive
                          ? 'bg-white border-gray-300 shadow-sm ring-2 ring-offset-1 ring-gray-900/10'
                          : 'border-gray-100 bg-gray-50/40 hover:bg-white hover:border-gray-200 hover:shadow-sm'
                      }`}
                    >
                      <span className="w-1.5 h-7 rounded-full shrink-0" style={{ backgroundColor: meta.hex }} />
                      <span className="text-sm shrink-0">{meta.emoji}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[11px] font-bold text-gray-700 truncate group-hover:text-gray-900">
                          {statusLabel(row.status)}
                        </span>
                        <span className="block text-[9px] font-semibold text-gray-400 tabular-nums">
                          {fmtPct(pct(row.count, parcelsTotal))}% · {groupLabel(meta.group)}
                        </span>
                      </span>
                      <span className="text-base font-black text-gray-900 tabular-nums shrink-0">{row.count}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-gray-300">
              <Truck className="w-9 h-9 mb-2" />
              <p className="text-xs font-bold text-gray-400">{tc('phase2.empty')}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{tc('phase2.emptyHint')}</p>
            </div>
          )}
        </section>
      </div>

      {/* Rates + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-cyan-500" /> {tc('metrics.performance')}
          </h3>
          <div className="space-y-4">
            {[
              {
                label: tc('metrics.confirmationRate'), value: metrics.confirmationRate,
                color: 'bg-cyan-500', bg: 'bg-cyan-100', text: 'text-cyan-700',
                hint: tv('metrics.confirmationRateHint', { confirmed: metrics.confirmed, treated: metrics.treated }),
              },
              {
                label: tc('metrics.deliveryRate'), value: metrics.deliveryRate,
                color: 'bg-emerald-500', bg: 'bg-emerald-100', text: 'text-emerald-700',
                hint: tv('metrics.deliveryRateHint', { delivered: metrics.delivered, resolved: metrics.delivered + metrics.deliveryFailed }),
              },
              {
                label: tc('metrics.lossRate'), value: metrics.lossRate,
                color: 'bg-rose-500', bg: 'bg-rose-100', text: 'text-rose-700',
                hint: tv('metrics.lossRateHint', { lost: metrics.lost, treated: metrics.treated }),
              },
            ].map((r) => (
              <div key={r.label}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-gray-600">{r.label}</span>
                  <span className={`text-lg font-black ${r.text}`}>{r.value}%</span>
                </div>
                <div className={`w-full ${r.bg} rounded-full h-1.5`}>
                  <div className={`${r.color} h-1.5 rounded-full transition-all`} style={{ width: `${Math.min(100, r.value)}%` }} />
                </div>
                <p className="text-[9px] font-medium text-gray-400 mt-1">{r.hint}</p>
              </div>
            ))}
          </div>
        </div>

        {/* The "how many times did they click" panel. */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 lg:col-span-2">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <MousePointerClick className="w-3.5 h-3.5 text-cyan-500" /> {tc('activity.title')}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { icon: MousePointerClick, value: activity.claimTotal, label: tc('activity.claimClicks'), hint: tc('activity.claimClicksHint'), accent: 'text-cyan-600 bg-cyan-50 border-cyan-100' },
              { icon: ShieldAlert, value: activity.forcedClaims, label: tc('activity.forcedClaims'), hint: tc('activity.forcedClaimsHint'), accent: 'text-amber-600 bg-amber-50 border-amber-100' },
              { icon: Layers, value: activity.assignments, label: tc('activity.totalAssignments'), hint: tc('activity.totalAssignmentsHint'), accent: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
              { icon: Hash, value: activity.distinctLeads, label: tc('activity.distinctLeads'), hint: tc('activity.distinctLeadsHint'), accent: 'text-slate-600 bg-slate-50 border-slate-100' },
              { icon: Repeat, value: activity.reclaimed, label: tc('activity.reclaims'), hint: tc('activity.reclaimsHint'), accent: 'text-orange-600 bg-orange-50 border-orange-100' },
              { icon: MessageCircle, value: activity.whatsappClicks, label: tc('activity.whatsappClicks'), hint: fmtDateTime(activity.lastWhatsappAt), accent: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
              { icon: PhoneCall, value: activity.callClicks, label: tc('activity.callClicks'), hint: fmtDateTime(activity.lastCallAt), accent: 'text-blue-600 bg-blue-50 border-blue-100' },
              { icon: History, value: activity.statusChanges, label: tc('activity.statusChanges'), hint: tc('activity.statusChangesHint'), accent: 'text-violet-600 bg-violet-50 border-violet-100' },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl p-3 border ${s.accent}`} title={s.hint}>
                <s.icon className="w-4 h-4 mb-1.5 opacity-70" />
                <p className="text-xl font-black leading-none">{s.value}</p>
                <p className="text-[9px] font-black uppercase tracking-wider mt-1 opacity-70">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] font-medium text-gray-400 mt-3">{tc('activity.footnote')}</p>
        </div>
      </div>

      {metrics.unknown > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-800">
              {tv('unknown.title', { count: metrics.unknown })}
            </p>
            <p className="text-[11px] font-medium text-amber-600 mt-0.5">
              {tv('unknown.body', { list: metrics.unknownStatuses.join(', ') })}
            </p>
          </div>
        </div>
      )}

      {dateBar}

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="relative">
          <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={tc('search.leads')}
            className="w-full ps-10 pe-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-cyan-500 transition-all font-medium text-sm"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <button
          onClick={() => { setStatusFilter('ALL'); setPage(1); }}
          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
            statusFilter === 'ALL'
              ? 'bg-gray-900 text-white border-gray-900 shadow-md'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          {tc('table.all')} ({breakdownTotal})
        </button>

        {/* Chips laid out the way the agent's dashboard lays them out: the two
            phases, each split into its groups. A group chip filters on the
            whole group at once. */}
        {PHASE_ORDER.map((phase) => {
          const phaseGroups = chipGroups.filter((g) => g.phase === phase);
          if (phaseGroups.length === 0) return null;
          const phaseCount = phaseGroups.reduce(
            (sum, g) => sum + g.statuses.reduce((s, x) => s + x.count, 0), 0
          );
          const PhaseIcon = PHASE_META[phase].icon;

          return (
            <div key={phase} className="rounded-xl border border-gray-100 bg-gray-50/40 p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <PhaseIcon className={`w-4 h-4 ${phase === 'confirmation' ? 'text-cyan-500' : 'text-indigo-500'}`} />
                <span className="text-[11px] font-black text-gray-700">{phaseLabel(phase)}</span>
                <span className="text-[10px] font-bold text-gray-400">({phaseCount})</span>
              </div>

              {phaseGroups.map((group) => {
                const groupValue = group.statuses.map((s) => s.status).join(',');
                const groupCount = group.statuses.reduce((s, x) => s + x.count, 0);
                const meta = GROUP_META[group.group];
                const GroupIcon = meta.icon;
                const groupActive = statusFilter === groupValue;
                return (
                  <div key={group.group} className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => { setStatusFilter(groupValue); setPage(1); }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border min-w-[150px] ${
                        groupActive ? `${meta.color} shadow-md` : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <GroupIcon className="w-3 h-3" style={{ color: meta.hex }} />
                      {groupLabel(group.group)} ({groupCount})
                    </button>

                    {group.statuses.map(({ status, count }) => {
                      const badge = getStatusMeta(status);
                      const isActive = statusFilter === status;
                      return (
                        <button
                          key={status}
                          onClick={() => { setStatusFilter(status); setPage(1); }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                            isActive ? `${badge.color} border-current shadow-md` : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <span aria-hidden>{badge.emoji}</span>
                          {statusLabel(status)} ({count})
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyan-500" />
            {statusFilter === 'ALL'
              ? tc('table.allLeads')
              : statusFilter.includes(',')
                ? tv('table.selectedStatuses', { count: statusFilter.split(',').length })
                : statusLabel(statusFilter)}
            <span className="text-gray-400 font-medium">({pagination.total})</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                {[
                  tc('table.client'), tc('table.product'), tc('table.amount'),
                  tc('table.leadStatus'), tc('table.parcel'), tc('table.activity'), tc('table.date'),
                ].map((h) => (
                  <th key={h} className="px-5 py-3 text-start text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                ))}
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leadsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="px-5 py-4"><div className="h-10 bg-gray-100 rounded-lg w-full" /></td>
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-gray-400 font-medium">
                    <Package className="w-12 h-12 mx-auto text-gray-200 mb-3" />
                    {tc('empty.noLeads')}
                  </td>
                </tr>
              ) : (
                leads.map((lead: any) => {
                  const statusInfo = getStatusMeta(lead.status);
                  const productImage = lead.product?.image;
                  const isOpen = expandedLead === lead.id;
                  const clicks = lead.contactClicks || { whatsapp: 0, call: 0 };
                  // The agent's negotiated price wins over the pack price —
                  // it's what the courier actually collects.
                  const amount = lead.confirmedPriceMad ?? lead.productPrice;

                  return (
                    <Fragment key={lead.id}>
                      <tr className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900">{lead.fullName}</span>
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                              <span className="flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {lead.phone}</span>
                              <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {lead.city || '-'}</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {productImage ? (
                              <img src={productImage} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 shadow-sm" />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <Package className="w-4 h-4 text-gray-400" />
                              </div>
                            )}
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-bold text-gray-900 truncate">{lead.product?.name || '-'}</span>
                              {lead.productVariant && (
                                <span className="text-[10px] font-black text-cyan-600 truncate uppercase tracking-tighter bg-cyan-50 px-1.5 py-0.5 rounded-md w-fit mt-0.5">
                                  {lead.productVariant}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className="text-sm font-black text-gray-900 tracking-tight">
                            {amount > 0 ? `${Number(amount).toFixed(2)} MAD` : '-'}
                          </span>
                          {lead.confirmedPriceMad != null && (
                            <p className="text-[9px] font-black text-amber-600 uppercase tracking-wider mt-0.5">{tc('table.negotiatedPrice')}</p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusInfo.color}`}>
                            <span aria-hidden>{statusInfo.emoji}</span>
                            {statusLabel(lead.status)}
                          </span>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-1">
                            {groupLabel(statusInfo.group)}
                          </p>
                        </td>

                        {/* Lead.status gets overwritten by delivery events, so
                            the parcel's own status is shown next to it. */}
                        <td className="px-5 py-4">
                          {lead.order ? (
                            <div className="flex flex-col gap-1">
                              {(() => {
                                const orderInfo = getStatusMeta(lead.order.status);
                                return (
                                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider w-fit ${orderInfo.color}`}>
                                    <span aria-hidden>{orderInfo.emoji}</span>
                                    {statusLabel(lead.order.status)}
                                  </span>
                                );
                              })()}
                              {lead.coliatyPackageCode && (
                                <span className="text-[9px] font-mono font-bold text-gray-400">{lead.coliatyPackageCode}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">{tc('table.noParcel')}</span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5 text-[10px] font-black text-gray-500">
                            <span className="flex items-center gap-1" title={tv('table.claimedTimes', { count: lead.claims ?? 0 })}>
                              <MousePointerClick className="w-3 h-3 text-cyan-500" /> {lead.claims ?? 0}
                            </span>
                            <span className="flex items-center gap-1" title={tc('card.whatsappTitle')}>
                              <MessageCircle className="w-3 h-3 text-emerald-500" /> {clicks.whatsapp}
                            </span>
                            <span className="flex items-center gap-1" title={tc('card.callsTitle')}>
                              <PhoneCall className="w-3 h-3 text-blue-500" /> {clicks.call}
                            </span>
                          </div>
                          {lead.lastClaimedAt && (
                            <p className="text-[9px] font-medium text-gray-400 mt-1">
                              {tv('table.claimedAt', { date: format(new Date(lead.lastClaimedAt), 'dd/MM HH:mm') })}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-col text-[11px] text-gray-500 font-medium">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(lead.createdAt), 'dd MMM yyyy')}
                            </span>
                            <span className="flex items-center gap-1 mt-0.5 opacity-60">
                              <Clock className="w-3 h-3" />
                              {format(new Date(lead.createdAt), 'HH:mm')}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-4">
                          <button
                            onClick={() => setExpandedLead(isOpen ? null : lead.id)}
                            className={`p-1.5 rounded-lg border transition-all ${
                              isOpen ? 'bg-cyan-50 border-cyan-200 text-cyan-600' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                            }`}
                            title={tc('history.title')}
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          </button>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="bg-gray-50/60">
                          <td colSpan={8} className="px-5 py-4">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                              <div className="lg:col-span-2">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                  <History className="w-3 h-3" /> {tc('history.title')}
                                </h4>
                                {(lead.statusHistory || []).length === 0 ? (
                                  <p className="text-[11px] font-medium text-gray-400 italic">{tc('history.empty')}</p>
                                ) : (
                                  <div className="space-y-2">
                                    {lead.statusHistory.map((h: any) => {
                                      const from = getStatusMeta(h.oldStatus);
                                      const to = getStatusMeta(h.newStatus);
                                      return (
                                        <div key={h.id} className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 px-3 py-2">
                                          <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${h.byThisAgent ? 'bg-cyan-500' : 'bg-gray-300'}`} />
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${from.color}`}>{from.emoji} {statusLabel(h.oldStatus)}</span>
                                              <span className="text-gray-300 text-xs rtl:rotate-180">→</span>
                                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${to.color}`}>{to.emoji} {statusLabel(h.newStatus)}</span>
                                            </div>
                                            {h.notes && <p className="text-[11px] text-gray-500 font-medium mt-1">{h.notes}</p>}
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-1">
                                              {h.changedBy}{h.byThisAgent ? ` ${tc('history.thisAgent')}` : ''} · {fmtDateTime(h.createdAt)}
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              <div>
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{tc('history.details')}</h4>
                                <dl className="space-y-1.5 text-[11px]">
                                  {[
                                    [tc('history.address'), lead.address || '—'],
                                    [tc('history.source'), lead.source || '—'],
                                    [tc('history.payment'), lead.paymentSituation ? paymentSituationLabel(lead.paymentSituation) : '—'],
                                    [tc('history.order'), lead.order?.orderNumber || '—'],
                                    [tc('history.callback'), lead.callbackAt ? fmtDateTime(lead.callbackAt) : '—'],
                                    [tc('history.firstClaim'), fmtDateTime(lead.firstClaimedAt)],
                                    [tc('history.lastUpdate'), fmtDateTime(lead.updatedAt)],
                                  ].map(([label, value]) => (
                                    <div key={label as string} className="flex justify-between gap-3">
                                      <dt className="font-bold text-gray-400 flex-shrink-0">{label}</dt>
                                      <dd className="font-semibold text-gray-700 text-end break-words">{value}</dd>
                                    </div>
                                  ))}
                                </dl>
                                {lead.notes && (
                                  <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-2.5">
                                    <p className="text-[9px] font-black text-amber-600 uppercase tracking-wider mb-1">{tc('history.agentNote')}</p>
                                    <p className="text-[11px] font-medium text-amber-800">{lead.notes}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="px-6 py-5 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
              {tv('table.page', { page: pagination.page, total: pagination.totalPages, count: pagination.total })}
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-all shadow-sm"
              >
                <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
              </button>
              <div className="flex items-center gap-1">
                {(() => {
                  // Window of up to 5 page buttons that stays inside
                  // [1, totalPages] at both ends.
                  const totalPages = pagination.totalPages;
                  const size = Math.min(5, totalPages);
                  const first = Math.max(1, Math.min(page - 2, totalPages - size + 1));
                  return Array.from({ length: size }).map((_, i) => {
                    const pageNum = first + i;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all shadow-sm ${
                          page === pageNum
                            ? 'bg-cyan-500 text-white shadow-cyan-200 border-cyan-500'
                            : 'bg-white border border-gray-200 text-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  });
                })()}
              </div>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-all shadow-sm"
              >
                <ChevronRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
