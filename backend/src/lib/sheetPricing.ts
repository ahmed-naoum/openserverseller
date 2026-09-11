/**
 * What one lead costs to write into a seller's Google Sheet.
 *
 * MONEY IS STORED IN INTEGER CENTS, never as a float. The tariff is $0.05, and 0.05
 * has no exact binary representation — accumulating it across thousands of leads
 * drifts, and a ledger that no longer sums to the balance is impossible to audit.
 * So `SheetCreditAccount.balance`, `SheetCreditTransaction.amount` and
 * `.balanceAfter` all hold CENTS, and every division happens at the edges (display,
 * and the leads-remaining figure) rather than in the arithmetic.
 *
 * Those columns used to hold a count of "credits" at 1 credit per lead. Their type is
 * unchanged; only the unit moved, which is why the migration multiplies old balances
 * by the price — an account that could send 3 leads can still send exactly 3.
 */

const num = (key: string, fallback: number): number => {
  const raw = process.env[key];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

/** Cents charged per lead written. $0.05 by default. */
export const LEAD_PRICE_CENTS = num('SHEET_LEAD_PRICE_CENTS', 5);

/**
 * What one ABANDONED CART costs to write into a seller's Google Sheet.
 *
 * Priced below a real lead, and priced by how it was sent, because the two are
 * not the same product. A cart is a phone number the customer never confirmed:
 * it is worth less, it converts worse, and a seller who leaves the automatic
 * stream on is handing us predictable volume, so it is charged 2c. Pushing one
 * by hand from the carts page is a deliberate, one-off recovery and is charged
 * the full 5c a lead costs.
 *
 * NOT applied to ordinary leads — those stay on LEAD_PRICE_CENTS whichever way
 * they reach the sheet. The discriminator is the lead's own `source`
 * ('ABANDONED_CART') combined with the push job's `origin`, both of which are
 * already columns; nothing new is stored to decide a price.
 *
 * The reservation gate (services/leadCredits.service.ts) deliberately keeps
 * reserving at the full LEAD_PRICE_CENTS for every lead, carts included. It is
 * a visibility lock, and reserving MORE than we later charge can only ever
 * leave a seller with credit to spare — the opposite mistake would let the
 * balance be overdrawn by rows the gate had already promised were affordable.
 */
export const CART_PRICE_AUTO_CENTS = num('SHEET_CART_PRICE_AUTO_CENTS', 2);
export const CART_PRICE_MANUAL_CENTS = num('SHEET_CART_PRICE_MANUAL_CENTS', 5);

/** A lead's source, as far as pricing is concerned. */
export const ABANDONED_CART_SOURCE = 'ABANDONED_CART';

/**
 * The tariff for one row, in cents.
 *
 * A pack-covered row never reaches this — `chargeCredits` books those at zero
 * against the subscription — so this is only ever the cents tariff.
 */
export function priceCentsFor(source: string | null | undefined, origin: string | null | undefined): number {
  if (source !== ABANDONED_CART_SOURCE) return LEAD_PRICE_CENTS;
  return origin === 'AUTO' ? CART_PRICE_AUTO_CENTS : CART_PRICE_MANUAL_CENTS;
}

/** The currency the amounts are denominated in, for display. */
export const CURRENCY_SYMBOL = '$';

/** `1234` -> `"12.34"`. */
export function centsToAmount(cents: number): string {
  const n = Number(cents) || 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** `1234` -> `"$12.34"`. */
export function formatMoney(cents: number): string {
  return `${CURRENCY_SYMBOL}${centsToAmount(cents)}`;
}

/**
 * Dollars from a form, to cents. Rounds rather than truncates so an admin typing
 * `9.99` cannot lose a cent to floating point (9.99 * 100 === 998.9999...).
 */
export function amountToCents(amount: number | string): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** How many whole leads a balance can still pay for. */
export function centsToLeads(cents: number): number {
  const n = Number(cents) || 0;
  if (n <= 0) return 0;
  return Math.floor(n / LEAD_PRICE_CENTS);
}

/** What N leads cost. */
export function leadsToCents(leads: number): number {
  return Math.max(0, Math.trunc(Number(leads) || 0)) * LEAD_PRICE_CENTS;
}
