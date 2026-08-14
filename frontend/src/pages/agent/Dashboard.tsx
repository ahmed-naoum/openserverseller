import { useState, useEffect, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { leadsApi } from '../../lib/api';
import { Link } from 'react-router-dom';
import {
  Headphones, Truck, CheckCircle2, Phone, PieChart as PieIcon,
  Activity, ArrowRight, RefreshCw, Sparkles, Zap, PackageCheck, Inbox, Send, ShoppingCart,
  CalendarClock, X, Filter, History,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';

type ThemeKey = 'classic' | 'girly' | 'princess';

/**
 * Every class string is written out in full: Tailwind can't see through
 * `bg-${accent}-500`, so interpolated utilities would be purged from the build.
 */
const THEME: Record<ThemeKey, {
  tag: string;
  heroBg: string; heroBorder: string; blobA: string; blobB: string;
  chip: string; select: string; card: string; glow: string;
  icon: string; accentText: string; soft: string; softDot: string;
  cta: string; ctaGhost: string; link: string; spinner: string; track: string;
  field: string;
}> = {
  classic: {
    tag: 'Espace Confirmation Classique 🕶️',
    heroBg: 'bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20',
    heroBorder: 'border-indigo-100/60',
    blobA: 'from-indigo-300/10 to-purple-400/10',
    blobB: 'from-blue-200/10 to-indigo-300/5',
    chip: 'bg-indigo-100/60 border-indigo-200/40 text-indigo-700',
    select: 'bg-indigo-600 text-white border-indigo-700 shadow-indigo-500/20',
    card: 'border-indigo-100/40',
    glow: 'bg-indigo-50/40',
    icon: 'text-indigo-500',
    accentText: 'text-indigo-700',
    soft: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    softDot: 'bg-indigo-500',
    cta: 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-200/70',
    ctaGhost: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100/80 border-indigo-100',
    link: 'text-indigo-600 hover:text-indigo-700',
    spinner: 'border-indigo-100 border-t-indigo-500',
    track: 'bg-indigo-50',
    field: 'border-indigo-100 focus:ring-2 focus:ring-indigo-200',
  },
  girly: {
    tag: 'Espace Agent Féminin ✨',
    heroBg: 'bg-gradient-to-br from-rose-50 via-pink-50/60 to-fuchsia-50/30',
    heroBorder: 'border-pink-100/60',
    blobA: 'from-pink-300/10 to-fuchsia-400/10',
    blobB: 'from-rose-200/10 to-pink-300/5',
    chip: 'bg-pink-100/60 border-pink-200/40 text-pink-700',
    select: 'bg-gradient-to-r from-pink-500 to-rose-500 text-white border-pink-600 shadow-pink-500/20',
    card: 'border-pink-100/50',
    glow: 'bg-pink-50/40',
    icon: 'text-pink-500',
    accentText: 'text-pink-700',
    soft: 'bg-pink-50 text-pink-600 border-pink-100',
    softDot: 'bg-pink-500',
    cta: 'bg-gradient-to-r from-pink-500 to-rose-500 hover:shadow-pink-200/70',
    ctaGhost: 'bg-pink-50 text-pink-600 hover:bg-pink-100/80 border-pink-100',
    link: 'text-pink-600 hover:text-pink-700',
    spinner: 'border-rose-100 border-t-pink-500',
    track: 'bg-pink-50',
    field: 'border-pink-100 focus:ring-2 focus:ring-pink-200',
  },
  princess: {
    tag: 'Espace Princess Royal 👑✨',
    heroBg: 'bg-gradient-to-br from-amber-50 via-pink-50/60 to-purple-50/30',
    heroBorder: 'border-amber-200/60',
    blobA: 'from-amber-300/10 via-pink-400/10 to-purple-400/10',
    blobB: 'from-rose-200/10 to-amber-300/5',
    chip: 'bg-amber-100/60 border-amber-200/40 text-amber-800',
    select: 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-500 text-white border-amber-600 shadow-amber-500/20',
    card: 'border-amber-100/50',
    glow: 'bg-amber-50/40',
    icon: 'text-amber-500',
    accentText: 'text-amber-800',
    soft: 'bg-amber-50 text-amber-700 border-amber-100',
    softDot: 'bg-amber-500',
    cta: 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-500 hover:shadow-amber-200/70',
    ctaGhost: 'bg-amber-50 text-amber-700 hover:bg-amber-100/80 border-amber-100',
    link: 'text-amber-700 hover:text-amber-800',
    spinner: 'border-amber-100 border-t-amber-500',
    track: 'bg-amber-50',
    field: 'border-amber-100 focus:ring-2 focus:ring-amber-200',
  },
};

/**
 * Phase 1 shows exactly the six outcomes an agent can pick under
 * "✅ Résultat de la confirmation" on the lead page — same order, same wording.
 */
const CONFIRMATION_OUTCOMES = [
  { key: 'CALL_LATER', emoji: '📞', label: 'CALL LATER', hint: 'Rappel programmé', color: '#3b82f6', tile: 'bg-blue-50/70 border-blue-100 text-blue-700', bar: 'bg-blue-500' },
  { key: 'NO_REPLY', emoji: '📵', label: 'NO REPLY', hint: 'Injoignable', color: '#64748b', tile: 'bg-slate-50 border-slate-200 text-slate-700', bar: 'bg-slate-500' },
  { key: 'CONFIRMED', emoji: '✅', label: 'CONFIRMED', hint: 'Commande confirmée', color: '#10b981', tile: 'bg-emerald-50/70 border-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
  { key: 'WRONG_ORDER', emoji: '⚠️', label: 'WRONG ORDER', hint: 'Mauvaise commande', color: '#f59e0b', tile: 'bg-amber-50/70 border-amber-100 text-amber-700', bar: 'bg-amber-500' },
  { key: 'CANCEL_REASON_PRICE', emoji: '💰', label: 'CANCEL REASON PRICE', hint: 'Refus sur le prix', color: '#a855f7', tile: 'bg-purple-50/70 border-purple-100 text-purple-700', bar: 'bg-purple-500' },
  { key: 'CANCEL_ORDER', emoji: '❌', label: 'CANCEL ORDER', hint: 'Commande annulée', color: '#ef4444', tile: 'bg-red-50/70 border-red-100 text-red-700', bar: 'bg-red-500' },
] as const;

/**
 * Claimed but not yet called — a state, not a result. It's listed with the six
 * outcomes so the whole pipeline is visible at a glance, but it stays out of the
 * confirmation-rate denominator: counting un-called leads as failures would drag
 * the rate down for work the agent hasn't had a chance to do yet.
 */
const IN_PROGRESS_ROW = {
  key: 'ASSIGNED',
  emoji: '👤',
  label: 'ASSIGNED',
  hint: 'Réclamé, appel à passer',
  color: '#06b6d4',
  tile: 'bg-cyan-50/70 border-cyan-100 text-cyan-700',
  bar: 'bg-cyan-500',
} as const;

type DeliveryGroup = 'pipeline' | 'transit' | 'issue' | 'done' | 'return';

const DELIVERY_GROUPS: Record<DeliveryGroup, { label: string; order: number; dot: string }> = {
  pipeline: { label: 'Préparation', order: 0, dot: 'bg-slate-400' },
  transit: { label: 'En transit', order: 1, dot: 'bg-blue-500' },
  issue: { label: 'Incidents', order: 2, dot: 'bg-orange-500' },
  done: { label: 'Livré', order: 3, dot: 'bg-emerald-500' },
  return: { label: 'Retours & annulations', order: 4, dot: 'bg-red-500' },
};

/** Every Coliaty parcel status, labelled and grouped. Keys mirror Livraison.tsx. */
const DELIVERY_STATUSES: Record<string, { label: string; emoji: string; group: DeliveryGroup; color: string }> = {
  PENDING: { label: 'En attente', emoji: '⏳', group: 'pipeline', color: '#f59e0b' },
  PUSHED_TO_DELIVERY: { label: 'Envoyé en livraison', emoji: '📤', group: 'pipeline', color: '#818cf8' },
  NEW_PARCEL: { label: 'Nouveau colis', emoji: '📦', group: 'pipeline', color: '#94a3b8' },
  WAITING_PREPARATION: { label: 'Attente préparation', emoji: '🧾', group: 'pipeline', color: '#fb923c' },
  ENCORE_PREPARED: { label: 'En préparation', emoji: '🔧', group: 'pipeline', color: '#60a5fa' },
  PREPARED: { label: 'Préparé', emoji: '✔️', group: 'pipeline', color: '#34d399' },
  WAITING_PICKUP: { label: 'Attente collecte', emoji: '🕒', group: 'pipeline', color: '#fbbf24' },

  PICKED_UP: { label: 'Collecté', emoji: '🚚', group: 'transit', color: '#3b82f6' },
  SENT: { label: 'Expédié', emoji: '✈️', group: 'transit', color: '#8b5cf6' },
  RECEIVED: { label: 'Reçu (destination)', emoji: '📍', group: 'transit', color: '#6366f1' },
  DISTRIBUTION: { label: 'En livraison', emoji: '🛵', group: 'transit', color: '#06b6d4' },
  PROGRAMMER: { label: 'Programmé', emoji: '📅', group: 'transit', color: '#0ea5e9' },
  PROGRAMMER_AUTO: { label: 'Programmé (auto)', emoji: '🤖', group: 'transit', color: '#a855f7' },

  POSTPONED: { label: 'Reporté', emoji: '⏭️', group: 'issue', color: '#f97316' },
  NOANSWER: { label: 'Pas de réponse', emoji: '📵', group: 'issue', color: '#fb7185' },
  ERR: { label: 'Tél. erroné', emoji: '☎️', group: 'issue', color: '#f43f5e' },
  INCORRECT_ADDRESS: { label: 'Adresse erronée', emoji: '🗺️', group: 'issue', color: '#e11d48' },

  DELIVERED: { label: 'Livré', emoji: '🎉', group: 'done', color: '#10b981' },

  RETURNED: { label: 'Retourné', emoji: '↩️', group: 'return', color: '#f97316' },
  REFUSE: { label: 'Refusé', emoji: '🚫', group: 'return', color: '#dc2626' },
  CANCELED: { label: 'Annulé (livreur)', emoji: '❌', group: 'return', color: '#ef4444' },
  CANCELED_BY_SELLER: { label: 'Annulé (vendeur)', emoji: '❌', group: 'return', color: '#b91c1c' },
  CANCELED_BY_SYSTEM: { label: 'Annulé (système)', emoji: '❌', group: 'return', color: '#991b1b' },
};

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
const fmtPct = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/**
 * The period filter scopes every figure on this page by *arrival* time — when
 * the lead came in, when the parcel was created, when the cart was abandoned.
 * Not by when it was last touched: an agent asking "what did I do today" means
 * today's leads, and a status that moved this morning on a lead from last week
 * would otherwise pull the whole week into the count.
 *
 * An empty bound means unbounded on that side, so most presets are "since X"
 * and stay correct as the day goes on. "Hier" is the exception: it needs a
 * closing bound, otherwise it would mean yesterday *and* today.
 */
const PERIOD_PRESETS: { key: string; label: string; range: () => { from: string; to: string } }[] = [
  { key: 'today', label: "Aujourd'hui", range: () => ({ from: startOfDaysAgo(0), to: '' }) },
  { key: 'yesterday', label: 'Hier', range: () => ({ from: startOfDaysAgo(1), to: endOfDaysAgo(1) }) },
  { key: '7d', label: '7 jours', range: () => ({ from: startOfDaysAgo(6), to: '' }) },
  { key: '30d', label: '30 jours', range: () => ({ from: startOfDaysAgo(29), to: '' }) },
  { key: 'all', label: 'Tout', range: () => ({ from: '', to: '' }) },
];

/**
 * Which timestamp the period is read against. Two different questions, and an
 * agent needs both: "what did I get through today" is the work, "how are
 * today's arrivals doing" is the intake. A status moved this morning on a lead
 * from last week belongs to the first and not to the second.
 */
const DATE_MODES = [
  { key: 'updatedAt', label: 'Mise à jour', hint: 'Compté à la date du changement de statut' },
  { key: 'createdAt', label: 'Création', hint: "Compté à la date d'arrivée du lead" },
] as const;

type DateMode = (typeof DATE_MODES)[number]['key'];

/**
 * How Phase 1 counts. Both readings are true and neither replaces the other: an
 * agent who rings the same number three times before giving up did three
 * NO_REPLY calls on one lead. "Par lead" files each lead once, under the last
 * thing the agent did to it, so the slices add up to the leads worked; "par
 * action" counts every status change, so they add up to the work done.
 */
const COUNT_MODES = [
  { key: 'leads', label: 'Par lead', hint: 'Chaque lead compté une fois, sous sa dernière action' },
  { key: 'actions', label: 'Par action', hint: 'Chaque changement de statut compté' },
] as const;

type CountMode = (typeof COUNT_MODES)[number]['key'];

/** `datetime-local` speaks local wall-clock; `toISOString` would shift the hour. */
const toDateTimeInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Midnight, `days` days back — the start bound of a "derniers N jours" preset. */
const startOfDaysAgo = (days: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return toDateTimeInput(d);
};

/**
 * 23:59 on the day `days` days back — the closing bound of a single-day preset.
 * Deliberately not the next day's 00:00: the server treats a bound given to the
 * minute as covering that whole minute, so midnight would leak the first sixty
 * seconds of the following day into the count.
 */
const endOfDaysAgo = (days: number) => {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  d.setDate(d.getDate() - days);
  return toDateTimeInput(d);
};

/**
 * `2026-08-09T14:30` → `09/08 à 14:30`. Read straight off the string: it is
 * already the wall-clock the agent typed, and a round-trip through `Date` would
 * only add a timezone to take back out.
 */
const fmtDateTimeInput = (value: string) => {
  const [date, time] = value.split('T');
  const [, month, day] = date.split('-');
  return time ? `${day}/${month} à ${time}` : `${day}/${month}`;
};

export default function AgentDashboard() {
  const [theme, setTheme] = useState<ThemeKey>(
    () => (localStorage.getItem('agent-theme') as ThemeKey) || 'girly'
  );

  const changeTheme = (next: ThemeKey) => {
    setTheme(next);
    localStorage.setItem('agent-theme', next);
    window.dispatchEvent(new Event('agent-theme-change'));
  };

  useEffect(() => {
    const syncTheme = () =>
      setTheme((localStorage.getItem('agent-theme') as ThemeKey) || 'girly');
    window.addEventListener('agent-theme-change', syncTheme);
    return () => window.removeEventListener('agent-theme-change', syncTheme);
  }, []);

  const t = THEME[theme];
  const isPlayful = theme !== 'classic';

  // --- Period ---------------------------------------------------------------
  // Default period: Aujourd'hui (since midnight today).
  const [dateFrom, setDateFrom] = useState(() => startOfDaysAgo(0));
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

  /** The tile drill-down: the same leads, in the same window, on the leads page. */
  const drillDownTo = (action: string) => {
    const params = new URLSearchParams({ historyStatus: action, dateField: dateMode });
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    return `/agent/leads?${params.toString()}`;
  };

  const applyPreset = (preset: (typeof PERIOD_PRESETS)[number]) => {
    const { from, to } = preset.range();
    setDateFrom(from);
    setDateTo(to);
  };

  // Match on both bounds so a closed preset ("Hier") lights its chip. Anything
  // that matches no preset is a custom range and lights none.
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

  // --- Data -----------------------------------------------------------------
  // Counts come from the server's group-by, never from a page of rows: a page
  // is capped (50 leads / 20 available) and silently under-reports the totals.
  //
  // The period is part of every key: two windows are two different answers, and
  // sharing one cache entry would show the previous window's numbers until the
  // refetch landed. `keepPreviousData` then holds the outgoing window on screen
  // while the new one loads — without it every change of period drops the whole
  // page back to the full-page spinner, which reads as a reload rather than a
  // filter.

  const leadStatsQuery = useQuery({
    queryKey: ['agent-lead-stats', dateFrom, dateTo, dateMode],
    queryFn: () => leadsApi.list({ withStats: 'true', limit: 1, ...range }),
    placeholderData: keepPreviousData,
  });

  const todoQuery = useQuery({
    queryKey: ['agent-todo-leads', dateFrom, dateTo, dateMode],
    queryFn: () => leadsApi.list({ status: 'ASSIGNED,NEW', limit: 6, ...range }),
    placeholderData: keepPreviousData,
  });

  const deliveryQuery = useQuery({
    queryKey: ['agent-delivery-stats', dateFrom, dateTo, dateMode],
    queryFn: () => leadsApi.livraison({ limit: 1, ...range }),
    placeholderData: keepPreviousData,
  });

  const availableQuery = useQuery({
    queryKey: ['agent-available-count', dateFrom, dateTo, dateMode],
    queryFn: () => leadsApi.available({ limit: 1, ...range }),
    placeholderData: keepPreviousData,
  });

  // The "Déjà converti" figure comes from the carts endpoint itself rather than
  // being recomputed here: that page applies its own scoping and visibility
  // rules, and a second implementation would quietly drift from the badge the
  // agent sees when they click through. `counts` covers the whole visible set
  // regardless of paging, so limit: 1 is enough.
  const cartsQuery = useQuery({
    queryKey: ['agent-cart-counts', dateFrom, dateTo, dateMode],
    queryFn: () => leadsApi.abandonedCarts({ limit: 1, ...range }),
    placeholderData: keepPreviousData,
  });

  const isLoading =
    leadStatsQuery.isLoading || deliveryQuery.isLoading || todoQuery.isLoading;
  // `isFetching`, not `isRefetching`: a change of period is a fresh key, so it
  // never counts as a refetch — and the numbers on screen would go stale with
  // nothing spinning to say so.
  const isRefreshing =
    !isLoading &&
    (leadStatsQuery.isFetching ||
      deliveryQuery.isFetching ||
      availableQuery.isFetching ||
      todoQuery.isFetching ||
      cartsQuery.isFetching);

  const refreshAll = () => {
    leadStatsQuery.refetch();
    deliveryQuery.refetch();
    availableQuery.refetch();
    todoQuery.refetch();
    cartsQuery.refetch();
  };

  const leadStats = leadStatsQuery.data?.data?.data?.stats;
  const byLeadStatus: Record<string, number> = leadStats?.byStatus || {};

  /**
   * Everything this agent did in the window, rebuilt server-side from the status
   * history they wrote. It is the only figure here that survives a lead leaving
   * them: the reassignment cron clears `assignedAgentId` when it hands a lead
   * back to the pool, so counting off the leads table loses the claim, the
   * calls and the outcome all at once.
   */
  const activity = leadStats?.agentActivity;
  const byAction: Record<string, number> = activity?.byAction || {};
  const byActionLeads: Record<string, number> = activity?.byLead || {};
  const totalActions: number = activity?.totalActions ?? 0;
  const leadsWorked: number = activity?.leadsWorked ?? 0;
  /** Leads pulled out of the pool — the real "Réclamé", claims handed back included. */
  const claimedTotal: number = activity?.claimed ?? 0;
  const deliveryStats = deliveryQuery.data?.data?.data?.stats;
  const byDeliveryStatus: Record<string, number> = deliveryStats?.byStatus || {};
  const parcelsTotal: number = deliveryStats?.total ?? 0;
  const todoLeads: any[] = todoQuery.data?.data?.data?.leads || [];
  const todoTotal: number = todoQuery.data?.data?.data?.pagination?.total ?? todoLeads.length;

  // The true size of the shared pool — `leads[]` is capped by the page limit.
  const availableCount: number = availableQuery.data?.data?.data?.totalAvailable ?? 0;
  // Confirmed but not yet pushed to Coliaty.
  const awaitingPush: number = byLeadStatus.CONFIRMED || 0;

  // Abandoned carts recovered from the "Paniers Abandonnés" page. `claimed` is
  // lifetime (what this agent converted); `inPipeline` is how many of those are
  // still theirs to work.
  // Both figures come from the carts endpoint's own `counts`, so the tile always
  // reads exactly like the Paniers Abandonnés page: `converted` is its "Déjà
  // converti" tab, `all` is its "Tous" tab. An all-time conversion count used to
  // sit here instead, which silently mixed an unscoped lifetime number with the
  // page's scoped ones — three different denominators on one tile.
  const cartCounts = cartsQuery.data?.data?.counts;
  const cartsConverted: number = cartCounts?.converted ?? 0;
  const cartsTotal: number = cartCounts?.all ?? 0;
  const cartsSub = `sur ${cartsTotal} panier${cartsTotal > 1 ? 's' : ''} au total`;

  // --- Phase 1: confirmation outcomes --------------------------------------
  // Both modes read the same server tally, from opposite ends: `byStatus` files
  // each lead under the agent's last word on it, `byAction` counts every status
  // change they made.
  const counts = countMode === 'actions' ? byAction : byLeadStatus;

  const outcomes = useMemo(
    () =>
      CONFIRMATION_OUTCOMES.map(o => {
        if (o.key !== 'CONFIRMED') return { ...o, value: counts[o.key] || 0 };

        const queued = counts.CONFIRMED || 0;
        // Per lead, a confirmation that shipped now sits under
        // PUSHED_TO_DELIVERY — folded back in here so CONFIRMED reflects all the
        // work done, not only what is still queued, and folded in rather than
        // added alongside so the lead stays in exactly one slice.
        const pushed = countMode === 'actions' ? 0 : counts.PUSHED_TO_DELIVERY || 0;
        return {
          ...o,
          value: queued + pushed,
          hint: pushed > 0 ? `${queued} en attente · ${pushed} envoyés` : o.hint,
        };
      }),
    [counts, countMode]
  );

  // Per lead this is a claim with no outcome recorded after it — which is not
  // the same as a lead still in hand, since the pool may have taken it back;
  // "Actions Requises" below is the current plate. Per action it is every claim
  // made. Both hints carry the claim total, because that is the figure an agent
  // means by "combien j'ai réclamé".
  const assignedRow = {
    ...IN_PROGRESS_ROW,
    value: counts.ASSIGNED || 0,
    hint:
      countMode === 'actions'
        ? `${byActionLeads.ASSIGNED || 0} leads réclamés`
        : `Réclamé, sans résultat enregistré · ${claimedTotal} réclamés au total`,
  };
  const cartConvertedRow = {
    key: 'ABANDONED_CART_CONVERTED',
    emoji: '🛒',
    label: 'PANIERS CONVERTIS',
    hint: `Paniers abandonnés convertis en leads · ${cartsSub}`,
    color: '#f43f5e',
    tile: 'bg-rose-50/70 border-rose-100 text-rose-700',
    bar: 'bg-rose-500',
    value: cartsConverted,
  };
  const phase1Rows = [...outcomes, assignedRow, cartConvertedRow];

  // Two totals on purpose: the rate is scored on results only, everything the
  // eye compares (bars, donut, tile %) is scored on the whole pipeline.
  const treatedTotal = outcomes.reduce((sum, o) => sum + o.value, 0);
  const pipelineTotal = treatedTotal + assignedRow.value;
  const confirmedTotal = outcomes.find(o => o.key === 'CONFIRMED')?.value ?? 0;
  const confirmationRate = pct(confirmedTotal, treatedTotal);
  const confirmationDist = phase1Rows.filter(o => o.value > 0);

  // --- Phase 2: every delivery status --------------------------------------
  const deliveryRows = useMemo(() => {
    return Object.entries(byDeliveryStatus)
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
      });
  }, [byDeliveryStatus]);

  const groupTotals = useMemo(() => {
    const totals: Record<DeliveryGroup, number> = { pipeline: 0, transit: 0, issue: 0, done: 0, return: 0 };
    for (const row of deliveryRows) totals[row.group] += row.count;
    return totals;
  }, [deliveryRows]);

  const deliveredTotal = byDeliveryStatus.DELIVERED || 0;
  const inProgressTotal = groupTotals.pipeline + groupTotals.transit + groupTotals.issue;
  const deliveryRate = pct(deliveredTotal, parcelsTotal);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-64 rounded-3xl ${t.glow}`}>
        <div className="relative w-12 h-12">
          <div className={`absolute inset-0 border-4 rounded-full animate-spin ${t.spinner}`} />
          {isPlayful ? (
            <Sparkles className={`w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse ${t.icon}`} />
          ) : (
            <Activity className={`w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse ${t.icon}`} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto px-1 sm:px-4 pb-4">
      {/* ---------------------------------------------------------------- Hero */}
      <div className={`rounded-3xl p-6 md:p-7 border shadow-sm relative overflow-hidden ${t.heroBg} ${t.heroBorder}`}>
        <div className={`absolute top-0 right-0 w-72 h-72 bg-gradient-to-br ${t.blobA} rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none`} />
        <div className={`absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr ${t.blobB} rounded-full blur-2xl -ml-20 -mb-20 pointer-events-none`} />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black backdrop-blur-sm shadow-sm uppercase tracking-wider ${t.chip}`}>
                {isPlayful
                  ? <Sparkles className={`w-3.5 h-3.5 animate-pulse ${t.icon}`} />
                  : <Activity className={`w-3.5 h-3.5 animate-pulse ${t.icon}`} />}
                {t.tag}
              </div>

              <div className="relative inline-block">
                <select
                  value={theme}
                  onChange={e => changeTheme(e.target.value as ThemeKey)}
                  aria-label="Changer de thème"
                  className={`pl-3 pr-8 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md border outline-none appearance-none cursor-pointer transition-all duration-300 ${t.select}`}
                >
                  <option value="classic" className="text-gray-900 bg-white font-bold">🕶️ Classique</option>
                  <option value="girly" className="text-gray-900 bg-white font-bold">🌸 Thème Girly ✨</option>
                  <option value="princess" className="text-gray-900 bg-white font-bold">💅 Princess Pink 👑</option>
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white font-black text-[8px]">▼</div>
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mb-1.5">
              {theme === 'princess'
                ? 'Espace Princesse Royale 👑✨'
                : theme === 'girly'
                  ? 'Mon Tableau de Bord Agent 🌸'
                  : 'Tableau de Bord Agent 📊'}
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm font-medium max-w-xl">
              Résultats de confirmation et suivi de livraison —{' '}
              {rangeLabel ? (
                <>
                  comptés sur ce qui a été{' '}
                  {dateMode === 'createdAt' ? 'reçu' : 'mis à jour'}{' '}
                  <span className={`font-black ${t.accentText}`}>{rangeLabel}</span>.
                </>
              ) : (
                'comptés sur la totalité de votre travail, pas sur une page.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={refreshAll}
              disabled={isRefreshing}
              className="p-2.5 bg-white text-gray-500 rounded-xl transition-all border border-gray-200 shadow-sm hover:text-gray-900 hover:border-gray-300 disabled:opacity-50"
              title="Actualiser les statistiques"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? `animate-spin ${t.icon}` : ''}`} />
            </button>

            <Link
              to="/agent/leads"
              className={`flex items-center gap-1.5 px-4 py-2.5 text-white font-black rounded-xl shadow-sm hover:shadow-lg transition-all text-xs ${t.cta}`}
            >
              <Zap className="w-3.5 h-3.5 text-white/80" />
              Réclamer Leads
            </Link>

            <Link
              to="/agent/livraison"
              className={`flex items-center gap-1.5 px-4 py-2.5 font-black rounded-xl transition-all text-xs border ${t.ctaGhost}`}
            >
              <Truck className="w-3.5 h-3.5 opacity-80" />
              Suivi Livraison
            </Link>
          </div>
        </div>

        {/* Période — scopes every figure on this page, both phases included.
            Presets cover the three windows an agent actually asks for; the two
            fields underneath are there for anything else, to the minute. */}
        <div className={`relative z-10 mt-5 rounded-2xl border bg-white/70 backdrop-blur-sm shadow-sm p-3 sm:p-3.5 ${t.card}`}>
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
                  onClick={() => applyPreset(preset)}
                  aria-pressed={activePreset === preset.key}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                    activePreset === preset.key
                      ? t.select
                      : 'bg-white text-gray-500 border-gray-200 hover:text-gray-900 hover:border-gray-300'
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
                title="Statistiques à partir de"
                className={`w-full sm:w-[180px] py-2 px-2.5 border rounded-xl bg-white text-xs font-bold text-gray-700 outline-none shadow-sm transition-all ${t.field}`}
              />
              <span className="text-[10px] font-black text-gray-300 uppercase">à</span>
              <input
                type="datetime-local"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={e => setDateTo(e.target.value)}
                aria-label="Statistiques jusqu'à"
                title="Statistiques jusqu'à"
                className={`w-full sm:w-[180px] py-2 px-2.5 border rounded-xl bg-white text-xs font-bold text-gray-700 outline-none shadow-sm transition-all ${t.field}`}
              />
              {hasRange && (
                <button
                  type="button"
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  title="Effacer la période"
                  className="flex items-center gap-1 px-2.5 py-2 text-[10px] font-black uppercase tracking-wider text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Effacer
                </button>
              )}
            </div>
          </div>

          {/* Which timestamp the period reads. Kept on its own row under the
              dates because it re-scores every figure above and below it — it is
              a second filter, not a formatting option. */}
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-dashed border-gray-200">
            <div className="flex items-center gap-2 shrink-0">
              <Filter className={`w-3.5 h-3.5 ${t.icon}`} />
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-600">Filtrer par date de</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {DATE_MODES.map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setDateMode(m.key)}
                  aria-pressed={dateMode === m.key}
                  title={m.hint}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                    dateMode === m.key
                      ? t.select
                      : 'bg-white text-gray-500 border-gray-200 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <span className="text-[10px] font-semibold text-gray-400 sm:ml-1">
              {DATE_MODES.find(m => m.key === dateMode)?.hint}
            </span>
          </div>
        </div>

        {/* Live counters — real totals, straight from the server aggregates */}
        <div className="relative z-10 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mt-3">
          <PulseStat
            to="/agent/leads"
            icon={<Inbox className="w-4 h-4" />}
            label="Disponibles"
            sub="Pool partagé à réclamer"
            value={availableCount}
            tone="emerald"
            live
          />
          <PulseStat
            to="/agent/leads"
            icon={<Phone className="w-4 h-4" />}
            label="À traiter"
            sub="Assignés, appel à passer"
            value={todoTotal}
            tone="blue"
            live={todoTotal > 0}
          />
          <PulseStat
            to="/agent/leads"
            icon={<Send className="w-4 h-4" />}
            label="En attente d'envoi"
            sub="Confirmés, pas encore poussés"
            value={awaitingPush}
            tone="amber"
            live={awaitingPush > 0}
          />
          <PulseStat
            to="/agent/livraison"
            icon={<PackageCheck className="w-4 h-4" />}
            label="Colis en cours"
            sub={`${deliveredTotal} livrés sur ${parcelsTotal}`}
            value={inProgressTotal}
            tone="violet"
          />
          <PulseStat
            to="/agent/live-stream-paniers"
            icon={<ShoppingCart className="w-4 h-4" />}
            label="Paniers convertis"
            sub={cartsSub}
            value={cartsConverted}
            tone="rose"
            live={cartsTotal > cartsConverted}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        {/* ------------------------------------------------ Phase 1 */}
        <section className={`bg-white p-5 sm:p-6 rounded-3xl border shadow-sm relative overflow-hidden ${t.card}`}>
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl ${t.glow} pointer-events-none`} />

          <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4 relative z-10">
            <div>
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Headphones className={`w-5 h-5 ${t.icon}`} />
                Phase 1: Confirmation
              </h2>
              <p className="text-[11px] font-semibold text-gray-400 mt-0.5 uppercase tracking-wider">
                ✅ Résultat de la confirmation
              </p>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2">
              <span
                className={`px-3 py-1.5 text-xs font-black rounded-xl border w-fit ${t.soft}`}
                title={
                  countMode === 'actions'
                    ? 'Calculé sur les actions de résultat — les réclamations (ASSIGNED) sont exclues.'
                    : 'Calculé sur les leads déjà traités — les leads ASSIGNED (appel non passé) sont exclus.'
                }
              >
                Taux: {fmtPct(confirmationRate)}% ({confirmedTotal}/{treatedTotal} traités)
              </span>
              <div className="flex items-center gap-1">
                {COUNT_MODES.map(m => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setCountMode(m.key)}
                    aria-pressed={countMode === m.key}
                    title={m.hint}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                      countMode === m.key
                        ? t.select
                        : 'bg-white text-gray-500 border-gray-200 hover:text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </header>

          {/* What the agent actually did in the window — counted off the status
              history, so a lead handed back to the pool still carries the calls
              that were made on it. */}
          <div className="relative z-10 grid grid-cols-3 gap-2 mb-5">
            <ActivityStat
              icon={<History className="w-3.5 h-3.5" />}
              label="Actions"
              value={totalActions}
              hint="Changements de statut enregistrés"
            />
            <ActivityStat
              icon={<Headphones className="w-3.5 h-3.5" />}
              label="Leads traités"
              value={leadsWorked}
              hint="Leads distincts touchés"
            />
            <ActivityStat
              icon={<Zap className="w-3.5 h-3.5" />}
              label="Réclamés"
              value={claimedTotal}
              hint="Leads sortis du pool, même rendus depuis"
            />
          </div>

          {/* Donut + legend */}
          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 mb-5">
            <div className="h-[180px] w-[180px] shrink-0 relative">
              {confirmationDist.length > 0 ? (
                <>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-black text-gray-900 leading-none">{pipelineTotal}</span>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Leads</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%" className="relative z-10">
                    <PieChart>
                      <Pie data={confirmationDist} innerRadius={58} outerRadius={82} paddingAngle={4} dataKey="value" nameKey="label" stroke="none" isAnimationActive={false}>
                        {confirmationDist.map(entry => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip wrapperStyle={{ zIndex: 100 }} content={<OutcomeTooltip total={pipelineTotal} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-300">
                  <PieIcon className="w-8 h-8 mb-2" />
                  <span className="text-xs font-bold">Aucun résultat</span>
                </div>
              )}
            </div>

            <div className="flex-1 w-full space-y-1.5">
              {phase1Rows.map(o => (
                <div
                  key={o.key}
                  className={`flex items-center gap-2.5 ${
                    o.key === 'ASSIGNED' ? 'pt-2 mt-0.5 border-t border-dashed border-gray-200' : ''
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: o.color }} />
                  <span className="text-[11px] font-bold text-gray-600 truncate flex-1">
                    {o.emoji} {o.label}
                  </span>
                  <div className={`hidden sm:block w-16 h-1.5 rounded-full overflow-hidden shrink-0 ${t.track}`}>
                    <div
                      className={`h-full rounded-full ${o.bar} transition-all duration-500`}
                      style={{ width: `${pct(o.value, pipelineTotal)}%` }}
                    />
                  </div>
                  <span className="text-xs font-black text-gray-900 tabular-nums w-8 text-right shrink-0">{o.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* The six outcome tiles, in the same order as the lead page buttons.
              ASSIGNED & PANIERS CONVERTIS close the grid as full-width rows: same visual language,
              their shape says "state in progress / recovery", not "standard result". */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 relative z-10">
            {phase1Rows.map(o => {
              const isFullWidth = o.key === 'ASSIGNED' || o.key === 'ABANDONED_CART_CONVERTED';
              const targetUrl = o.key === 'ABANDONED_CART_CONVERTED' ? '/agent/live-stream-paniers' : drillDownTo(o.key);
              return (
                <Link
                  key={o.key}
                  to={targetUrl}
                  className={`p-3.5 rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${o.tile} ${
                    isFullWidth
                      ? 'col-span-2 lg:col-span-3 flex items-center gap-3'
                      : 'block'
                  }`}
                  title={o.key === 'ABANDONED_CART_CONVERTED' ? 'Voir les paniers abandonnés' : `Voir les leads que vous avez marqués « ${o.label} » sur la période`}
                >
                  {isFullWidth ? (
                    <>
                      <span className="text-base leading-none shrink-0">{o.emoji}</span>
                      <span className="text-2xl font-black leading-none tabular-nums shrink-0">{o.value}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[9px] font-black tracking-wider uppercase opacity-90 leading-tight">{o.label}</span>
                        <span className="block text-[9px] font-semibold opacity-60 leading-tight">{o.hint}</span>
                      </span>
                      <span className="text-[9px] font-black opacity-60 tabular-nums shrink-0">
                        {fmtPct(pct(o.value, pipelineTotal))}%
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-base leading-none">{o.emoji}</span>
                        <span className="text-[9px] font-black opacity-60 tabular-nums">
                          {fmtPct(pct(o.value, pipelineTotal))}%
                        </span>
                      </div>
                      <p className="text-2xl font-black mt-1.5 leading-none tabular-nums">{o.value}</p>
                      <p className="text-[9px] font-black tracking-wider uppercase mt-1.5 opacity-90 leading-tight">{o.label}</p>
                      <p className="text-[9px] font-semibold opacity-60 leading-tight">{o.hint}</p>
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        </section>

        {/* ------------------------------------------------ Phase 2 */}
        <section className={`bg-white p-5 sm:p-6 rounded-3xl border shadow-sm relative overflow-hidden ${t.card}`}>
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl ${t.glow} pointer-events-none`} />

          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 relative z-10">
            <div>
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Truck className={`w-5 h-5 ${t.icon}`} />
                Phase 2: Livraison Coliaty
              </h2>
              <p className="text-[11px] font-semibold text-gray-400 mt-0.5 uppercase tracking-wider">
                📦 Tous les statuts de livraison
              </p>
            </div>
            <span className={`px-3 py-1.5 text-xs font-black rounded-xl border w-fit ${t.soft}`}>
              Taux: {fmtPct(deliveryRate)}% ({deliveredTotal}/{parcelsTotal})
            </span>
          </header>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5 relative z-10">
            <MiniStat label="Colis envoyés" value={parcelsTotal} tone="slate" />
            <MiniStat label="Livrés" value={deliveredTotal} tone="emerald" />
            <MiniStat label="En cours" value={inProgressTotal} tone="blue" />
            <MiniStat label="Retours / annul." value={groupTotals.return} tone="red" />
          </div>

          {/* Every status, stacked proportionally */}
          {parcelsTotal > 0 ? (
            <>
              <div className="relative z-10 mb-4">
                <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-gray-100">
                  {deliveryRows.map(row => (
                    <div
                      key={row.key}
                      className="h-full transition-all duration-500"
                      style={{ width: `${pct(row.count, parcelsTotal)}%`, backgroundColor: row.color }}
                      title={`${row.label} — ${row.count}`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5">
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
              </div>

              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[300px] overflow-y-auto pr-1">
                {deliveryRows.map(row => (
                  <Link
                    key={row.key}
                    to={`/agent/livraison?status=${row.key}`}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-gray-100 bg-gray-50/40 hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all group"
                    title={`Voir les colis « ${row.label} »`}
                  >
                    <span className="w-1.5 h-7 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                    <span className="text-sm shrink-0">{row.emoji}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[11px] font-bold text-gray-700 truncate capitalize group-hover:text-gray-900">
                        {row.label}
                      </span>
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
            <div className="relative z-10 py-12 flex flex-col items-center justify-center text-gray-300">
              <Truck className="w-9 h-9 mb-2" />
              <p className="text-xs font-bold text-gray-400">Aucun colis envoyé pour le moment</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Confirmez un lead puis poussez-le vers Coliaty.</p>
            </div>
          )}
        </section>
      </div>

      {/* -------------------------------------------------- Actions requises */}
      <section className={`bg-white rounded-3xl border shadow-sm overflow-hidden ${t.card}`}>
        <div className={`p-5 sm:p-6 border-b flex items-center justify-between gap-3 ${t.card}`}>
          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Activity className={`w-5 h-5 animate-pulse ${t.icon}`} />
            {isPlayful ? 'Action Requise Immédiate ✨' : 'Actions Requises'}
            {todoTotal > 0 && (
              <span className={`px-2 py-0.5 rounded-lg text-[11px] font-black border ${t.soft}`}>{todoTotal}</span>
            )}
          </h3>
          <Link to="/agent/leads" className={`text-sm font-bold flex items-center gap-1 shrink-0 ${t.link}`}>
            Voir tout <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="divide-y divide-gray-50">
          {todoLeads.length > 0 ? (
            todoLeads.slice(0, 5).map((lead: any) => (
              <div key={lead.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/60 transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black shadow-inner border border-white shrink-0 ${t.soft}`}>
                    {(lead.fullName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900 truncate">{lead.fullName}</div>
                    <div className="text-xs sm:text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Phone className={`w-3.5 h-3.5 ${t.icon}`} /> {lead.phone}
                      {lead.city && <span className="text-gray-300">·</span>}
                      {lead.city && <span className="truncate">{lead.city}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-[60px] sm:ml-0 shrink-0">
                  <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border ${t.soft}`}>
                    {lead.status === 'ASSIGNED' ? 'Assigné' : 'Nouveau'}
                  </span>
                  <Link
                    to={`/agent/leads/${String(lead.id).replace('lead-', '')}`}
                    className={`px-4 py-2 text-white rounded-xl text-xs font-black shadow-sm hover:shadow-lg transition-all ${t.cta}`}
                  >
                    Traiter
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <CheckCircle2 className={`w-12 h-12 mx-auto mb-3 animate-bounce ${t.icon}`} />
              <p className="font-black text-gray-900">{isPlayful ? 'Tout est à jour ! 🌸' : 'Tout est à jour ! ✅'}</p>
              <p className="text-sm text-gray-500 mt-1">Vous n'avez aucun prospect en attente de traitement.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const TONES: Record<string, { wrap: string; icon: string; dot: string; ping: string }> = {
  emerald: { wrap: 'bg-emerald-50/70 border-emerald-100', icon: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-500', ping: 'bg-emerald-400' },
  blue: { wrap: 'bg-blue-50/70 border-blue-100', icon: 'bg-blue-100 text-blue-600', dot: 'bg-blue-500', ping: 'bg-blue-400' },
  amber: { wrap: 'bg-amber-50/70 border-amber-100', icon: 'bg-amber-100 text-amber-600', dot: 'bg-amber-500', ping: 'bg-amber-400' },
  violet: { wrap: 'bg-violet-50/70 border-violet-100', icon: 'bg-violet-100 text-violet-600', dot: 'bg-violet-500', ping: 'bg-violet-400' },
  rose: { wrap: 'bg-rose-50/70 border-rose-100', icon: 'bg-rose-100 text-rose-600', dot: 'bg-rose-500', ping: 'bg-rose-400' },
};

function PulseStat({ to, icon, label, sub, value, tone, live }: {
  to: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  value: number;
  tone: keyof typeof TONES;
  live?: boolean;
}) {
  const c = TONES[tone];
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl border shadow-sm bg-white/70 backdrop-blur-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${c.wrap}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${c.icon}`}>{icon}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xl font-black text-gray-900 leading-none tabular-nums">{value}</span>
          {live && (
            <span className="relative flex h-1.5 w-1.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${c.ping}`} />
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${c.dot}`} />
            </span>
          )}
        </div>
        {/* The hint is unreadable in a 2-up mobile grid — the number and its
            label carry the meaning, so the hint only shows once there's room. */}
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-600 mt-0.5 leading-tight">{label}</p>
        <p className="hidden sm:block text-[9px] font-semibold text-gray-400 truncate">{sub}</p>
      </div>
    </Link>
  );
}

/** A raw count of agent activity — no link, because it spans every outcome. */
function ActivityStat({ icon, label, value, hint }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="px-3 py-2.5 rounded-2xl border border-gray-100 bg-gray-50/50" title={hint}>
      <div className="flex items-center gap-1.5 text-gray-400">
        {icon}
        <span className="text-[9px] font-black uppercase tracking-wider truncate">{label}</span>
      </div>
      <p className="text-xl font-black text-gray-900 mt-1 leading-none tabular-nums">{value}</p>
    </div>
  );
}

const MINI_TONES: Record<string, string> = {
  slate: 'bg-slate-50 border-slate-200 text-slate-700',
  emerald: 'bg-emerald-50/70 border-emerald-100 text-emerald-700',
  blue: 'bg-blue-50/70 border-blue-100 text-blue-700',
  red: 'bg-red-50/70 border-red-100 text-red-700',
};

function MiniStat({ label, value, tone }: { label: string; value: number; tone: keyof typeof MINI_TONES }) {
  return (
    <div className={`p-3.5 rounded-2xl border shadow-sm ${MINI_TONES[tone]}`}>
      <span className="text-[9px] font-black tracking-wider uppercase opacity-80 leading-tight block">{label}</span>
      <p className="text-2xl font-black mt-1 leading-none tabular-nums">{value}</p>
    </div>
  );
}

function OutcomeTooltip({ active, payload, total }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white p-3 rounded-2xl shadow-xl border border-gray-100 flex flex-col gap-1 outline-none">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
        <span className="text-[10px] font-black text-gray-600 uppercase tracking-wider">
          {data.emoji} {data.label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5 pl-4">
        <span className="text-sm font-black text-gray-900">{data.value}</span>
        <span className="text-[10px] font-bold text-gray-400">{fmtPct(pct(data.value, total))}%</span>
      </div>
    </div>
  );
}
