/**
 * Which kind of event is this notification? Mirror of the mobile app's
 * `src/services/notificationKinds.ts` (keep both files identical): the kind picks
 * the Android notification channel, and therefore the sound the phone plays when
 * the push arrives while the SILACOD app is closed.
 *
 * Kinds (one distinct sound file / Android channel each):
 *   money    💰  new sale / new lead / new order received
 *   confirm  ✅  lead or order confirmed
 *   success  ✨  delivered, payout approved / paid, wallet credited
 *   error    ⚠️  cancelled, returned, refused, rejected, incident
 *   ticket   🎫  support reply, complaint, chat message
 *   bell     🔔  lead assigned, shipping / status update, announcements, anything else
 */
export type NotificationKind = 'money' | 'confirm' | 'success' | 'error' | 'ticket' | 'bell';

export const NOTIFICATION_KINDS: NotificationKind[] = ['money', 'confirm', 'success', 'error', 'ticket', 'bell'];

/** Types the backend sends that should be matched exactly (not by substring). */
const EXACT_TYPE_KINDS: Record<string, NotificationKind> = {
  DIRECT: 'ticket',
  CHAT: 'ticket',
  CHAT_MESSAGE: 'ticket',
  MESSAGE: 'ticket',
  BROADCAST: 'bell',
  SYSTEM: 'bell',
  CREDIT: 'success',
  PAYOUT: 'success',
  SALE: 'money',
  LEAD: 'money',
  ORDER: 'money',
};

/**
 * Ordered rules: the FIRST rule whose keyword appears in the haystack wins.
 * Order matters: "LEAD_CONFIRMED" must resolve to `confirm` before the generic
 * "LEAD" fallback resolves to `money`, "PAYOUT_REJECTED" must be `error` before
 * "PAYOUT" is `success`, etc.
 */
const RULES: Array<{ kind: NotificationKind; keywords: string[] }> = [
  // 1. Problems, cancellations, refusals
  {
    kind: 'error',
    keywords: [
      'CANCEL', 'ANNUL', 'REJECT', 'REFUS', 'RETURN', 'RETOUR', 'FAIL', 'ECHEC', 'ÉCHEC',
      'ERROR', 'ERREUR', 'WRONG', 'INCORRECT', 'BLOCK', 'BLOQU', 'SUSPEND', 'INCIDENT', 'PROBLEM', 'PROBLÈME',
    ],
  },
  // 2. Support, complaints, conversations
  {
    kind: 'ticket',
    keywords: ['TICKET', 'SUPPORT', 'RÉCLAMATION', 'RECLAMATION', 'REPLY', 'RÉPONSE', 'REPONSE', 'CONVERSATION', 'NOUVEAU MESSAGE'],
  },
  // 3. Confirmations (lead confirmed, order confirmed, price confirmed)
  {
    kind: 'confirm',
    keywords: ['CONFIRM'],
  },
  // 4. Positive outcomes: delivered, paid, payout approved, wallet credited
  {
    kind: 'success',
    keywords: [
      'DELIVERED', 'LIVRÉ', 'LIVREE', 'PAYOUT', 'VIREMENT', 'WALLET', 'PORTEFEUILLE', 'CREDIT', 'CRÉDIT',
      'RETRAIT', 'WITHDRAW', 'COMMISSION', 'APPROV', 'APPROUV', 'ENCAISS', 'PAID', 'PAYÉ', 'COMPLETED', 'TERMIN', 'GAIN',
    ],
  },
  // 5. New business: new sale / lead / order
  {
    kind: 'money',
    keywords: [
      'NEW_LEAD', 'LEAD_CREATED', 'NEW_ORDER', 'ORDER_CREATED', 'STORE_ORDER', 'AVAILABLE_LEAD', 'NEW_SALE', 'SALE', 'VENTE',
      'NOUVELLE COMMANDE', 'NOUVEAU LEAD', 'NOUVEAU PROSPECT', 'NOUVELLE VENTE', 'NEW_PARCEL',
    ],
  },
  // 6. Assignments, status / shipping updates, announcements
  {
    kind: 'bell',
    keywords: [
      'ASSIGN', 'STATUS', 'STATUT', 'SHIPPED', 'EXPÉD', 'EXPED', 'PICKUP', 'PICKED', 'TRANSIT', 'DELIVERY', 'LIVRAISON',
      'PREPAR', 'POSTPON', 'REPORT', 'CALL_LATER', 'NO_REPLY', 'NOANSWER', 'BROADCAST', 'SYSTEM', 'ANNONCE', 'RAPPEL', 'REMINDER',
    ],
  },
  // 7. Last resort: anything that still smells like a lead / order / payment is a sale
  {
    kind: 'money',
    keywords: ['LEAD', 'ORDER', 'COMMANDE', 'PROSPECT', 'MONEY', 'PAY'],
  },
];

