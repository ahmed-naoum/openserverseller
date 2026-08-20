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
