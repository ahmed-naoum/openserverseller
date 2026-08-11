import {
  AlertCircle, Box, Calendar, CheckCircle2, Clock, Headphones, MapPin, Package,
  Phone, PhoneOff, RefreshCw, RotateCcw, ShoppingCart, Truck, Users, Wallet, X,
  type LucideIcon,
} from 'lucide-react';

/**
 * The complete catalogue of values `Lead.status` can actually hold.
 *
 * `Lead.status` is a free-form String column that three separate systems write
 * into — the agent (PATCH /leads/:id/status), the order-status mirror in
 * order.routes.ts, and the Coliaty webhook, which passes unmapped carrier codes
 * straight through. Any screen that keeps its own short list of statuses ends up
 * rendering raw codes like `ENCORE_PREPARED` at users and silently dropping
 * leads out of its totals. This is the single list to reach for instead.
 *
 * Phases, groups, labels and emojis mirror the agent dashboard
 * (pages/agent/Dashboard.tsx) so an admin inspecting an agent sees the same
 * vocabulary the agent does. `group` also mirrors the buckets
 * `buildAgentMetrics` uses in backend/src/routes/admin.routes.ts — keep the
 * three in step.
 */

export type Phase = 'confirmation' | 'delivery';

export type StatusGroup =
  // Phase 1 — Confirmation
  | 'in_progress' | 'confirmed' | 'lost'
  // Phase 2 — Livraison Coliaty
  | 'pipeline' | 'transit' | 'issue' | 'done' | 'return';

export interface StatusMeta {
  label: string;
  emoji: string;
  group: StatusGroup;
  /** Badge classes. */
  color: string;
  /** Gradient for the summary cards. */
  gradient: string;
  /** Solid colour for bars and charts. */
  hex: string;
  icon: LucideIcon;
}

export const PHASE_META: Record<Phase, { label: string; subtitle: string; icon: LucideIcon }> = {
  confirmation: { label: 'Phase 1: Confirmation', subtitle: '✅ Résultat de la confirmation', icon: Headphones },
  delivery: { label: 'Phase 2: Livraison Coliaty', subtitle: '📦 Tous les statuts de livraison', icon: Truck },
};

export const PHASE_ORDER: Phase[] = ['confirmation', 'delivery'];

