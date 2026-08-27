/**
 * What a lead is actually worth — and how many units it costs the warehouse —
 * resolved the one way the whole platform agrees on.
 *
 * This used to live as a private helper inside lead.routes.ts. It was lifted here
 * when the Google Sheets export needed the same answer and shipped with only the
 * first two steps of the chain — which silently wrote a blank price for every lead
 * that had no order yet, i.e. every prospect.
 *
 * Price and quantity are deliberately answered by two different functions over
 * one shared lookup: a pack's `price` is the BUNDLE total, so the quantity must
 * never be allowed anywhere near it. A three-unit pack at 399 MAD is 399 MAD.
 */

/**
 * One entry of an express_checkout block's `content.options`, as the builder
 * stores it. Everything is optional and untyped because this comes out of the
 * landing page's free-form `customStructure` JSON, not out of a column.
 */
export interface PackOption {
  id?: string;
  name?: string;
  price?: any;
  quantity?: any;
  [k: string]: any;
}

/** The lead shape the helpers below read. Every field is optional. */
export interface PricedLead {
  confirmedPriceMad?: number | null;
  /** Legacy free-text display string. May be a bare pack name or "Product (Pack)". */
  productVariant?: string | null;
  /** The chosen option's id — the real join key, frozen at capture time. */
  variantOptionId?: string | null;
  /** The pack label alone, frozen at capture time. */
  variantName?: string | null;
  /** Units in the chosen pack, frozen at capture time. */
  packQuantity?: number | null;
  order?: { totalAmountMad?: number | null } | null;
  referralLink?: {
    landingPage?: { customStructure?: any } | null;
    product?: { retailPriceMad?: number | null } | null;
  } | null;
}

/** Trimmed, lower-cased, and safe on numbers — `.toLowerCase()` on an id is not. */
const norm = (value: any): string =>
  value === null || value === undefined ? '' : String(value).trim().toLowerCase();

/** A quantity is only usable if it is a whole number of units, at least one. */
const asPositiveInt = (value: any): number | null => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * The express_checkout option this lead actually chose, or null.
 *
 * Matching runs most authoritative first: the stored option id, then the stored
 * bare pack name, then the legacy free-text `productVariant`. The last two paths
 * exist because `variantOptionId`/`variantName` are new columns — every lead
 * captured before they landed carries nothing but `productVariant`.
 */
export const findPackOption = (lead: any): PackOption | null => {
  const raw = lead?.referralLink?.landingPage?.customStructure;
  if (!raw) return null;

  let structure: any = raw;
  if (typeof structure === 'string') {
    // Stored as a JSON string on some rows and as jsonb on others, depending on
    // which builder wrote it. A malformed one is just an unknown pack.
    try {
      structure = JSON.parse(structure);
    } catch {
      return null;
    }
  }

  const blocks = Array.isArray(structure) ? structure : structure?.blocks;
  if (!Array.isArray(blocks)) return null;

  // EVERY checkout block, not just the first. Nothing stops a builder from
  // putting a second express_checkout further down the page, and pricing a lead
  // that came through the second one against the first one's packs quietly
  // charges the wrong amount. Order is preserved so the earlier block still wins
  // a tie, which is what the old `blocks.find(...)` effectively did.
  const entries: { option: PackOption; id: string; rawId: any }[] = [];
  for (const block of blocks) {
    if (block?.type !== 'express_checkout') continue;
    const options = block?.content?.options;
    if (!Array.isArray(options)) continue;
    options.forEach((option: any, index: number) => {
      if (!option) return;
      // Mirrors the compiler's `id: String(o?.id ?? i)` (blocks/checkout.ts):
      // an option the builder never gave an id answers to its index WITHIN ITS
      // OWN BLOCK, which is why the index is taken per block and not globally.
      entries.push({ option, id: String(option.id ?? index), rawId: option.id });
    });
  }
  if (!entries.length) return null;

  // (a) The id the page posted back. Both sides through String() — an id is
  // often a number in the builder's JSON, and `.toLowerCase()` on one throws.
  const wantedId = lead?.variantOptionId === null || lead?.variantOptionId === undefined
    ? ''
    : String(lead.variantOptionId).trim();
  if (wantedId) {
    const byId = entries.find((e) => e.id === wantedId);
    if (byId) return byId.option;
  }

  // (b) The bare pack label, as captured.
  const wantedName = norm(lead?.variantName);
  if (wantedName) {
    const byName = entries.find((e) => norm(e.option.name) === wantedName);
    if (byName) return byName.option;
  }

  const byText = (text: string): PackOption | null => {
    if (!text) return null;
    // Deliberately `rawId`, not the index fallback used in (a): this path takes
    // a human-facing label, and letting a stray "1" match the second option by
    // position would price a lead off a pack nobody picked.
    const hit = entries.find((e) => norm(e.option.name) === text || norm(e.rawId) === text);
    return hit ? hit.option : null;
  };

  // (c) The legacy free-text column. Keep this forever — it is all a
  // pre-existing lead has.
  const legacy = norm(lead?.productVariant);
  const byLegacy = byText(legacy);
  if (byLegacy) return byLegacy;

  // (d) Last resort. Pages compiled before this change build "Product (Pack)"
  // for a customer who arrived via a product card (runtime/checkout.ts), and
  // that composite matches no option at all — the compiler even warns about it.
  // Those leads are falling through to retail price today, so re-reading the
  // final parenthesised group can only move a price that is already wrong: a
  // lead with an order total or a confirmed price never reaches the pack tier
  // of getPackPrice, so no invoiced amount can move.
  if (legacy.endsWith(')')) {
    const open = legacy.lastIndexOf('(');
    if (open !== -1) {
      return byText(legacy.slice(open + 1, -1).trim());
    }
  }

  return null;
};

