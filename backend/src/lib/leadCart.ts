/**
 * The basket a store checkout captured, read back the one way every consumer
 * agrees on.
 *
 * A landing page sells one product in one pack, and three columns on the lead
 * carry that (`variantOptionId`, `variantName`, `packQuantity`). A storefront
 * sells a basket, which does not fit in a column, so `Lead.cartItems` holds a
 * snapshot of it as JSON — written once by `executeStoreCheckout` and never
 * edited afterwards.
 *
 * That snapshot is read by the courier hand-off (to build the order, the parcel
 * and the stock movements), by the price resolver, by the Sheets writer and by
 * three screens. Each of those parsing it its own way is how a basket ends up
 * priced one way on the agent's screen and another way on the parcel, so the
 * parsing lives here exactly once.
 *
 * Everything is defensive. This is a JSON column, not a table: rows may predate
 * a field, carry a string where a number belongs, or have been written by an
 * older build. A line that cannot be trusted is dropped rather than guessed at
 * — a basket that silently loses a line is visible on the agent's screen, while
 * a basket that invents a quantity is not.
 */

/** One basket line, as `executeStoreCheckout` writes it. */
export interface CartLine {
  productId: number;
  productName: string;
  sku: string | null;
  imageUrl: string | null;
  variantName: string | null;
  variantOptionId: string | null;
  quantity: number;
  unitPriceMad: number;
  totalPriceMad: number;
}

/** The lead fields these helpers read. All optional — most leads have none. */
export interface CartLead {
  cartItems?: any;
  totalAmountMad?: number | null;
  shippingFeeMad?: number | null;
}

/** Same ceiling the checkout clamps a line to, so a re-read cannot exceed it. */
const MAX_QTY = 99;

/** Coliaty rejects a parcel whose content is under 5 or over 100 characters. */
export const PARCEL_CONTENT_MIN = 5;
export const PARCEL_CONTENT_MAX = 100;

const asMoney = (value: any): number => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const asQuantity = (value: any): number | null => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return null;
  return Math.min(MAX_QTY, n);
};

const asText = (value: any, max: number): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().slice(0, max);
  return text || null;
};

/**
 * The basket as trustworthy lines, or an empty array for every lead that never
 * had one.
 *
 * An empty result is the signal callers branch on: it means "not a store
 * basket, behave exactly as you did before this existed". So it must also be
 * what a malformed column returns — a store lead whose snapshot cannot be read
 * falls back to the single-product path rather than shipping nothing.
 */
export function parseCartItems(lead: CartLead | null | undefined): CartLine[] {
  const raw = lead?.cartItems;
  if (!raw) return [];

  let list: any = raw;
  // jsonb on new rows, a JSON string on anything written through a client that
  // stringified it first. Both shapes are in the wild for `customStructure`
  // already (see leadPricing.ts), so both are handled here too.
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];

  const lines: CartLine[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;

    const productId = Number(entry.productId);
    const quantity = asQuantity(entry.quantity);
    // No product and no quantity means no stock movement and no order item can
    // be built from this line. Nothing downstream can recover it, so it goes.
    if (!Number.isInteger(productId) || productId <= 0 || !quantity) continue;

    const unitPriceMad = asMoney(entry.unitPriceMad);
    // Trust the stored line total, but only when it agrees with its own parts.
    // A disagreement means one of the two was edited by hand; the unit price
    // times the quantity is the figure the customer was shown adding up.
    const storedTotal = asMoney(entry.totalPriceMad);
    const derivedTotal = unitPriceMad * quantity;
    const totalPriceMad =
      Math.abs(storedTotal - derivedTotal) < 0.01 ? storedTotal : derivedTotal;

    lines.push({
      productId,
      productName: asText(entry.productName, 200) || `#${productId}`,
      sku: asText(entry.sku, 64),
      imageUrl: asText(entry.imageUrl, 500),
      variantName: asText(entry.variantName, 120),
      variantOptionId: asText(entry.variantOptionId, 64),
      quantity,
      unitPriceMad,
      totalPriceMad,
    });
  }

  return lines;
}

/** True when this lead carries a readable basket. */
export function hasCart(lead: CartLead | null | undefined): boolean {
  return parseCartItems(lead).length > 0;
}

/** Goods total, shipping excluded. */
export function cartSubtotalMad(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.totalPriceMad, 0);
}

/** Units of stock the whole basket moves. */
export function cartTotalUnits(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * What the courier collects: goods plus the shipping the store charged.
 *
 * The stored `totalAmountMad` is preferred over re-adding the lines, because it
 * is what the customer saw on the checkout screen and agreed to pay. The sum is
 * only used when that column is missing, which is every row written before it
 * existed.
 */
export function cartTotalMad(lead: CartLead, lines?: CartLine[]): number {
  const stored = Number(lead?.totalAmountMad);
  if (Number.isFinite(stored) && stored > 0) return stored;

  const items = lines ?? parseCartItems(lead);
  return cartSubtotalMad(items) + asMoney(lead?.shippingFeeMad);
}

/**
 * A one-line description of the basket, for a screen or a column.
 *
 * `2x Chemise blanche (L) + 1x Ceinture cuir`. Truncation is reported rather
 * than hidden: a parcel label that stops mid-word tells the packer nothing,
 * while "+2 autres" tells them to open the order.
 */
export function cartSummary(lines: CartLine[], maxLength: number): string {
  if (!lines.length) return '';

  const label = (line: CartLine): string =>
    line.variantName
      ? `${line.quantity}x ${line.productName} (${line.variantName})`
      : `${line.quantity}x ${line.productName}`;

  const parts: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const next = label(lines[i]);
    const remaining = lines.length - i - 1;
    const suffix = remaining > 0 ? ` +${remaining} autre${remaining > 1 ? 's' : ''}` : '';
    const candidate = [...parts, next].join(' + ') + suffix;

    if (candidate.length > maxLength) {
      // This line does not fit. Report everything from here on as a count, and
      // if even that overflows, drop back one line and count from there.
      const dropped = lines.length - i;
      let out = parts.join(' + ') + ` +${dropped} autre${dropped > 1 ? 's' : ''}`;
      while (out.length > maxLength && parts.length > 1) {
        parts.pop();
        const n = lines.length - parts.length;
        out = parts.join(' + ') + ` +${n} autre${n > 1 ? 's' : ''}`;
      }
      return out.slice(0, maxLength).trim();
    }

    parts.push(next);
  }

  return parts.join(' + ');
}

/**
 * The parcel content line Coliaty accepts: never under 5 characters, never over
 * 100, and never empty even for a basket whose every product name was blank.
 */
export function cartParcelContent(lines: CartLine[]): string {
  let content = cartSummary(lines, PARCEL_CONTENT_MAX);
  if (!content.trim()) content = 'Marchandise';
  if (content.length < PARCEL_CONTENT_MIN) content = content.padEnd(PARCEL_CONTENT_MIN, ' ');
  return content.slice(0, PARCEL_CONTENT_MAX);
}
