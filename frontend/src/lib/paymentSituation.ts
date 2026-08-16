/**
 * The complete catalogue of values `Lead.paymentSituation` can actually hold.
 *
 * The column is a free-form String four systems write into:
 *   - the admin, from Payment Monitoring — `NOT_PAID` / `PAID` / `FACTURED`
 *   - the returns flow, which invoices a return as `FACTURED`
 *   - the call-center agent, from /agent/facturation — `FACTURED` becomes
 *     `FACTURED-CC` once the agent has issued their own facture for the parcel
 *   - very old rows, which still carry the French labels `Payé` / `no Payé`
 *
 * Every screen used to keep its own three-entry map, so `FACTURED-CC` rendered
 * as a raw code (or, worse, was normalised down to "Non payé") everywhere but
 * the agent's own page. This is the single list to reach for instead.
 */

export type PaymentSituationCode = 'NOT_PAID' | 'PAID' | 'FACTURED' | 'FACTURED-CC';

export interface PaymentSituationMeta {
  /** French label shown to users. */
  label: string;
  /** Badge classes — background, text and border together. */
  badge: string;
  /** Text colour alone, for the pages that split the two. */
  text: string;
  /** Background + border alone, for the pages that split the two. */
  bg: string;
  /** Solid colour for charts. */
  hex: string;
  /** One line explaining what the value means, for tooltips. */
  hint: string;
}

export const PAYMENT_SITUATION_META: Record<PaymentSituationCode, PaymentSituationMeta> = {
  NOT_PAID: {
    label: 'Non payé',
    badge: 'bg-rose-50 text-rose-600 border-rose-200',
    text: 'text-rose-600',
    bg: 'bg-rose-50 border-rose-100',
    hex: '#f43f5e',
    hint: "Le colis n'a pas encore été encaissé.",
  },
  PAID: {
    label: 'Payé',
    badge: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    text: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-100',
    hex: '#10b981',
    hint: "Encaissé, en attente de la facture de l'admin.",
  },
  FACTURED: {
    label: 'Facturé',
    badge: 'bg-blue-50 text-blue-600 border-blue-200',
    text: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-100',
    hex: '#3b82f6',
    hint: "Facturé au vendeur / à l'influenceur. Facturable par l'agent call center.",
  },
  'FACTURED-CC': {
    label: 'Facturé CC',
    badge: 'bg-violet-50 text-violet-600 border-violet-200',
    text: 'text-violet-600',
    bg: 'bg-violet-50 border-violet-100',
    hex: '#8b5cf6',
    hint: "L'agent call center a généré sa facture pour ce colis — déjà payé à l'agent.",
  },
};

/** Order the codes appear in filters and legends. */
export const PAYMENT_SITUATION_CODES: PaymentSituationCode[] = [
  'NOT_PAID',
  'PAID',
  'FACTURED',
  'FACTURED-CC',
];

/** Ready-made `<option>` data: `[{ value, label }]` in display order. */
export const PAYMENT_SITUATION_OPTIONS = PAYMENT_SITUATION_CODES.map(code => ({
  value: code,
  ...PAYMENT_SITUATION_META[code],
}));

/** Legacy spellings still present in the database, mapped onto a current code. */
const ALIASES: Record<string, PaymentSituationCode> = {
  'Payé': 'PAID',
  'PAYÉ': 'PAID',
  'no Payé': 'NOT_PAID',
  'NO PAYÉ': 'NOT_PAID',
  'FACTURE': 'FACTURED',
  'FACTURÉ': 'FACTURED',
  'FACTURÉE': 'FACTURED',
  'FACTUREE': 'FACTURED',
  'FACTURED-CC': 'FACTURED-CC',
  'FACTURÉ-CC': 'FACTURED-CC',
};

/** Any stored spelling → a current code. Unknown values fall back to NOT_PAID. */
export function normalizePaymentSituation(situation?: string | null): PaymentSituationCode {
  if (!situation) return 'NOT_PAID';
  const raw = String(situation).trim();
  if (raw in PAYMENT_SITUATION_META) return raw as PaymentSituationCode;
  const upper = raw.toUpperCase();
  return ALIASES[raw] || ALIASES[upper] || 'NOT_PAID';
}

export function paymentSituationMeta(situation?: string | null): PaymentSituationMeta {
  return PAYMENT_SITUATION_META[normalizePaymentSituation(situation)];
}

export function paymentSituationLabel(situation?: string | null): string {
  return paymentSituationMeta(situation).label;
}

/** True once a parcel carries a facture — the vendor one or the agent one. */
export function isFactured(situation?: string | null): boolean {
  const code = normalizePaymentSituation(situation);
  return code === 'FACTURED' || code === 'FACTURED-CC';
}

/** True for the parcels a call-center agent may still bill. */
export function isAgentBillable(situation?: string | null): boolean {
  return normalizePaymentSituation(situation) === 'FACTURED';
}
