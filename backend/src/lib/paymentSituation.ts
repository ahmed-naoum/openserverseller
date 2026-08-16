/**
 * The values `Lead.paymentSituation` can hold, and the one question most call
 * sites actually ask of it: "does this parcel already carry a facture?".
 *
 * `FACTURED` is written by the admin when the vendor/influencer invoice is
 * generated, and by the returns flow when a return is invoiced. `FACTURED-CC`
 * is written by /agent-facturation once a call-center agent has issued their
 * own facture for the same parcel — it is `FACTURED`, one step further, so any
 * check written as `=== 'FACTURED'` silently stops recognising an invoiced
 * parcel the moment the agent bills it. Use `FACTURED_SITUATIONS`/`isFactured`
 * for "already invoiced", and the literal 'FACTURED' only where the agent's
 * step specifically matters.
 */

export const PAYMENT_SITUATIONS = ['NOT_PAID', 'PAID', 'FACTURED', 'FACTURED-CC'] as const;

/** Older rows still carry these French labels; accepted on write for parity. */
export const LEGACY_PAYMENT_SITUATIONS = ['Payé', 'no Payé'] as const;

/** Every spelling a write endpoint accepts. */
export const WRITABLE_PAYMENT_SITUATIONS: string[] = [
  ...PAYMENT_SITUATIONS,
  ...LEGACY_PAYMENT_SITUATIONS,
];

/** Both facture states — the vendor's and the call-center agent's. */
export const FACTURED_SITUATIONS = ['FACTURED', 'FACTURED-CC'] as const;

export const isFactured = (situation?: string | null): boolean =>
  situation === 'FACTURED' || situation === 'FACTURED-CC';