export const GROUP_META: Record<StatusGroup, {
  phase: Phase; label: string; hex: string; icon: LucideIcon; color: string;
}> = {
  in_progress: { phase: 'confirmation', label: 'En cours', hex: '#06b6d4', icon: Headphones, color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  confirmed: { phase: 'confirmation', label: 'Confirmé', hex: '#10b981', icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  lost: { phase: 'confirmation', label: 'Non converti', hex: '#ef4444', icon: X, color: 'bg-red-50 text-red-700 border-red-200' },
  pipeline: { phase: 'delivery', label: 'Préparation', hex: '#94a3b8', icon: Package, color: 'bg-slate-50 text-slate-700 border-slate-200' },
  transit: { phase: 'delivery', label: 'En transit', hex: '#3b82f6', icon: Truck, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  issue: { phase: 'delivery', label: 'Incidents', hex: '#f97316', icon: AlertCircle, color: 'bg-orange-50 text-orange-700 border-orange-200' },
  done: { phase: 'delivery', label: 'Livré', hex: '#10b981', icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  return: { phase: 'delivery', label: 'Retours & annulations', hex: '#ef4444', icon: RotateCcw, color: 'bg-red-50 text-red-700 border-red-200' },
};

export const GROUP_ORDER: StatusGroup[] = [
  'in_progress', 'confirmed', 'lost',
  'pipeline', 'transit', 'issue', 'done', 'return',
];

export const GROUPS_BY_PHASE: Record<Phase, StatusGroup[]> = {
  confirmation: GROUP_ORDER.filter((g) => GROUP_META[g].phase === 'confirmation'),
  delivery: GROUP_ORDER.filter((g) => GROUP_META[g].phase === 'delivery'),
};

export const STATUS_CATALOG: Record<string, StatusMeta> = {
  // ===================== Phase 1 — Confirmation =====================

  // --- Claimed but no outcome yet ---------------------------------------
  NEW: { label: 'Nouveau', emoji: '🆕', group: 'in_progress', color: 'bg-slate-100 text-slate-700', gradient: 'from-slate-500 to-slate-600', hex: '#64748b', icon: Clock },
  LEAD: { label: 'Prospect', emoji: '👥', group: 'in_progress', color: 'bg-slate-100 text-slate-700', gradient: 'from-slate-500 to-slate-700', hex: '#475569', icon: Users },
  AVAILABLE: { label: 'Disponible (Pool)', emoji: '🟡', group: 'in_progress', color: 'bg-amber-100 text-amber-800', gradient: 'from-amber-400 to-amber-500', hex: '#eab308', icon: Clock },
  ASSIGNED: { label: 'Réclamé', emoji: '👤', group: 'in_progress', color: 'bg-cyan-100 text-cyan-800', gradient: 'from-cyan-500 to-cyan-600', hex: '#06b6d4', icon: Headphones },
  CONTACTED: { label: 'Contacté', emoji: '💬', group: 'in_progress', color: 'bg-blue-100 text-blue-800', gradient: 'from-blue-500 to-blue-600', hex: '#3b82f6', icon: Phone },
  INTERESTED: { label: 'Intéressé', emoji: '👍', group: 'in_progress', color: 'bg-green-100 text-green-800', gradient: 'from-green-500 to-green-600', hex: '#22c55e', icon: CheckCircle2 },
  CALL_LATER: { label: 'Rappel programmé', emoji: '📞', group: 'in_progress', color: 'bg-blue-100 text-blue-800', gradient: 'from-blue-500 to-blue-600', hex: '#3b82f6', icon: Calendar },
  CALLBACK_REQUESTED: { label: 'Rappel demandé', emoji: '🔁', group: 'in_progress', color: 'bg-orange-100 text-orange-800', gradient: 'from-orange-400 to-orange-500', hex: '#fb923c', icon: RotateCcw },

  // --- Sale closed on the call ------------------------------------------
  CONFIRMED: { label: 'Commande confirmée', emoji: '✅', group: 'confirmed', color: 'bg-emerald-100 text-emerald-800', gradient: 'from-emerald-500 to-emerald-600', hex: '#10b981', icon: CheckCircle2 },
  PRICE_CONFIRMED: { label: 'Prix confirmé', emoji: '💵', group: 'confirmed', color: 'bg-blue-100 text-blue-800', gradient: 'from-blue-500 to-blue-700', hex: '#2563eb', icon: Wallet },
  ORDERED: { label: 'Commandé', emoji: '🛒', group: 'confirmed', color: 'bg-emerald-100 text-emerald-900', gradient: 'from-emerald-600 to-emerald-700', hex: '#059669', icon: ShoppingCart },

  // --- Worked, no sale ---------------------------------------------------
  NO_REPLY: { label: 'Injoignable', emoji: '📵', group: 'lost', color: 'bg-slate-100 text-slate-700', gradient: 'from-slate-500 to-slate-600', hex: '#64748b', icon: PhoneOff },
  // Terminal: the retry loop gave up after MAX_NO_REPLY_RELEASES attempts, so
  // this lead is out of the pool for good. See backend/src/lib/leadRelease.ts.
  DEAD_NO_REPLY: { label: 'Injoignable définitif', emoji: '⛔', group: 'lost', color: 'bg-slate-200 text-slate-800', gradient: 'from-slate-600 to-slate-800', hex: '#475569', icon: PhoneOff },
  WRONG_ORDER: { label: 'Mauvaise commande', emoji: '⚠️', group: 'lost', color: 'bg-amber-100 text-amber-800', gradient: 'from-amber-500 to-amber-600', hex: '#f59e0b', icon: AlertCircle },
  CANCEL_REASON_PRICE: { label: 'Refus sur le prix', emoji: '💰', group: 'lost', color: 'bg-purple-100 text-purple-800', gradient: 'from-purple-500 to-purple-600', hex: '#a855f7', icon: Wallet },
  CANCEL_ORDER: { label: 'Commande annulée', emoji: '❌', group: 'lost', color: 'bg-red-100 text-red-800', gradient: 'from-red-500 to-red-600', hex: '#ef4444', icon: X },
  NOT_INTERESTED: { label: 'Pas intéressé', emoji: '👎', group: 'lost', color: 'bg-red-100 text-red-800', gradient: 'from-red-500 to-red-600', hex: '#ef4444', icon: X },
  UNREACHABLE: { label: 'Non joignable', emoji: '📴', group: 'lost', color: 'bg-gray-100 text-gray-700', gradient: 'from-gray-500 to-gray-600', hex: '#9ca3af', icon: PhoneOff },
  INVALID: { label: 'Invalide', emoji: '🚷', group: 'lost', color: 'bg-slate-200 text-slate-700', gradient: 'from-slate-400 to-slate-500', hex: '#94a3b8', icon: AlertCircle },
  PRICE_REJECTED: { label: 'Prix refusé', emoji: '💸', group: 'lost', color: 'bg-rose-100 text-rose-800', gradient: 'from-rose-500 to-rose-600', hex: '#f43f5e', icon: Wallet },

  // ===================== Phase 2 — Livraison Coliaty =====================

  // --- Préparation -------------------------------------------------------
  PENDING: { label: 'En attente', emoji: '⏳', group: 'pipeline', color: 'bg-amber-100 text-amber-800', gradient: 'from-amber-500 to-amber-600', hex: '#f59e0b', icon: Clock },
  PUSHED_TO_DELIVERY: { label: 'Envoyé en livraison', emoji: '📤', group: 'pipeline', color: 'bg-indigo-100 text-indigo-800', gradient: 'from-indigo-500 to-indigo-600', hex: '#818cf8', icon: Truck },
  NEW_PARCEL: { label: 'Nouveau colis', emoji: '📦', group: 'pipeline', color: 'bg-slate-100 text-slate-700', gradient: 'from-slate-500 to-slate-600', hex: '#94a3b8', icon: Box },
  WAITING_PREPARATION: { label: 'Attente préparation', emoji: '🧾', group: 'pipeline', color: 'bg-orange-100 text-orange-900', gradient: 'from-orange-600 to-amber-700', hex: '#fb923c', icon: Clock },
  ENCORE_PREPARED: { label: 'En préparation', emoji: '🔧', group: 'pipeline', color: 'bg-blue-100 text-blue-800', gradient: 'from-blue-500 to-blue-600', hex: '#60a5fa', icon: RefreshCw },
  PREPARED: { label: 'Préparé', emoji: '✔️', group: 'pipeline', color: 'bg-emerald-100 text-emerald-800', gradient: 'from-emerald-500 to-emerald-600', hex: '#34d399', icon: CheckCircle2 },
  WAITING_PICKUP: { label: 'Attente collecte', emoji: '🕒', group: 'pipeline', color: 'bg-amber-100 text-amber-800', gradient: 'from-amber-500 to-amber-600', hex: '#fbbf24', icon: Clock },
  IN_PRODUCTION: { label: 'En production', emoji: '🏭', group: 'pipeline', color: 'bg-amber-100 text-amber-900', gradient: 'from-amber-600 to-orange-600', hex: '#d97706', icon: RefreshCw },
  READY_FOR_SHIPPING: { label: 'Prêt à expédier', emoji: '📮', group: 'pipeline', color: 'bg-teal-100 text-teal-800', gradient: 'from-teal-500 to-teal-600', hex: '#14b8a6', icon: Package },

  // --- En transit --------------------------------------------------------
  PICKED_UP: { label: 'Collecté', emoji: '🚚', group: 'transit', color: 'bg-blue-100 text-blue-800', gradient: 'from-blue-500 to-blue-600', hex: '#3b82f6', icon: Package },
  SENT: { label: 'Expédié', emoji: '✈️', group: 'transit', color: 'bg-violet-100 text-violet-800', gradient: 'from-violet-500 to-purple-600', hex: '#8b5cf6', icon: Truck },
  RECEIVED: { label: 'Reçu (destination)', emoji: '📍', group: 'transit', color: 'bg-indigo-100 text-indigo-800', gradient: 'from-indigo-500 to-indigo-700', hex: '#6366f1', icon: MapPin },
  DISTRIBUTION: { label: 'En livraison', emoji: '🛵', group: 'transit', color: 'bg-cyan-100 text-cyan-800', gradient: 'from-cyan-500 to-cyan-600', hex: '#06b6d4', icon: Truck },
  PROGRAMMER: { label: 'Programmé', emoji: '📅', group: 'transit', color: 'bg-sky-100 text-sky-800', gradient: 'from-sky-500 to-sky-600', hex: '#0ea5e9', icon: Calendar },
  PROGRAMMER_AUTO: { label: 'Programmé (auto)', emoji: '🤖', group: 'transit', color: 'bg-purple-100 text-purple-800', gradient: 'from-purple-500 to-purple-600', hex: '#a855f7', icon: Calendar },
  SHIPPED: { label: 'Expédié (commande)', emoji: '🚛', group: 'transit', color: 'bg-violet-100 text-violet-800', gradient: 'from-violet-500 to-violet-600', hex: '#7c3aed', icon: Truck },

  // --- Incidents ---------------------------------------------------------
  POSTPONED: { label: 'Reporté', emoji: '⏭️', group: 'issue', color: 'bg-orange-100 text-orange-800', gradient: 'from-orange-500 to-orange-600', hex: '#f97316', icon: Calendar },
  NOANSWER: { label: 'Pas de réponse', emoji: '📵', group: 'issue', color: 'bg-rose-100 text-rose-800', gradient: 'from-rose-500 to-rose-600', hex: '#fb7185', icon: PhoneOff },
  ERR: { label: 'Tél. erroné', emoji: '☎️', group: 'issue', color: 'bg-rose-100 text-rose-900', gradient: 'from-rose-600 to-red-700', hex: '#f43f5e', icon: Phone },
  INCORRECT_ADDRESS: { label: 'Adresse erronée', emoji: '🗺️', group: 'issue', color: 'bg-pink-100 text-pink-800', gradient: 'from-pink-500 to-pink-600', hex: '#e11d48', icon: MapPin },

  // --- Livré -------------------------------------------------------------
  DELIVERED: { label: 'Livré', emoji: '🎉', group: 'done', color: 'bg-green-100 text-green-800', gradient: 'from-green-500 to-emerald-600', hex: '#10b981', icon: CheckCircle2 },

  // --- Retours & annulations ---------------------------------------------
  RETURNED: { label: 'Retourné', emoji: '↩️', group: 'return', color: 'bg-orange-100 text-orange-800', gradient: 'from-orange-500 to-orange-700', hex: '#f97316', icon: RotateCcw },
  REFUSE: { label: 'Refusé', emoji: '🚫', group: 'return', color: 'bg-red-100 text-red-800', gradient: 'from-red-500 to-red-600', hex: '#dc2626', icon: X },
  CANCELED: { label: 'Annulé (livreur)', emoji: '❌', group: 'return', color: 'bg-red-100 text-red-900', gradient: 'from-red-600 to-red-700', hex: '#ef4444', icon: X },
  CANCELED_BY_SELLER: { label: 'Annulé (vendeur)', emoji: '❌', group: 'return', color: 'bg-red-100 text-red-800', gradient: 'from-red-500 to-rose-600', hex: '#b91c1c', icon: X },
  CANCELED_BY_SYSTEM: { label: 'Annulé (système)', emoji: '❌', group: 'return', color: 'bg-red-200 text-red-900', gradient: 'from-red-700 to-red-900', hex: '#991b1b', icon: AlertCircle },
  CANCELLED: { label: 'Annulé', emoji: '🛑', group: 'return', color: 'bg-slate-200 text-slate-800', gradient: 'from-slate-500 to-slate-700', hex: '#64748b', icon: X },
  REFUNDED: { label: 'Remboursé', emoji: '💳', group: 'return', color: 'bg-teal-100 text-teal-800', gradient: 'from-teal-500 to-teal-700', hex: '#14b8a6', icon: RefreshCw },
};

/** Statuses grouped, in the order the UI should show them. */
export const STATUSES_BY_GROUP = GROUP_ORDER.reduce((acc, group) => {
  acc[group] = Object.keys(STATUS_CATALOG).filter((s) => STATUS_CATALOG[s].group === group);
  return acc;
}, {} as Record<StatusGroup, string[]>);

const UNKNOWN: StatusMeta = {
  label: 'Inconnu', emoji: '❔', group: 'in_progress', color: 'bg-gray-100 text-gray-600',
  gradient: 'from-gray-400 to-gray-500', hex: '#9ca3af', icon: AlertCircle,
};

/** Uppercases and swaps spaces for underscores so `en livraison` still matches. */
export const normalizeStatus = (status?: string | null) =>
  (status || '').toString().trim().toUpperCase().replace(/[\s-]+/g, '_');

/**
 * Never returns undefined. An unmapped carrier code — which the webhook can
 * write at any time — gets a readable Title Case label instead of leaking the
 * raw enum into the page.
 */
export function getStatusMeta(status?: string | null): StatusMeta {
  const key = normalizeStatus(status);
  if (STATUS_CATALOG[key]) return STATUS_CATALOG[key];
  if (!key) return UNKNOWN;
  return {
    ...UNKNOWN,
    label: key
      .toLowerCase()
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
  };
}

export const getStatusLabel = (status?: string | null) => getStatusMeta(status).label;

/** Per-group totals for a `{ status: count }` breakdown. Always covers 100%. */
export function groupTotals(breakdown: Record<string, number>) {
  const totals = GROUP_ORDER.reduce(
    (acc, g) => ({ ...acc, [g]: 0 }),
    {} as Record<StatusGroup, number>
  );
  Object.entries(breakdown).forEach(([status, count]) => {
    totals[getStatusMeta(status).group] += Number(count) || 0;
  });
  return totals;
}
