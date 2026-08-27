import { describe, it, expect } from 'vitest';
import { findPackOption, getPackPrice, getPackQuantity } from '../src/lib/leadPricing.js';

/**
 * The one place the platform agrees on what a lead is worth and how much stock it
 * costs. Every wrong answer here is either money billed to the wrong amount or a
 * warehouse count that drifts from reality, so the matching chain is pinned
 * step by step rather than end to end.
 *
 * The two halves are deliberately separate: a pack's `price` is the BUNDLE total,
 * so a three-unit pack at 399 MAD is 399 MAD. Nothing may multiply the two.
 */

/** A lead carrying the given checkout options behind its referral link. */
const leadWith = (options: any[], lead: any = {}) => ({
  ...lead,
  referralLink: {
    landingPage: {
      customStructure: { blocks: [{ type: 'express_checkout', content: { options } }] },
    },
    ...(lead.referralLink ?? {}),
  },
});

const PACKS = [
  { id: 'p1', name: '1 Pièce (Offre Standard)', price: 199, quantity: 1 },
  { id: 'p2', name: '2 Pièces + 1 Gratuite', price: 399, quantity: 3 },
];

describe('findPackOption', () => {
  it('matches on the stored option id first', () => {
    expect(findPackOption(leadWith(PACKS, { variantOptionId: 'p2' }))?.price).toBe(399);
  });

  it('matches an id that is a number on one side and a string on the other', () => {
    // The builder stores ids as it pleases and the page posts back a string. The
    // old matcher called .toLowerCase() on this, threw, and had the throw
    // swallowed — every such lead quietly repriced at the product's retail price.
    const numeric = [{ id: 2, name: 'Deux', price: 479 }];
    expect(findPackOption(leadWith(numeric, { variantOptionId: '2' }))?.price).toBe(479);
    expect(findPackOption(leadWith(numeric, { variantOptionId: 2 }))?.price).toBe(479);
  });

  it('answers to the index fallback for an option the builder never gave an id', () => {
    // Mirrors the compiler's `id: String(o?.id ?? i)`: an unnamed, id-less option
    // is addressable only by its position, and that is what the page posts back.
    const anonymous = [{ price: 99 }, { price: 149 }];
    expect(findPackOption(leadWith(anonymous, { variantOptionId: '1' }))?.price).toBe(149);
    expect(findPackOption(leadWith(anonymous, { variantOptionId: '0' }))?.price).toBe(99);
  });

  it('takes the index within its own block, not across the page', () => {
    // Two checkout blocks on one page is legal. Pricing a lead that came through
    // the second one against the first one's packs charges the wrong amount.
    const lead = {
      variantOptionId: '0',
      variantName: 'Deuxième bloc',
      referralLink: {
        landingPage: {
          customStructure: {
            blocks: [
              { type: 'express_checkout', content: { options: [{ name: 'Premier bloc', price: 100 }] } },
              { type: 'express_checkout', content: { options: [{ name: 'Deuxième bloc', price: 200 }] } },
            ],
          },
        },
      },
    };
    // Both blocks own an option at index 0, so the earlier block wins the id
    // match — the same tie the old `blocks.find(...)` resolved this way.
    expect(findPackOption(lead)?.price).toBe(100);
    // The name is unambiguous, so a lead that carries one reaches the right block.
    expect(findPackOption({ ...lead, variantOptionId: null })?.price).toBe(200);
  });

  it('falls back to the bare pack name, ignoring case and stray whitespace', () => {
    expect(findPackOption(leadWith(PACKS, { variantName: '  2 pièces + 1 GRATUITE ' }))?.id).toBe('p2');
  });

  it('still matches a legacy lead that has nothing but productVariant', () => {
    // Every lead captured before variantOptionId/variantName existed. This path
    // is permanent — it is all those rows will ever carry.
    expect(findPackOption(leadWith(PACKS, { productVariant: '2 Pièces + 1 Gratuite' }))?.price).toBe(399);
  });

  it('recovers the pack out of the legacy "Product (Pack)" composite', () => {
    // Pages compiled before this change glue the product name onto the pack for a
    // customer who arrived via a product card, and that string matches no option
    // at all — those leads are falling through to retail today.
    const lead = leadWith(PACKS, { productVariant: 'Montre Or (2 Pièces + 1 Gratuite)' });
    expect(findPackOption(lead)?.price).toBe(399);
  });

  it('refuses to match a legacy label against the positional id fallback', () => {
    // `productVariant` is a human-facing label. Letting a stray "1" in it match
    // the second option by position would price a lead off a pack nobody picked.
    const anonymous = [{ price: 99 }, { price: 149 }];
    expect(findPackOption(leadWith(anonymous, { productVariant: '1' }))).toBeNull();
  });

  it('parses a customStructure stored as a JSON string', () => {
    // jsonb on some rows, a string on others, depending on which builder wrote it.
    const lead = {
      variantOptionId: 'p2',
      referralLink: {
        landingPage: {
          customStructure: JSON.stringify({
            blocks: [{ type: 'express_checkout', content: { options: PACKS } }],
          }),
        },
      },
    };
    expect(findPackOption(lead)?.price).toBe(399);
  });

  it('returns null rather than throwing on anything it cannot read', () => {
    const asString = (customStructure: any) => ({
      variantOptionId: 'p2',
      referralLink: { landingPage: { customStructure } },
    });
    expect(findPackOption(asString('{ not json'))).toBeNull(); // truncated write
    expect(findPackOption(asString({ blocks: 'nope' }))).toBeNull();
    expect(findPackOption(asString({ blocks: [{ type: 'hero' }] }))).toBeNull();
    expect(findPackOption(asString(null))).toBeNull();
    expect(findPackOption({})).toBeNull();
    expect(findPackOption(null)).toBeNull();
    // A checkout block with no options at all — a seller who deleted them.
    expect(findPackOption(leadWith([]))).toBeNull();
  });

  it('gives up cleanly when nothing on the lead identifies a pack', () => {
    expect(findPackOption(leadWith(PACKS))).toBeNull();
    expect(findPackOption(leadWith(PACKS, { variantName: 'Un pack supprimé' }))).toBeNull();
  });
});

