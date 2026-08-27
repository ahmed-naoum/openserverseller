/**
 * How a lead is matched back to the express_checkout pack the customer picked.
 *
 * Three screens used to hand-roll this — agent/LeadDetail, vendor/Leads and
 * influencer/Leads — and all three matched on one thing: `option.name ===
 * lead.productVariant`. That match is now wrong twice over. A pack label is
 * free text a seller can rename in the sitebuilder, and `productVariant` is a
 * DISPLAY string that may glue the product name onto the pack label, so it can
 * match no option name at all. The landing page therefore also sends the
 * option's own id, and that id is what these helpers match on first.
 *
 * The name comparison stays for good: every lead captured before the id
 * existed has nothing else, and a seller who deletes and re-adds a pack breaks
 * the id for leads that referenced it.
 */

/** One express_checkout option, as authored in the sitebuilder. */
export interface PackOption {
  id?: string | number | null;
  name?: string | null;
  /** Bundle total, never a unit price — a 3-unit pack at 399 MAD stays 399 MAD. */
  price?: any;
  /** Units of stock behind the label; absent on packs authored before the field. */
  quantity?: any;
  [key: string]: any;
}

/**
 * The pack-identifying fields a row carries. Every one is optional: rows come
 * from several endpoints and legacy leads have only `productVariant`.
 */
export interface PackSelection {
  /** The chosen option's id — the only stable join key. */
  variantOptionId?: string | number | null;
  /** The bare pack label, stored apart from the product name. */
  variantName?: string | null;
  /** Legacy free-text display string, possibly composite. Written for every lead. */
  productVariant?: string | null;
  /** Units in the chosen pack, frozen at capture. Null on pre-existing leads. */
  packQuantity?: number | null;
}

/**
 * The express_checkout options inside a landing page's `customStructure`.
 *
 * The structure arrives parsed from the customers list and as a raw JSON string
 * from the lead-detail endpoint, and the blocks live either at the root or
 * under `.blocks` depending on which sitebuilder version wrote the page — all
 * four combinations reach here, so all four are handled.
 */
export const readCheckoutOptions = (customStructure: any): PackOption[] | null => {
  if (!customStructure) return null;
  try {
    const structure = typeof customStructure === 'string' ? JSON.parse(customStructure) : customStructure;
    const blocks = Array.isArray(structure) ? structure : structure?.blocks || [];
    const checkout = blocks.find((b: any) => b?.type === 'express_checkout');
    const options = checkout?.content?.options;
    return Array.isArray(options) ? options : null;
  } catch {
    return null;
  }
};

/** Trimmed to '' so a whitespace-only id or label never counts as a value. */
const asKey = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim());

/**
 * The option a lead picked, or null.
 *
 * Ids are compared as strings on both sides and never lowercased: they are
 * authored as literals like `pack-2` but nothing stops a seller's page from
 * carrying numeric ones, and `1 !== '1'` would silently drop the match.
 */
export const findPackOption = (
  options: PackOption[] | null | undefined,
  selection: PackSelection | null | undefined
): PackOption | null => {
  if (!Array.isArray(options) || !options.length || !selection) return null;

  const wantedId = asKey(selection.variantOptionId);
  if (wantedId) {
    const byId = options.find((o) => o && asKey(o.id) === wantedId);
    if (byId) return byId;
  }

  // `variantName` before `productVariant`: it is the bare label, so it still
  // matches an option name after the display string grew a product name in
  // front of it. `productVariant` is the last resort and the only thing a
  // pre-existing lead has.
  for (const candidate of [selection.variantName, selection.productVariant]) {
    if (!candidate) continue;
    const byName = options.find((o) => o && o.name === candidate);
    if (byName) return byName;
  }

  return null;
};

/**
 * What to match a row on, given the lead's own fields and the order's copy of
 * the label.
 *
 * `orderVariant` is free text an agent can retype on the delivery form before
 * the parcel is raised. Once it stops matching what the landing page recorded,
 * the lead's option id points at a pack that is no longer in the box — so the
 * id is dropped and the typed text becomes the only thing to match on. Price
 * and label both go through here, which is what stops a row from showing one
 * pack's name next to another pack's price.
 */
export const rowPackSelection = (
  lead: PackSelection | null | undefined,
  orderVariant?: string | null
): PackSelection => {
  const onTheOrder = (orderVariant || '').trim();
  const recorded = (lead?.productVariant || '').trim();
  if (onTheOrder && recorded && onTheOrder !== recorded) return { productVariant: onTheOrder };
  return {
    variantOptionId: lead?.variantOptionId ?? null,
    variantName: lead?.variantName ?? null,
    productVariant: recorded || onTheOrder || null,
    packQuantity: lead?.packQuantity ?? null,
  };
};

/**
 * Price of the pack a customers-list row picked, or null when nothing matches.
 *
 * The list ships each link's options once in `linkMeta` rather than embedding a
 * landing page per row; `customStructure` is the fallback for full-fat rows
 * that still carry their own link. A matched option with a falsy price counts
 * as no match, which is what makes consulting the second source worthwhile —
 * the trimmed projection can be older than the page it was cut from.
 */
export const resolveRowPackPrice = (
  selection: PackSelection | null | undefined,
  packOptions: PackOption[] | null | undefined,
  customStructure?: any
): number | null => {
  const priceOf = (option: PackOption | null): number | null =>
    option && option.price ? Number(option.price) : null;

  return (
    priceOf(findPackOption(packOptions, selection)) ??
    priceOf(findPackOption(readCheckoutOptions(customStructure), selection))
  );
};

/**
 * How many units a row is for.
 *
 * The order's items win whenever an order exists: that figure has already been
 * reconciled against what will actually ship. Below it sits the count frozen on
 * the lead at capture, then the live pack's own count for leads captured before
 * that column existed — and only then 1.
 *
 * The `|| 1` this replaces was not a harmless default. Every prospect row — a
 * lead has no order until it is confirmed — printed "QTE: 1" no matter which
 * pack the customer chose, so a seller reading the list saw a three-piece pack
 * described as a single unit.
 */
export const resolveRowPackQuantity = (
  selection: PackSelection | null | undefined,
  packOptions: PackOption[] | null | undefined,
  customStructure?: any,
  orderItems?: { quantity?: any }[] | null
): number => {
  const fromOrder = (orderItems || []).reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);
  if (fromOrder > 0) return fromOrder;

  const asUnits = (value: any): number | null => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
  };

  const stored = asUnits(selection?.packQuantity);
  if (stored) return stored;

  return (
    asUnits(findPackOption(packOptions, selection)?.quantity) ??
    asUnits(findPackOption(readCheckoutOptions(customStructure), selection)?.quantity) ??
    1
  );
};

/**
 * The pack label to show a human.
 *
 * `variantName` wins because it is the pack alone — the whole reason it is
 * stored apart from `productVariant`, which may read "Sérum Bio — 2 Pièces + 1
 * Gratuite" or, on a legacy lead, be the only thing there is. An agent's retype
 * outranks both, through the same rule the price lookup applies.
 */
export const packVariantLabel = (
  lead: PackSelection | null | undefined,
  orderVariant?: string | null
): string | null => {
  const selection = rowPackSelection(lead, orderVariant);
  return (selection.variantName || '').trim() || (selection.productVariant || '').trim() || null;
};
