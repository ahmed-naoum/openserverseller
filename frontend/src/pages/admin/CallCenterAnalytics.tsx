import { useEffect, useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Activity, AlertTriangle, ArrowLeftRight, ArrowUpDown, BarChart3,
  CalendarDays, CheckCircle2, ChevronRight, Download, GitCompareArrows,
  Headphones, Inbox, Layers, PackageCheck, RefreshCw, Repeat, Scale,
  ShieldAlert, ShieldCheck, Target, TrendingUp, Truck, Users, X,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, Cell,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ReferenceLine, ScatterChart, Scatter, PieChart, Pie,
} from 'recharts';
import { adminApi } from '../../lib/api';
import { pct, fmtPct, fmtNum } from '../../lib/agentPeriod';
import { actionMeta } from '../../lib/agentStatusMeta';
import { getStatusMeta, normalizeStatus } from '../../lib/leadStatusCatalog';

/* ============================================================= data shapes */

interface BucketRow {
  key: string;
  portfolio: number;
  agentArrival: number;
  agentAction: number;
  delta: number;
}

interface AgentRow {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  portfolio: {
    total: number;
    statusBreakdown: Record<string, number>;
    metrics: {
      total: number; treated: number; open: number; lost: number;
      confirmed: number; delivered: number; deliveryFailed: number;
      inTransit: number; confirmationRate: number; deliveryRate: number;
      lossRate: number; unknownStatuses: string[]; unknown: number;
    };
  };
  work: {
    totalActions: number; leadsWorked: number; claimed: number;
    byAction: Record<string, number>; byLead: Record<string, number>;
    byLastAction: Record<string, number>;
    confirmedTotal: number; treated: number; pipeline: number;
    confirmationRate: number;
  };
  workByArrival: {
    totalActions: number; leadsWorked: number; claimed: number;
    byLastAction: Record<string, number>;
    confirmedTotal: number; treated: number; pipeline: number;
    confirmationRate: number;
  };
  reconciliation: {
    agree: number; conflictTotal: number; assignedNotWorked: number;
    workedNotAssigned: number; backInPool: number; heldByOther: number;
    union: number; matchRate: number;
    conflicts: { from: string; to: string; count: number }[];
    holders: { holderId: number; holderName: string; count: number }[];
    buckets: BucketRow[];
    samples: {
      assignedNotWorked: { id: number; name: string | null; city: string | null; status: string; createdAt: string }[];
      workedNotAssigned: { id: number; name: string | null; city: string | null; lastAction: string; status: string | null; holderId: number | null; holderName: string | null }[];
      conflicts: { id: number; name: string | null; city: string | null; lastAction: string; status: string }[];
    };
  };
  parcels: {
    total: number; byStatus: Record<string, number>;
    delivered: number; failed: number; inTransit: number;
    revenueTotal: number; revenueDelivered: number;
    agentDeliveryRate: number; adminDeliveryRate: number;
    desync: number; pendingPairs: number;
    desyncSamples: { id: number; name: string | null; orderNumber: string; leadStatus: string; orderStatus: string }[];
  };
}

interface Totals {
  agents: number; activeAgents: number;
  portfolioTotal: number; leadsWorked: number; leadsWorkedAction: number;
  totalActions: number;
  agree: number; conflictTotal: number; assignedNotWorked: number;
  backInPool: number; heldByOther: number; union: number; matchRate: number;
  adminConfirmed: number; adminTreated: number; adminConfirmationRate: number;
  agentConfirmed: number; agentTreated: number; agentConfirmationRate: number;
  parcelsTotal: number; delivered: number; failed: number;
  revenueDelivered: number; desync: number;
  buckets: BucketRow[];
}

interface DailyRow {
  date: string; actions: number; claims: number; confirmations: number;
  leadsIn: number; parcelsCreated: number; delivered: number;
}

/* ================================================== statistics, in the open */

/**
 * Wilson 95% score interval for a proportion, in percent. Chosen over the
 * naïve ±1.96·√(p(1−p)/n) because agents with 5 treated leads exist, and the
 * normal approximation puts absurd bounds (negative, >100) on small n while
 * Wilson stays inside [0, 100] and stays honest about the uncertainty.
 */
const wilson = (k: number, n: number, z = 1.96): { low: number; high: number } => {
  if (n <= 0) return { low: 0, high: 0 };
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return {
    low: Math.max(0, (center - margin) * 100),
    high: Math.min(100, (center + margin) * 100),
  };
};

/**
 * Two-proportion z-statistic (pooled). Used to flag agents whose confirmation
 * rate differs from the rest of the roster beyond what chance explains at 95%
 * (|z| > 1.96). Returns 0 when a side has no data.
 */
