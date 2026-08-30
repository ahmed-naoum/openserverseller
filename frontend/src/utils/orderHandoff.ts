/**
 * Carries what was just ordered from the landing page to the thank-you page.
 *
 * The two pages are separate documents, not a React transition: the compiled
 * landing page finishes checkout with `location.replace(...)`
 * (backend/src/services/landingCompiler/runtime/checkout.ts), which unloads the
 * document and discards router state. So the handoff has to survive a full
 * navigation, and it must work identically for the React page and the compiled
 * one.
 *
 * sessionStorage rather than query parameters, deliberately: the payload carries
 * the buyer's name and city, and a query string ends up in the address bar, in
 * `document.referrer` for anything the thank-you page loads, and in server logs.
 * sessionStorage is same-tab, same-origin, and dies with the tab.
 *
 * Treated as a hint, never as truth. The thank-you page renders correctly with
 * nothing here — a visitor who refreshes, opens the URL directly, or blocks
 * storage simply sees the page without the order summary.
 */

const KEY = 'sc_order_handoff';

/** How long a handoff stays usable. Long enough to survive a slow page load. */
const MAX_AGE_MS = 10 * 60 * 1000;

export interface OrderHandoff {
  /** Referral code the order was placed on, so a stale handoff is not shown on another page. */
  code: string;
  /** Server-assigned order/lead id, when the submit endpoint returned one. */
  orderId?: string | number | null;
  fullName?: string;
  city?: string;
  /** Human label of the chosen pack/variant. */
  variantName?: string | null;
  /** Unit or pack price as displayed at checkout. Never multiplied by quantity. */
  price?: number | null;
  currency?: string;
  productName?: string | null;
  /**
   * Event id the submit POSTed to the backend, which forwarded it to Meta's
   * Conversions API. The thank-you page's fbq call must carry the same id so
   * Meta pairs the two events instead of counting the order twice.
   */
  capiEventId?: string | null;
  /** Epoch ms, set on write. */
  at: number;
}

/** Stores the handoff. Never throws — storage may be unavailable or full. */
export function writeOrderHandoff(value: Omit<OrderHandoff, 'at'>): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...value, at: Date.now() }));
  } catch {
    /* private mode, quota, or storage disabled — the page degrades gracefully */
  }
}

/**
 * Reads the handoff for `code`, or null.
 *
 * Returns null for a handoff belonging to a different link or older than
 * MAX_AGE_MS, so a stale entry cannot leak one order's details onto another
 * page. Reading does not consume it: React may render twice (StrictMode) and
 * the visitor may refresh.
 */
export function readOrderHandoff(code: string): OrderHandoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrderHandoff;
    if (!parsed || parsed.code !== code) return null;
    if (typeof parsed.at !== 'number' || Date.now() - parsed.at > MAX_AGE_MS) {
      clearOrderHandoff();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearOrderHandoff(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

/** Where a given link's thank-you page lives. */
export function thankYouPath(code: string): string {
  return `/r/${encodeURIComponent(code)}/thank-you`;
}
