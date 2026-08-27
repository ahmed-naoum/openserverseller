/**
 * What one WhatsApp AI reply costs the account.
 *
 * MONEY IS STORED IN INTEGER CENTS, never as a float — the same rule, and for
 * the same reason, as lib/sheetPricing.ts: a tariff like $0.02 has no exact
 * binary representation, so accumulating it across thousands of replies drifts
 * and a ledger that no longer sums to its balance cannot be audited. So
 * `WaCreditAccount.balance`, `WaCreditTransaction.amount` and `.balanceAfter`
 * all hold CENTS, and every division happens at the edges (display, and the
 * replies-remaining figure) rather than in the arithmetic.
 *
 * WHY PER REPLY AND NOT PER TOKEN. Token spend is real but it is not a unit a
 * seller can reason about or budget against, and it varies by an order of
 * magnitude between a one-word "ok" and a photo-heavy negotiation. Charging a
 * flat price per agent reply gives the seller the same mental model they
 * already have from Google Sheets credits — one action, one price. Actual token
 * cost is still recorded per turn (WhatsappAgentTurn.costCents, rolled up into
 * WhatsappAgentUsage) so an admin can see what an account really costs against
 * what it was billed, and move the tariff when the two drift apart.
 *
 * Unlike sheetPricing, the tariff is read through getSecret rather than
 * process.env: it is an admin-tunable number on the Variables & Secrets screen
 * (WA_REPLY_PRICE_CENTS), so it must not be frozen into a module constant at
 * import time — the secret cache is only populated later, by loadSecrets().
 */

import { getSecretNumber } from './secretStore.js';

/** Cents charged per agent reply. $0.02 by default. */
export function replyPriceCents(): number {
  const n = getSecretNumber('WA_REPLY_PRICE_CENTS', 2);
  return Number.isInteger(n) && n > 0 ? n : 2;
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

/** How many whole replies a balance can still pay for. */
export function centsToReplies(cents: number): number {
  const n = Number(cents) || 0;
  if (n <= 0) return 0;
  return Math.floor(n / replyPriceCents());
}

/** What N replies cost. */
export function repliesToCents(replies: number): number {
  return Math.max(0, Math.trunc(Number(replies) || 0)) * replyPriceCents();
}

/**
 * What a turn actually cost us in model tokens, in cents.
 *
 * Costs on AiModel are quoted per MILLION tokens, so the division is by 1e6.
 * Rounded up: a turn that costs a fraction of a cent must not be recorded as
 * free, or a busy account shows a plausible-looking zero.
 *
 * Cache reads are billed at a tenth of the input rate and cache writes at
 * 1.25x, which is the standard Anthropic ratio. Both are approximations kept
 * here rather than as two more columns on AiModel, because this figure exists
 * to tell an admin whether the flat tariff is roughly right — not to reconcile
 * an invoice.
 */
export function tokenCostCents(
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  },
  model: { inputCostPerMTokCents?: number; outputCostPerMTokCents?: number } | null | undefined
): number {
  if (!model) return 0;
  const inRate = Number(model.inputCostPerMTokCents) || 0;
  const outRate = Number(model.outputCostPerMTokCents) || 0;
  if (!inRate && !outRate) return 0;

  const billable =
    (Number(usage.inputTokens) || 0) * inRate +
    (Number(usage.outputTokens) || 0) * outRate +
    (Number(usage.cacheReadTokens) || 0) * inRate * 0.1 +
    (Number(usage.cacheWriteTokens) || 0) * inRate * 1.25;

  return Math.ceil(billable / 1_000_000);
}
