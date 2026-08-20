/**
 * The one place Google Sheets money is turned into text.
 *
 * The balance, every ledger amount and every tariff the API sends are INTEGER
 * CENTS — `15` means $0.15 — and the seller must read the same figure on the
 * header chip, in the popover and on the leads panel. Each surface inventing its
 * own rounding is how "$0.15" on one chip becomes "$0.2" on the next.
 *
 * The string is built from the integer — floor for the dollars, the remainder
 * padded for the cents — and never with `toFixed` on `cents / 100`: 0.1 and 0.05
 * have no exact binary form, so a divided float prints "0.15000000000000002" as
 * readily as it prints "0.15", and `toFixed` only hides that one digit later.
 *
 * The tariff is NOT a constant here. The server owns it and sends it as
 * `gate.priceCents`, so a price change is a server-side change — pass it in.
 */

/** The currency the balances are denominated in. Mirrors the server's. */
export const CURRENCY_SYMBOL = '$';

/** `1234` -> `"$12.34"`, `-5` -> `"-$0.05"`. Sign in front of the symbol. */
export function formatMoney(cents: number): string {
  const n = Math.trunc(Number(cents) || 0);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}${CURRENCY_SYMBOL}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/**
 * How many WHOLE leads a balance can pay for — what the server calls `affordable`.
 *
 * A tariff of zero or less would divide by nothing (or hand back Infinity), which
 * on screen becomes an unlimited quota the account does not have, so it answers 0.
 */
export function centsToLeads(cents: number, priceCents: number): number {
  const price = Math.trunc(Number(priceCents) || 0);
  const n = Math.trunc(Number(cents) || 0);
  if (price <= 0 || n <= 0) return 0;
  return Math.floor(n / price);
}

/** What N leads cost, in cents. The inverse of `centsToLeads`. */
export function leadsToCents(leads: number, priceCents: number): number {
  const price = Math.trunc(Number(priceCents) || 0);
  if (price <= 0) return 0;
  return Math.max(0, Math.trunc(Number(leads) || 0)) * price;
}
