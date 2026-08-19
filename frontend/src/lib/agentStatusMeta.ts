/**
 * Labels, colours and grouping for every status an agent screen renders.
 *
 * Shared by the agent dashboard and the statistics page so a status is the same
 * colour, the same wording and the same family on both. Kept out of the pages
 * themselves because a colour that means "annulé" on one screen and "reporté" on
 * the other is worse than no colour at all.
 *
 * Every class string is written out in full: Tailwind cannot see through
 * `bg-${accent}-500`, so interpolated utilities would be purged from the build.
 */

/**
 * The six outcomes an agent can pick under "Résultat de la confirmation" on the
 * lead page — same order, same wording as the buttons there.
 */
export const CONFIRMATION_OUTCOMES = [
  { key: 'CALL_LATER', emoji: '📞', label: 'CALL LATER', hint: 'Rappel programmé', color: '#3b82f6', tile: 'bg-blue-50/70 border-blue-100 text-blue-700', bar: 'bg-blue-500' },
  { key: 'NO_REPLY', emoji: '📵', label: 'NO REPLY', hint: 'Injoignable', color: '#64748b', tile: 'bg-slate-50 border-slate-200 text-slate-700', bar: 'bg-slate-500' },
  { key: 'CONFIRMED', emoji: '✅', label: 'CONFIRMED', hint: 'Commande confirmée', color: '#10b981', tile: 'bg-emerald-50/70 border-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
  { key: 'WRONG_ORDER', emoji: '⚠️', label: 'WRONG ORDER', hint: 'Mauvaise commande', color: '#f59e0b', tile: 'bg-amber-50/70 border-amber-100 text-amber-700', bar: 'bg-amber-500' },
  { key: 'CANCEL_REASON_PRICE', emoji: '💰', label: 'CANCEL REASON PRICE', hint: 'Refus sur le prix', color: '#a855f7', tile: 'bg-purple-50/70 border-purple-100 text-purple-700', bar: 'bg-purple-500' },
  { key: 'CANCEL_ORDER', emoji: '❌', label: 'CANCEL ORDER', hint: 'Commande annulée', color: '#ef4444', tile: 'bg-red-50/70 border-red-100 text-red-700', bar: 'bg-red-500' },
] as const;

/**
 * Claimed but not yet called — a state, not a result. Listed alongside the six
 * outcomes so the whole pipeline is visible at a glance, but it stays out of the
 * confirmation-rate denominator: counting un-called leads as failures would drag
 * the rate down for work the agent hasn't had a chance to do yet.
 */
export const IN_PROGRESS_ROW = {
  key: 'ASSIGNED',
  emoji: '👤',
  label: 'ASSIGNED',
  hint: 'Réclamé, appel à passer',
  color: '#06b6d4',
  tile: 'bg-cyan-50/70 border-cyan-100 text-cyan-700',
  bar: 'bg-cyan-500',
} as const;

/** The hand-off to Coliaty. Folded into CONFIRMED per lead, its own action per action. */
export const PUSHED_ROW = {
  key: 'PUSHED_TO_DELIVERY',
  emoji: '🚀',
  label: 'PUSHED TO DELIVERY',
  hint: 'Envoyé à Coliaty',
  color: '#8b5cf6',
  tile: 'bg-violet-50/70 border-violet-100 text-violet-700',
  bar: 'bg-violet-500',
} as const;

export type OutcomeMeta = {
  key: string; emoji: string; label: string; hint: string;
  color: string; tile: string; bar: string;
};

/** Every action the dashboard scores an agent on, in tile order. */
export const AGENT_ACTIONS: OutcomeMeta[] = [
  IN_PROGRESS_ROW,
  ...CONFIRMATION_OUTCOMES,
  PUSHED_ROW,
];

export const actionMeta = (key: string): OutcomeMeta =>
  AGENT_ACTIONS.find(a => a.key === key) ?? {
    key,
    emoji: '•',
    label: key.replace(/_/g, ' '),
    hint: '',
    color: '#94a3b8',
    tile: 'bg-slate-50 border-slate-200 text-slate-700',
    bar: 'bg-slate-400',
  };

export type DeliveryGroup = 'pipeline' | 'transit' | 'issue' | 'done' | 'return';

export const DELIVERY_GROUPS: Record<DeliveryGroup, { label: string; order: number; dot: string }> = {
  pipeline: { label: 'Préparation', order: 0, dot: 'bg-slate-400' },
  transit: { label: 'En transit', order: 1, dot: 'bg-blue-500' },
  issue: { label: 'Incidents', order: 2, dot: 'bg-orange-500' },
  done: { label: 'Livré', order: 3, dot: 'bg-emerald-500' },
  return: { label: 'Retours & annulations', order: 4, dot: 'bg-red-500' },
};

/** Every Coliaty parcel status, labelled and grouped. */
export const DELIVERY_STATUSES: Record<string, { label: string; emoji: string; group: DeliveryGroup; color: string }> = {
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
