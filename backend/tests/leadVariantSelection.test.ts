/**
 * The confirmation call is allowed to change which pack a lead is for, and the
 * three variant columns have to move with it.
 *
 * Before those columns existed the correction worked by itself: everything
 * matched on `productVariant`, so rewriting that string moved the price too.
 * findPackOption and getPackQuantity now read the frozen id and unit count
 * FIRST — by design, so a seller editing a pack cannot retroactively reprice
 * captured leads — which means a writer that updates the label alone leaves a
 * stale id outvoting it. The last case here is that regression: the warehouse
 * shipping a five-piece pack while decrementing one unit of stock.
 */
import { describe, it, expect } from 'vitest';
import { resolveVariantSelection, getPackQuantity, findPackOption } from '../src/lib/leadPricing.js';

const link = {
  landingPage: {
    customStructure: {
      blocks: [
        { type: 'express_checkout', content: { options: [
          { id: 'pack-1', name: '1 Pièce', price: 249, quantity: 1 },
          { id: 'pack-2', name: '2 Pièces + 1 Gratuite', price: 399, quantity: 3 },
        ] } },
      ],
    },
  },
  product: { retailPriceMad: 500 },
};

describe('resolveVariantSelection', () => {
  it('resolves a typed label back to the real option, id and units', () => {
    expect(resolveVariantSelection({ referralLink: link }, '2 Pièces + 1 Gratuite'))
      .toEqual({ variantOptionId: 'pack-2', variantName: '2 Pièces + 1 Gratuite', packQuantity: 3 });
  });

  it('is case- and whitespace-insensitive', () => {
    expect(resolveVariantSelection({ referralLink: link }, '  2 pièces + 1 gratuite  ').variantOptionId)
      .toBe('pack-2');
  });

  it('clears the id and units for a freehand label, keeping the text', () => {
    expect(resolveVariantSelection({ referralLink: link }, 'Echange SAV'))
      .toEqual({ variantOptionId: null, variantName: 'Echange SAV', packQuantity: null });
  });

  it('clears everything when the label is emptied', () => {
    expect(resolveVariantSelection({ referralLink: link }, '   '))
      .toEqual({ variantOptionId: null, variantName: null, packQuantity: null });
  });

  it('ignores the lead\'s own stale columns — they are what is being overruled', () => {
    const stale = { variantOptionId: 'pack-2', variantName: '2 Pièces + 1 Gratuite', packQuantity: 3, referralLink: link };
    expect(resolveVariantSelection(stale, '1 Pièce'))
      .toEqual({ variantOptionId: 'pack-1', variantName: '1 Pièce', packQuantity: 1 });
  });

  it('closes the stock hole: correcting the pack changes what getPackQuantity answers', () => {
    const lead: any = { variantOptionId: 'pack-1', variantName: '1 Pièce', packQuantity: 1, referralLink: link };
    expect(getPackQuantity(lead)).toBe(1);
    Object.assign(lead, resolveVariantSelection(lead, '2 Pièces + 1 Gratuite'));
    expect(getPackQuantity(lead)).toBe(3);
    expect(findPackOption(lead)?.price).toBe(399);
  });
});