/**
 * Resolve the notification kind from its backend type and (optionally) its text.
 * The type is checked alone first (it is the most reliable signal), then type + title + body together.
 */
export function classifyNotification(type?: string | null, title?: string | null, body?: string | null): NotificationKind {
  const t = (type || '').trim().toUpperCase();

  if (t && EXACT_TYPE_KINDS[t]) return EXACT_TYPE_KINDS[t];

  const text = `${(title || '').toUpperCase()} ${(body || '').toUpperCase()}`;
  const fromType = matchRules(t);

  // A specific type (LEAD_CONFIRMED, PAYOUT_REJECTED, NEW_LEAD...) is authoritative.
  if (fromType && fromType !== 'bell') return fromType;

  // A generic type (ORDER_STATUS_CHANGED, LEAD_ASSIGNED...) may carry the real
  // outcome in its text ("Commande X - DELIVERED"): look for an outcome kind there,
  // but never re-classify a generic update as a brand-new sale.
  if (fromType === 'bell') {
    return matchRules(text, OUTCOME_KINDS) || 'bell';
  }

  return matchRules(`${t} ${text}`) || 'bell';
}

/** Kinds that describe what happened to something, as opposed to something new arriving. */
const OUTCOME_KINDS: NotificationKind[] = ['error', 'ticket', 'confirm', 'success'];

function matchRules(haystack: string, onlyKinds?: NotificationKind[]): NotificationKind | null {
  if (!haystack.trim()) return null;
  for (const rule of RULES) {
    if (onlyKinds && !onlyKinds.includes(rule.kind)) continue;
    if (rule.keywords.some((k) => haystack.includes(k))) return rule.kind;
  }
  return null;
}

/** Fallback titles when a realtime payload carries no title of its own. */
export const KIND_LABELS: Record<NotificationKind, string> = {
  money: '💰 Nouvelle vente / lead reçu',
  confirm: '✅ Confirmation reçue',
  success: '✨ Bonne nouvelle SILACOD',
  error: '⚠️ Alerte SILACOD',
  ticket: '🎫 Support SILACOD',
  bell: '🔔 Notification SILACOD',
};

/** Android notification channel ids created by the SILACOD mobile app (see its notifications.ts). */
export const ANDROID_CHANNEL_FOR_KIND: Record<NotificationKind, string> = {
  money: 'silacod_sales',
  confirm: 'silacod_orders',
  ticket: 'silacod_support',
  success: 'silacod_success',
  error: 'silacod_alerts',
  bell: 'silacod_default',
};

/** Sound files bundled in the mobile app: Android res/raw name (no extension) and iOS bundle name. */
export const SOUND_FILE_FOR_KIND: Record<NotificationKind, { android: string; ios: string }> = {
  money: { android: 'money_sound', ios: 'Money_sound.mp3' },
  confirm: { android: 'correct_confirmation', ios: 'correct-confirmation.mp3' },
  ticket: { android: 'tick_notification_sound', ios: 'tick-notification-sound.mp3' },
  success: { android: 'success', ios: 'success.mp3' },
  error: { android: 'error', ios: 'error.mp3' },
  bell: { android: 'bell_ding', ios: 'bell-ding.mp3' },
};