const twoPropZ = (k1: number, n1: number, k2: number, n2: number): number => {
  if (n1 <= 0 || n2 <= 0) return 0;
  const p1 = k1 / n1;
  const p2 = k2 / n2;
  const p = (k1 + k2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  return se > 0 ? (p1 - p2) / se : 0;
};

/** Minimum treated leads before a significance verdict is worth printing. */
const MIN_N_FOR_SIGNIFICANCE = 20;

/* ============================================================== small bits */

const iso = (d: Date) => format(d, 'yyyy-MM-dd');

const DATE_PRESETS = [
  { key: "Aujourd'hui", days: 0 },
  { key: '7 jours', days: 6 },
  { key: '30 jours', days: 29 },
  { key: '90 jours', days: 89 },
];

/** `2026-08-18` → `18/08` for chart axes. */
const fmtDayShort = (key: string) => {
  const [, m, d] = String(key).split('-');
  return d && m ? `${d}/${m}` : String(key);
};

/** Comparison-bucket display meta — the agent palette, plus OTHER in grey. */
const bucketMeta = (key: string) =>
  key === 'OTHER'
    ? { key, emoji: '📁', label: 'AUTRES STATUTS', color: '#94a3b8' }
    : actionMeta(key);

const CAUSES = [
  {
    key: 'agree', label: 'Concordants', color: '#10b981',
    hint: 'Même lecture des deux côtés : le statut actuel du lead correspond au dernier résultat enregistré par l’agent.',
  },
  {
    key: 'conflictTotal', label: 'Statut modifié après l’agent', color: '#f59e0b',
    hint: 'Le lead est toujours chez l’agent, mais son statut actuel ne correspond plus au dernier résultat de l’agent — webhook Coliaty, admin ou vendeur est passé derrière.',
  },
  {
    key: 'assignedNotWorked', label: 'Assignés jamais traités', color: '#ef4444',
    hint: 'Comptés par l’admin (lead assigné) mais invisibles côté agent : aucun changement de statut enregistré par cet agent sur ce lead.',
  },
  {
    key: 'backInPool', label: 'Rendus au pool', color: '#8b5cf6',
    hint: 'Travaillés par l’agent puis désassignés par le cron — l’agent garde son travail dans ses statistiques, l’admin ne les compte plus.',
  },
  {
    key: 'heldByOther', label: 'Repris par un autre', color: '#06b6d4',
    hint: 'Travaillés par l’agent, mais aujourd’hui assignés à un autre agent (réclamation forcée ou réassignation).',
  },
] as const;

function Kpi({ icon, label, value, sub, tone }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; tone: string;
}) {
  return (
    <div className={`px-3.5 py-3 rounded-2xl border shadow-sm ${tone}`}>
      <div className="w-8 h-8 rounded-xl bg-white/60 flex items-center justify-center mb-2">{icon}</div>
      <p className="text-xl font-black text-gray-900 leading-none tabular-nums">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-wider text-gray-600 mt-1.5 leading-tight">{label}</p>
      {sub && <p className="text-[9px] font-semibold text-gray-400 leading-tight mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle, right }: {
  icon: React.ReactNode; title: string; subtitle?: string; right?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
      <div>
        <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {subtitle && (
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {right}
    </header>
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

function StatusChip({ status }: { status: string | null | undefined }) {
  const meta = getStatusMeta(status);
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${meta.color}`}>
      <span aria-hidden>{meta.emoji}</span>
      {normalizeStatus(status)}
    </span>
  );
}

/* ==================================================================== page */

type SortKey =
  | 'portfolio' | 'worked' | 'delta' | 'matchRate'
  | 'confAdmin' | 'confAgent' | 'desync' | 'name';

export default function CallCenterAnalytics() {
  const [startDate, setStartDate] = useState(() => iso(new Date(Date.now() - 29 * 86400000)));
  const [endDate, setEndDate] = useState(() => iso(new Date()));
  const [sortBy, setSortBy] = useState<SortKey>('portfolio');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['call-center-analytics', startDate, endDate],
    queryFn: () => adminApi.getCallCenterAnalytics({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  const payload = data?.data?.data;
  const agents: AgentRow[] = payload?.agents || [];
  const totals: Totals | null = payload?.totals || null;
  const daily: DailyRow[] = payload?.daily || [];
  const truncated = payload?.truncated || { leads: false, history: false, parcels: false };

  // Keep a valid selection: default to the busiest agent, drop a selection
  // that leaves the roster (e.g. after a date change empties an agent out).
  useEffect(() => {
    if (agents.length === 0) {
      setSelectedId(null);
      return;
    }
    if (selectedId === null || !agents.some((a) => a.id === selectedId)) {
      setSelectedId(agents[0].id);
    }
  }, [agents, selectedId]);

  const selected = useMemo(
    () => agents.find((a) => a.id === selectedId) || null,
    [agents, selectedId]
  );

  /* ------------------------------------------------------------- sorting */
  const sortedAgents = useMemo(() => {
    const value = (a: AgentRow): number => {
      switch (sortBy) {
        case 'worked': return a.workByArrival.leadsWorked;
        case 'delta': return Math.abs(a.portfolio.total - a.workByArrival.leadsWorked);
        case 'matchRate': return a.reconciliation.matchRate;
        case 'confAdmin': return a.portfolio.metrics.confirmationRate;
        case 'confAgent': return a.work.confirmationRate;
        case 'desync': return a.parcels.desync;
        default: return a.portfolio.total;
      }
    };
    return [...agents].sort((a, b) =>
      sortBy === 'name'
        ? (a.fullName || '').localeCompare(b.fullName || '')
        : value(b) - value(a));
  }, [agents, sortBy]);

  /* ---------------------------------------------------- derived chart data */
  const scatterData = useMemo(
    () => agents
      .filter((a) => a.portfolio.metrics.treated > 0 || a.work.treated > 0)
      .map((a) => ({
        name: a.fullName,
        x: a.portfolio.metrics.confirmationRate,
        y: a.work.confirmationRate,
        z: Math.max(4, a.portfolio.total),
        treatedAdmin: a.portfolio.metrics.treated,
        treatedAgent: a.work.treated,
      })),
    [agents]
  );

  const comparisonBars = useMemo(
    () => sortedAgents.slice(0, 12).map((a) => ({
      name: (a.fullName || '').split(' ')[0] || `#${a.id}`,
      fullName: a.fullName,
      'Vue Admin': a.portfolio.total,
      'Vue Agent': a.workByArrival.leadsWorked,
      Concordants: a.reconciliation.agree,
    })),
    [sortedAgents]
  );

  const matchPie = useMemo(() => {
    if (!totals) return [];
    return CAUSES
      .map((c) => ({ name: c.label, value: totals[c.key as keyof Totals] as number, color: c.color }))
      .filter((s) => s.value > 0);
  }, [totals]);

  const dailyChart = useMemo(() => {
    return daily.map((d, i, arr) => {
      const from = Math.max(0, i - 6);
      const slice = arr.slice(from, i + 1);
      const ma7 = slice.reduce((s, x) => s + x.actions, 0) / slice.length;
      return { ...d, label: fmtDayShort(d.date), ma7: Number(ma7.toFixed(1)) };
    });
  }, [daily]);

  // Waterfall: Vue Admin → Vue Agent, every step a named cause. Built on the
  // exact identity the backend guarantees:
  //   agent = admin − jamaisTraités + rendusPool + reprisParAutre
  const waterfall = useMemo(() => {
    if (!selected) return [];
    const r = selected.reconciliation;
    const P = selected.portfolio.total;
    const afterNotWorked = P - r.assignedNotWorked;
    return [
      { name: 'Vue Admin', base: 0, value: P, color: '#0891b2' },
      { name: 'Jamais traités', base: afterNotWorked, value: r.assignedNotWorked, color: '#ef4444' },
      { name: 'Rendus au pool', base: afterNotWorked, value: r.backInPool, color: '#8b5cf6' },
      { name: 'Repris par un autre', base: afterNotWorked + r.backInPool, value: r.heldByOther, color: '#06b6d4' },
      { name: 'Vue Agent', base: 0, value: selected.workByArrival.leadsWorked, color: '#10b981' },
    ];
  }, [selected]);

  const selectedBuckets = useMemo(() => {
    if (!selected) return [];
    return selected.reconciliation.buckets.map((b) => {
      const meta = bucketMeta(b.key);
      return {
        ...b,
        label: meta.label,
        emoji: meta.emoji,
        color: meta.color,
      };
    });
  }, [selected]);

  const parcelRows = useMemo(() => {
    if (!selected) return [];
    return Object.entries(selected.parcels.byStatus)
      .map(([status, count]) => ({ status, count: Number(count) }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [selected]);

  /* ------------------------------------------------------- global findings */
  const findings = useMemo(() => {
    if (!totals) return [];
    const out: { severity: 'ok' | 'warn' | 'error'; text: string }[] = [];
    if (totals.assignedNotWorked > 0) {
      out.push({
        severity: 'warn',
        text: `${fmtNum(totals.assignedNotWorked)} leads assignés sans aucune action de leur agent — comptés dans la vue admin, absents des statistiques agent.`,
      });
    }
    if (totals.backInPool > 0) {
      out.push({
        severity: 'warn',
        text: `${fmtNum(totals.backInPool)} leads travaillés puis rendus au pool par le cron — l'agent les garde dans ses chiffres, l'admin ne les voit plus.`,
      });
    }
    if (totals.heldByOther > 0) {
      out.push({
        severity: 'warn',
        text: `${fmtNum(totals.heldByOther)} leads travaillés par un agent mais assignés aujourd'hui à un autre — comptés deux fois selon l'écran regardé.`,
      });
    }
    if (totals.conflictTotal > 0) {
      out.push({
        severity: 'warn',
        text: `${fmtNum(totals.conflictTotal)} leads dont le statut actuel ne correspond plus au dernier résultat de l'agent (webhook livreur, modification admin/vendeur).`,
      });
    }
    if (totals.desync > 0) {
      out.push({
        severity: 'error',
        text: `${fmtNum(totals.desync)} colis désynchronisés : le statut du lead ne reflète plus celui de la commande — chiffres de livraison suspects, à vérifier lead par lead ci-dessous.`,
      });
    }
    const unknown = agents.reduce((s, a) => s + a.portfolio.metrics.unknown, 0);
    if (unknown > 0) {
      out.push({
        severity: 'warn',
        text: `${fmtNum(unknown)} leads portent un statut hors catalogue (code transporteur non mappé ou valeur héritée) — ils tombent dans « AUTRES ».`,
      });
    }
    if (truncated.leads || truncated.history || truncated.parcels) {
      out.push({
        severity: 'error',
        text: 'Période trop large : la lecture a atteint son plafond serveur, certains totaux sont partiels. Réduisez la fenêtre pour des chiffres exacts.',
      });
    }
    if (out.length === 0) {
      out.push({
        severity: 'ok',
        text: 'Aucune divergence sur cette période : la vue admin et la vue agent racontent la même histoire, lead pour lead.',
      });
    }
    return out;
  }, [totals, agents, truncated]);

  /* ------------------------------------------------------------ csv export */
  const exportCsv = () => {
    const header = [
      'Agent', 'Email', 'Actif',
      'Vue admin (leads)', 'Vue agent (même fenêtre)', 'Vue agent (date action)',
      'Écart', 'Concordants', 'Taux concordance %',
      'Assignés jamais traités', 'Rendus au pool', 'Repris par un autre', 'Statut modifié après agent',
      'Confirmés (admin)', 'Traités (admin)', 'Taux conf. admin %',
      'Confirmés (agent)', 'Traités (agent)', 'Taux conf. agent %',
      'IC95 bas %', 'IC95 haut %',
      'Colis', 'Livrés', 'Taux livraison agent %', 'Taux livraison admin %',
      'Colis désynchronisés', 'CA livré (MAD)',
    ];
    const lines = sortedAgents.map((a) => {
      const ci = wilson(a.work.confirmedTotal, a.work.treated);
      return [
        a.fullName, a.email, a.isActive ? 'oui' : 'non',
        a.portfolio.total, a.workByArrival.leadsWorked, a.work.leadsWorked,
        a.portfolio.total - a.workByArrival.leadsWorked,
        a.reconciliation.agree, a.reconciliation.matchRate,
        a.reconciliation.assignedNotWorked, a.reconciliation.backInPool,
        a.reconciliation.heldByOther, a.reconciliation.conflictTotal,
        a.portfolio.metrics.confirmed, a.portfolio.metrics.treated, a.portfolio.metrics.confirmationRate,
        a.work.confirmedTotal, a.work.treated, a.work.confirmationRate,
        ci.low.toFixed(1), ci.high.toFixed(1),
        a.parcels.total, a.parcels.delivered,
        a.parcels.agentDeliveryRate, a.parcels.adminDeliveryRate,
        a.parcels.desync, a.parcels.revenueDelivered,
      ];
    });
    const escape = (v: unknown) => {
      const s = String(v ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    // BOM + semicolons so Excel (fr) opens it in columns with accents intact.
    const csv = '﻿' + [header, ...lines]
      .map((row) => row.map(escape).join(';'))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `call-center-reconciliation_${startDate || 'debut'}_${endDate || 'fin'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /* --------------------------------------------------------------- render */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-cyan-100 border-t-cyan-500 rounded-full animate-spin" />
          <Scale className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-500 animate-pulse" />
        </div>
      </div>
    );
  }

  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(iso(start));
    setEndDate(iso(end));
  };

  const rosterConfZ = totals
    ? twoPropZ(
      totals.agentConfirmed, totals.agentTreated,
      totals.adminConfirmed, totals.adminTreated,
    )
    : 0;

  return (
    <div className="space-y-6">
      {/* -------------------------------------------------------------- Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 text-white shadow-2xl">
        <div className="absolute top-0 end-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 start-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl translate-y-1/2" />
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-cyan-300 text-xs font-bold mb-4 backdrop-blur-sm">
                <GitCompareArrows className="w-3.5 h-3.5" /> Réconciliation Admin ⇄ Agents
              </div>
              <h1 className="text-3xl font-black tracking-tight leading-none mb-2">Analytics Call Center</h1>
              <p className="text-base text-white/60 font-medium max-w-3xl">
                Les deux lectures — l'inspecteur admin (leads actuellement assignés) et les
                statistiques agent (actions enregistrées) — calculées au même instant, sur la
                même période, avec chaque écart décomposé en causes vérifiables.
              </p>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-white/20 transition-all disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Calcul…' : 'Actualiser'}
            </button>
          </div>

          {totals && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
              {[
                { label: 'Agents actifs', value: `${totals.activeAgents}/${totals.agents}`, icon: Headphones },
                { label: 'Vue admin (leads)', value: fmtNum(totals.portfolioTotal), icon: Users },
                { label: 'Vue agent (travaillés)', value: fmtNum(totals.leadsWorked), icon: Activity },
                { label: 'Concordants', value: fmtNum(totals.agree), icon: CheckCircle2 },
                { label: 'Taux de concordance', value: `${fmtPct(totals.matchRate)}%`, icon: Scale },
                { label: 'Colis désynchronisés', value: fmtNum(totals.desync), icon: ShieldAlert },
              ].map((s) => (
                <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-sm">
                  <s.icon className="w-4 h-4 text-cyan-400 mb-1.5" />
                  <p className="text-xl font-black leading-none tabular-nums">{s.value}</p>
                  <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}
          {dataUpdatedAt > 0 && (
            <p className="text-[10px] font-semibold text-white/30 mt-3">
              Instantané calculé le {format(new Date(dataUpdatedAt), 'dd/MM/yyyy à HH:mm:ss')} —
              les deux vues lisent la même base au même moment, aucun décalage de cache possible.
            </p>
          )}
        </div>
      </div>

      {/* --------------------------------------------------------- Findings */}
      <div className="grid grid-cols-1 gap-2">
        {findings.map((f, i) => (
          <div
            key={i}
            className={`flex items-start gap-2.5 px-4 py-3 rounded-2xl border ${
              f.severity === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : f.severity === 'error'
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            {f.severity === 'ok'
              ? <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
            <p className="text-[11px] font-bold leading-relaxed">{f.text}</p>
          </div>
        ))}
      </div>

      {/* ---------------------------------------------------------- Date bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 flex-shrink-0">
            <CalendarDays className="w-4 h-4 text-cyan-500" /> Période
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.days)}
                className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 text-[10px] font-black uppercase tracking-wider border border-gray-200 hover:bg-cyan-50 hover:text-cyan-600 hover:border-cyan-200 transition-all"
              >
                {p.key}
              </button>
            ))}
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 text-[10px] font-black uppercase tracking-wider border border-gray-200 hover:bg-cyan-50 hover:text-cyan-600 hover:border-cyan-200 transition-all"
            >
              Tout l'historique
            </button>
          </div>
          <div className="flex items-center gap-2 lg:ms-auto">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all w-[150px]"
            />
            <span className="text-xs font-bold text-gray-300">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all w-[150px]"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-red-100 transition-all border border-red-100"
              >
                <X className="w-3 h-3" /> Effacer
              </button>
            )}
          </div>
        </div>
        <p className="text-[10px] font-medium text-gray-400 mt-2.5 leading-relaxed">
          La fenêtre s'applique à la <b>date d'arrivée du lead</b> pour les deux vues (seule base
          comparable 1:1), aux <b>dates d'action</b> pour la colonne « page stats agent », et à la
          <b> date de création du colis</b> pour la livraison — exactement comme chaque écran d'origine.
        </p>
      </div>

      {/* --------------------------------------------------- Causes legend */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {CAUSES.map((c) => (
            <span key={c.key} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500" title={c.hint}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
              {c.label}
              {totals && (
                <span className="text-gray-900 font-black tabular-nums">
                  {fmtNum(totals[c.key as keyof Totals] as number)}
                </span>
              )}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 ms-auto">
            <Target className="w-3 h-3" />
            Identité vérifiée : vue agent = vue admin − jamais traités + rendus pool + repris
          </span>
        </div>
      </div>

      {/* -------------------------------------------------- Roster table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-cyan-500" />
            Concordance par agent
            <span className="text-gray-400 font-medium">({agents.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-cyan-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
            >
              <option value="portfolio">Tri : vue admin</option>
              <option value="worked">Tri : vue agent</option>
              <option value="delta">Tri : écart</option>
              <option value="matchRate">Tri : concordance</option>
              <option value="confAdmin">Tri : taux conf. admin</option>
              <option value="confAgent">Tri : taux conf. agent</option>
              <option value="desync">Tri : colis désync.</option>
              <option value="name">Tri : nom</option>
            </select>
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-700 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[1080px]">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                {[
                  { h: 'Agent' },
                  { h: 'Vue admin', hint: 'Leads actuellement assignés, arrivés dans la fenêtre — le chiffre de /admin/call-center-inspector.' },
                  { h: 'Vue agent', hint: 'Leads distincts sur lesquels cet agent a enregistré au moins une action (même fenêtre d’arrivée) — la base des statistiques agent.' },
                  { h: 'Écart', hint: 'Vue admin − vue agent. Chaque unité d’écart est classée dans une des causes à droite.' },
                  { h: 'Concordance', hint: 'Part des leads (union des deux vues) où le statut actuel = dernier résultat de l’agent.' },
                  { h: 'Causes', hint: 'Jamais traités / rendus au pool / repris par un autre / statut modifié après l’agent.' },
                  { h: 'Conf. admin', hint: 'Taux de confirmation de l’inspecteur : famille confirmée ÷ traités (statut actuel).' },
                  { h: 'Conf. agent · IC 95%', hint: 'Taux de la page statistiques agent (dernière action, fenêtre par date d’action) avec intervalle de confiance de Wilson à 95%.' },
                  { h: 'Colis', hint: 'Colis de la fenêtre : livrés/total (formule agent) et désynchronisations lead⇄commande.' },
                  { h: '' },
                ].map((c) => (
                  <th key={c.h} title={c.hint} className="px-4 py-3 text-start text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                    {c.h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedAgents.map((a) => {
                const delta = a.portfolio.total - a.workByArrival.leadsWorked;
                const ci = wilson(a.work.confirmedTotal, a.work.treated);
                const restConfirmed = (totals?.agentConfirmed || 0) - a.work.confirmedTotal;
                const restTreated = (totals?.agentTreated || 0) - a.work.treated;
                const z = twoPropZ(a.work.confirmedTotal, a.work.treated, restConfirmed, restTreated);
                const significant = a.work.treated >= MIN_N_FOR_SIGNIFICANCE
                  && restTreated >= MIN_N_FOR_SIGNIFICANCE
                  && Math.abs(z) > 1.96;
                const isSelected = a.id === selectedId;
                return (
                  <tr
                    key={a.id}
                    onClick={() => setSelectedId(a.id)}
                    className={`border-b border-gray-50 cursor-pointer transition-colors ${
                      isSelected ? 'bg-cyan-50/60' : 'hover:bg-gray-50/60'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0 ${
                          a.isActive ? 'bg-gradient-to-br from-cyan-500 to-blue-600' : 'bg-gradient-to-br from-gray-400 to-gray-500'
                        }`}>
                          {a.fullName?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-gray-900 truncate max-w-[140px]">{a.fullName}</p>
                          <p className="text-[9px] font-semibold text-gray-400 truncate max-w-[140px]">{a.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-black text-gray-900 tabular-nums">{fmtNum(a.portfolio.total)}</td>
                    <td className="px-4 py-3 text-sm font-black text-gray-900 tabular-nums">{fmtNum(a.workByArrival.leadsWorked)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-black tabular-nums ${
                        delta === 0 ? 'text-emerald-600' : delta > 0 ? 'text-amber-600' : 'text-violet-600'
                      }`}>
                        {delta > 0 ? `+${fmtNum(delta)}` : fmtNum(delta)}
                      </span>
                    </td>
                    <td className="px-4 py-3 min-w-[130px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              a.reconciliation.matchRate >= 90 ? 'bg-emerald-500'
                                : a.reconciliation.matchRate >= 70 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, a.reconciliation.matchRate)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-black text-gray-700 tabular-nums w-11 text-end">
                          {fmtPct(a.reconciliation.matchRate)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {[
                          { v: a.reconciliation.assignedNotWorked, c: CAUSES[2] },
                          { v: a.reconciliation.backInPool, c: CAUSES[3] },
                          { v: a.reconciliation.heldByOther, c: CAUSES[4] },
                          { v: a.reconciliation.conflictTotal, c: CAUSES[1] },
                        ].map(({ v, c }) => (
                          <span
                            key={c.key}
                            title={`${c.label} : ${v}`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums"
                            style={{ backgroundColor: `${c.color}1a`, color: c.color }}
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-black text-cyan-700 tabular-nums">
                        {fmtPct(a.portfolio.metrics.confirmationRate)}%
                      </span>
                      <p className="text-[9px] font-semibold text-gray-400 tabular-nums">
                        {a.portfolio.metrics.confirmed}/{a.portfolio.metrics.treated}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-emerald-700 tabular-nums">
                          {fmtPct(a.work.confirmationRate)}%
                        </span>
                        {significant && (
                          <span
                            title={`z = ${z.toFixed(2)} vs reste de l'équipe — écart significatif à 95%`}
                            className={`text-[9px] font-black px-1 py-0.5 rounded ${
                              z > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                            }`}
                          >
                            {z > 0 ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] font-semibold text-gray-400 tabular-nums">
                        {a.work.treated >= 1
                          ? `IC [${fmtPct(ci.low)}–${fmtPct(ci.high)}] · n=${a.work.treated}`
                          : 'aucun lead traité'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-black text-gray-800 tabular-nums">
                        {a.parcels.delivered}/{a.parcels.total}
                      </span>
                      {a.parcels.desync > 0 && (
                        <span
                          className="ms-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-red-100 text-red-600 tabular-nums"
                          title={`${a.parcels.desync} colis dont lead.status ≠ order.status`}
                        >
                          {a.parcels.desync} désync
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-cyan-500' : ''}`} />
                    </td>
                  </tr>
                );
              })}
              {sortedAgents.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <EmptyBlock label="Aucun agent call-center" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------ Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-stretch">
        <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <SectionTitle
            icon={<Target className="w-4 h-4 text-cyan-500" />}
            title="Taux de confirmation : admin vs agent"
            subtitle="Chaque point est un agent · la diagonale = accord parfait des deux écrans"
          />
          {scatterData.length > 0 ? (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 8, right: 12, left: -10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    type="number" dataKey="x" name="Vue admin" unit="%" domain={[0, 100]}
                    tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                    label={{ value: 'Taux admin (%)', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#94a3b8' }}
                  />
                  <YAxis
                    type="number" dataKey="y" name="Vue agent" unit="%" domain={[0, 100]}
                    tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                    label={{ value: 'Taux agent (%)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }}
                  />
                  <ZAxis type="number" dataKey="z" range={[40, 400]} />
                  <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke="#cbd5e1" strokeDasharray="6 4" />
                  <RechartsTooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      return (
                        <div className="bg-white p-3 rounded-2xl shadow-xl border border-gray-100 text-[10px] font-bold text-gray-600">
                          <p className="text-[11px] font-black text-gray-900 mb-1">{p.name}</p>
                          <p>Admin : <b className="text-cyan-700">{fmtPct(p.x)}%</b> ({p.treatedAdmin} traités)</p>
                          <p>Agent : <b className="text-emerald-700">{fmtPct(p.y)}%</b> ({p.treatedAgent} traités)</p>
                          <p className="text-gray-400 mt-1">Écart : {fmtPct(Math.abs(p.x - p.y))} points</p>
                        </div>
                      );
                    }}
                  />
                  <Scatter data={scatterData} fill="#0891b2" fillOpacity={0.75} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyBlock label="Aucune donnée sur cette période" />
          )}
          {totals && (
            <p className="text-[10px] font-semibold text-gray-400 mt-2 leading-relaxed">
              Global : admin <b className="text-cyan-700">{fmtPct(totals.adminConfirmationRate)}%</b> vs
              agent <b className="text-emerald-700">{fmtPct(totals.agentConfirmationRate)}%</b>
              {totals.adminTreated >= MIN_N_FOR_SIGNIFICANCE && totals.agentTreated >= MIN_N_FOR_SIGNIFICANCE && (
                <> — {Math.abs(rosterConfZ) > 1.96
                  ? `écart statistiquement significatif (z = ${rosterConfZ.toFixed(2)}) : les deux écrans ne mesurent pas la même chose (fenêtres et dénominateurs différents), voir la note de méthodologie.`
                  : `écart compatible avec le hasard (z = ${rosterConfZ.toFixed(2)}).`}</>
              )}
            </p>
          )}
        </section>

        <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <SectionTitle
            icon={<Layers className="w-4 h-4 text-cyan-500" />}
            title="Volume par agent : les deux vues"
            subtitle="Vue admin (assignés) · vue agent (travaillés, même fenêtre) · concordants"
          />
          {comparisonBars.length > 0 ? (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonBars} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    cursor={{ fill: '#f8fafc' }}
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-white p-3 rounded-2xl shadow-xl border border-gray-100 text-[10px] font-bold text-gray-600 min-w-[160px]">
                          <p className="text-[11px] font-black text-gray-900 mb-1">{payload[0].payload.fullName}</p>
                          {payload.map((p: any) => (
                            <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                              <span className="flex-1">{p.dataKey}</span>
                              <b className="text-gray-900 tabular-nums">{p.value}</b>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="Vue Admin" fill="#0891b2" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="Vue Agent" fill="#10b981" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="Concordants" fill="#94a3b8" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyBlock label="Aucune donnée sur cette période" />
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {[
              { label: 'Vue Admin', color: '#0891b2' },
              { label: 'Vue Agent', color: '#10b981' },
              { label: 'Concordants', color: '#94a3b8' },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        </section>
      </div>

      {/* -------------------------------------------- Global decomposition */}
      {totals && totals.union > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-stretch">
          <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <SectionTitle
              icon={<Scale className="w-4 h-4 text-cyan-500" />}
              title="Où vont les écarts"
              subtitle="Union des deux vues, classée par cause"
            />
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={matchPie} dataKey="value" nameKey="name"
                    innerRadius={55} outerRadius={85} paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {matchPie.map((s) => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <RechartsTooltip
                    formatter={(v: any, name: any) => [
                      `${fmtNum(Number(v))} leads (${fmtPct(pct(Number(v), totals.union))}%)`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1 mt-1">
              {matchPie.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="text-gray-900 font-black tabular-nums">{fmtNum(s.value)}</span>
                  <span className="text-gray-400 tabular-nums w-11 text-end">{fmtPct(pct(s.value, totals.union))}%</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm xl:col-span-2">
            <SectionTitle
              icon={<BarChart3 className="w-4 h-4 text-cyan-500" />}
              title="Par résultat : les trois lectures (équipe entière)"
              subtitle="Statut actuel (admin) · dernière action même fenêtre (agent) · dernière action datée par l'action (page stats)"
            />
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={totals.buckets.map((b) => ({
                    ...b,
                    label: bucketMeta(b.key).label.split(' ')[0],
                    fullLabel: bucketMeta(b.key).label,
                  }))}
                  margin={{ top: 4, right: 8, left: -18, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    cursor={{ fill: '#f8fafc' }}
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload;
                      return (
                        <div className="bg-white p-3 rounded-2xl shadow-xl border border-gray-100 text-[10px] font-bold text-gray-600 min-w-[190px]">
                          <p className="text-[11px] font-black text-gray-900 mb-1">
                            {bucketMeta(row.key).emoji} {row.fullLabel}
                          </p>
                          <p>Admin (statut actuel) : <b className="tabular-nums">{row.portfolio}</b></p>
                          <p>Agent (même fenêtre) : <b className="tabular-nums">{row.agentArrival}</b></p>
                          <p>Agent (page stats) : <b className="tabular-nums">{row.agentAction}</b></p>
                          <p className={`mt-1 ${row.delta === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            Écart admin−agent : {row.delta > 0 ? '+' : ''}{row.delta}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="portfolio" name="Admin" fill="#0891b2" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="agentArrival" name="Agent (fenêtre)" fill="#10b981" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="agentAction" name="Agent (page stats)" fill="#a78bfa" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {[
                { label: 'Admin (statut actuel)', color: '#0891b2' },
                { label: 'Agent (même fenêtre)', color: '#10b981' },
                { label: 'Agent (page stats, date action)', color: '#a78bfa' },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ------------------------------------------------ Agent drill-down */}
      {selected && (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-base font-black text-white shadow-lg ${
              selected.isActive
                ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-200/50'
                : 'bg-gradient-to-br from-gray-400 to-gray-500 shadow-gray-200/50'
            }`}>
              {selected.fullName?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-black text-gray-900 tracking-tight truncate">
                Zoom : {selected.fullName}
              </h2>
              <p className="text-xs text-gray-400 font-medium truncate">{selected.email}</p>
            </div>
            <div className="text-end shrink-0">
              <p className={`text-2xl font-black tabular-nums ${
                selected.reconciliation.matchRate >= 90 ? 'text-emerald-600'
                  : selected.reconciliation.matchRate >= 70 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {fmtPct(selected.reconciliation.matchRate)}%
              </p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Concordance</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi icon={<Users className="w-4 h-4 text-cyan-600" />} label="Vue admin"
                 value={fmtNum(selected.portfolio.total)} sub="leads assignés (fenêtre)" tone="bg-cyan-50/70 border-cyan-100" />
            <Kpi icon={<Activity className="w-4 h-4 text-emerald-600" />} label="Vue agent"
                 value={fmtNum(selected.workByArrival.leadsWorked)} sub="leads travaillés (même fenêtre)" tone="bg-emerald-50/70 border-emerald-100" />
            <Kpi icon={<Inbox className="w-4 h-4 text-violet-600" />} label="Page stats agent"
                 value={fmtNum(selected.work.leadsWorked)} sub={`${fmtNum(selected.work.totalActions)} actions (date d'action)`} tone="bg-violet-50/70 border-violet-100" />
            <Kpi icon={<TrendingUp className="w-4 h-4 text-blue-600" />} label="Conf. admin / agent"
                 value={`${fmtPct(selected.portfolio.metrics.confirmationRate)} / ${fmtPct(selected.work.confirmationRate)}%`}
                 sub={`${selected.portfolio.metrics.confirmed}/${selected.portfolio.metrics.treated} · ${selected.work.confirmedTotal}/${selected.work.treated}`}
                 tone="bg-blue-50/70 border-blue-100" />
            <Kpi icon={<PackageCheck className="w-4 h-4 text-indigo-600" />} label="Livraison agent / admin"
                 value={`${fmtPct(selected.parcels.agentDeliveryRate)} / ${fmtPct(selected.parcels.adminDeliveryRate)}%`}
                 sub={`${selected.parcels.delivered} livrés · ${selected.parcels.total} colis · ${selected.parcels.failed} retours`}
                 tone="bg-indigo-50/70 border-indigo-100" />
            <Kpi icon={<Repeat className="w-4 h-4 text-amber-600" />} label="Réclamés"
                 value={fmtNum(selected.work.claimed)} sub="sortis du pool (rendus inclus)" tone="bg-amber-50/70 border-amber-100" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-stretch">
            {/* Waterfall */}
            <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <SectionTitle
                icon={<GitCompareArrows className="w-4 h-4 text-cyan-500" />}
                title="De la vue admin à la vue agent"
                subtitle="Chaque marche est une cause comptée — l'écart est expliqué à 100%"
              />
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waterfall} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      cursor={{ fill: '#f8fafc' }}
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload;
                        return (
                          <div className="bg-white p-3 rounded-2xl shadow-xl border border-gray-100 text-[10px] font-bold text-gray-600">
                            <p className="text-[11px] font-black text-gray-900">{row.name}</p>
                            <p className="tabular-nums">{fmtNum(row.value)} leads</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
                    <Bar dataKey="value" stackId="wf" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                      {waterfall.map((step) => <Cell key={step.name} fill={step.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] font-semibold text-gray-400 mt-2 leading-relaxed">
                {fmtNum(selected.portfolio.total)} (admin) − {fmtNum(selected.reconciliation.assignedNotWorked)} jamais
                traités + {fmtNum(selected.reconciliation.backInPool)} rendus au pool
                + {fmtNum(selected.reconciliation.heldByOther)} repris
                = {fmtNum(selected.workByArrival.leadsWorked)} (agent). Les deux vues partagent
                {' '}{fmtNum(selected.reconciliation.agree + selected.reconciliation.conflictTotal)} leads,
                dont {fmtNum(selected.reconciliation.agree)} au même statut.
              </p>
            </section>

            {/* Per-bucket table */}
            <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <SectionTitle
                icon={<Layers className="w-4 h-4 text-cyan-500" />}
                title="Résultat par résultat"
                subtitle="Le tableau à mettre à côté des deux écrans pour vérifier chaque chiffre"
              />
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full min-w-[460px] text-left">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="pb-2 text-[9px] font-black uppercase tracking-wider text-gray-400">Résultat</th>
                      <th className="pb-2 text-[9px] font-black uppercase tracking-wider text-gray-400 text-right" title="Statut actuel des leads assignés — l'inspecteur admin">Admin</th>
                      <th className="pb-2 text-[9px] font-black uppercase tracking-wider text-gray-400 text-right" title="Dernière action de l'agent, même fenêtre d'arrivée">Agent (fenêtre)</th>
                      <th className="pb-2 text-[9px] font-black uppercase tracking-wider text-gray-400 text-right" title="Dernière action, fenêtre sur la date d'action — la page /agent/statistics">Page stats</th>
                      <th className="pb-2 text-[9px] font-black uppercase tracking-wider text-gray-400 text-right">Écart</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBuckets.map((b) => (
                      <tr key={b.key} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                        <td className="py-2">
                          <span className="flex items-center gap-2">
                            <span className="w-1.5 h-6 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                            <span className="text-[11px] font-bold text-gray-700">{b.emoji} {b.label}</span>
                          </span>
                        </td>
                        <td className="py-2 text-right text-sm font-black text-gray-900 tabular-nums">{b.portfolio}</td>
                        <td className="py-2 text-right text-sm font-black text-gray-900 tabular-nums">{b.agentArrival}</td>
                        <td className="py-2 text-right text-sm font-bold text-gray-500 tabular-nums">{b.agentAction}</td>
                        <td className={`py-2 text-right text-sm font-black tabular-nums ${
                          b.delta === 0 ? 'text-emerald-600' : b.delta > 0 ? 'text-amber-600' : 'text-violet-600'
                        }`}>
                          {b.delta > 0 ? `+${b.delta}` : b.delta}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selected.reconciliation.conflicts.length > 0 && (
                <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">
                    Conflits les plus fréquents (dernier mot de l'agent → statut actuel)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.reconciliation.conflicts.slice(0, 8).map((c) => (
                      <span
                        key={`${c.from}-${c.to}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-wider"
                      >
                        {bucketMeta(c.from).emoji} {c.from} → {bucketMeta(c.to).emoji} {c.to}
                        <span className="opacity-70 tabular-nums">({c.count})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selected.reconciliation.holders.length > 0 && (
                <div className="mt-3">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">
                    Repris par
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.reconciliation.holders.map((h) => (
                      <span key={h.holderId} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-50 border border-cyan-100 text-cyan-700 text-[9px] font-black tracking-wider">
                        {h.holderName} <span className="opacity-70 tabular-nums">({h.count})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Sample tables — the concrete leads behind every delta */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {[
              {
                title: 'Assignés jamais traités',
                hint: 'Dans la vue admin, absents de la vue agent',
                color: '#ef4444',
                count: selected.reconciliation.assignedNotWorked,
                rows: selected.reconciliation.samples.assignedNotWorked.map((s) => ({
                  id: s.id, name: s.name, left: <StatusChip status={s.status} />,
                  right: <span className="text-[9px] font-semibold text-gray-400">{s.city || '—'}</span>,
                })),
              },
              {
                title: 'Travaillés, plus assignés',
                hint: 'Dans la vue agent, absents de la vue admin',
                color: '#8b5cf6',
                count: selected.reconciliation.workedNotAssigned,
                rows: selected.reconciliation.samples.workedNotAssigned.map((s) => ({
                  id: s.id, name: s.name,
                  left: (
                    <span className="flex items-center gap-1">
                      <span className="text-[9px] font-black" style={{ color: bucketMeta(bucketOf(s.lastAction)).color }}>
                        {s.lastAction}
                      </span>
                      <span className="text-gray-300">→</span>
                      <StatusChip status={s.status} />
                    </span>
                  ),
                  right: (
                    <span className="text-[9px] font-semibold text-gray-400">
                      {s.holderName ? `chez ${s.holderName}` : 'au pool'}
                    </span>
                  ),
                })),
              },
              {
                title: 'Statut modifié après l’agent',
                hint: 'Le dernier mot de l’agent ≠ statut actuel',
                color: '#f59e0b',
                count: selected.reconciliation.conflictTotal,
                rows: selected.reconciliation.samples.conflicts.map((s) => ({
                  id: s.id, name: s.name,
                  left: (
                    <span className="flex items-center gap-1">
                      <span className="text-[9px] font-black" style={{ color: bucketMeta(bucketOf(s.lastAction)).color }}>
                        {s.lastAction}
                      </span>
                      <span className="text-gray-300">→</span>
                      <StatusChip status={s.status} />
                    </span>
                  ),
                  right: <span className="text-[9px] font-semibold text-gray-400">{s.city || '—'}</span>,
                })),
              },
            ].map((panel) => (
              <section key={panel.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-black text-gray-800 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: panel.color }} />
                      {panel.title}
                    </h3>
                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">{panel.hint}</p>
                  </div>
                  <span className="text-lg font-black text-gray-900 tabular-nums">{fmtNum(panel.count)}</span>
                </div>
                <div className="divide-y divide-gray-50 max-h-[280px] overflow-y-auto">
                  {panel.rows.length > 0 ? panel.rows.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 px-4 py-2">
                      <span className="text-[10px] font-black text-gray-400 tabular-nums shrink-0 w-14">#{r.id}</span>
                      <span className="text-[11px] font-bold text-gray-700 truncate flex-1">{r.name || '—'}</span>
                      <span className="shrink-0">{r.left}</span>
                      <span className="shrink-0">{r.right}</span>
                    </div>
                  )) : (
                    <p className="px-4 py-6 text-center text-[11px] font-bold text-gray-300">Aucun — parfait</p>
                  )}
                </div>
                {panel.count > panel.rows.length && panel.rows.length > 0 && (
                  <p className="px-4 py-2 text-[9px] font-semibold text-gray-400 border-t border-gray-50">
                    Échantillon de {panel.rows.length} sur {fmtNum(panel.count)} — retrouvez chaque
                    lead par son # dans « Tous les Leads » ou l'inspecteur.
                  </p>
                )}
              </section>
            ))}
          </div>

          {/* Parcels integrity */}
          <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <SectionTitle
              icon={<Truck className="w-4 h-4 text-indigo-500" />}
              title="Livraison : mêmes colis, deux formules"
              subtitle="Formule agent : livrés ÷ tous les colis · formule admin : livrés ÷ colis arrivés au bout"
              right={(
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1.5 text-[11px] font-black rounded-xl border bg-emerald-50 text-emerald-700 border-emerald-100">
                    Agent : {fmtPct(selected.parcels.agentDeliveryRate)}% ({selected.parcels.delivered}/{selected.parcels.total})
                  </span>
                  <span className="px-3 py-1.5 text-[11px] font-black rounded-xl border bg-cyan-50 text-cyan-700 border-cyan-100">
                    Admin : {fmtPct(selected.parcels.adminDeliveryRate)}% ({selected.parcels.delivered}/{selected.parcels.delivered + selected.parcels.failed})
                  </span>
                  <span className="px-3 py-1.5 text-[11px] font-black rounded-xl border bg-slate-50 text-slate-700 border-slate-100">
                    {fmtNum(selected.parcels.revenueDelivered)} MAD livrés
                  </span>
                </div>
              )}
            />
            {selected.parcels.total > 0 ? (
              <>
                <p className="text-[10px] font-semibold text-gray-400 mb-3 leading-relaxed">
                  Les deux pourcentages sont corrects — ils répondent à deux questions différentes.
                  {' '}{fmtNum(selected.parcels.inTransit)} colis encore en route gonflent le dénominateur
                  de la formule agent, pas celui de la formule admin. Ils convergeront quand la tournée sera finie.
                </p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {parcelRows.map((r) => {
                    const meta = getStatusMeta(r.status);
                    return (
                      <span key={r.status} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${meta.color}`}>
                        <span aria-hidden>{meta.emoji}</span>
                        {normalizeStatus(r.status)} <span className="opacity-70 tabular-nums">({r.count})</span>
                      </span>
                    );
                  })}
                </div>
                {selected.parcels.desync > 0 ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
                    <p className="text-[11px] font-black text-red-700 flex items-center gap-2 mb-2">
                      <ShieldAlert className="w-4 h-4" />
                      {fmtNum(selected.parcels.desync)} colis désynchronisés — le statut du lead ne
                      reflète plus celui de la commande (le webhook doit les faire correspondre)
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                      {selected.parcels.desyncSamples.map((s) => (
                        <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-red-100">
                          <span className="text-[10px] font-black text-gray-400 tabular-nums shrink-0">#{s.id}</span>
                          <span className="text-[11px] font-bold text-gray-700 truncate flex-1">{s.name || s.orderNumber}</span>
                          <StatusChip status={s.leadStatus} />
                          <span className="text-gray-300 text-[10px]">≠</span>
                          <StatusChip status={s.orderStatus} />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Tous les statuts lead ⇄ commande correspondent ({fmtNum(selected.parcels.pendingPairs)} colis
                    fraîchement poussés en attente, appariement normal).
                  </p>
                )}
              </>
            ) : (
              <EmptyBlock label="Aucun colis sur cette période" />
            )}
          </section>
        </div>
      )}

      {/* ----------------------------------------------------- Daily chart */}
      <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <SectionTitle
          icon={<Activity className="w-4 h-4 text-cyan-500" />}
          title="Activité quotidienne de l'équipe"
          subtitle="Actions des agents · confirmations · colis créés · colis livrés · moyenne mobile 7 j"
        />
        {dailyChart.length > 0 ? (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyChart} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <RechartsTooltip
                  cursor={{ fill: '#f8fafc' }}
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as DailyRow & { ma7: number };
                    return (
                      <div className="bg-white p-3 rounded-2xl shadow-xl border border-gray-100 text-[10px] font-bold text-gray-600 min-w-[180px]">
                        <p className="text-[11px] font-black text-gray-900 mb-1">{label}</p>
                        <p>Actions agents : <b className="tabular-nums">{row.actions}</b> (moy. 7j : {row.ma7})</p>
                        <p>Réclamations : <b className="tabular-nums">{row.claims}</b></p>
                        <p>Confirmations : <b className="tabular-nums">{row.confirmations}</b></p>
                        <p>Leads arrivés (assignés) : <b className="tabular-nums">{row.leadsIn}</b></p>
                        <p>Colis créés : <b className="tabular-nums">{row.parcelsCreated}</b></p>
                        <p>Colis livrés : <b className="tabular-nums">{row.delivered}</b></p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="actions" fill="#c7d2fe" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Line type="monotone" dataKey="ma7" stroke="#6366f1" strokeWidth={2} strokeDasharray="6 3" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="confirmations" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="parcelsCreated" stroke="#0891b2" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="delivered" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyBlock label="Aucune activité sur cette période" />
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {[
            { label: 'Actions (barres)', color: '#c7d2fe' },
            { label: 'Moyenne mobile 7 j', color: '#6366f1' },
            { label: 'Confirmations', color: '#10b981' },
            { label: 'Colis créés', color: '#0891b2' },
            { label: 'Colis livrés', color: '#f59e0b' },
          ].map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------ Methodology */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Scale className="w-3.5 h-3.5" /> Méthodologie — pourquoi les écrans d'origine divergent
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-[11px] font-medium text-slate-500 leading-relaxed">
          <p>
            <b className="text-slate-700">L'inspecteur admin</b> lit le <b>statut actuel</b> des leads
            <b> actuellement assignés</b>, fenêtré sur la date d'arrivée du lead. Un lead rendu au pool
            ou repris disparaît de l'agent d'origine ; un statut réécrit par le webhook Coliaty remplace
            le résultat de l'appel.
          </p>
          <p>
            <b className="text-slate-700">Les pages agent</b> reconstruisent tout depuis
            l'<b>historique des statuts écrits par l'agent</b> (fenêtré par défaut sur la date de
            l'action, 7 derniers jours) : le travail survit à la désassignation, et un lead livré reste
            compté « confirmé » chez l'agent.
          </p>
          <p>
            <b className="text-slate-700">Taux de confirmation</b> — admin : famille confirmée ÷ leads
            traités (statut actuel) ; agent : (CONFIRMED + PUSHED) ÷ les six résultats (dernière
            action). Mêmes noms, dénominateurs différents : comparez-les via la diagonale du nuage de
            points, pas entre eux.
          </p>
          <p>
            <b className="text-slate-700">Taux de livraison</b> — agent : livrés ÷ tous les colis
            (les colis en route pèsent) ; admin : livrés ÷ colis arrivés au bout. Les deux convergent
            quand plus rien n'est en transit. Les intervalles de confiance sont des intervalles de
            Wilson à 95 % ; les badges ▲▼ signalent un écart à l'équipe avec |z| &gt; 1,96 et
            n ≥ {MIN_N_FOR_SIGNIFICANCE}.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Last-action → comparison bucket, mirrored from the backend for chip colors. */
function bucketOf(action: string): string {
  const a = (action || '').toUpperCase();
  if (a === 'CONFIRMED' || a === 'PUSHED_TO_DELIVERY') return 'CONFIRMED';
  if (['ASSIGNED', 'CALL_LATER', 'NO_REPLY', 'WRONG_ORDER', 'CANCEL_REASON_PRICE', 'CANCEL_ORDER'].includes(a)) return a;
  return 'OTHER';
}