describe('getPackPrice', () => {
  it('reads a pack priced 0 as a real price, not as "nothing known"', () => {
    // A giveaway or a sample. The old truthiness check sent it through to the
    // product's retail price and billed the customer for something free.
    const free = [{ id: 'p1', name: 'Échantillon gratuit', price: 0 }];
    const lead = leadWith(free, {
      variantOptionId: 'p1',
      referralLink: { product: { retailPriceMad: 249 } },
    });
    expect(getPackPrice(lead)).toBe(0);
  });

  it('still falls through to retail when the pack answers nothing at all', () => {
    for (const price of [null, undefined, '', 'gratuit']) {
      const lead = leadWith([{ id: 'p1', name: 'Un', price }], {
        variantOptionId: 'p1',
        referralLink: { product: { retailPriceMad: 249 } },
      });
      expect(getPackPrice(lead), `price=${String(price)}`).toBe(249);
    }
  });

  it('keeps its order: order total, then confirmed price, then pack, then retail', () => {
    const base = leadWith(PACKS, {
      variantOptionId: 'p2',
      referralLink: { product: { retailPriceMad: 249 } },
    });
    expect(getPackPrice({ ...base, order: { totalAmountMad: 349 }, confirmedPriceMad: 299 })).toBe(349);
    expect(getPackPrice({ ...base, confirmedPriceMad: 299 })).toBe(299);
    expect(getPackPrice(base)).toBe(399);
    expect(getPackPrice({ ...base, variantOptionId: null })).toBe(249);
    expect(getPackPrice({})).toBe(0);
  });

  it('never lets the pack quantity touch the money', () => {
    // D1, as an assertion: 3 units at 399 MAD is 399 MAD, not 1197.
    const lead = leadWith(PACKS, { variantOptionId: 'p2', packQuantity: 3 });
    expect(getPackPrice(lead)).toBe(399);
    expect(getPackQuantity(lead)).toBe(3);
  });
});

describe('getPackQuantity', () => {
  it('prefers the quantity frozen on the lead over the pack as it stands today', () => {
    // A seller who later edits a pack from 1 unit to 3 must not retroactively
    // change what every lead captured before that edit costs in stock.
    const lead = leadWith(PACKS, { variantOptionId: 'p2', packQuantity: 5 });
    expect(getPackQuantity(lead)).toBe(5);
  });

  it('reads the pack for a lead captured before the column existed', () => {
    expect(getPackQuantity(leadWith(PACKS, { variantOptionId: 'p2' }))).toBe(3);
    expect(getPackQuantity(leadWith(PACKS, { productVariant: '2 Pièces + 1 Gratuite' }))).toBe(3);
  });

  it('resolves to one unit rather than to nothing', () => {
    // Callers multiply a stock decrement by this. A 0 lets a pack sell for ever;
    // a NaN or a null wipes the decrement out entirely.
    const junk = [null, undefined, 0, -3, 2.5, NaN, Infinity, '', 'trois', {}, []];
    for (const packQuantity of junk) {
      const quantity = getPackQuantity(leadWith(PACKS, { packQuantity }));
      expect(quantity, `packQuantity=${String(packQuantity)}`).toBe(1);
    }
    // Same floor when the pack itself carries the junk and the lead carries none.
    for (const quantity of junk) {
      const resolved = getPackQuantity(
        leadWith([{ id: 'p1', name: 'Un', price: 199, quantity }], { variantOptionId: 'p1' })
      );
      expect(resolved, `option.quantity=${String(quantity)}`).toBe(1);
    }
    expect(getPackQuantity({})).toBe(1);
    expect(getPackQuantity(null)).toBe(1);
  });

  it('accepts a whole number arriving as a string', () => {
    // The column is an Int, but the pack's own quantity comes out of free-form
    // JSON, where a builder can and does write "3".
    expect(getPackQuantity(leadWith([{ id: 'p1', price: 1, quantity: '3' }], { variantOptionId: 'p1' }))).toBe(3);
  });
});