/**
 * Resolution order, most authoritative first:
 *   1. the order total — once an order exists, that is the money
 *   2. what the agent settled on during the confirmation call
 *   3. the pack/variant price from the landing page the lead came through
 *   4. the product's list price
 * Returns 0 when nothing is known.
 */
export const getPackPrice = (lead: any): number => {
  if (lead?.order?.totalAmountMad !== undefined && lead?.order?.totalAmountMad !== null) {
    return Number(lead.order.totalAmountMad);
  }
  // What the agent agreed with the customer on the confirmation call wins over
  // the pack's listed price — that is the amount the courier must collect.
  if (lead?.confirmedPriceMad !== undefined && lead?.confirmedPriceMad !== null) {
    return Number(lead.confirmedPriceMad);
  }

  const price = findPackOption(lead)?.price;
  // 0 is a price. The old truthiness check sent a legitimately-free pack — a
  // giveaway, a sample — through to the product's retail price and billed the
  // customer for it. Only "no answer" falls through: null, undefined, '', NaN.
  if (price !== null && price !== undefined && price !== '') {
    const amount = Number(price);
    if (Number.isFinite(amount)) return amount;
  }

  return lead?.referralLink?.product?.retailPriceMad || 0;
};

/**
 * How many units of the product this lead consumes. Always at least 1 — callers
 * multiply stock movements by it, and a null or NaN would wipe out a decrement.
 *
 * The stored column beats the live pack on purpose: `packQuantity` is frozen at
 * capture time, and a seller who later edits a pack from 1 unit to 3 must not
 * retroactively change what every lead captured before that edit costs in stock.
 * The pack is only consulted for leads captured before the column existed.
 */
export const getPackQuantity = (lead: any): number => {
  const stored = asPositiveInt(lead?.packQuantity);
  if (stored) return stored;

  const fromPack = asPositiveInt(findPackOption(lead)?.quantity);
  if (fromPack) return fromPack;

  return 1;
};

/** The three variant columns, as a `prisma.lead.update` data fragment. */
export interface VariantSelection {
  variantOptionId: string | null;
  variantName: string | null;
  packQuantity: number | null;
}

/**
 * Re-derive the variant columns from a free-text pack label an operator typed.
 *
 * The confirmation call is allowed to change which pack a lead is for, and until
 * the columns above existed that correction worked by itself: everything matched
 * on `productVariant`, so rewriting that one string moved the price with it. It
 * no longer does — `findPackOption` and `getPackQuantity` both consult the
 * frozen id and quantity first, by design, so a stale `variantOptionId` would
 * outvote the correction and the warehouse would ship the pack the customer did
 * not agree to. Any writer that edits `productVariant` must call this and store
 * all three results together.
 *
 * `lead` is only read for its landing structure, so it must carry
 * PACK_PRICE_INCLUDE. A label matching no option clears the id and the quantity
 * rather than keeping the previous pack's: an operator typing something freehand
 * means "not one of the packs", and one unit of an unknown thing is the only
 * honest reading.
 */
export const resolveVariantSelection = (lead: any, label: any): VariantSelection => {
  const text = label === null || label === undefined ? '' : String(label).trim();
  if (!text) return { variantOptionId: null, variantName: null, packQuantity: null };

  // Match the typed label alone — the lead's own stored columns are exactly what
  // is being overruled here, so they must not participate in the lookup.
  const option = findPackOption({
    productVariant: text,
    referralLink: lead?.referralLink,
  });
  if (!option) return { variantOptionId: null, variantName: text, packQuantity: null };

  return {
    variantOptionId: option.id === null || option.id === undefined ? null : String(option.id),
    variantName: option.name ? String(option.name) : text,
    packQuantity: asPositiveInt(option.quantity),
  };
};

/**
 * The Prisma `include` the chain above needs beyond the lead's own columns.
 * Exported so every caller selects the same thing — a caller that forgets the
 * referralLink silently falls through to 0.
 *
 * Still complete: everything the matching added since (variantOptionId,
 * variantName, packQuantity) lives on the lead row itself, and the pack's
 * `quantity` rides along inside the same customStructure JSON as its price.
 */
export const PACK_PRICE_INCLUDE = {
  order: { select: { totalAmountMad: true } },
  referralLink: {
    select: {
      landingPage: { select: { customStructure: true } },
      product: { select: { retailPriceMad: true } },
    },
  },
} as const;
