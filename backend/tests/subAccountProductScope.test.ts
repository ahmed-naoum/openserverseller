import { describe, it, expect } from 'vitest';
import {
  productScopeOf,
  isProductInScope,
  applyProductScope,
  referralLinkProductFilter,
  applyReferralLinkProductScope,
  type ProductScope,
} from '../src/lib/subAccountProductScope.js';

/**
 * Narrowing a sub-account to part of its vendor's catalogue.
 *
 * The whole feature rests on one convention — no rows means the WHOLE catalogue,
 * not an empty one — and on the scope being merged into queries as an AND rather
 * than assigned over whatever filter was already there. Both are easy to break
 * by accident and neither fails loudly: the first would silently lock every
 * existing helper out of everything, the second would silently widen a helper's
 * reach instead of narrowing it. These pin them down.
 */

const unrestricted: ProductScope = null;
const scoped: ProductScope = [12, 40];

describe('productScopeOf', () => {
  it('answers null for everyone who is not a narrowed sub-account', () => {
    expect(productScopeOf({})).toBeNull();
    expect(productScopeOf({ user: undefined })).toBeNull();
    // A vendor, an admin, or a helper holding the whole catalogue.
    expect(productScopeOf({ user: {} })).toBeNull();
    expect(productScopeOf({ user: { subProductIds: null } })).toBeNull();
  });

  it('returns the assigned ids for a narrowed sub-account', () => {
    expect(productScopeOf({ user: { subProductIds: [7] } })).toEqual([7]);
  });
});

describe('isProductInScope', () => {
  it('lets everything through when unrestricted', () => {
    expect(isProductInScope(unrestricted, 999)).toBe(true);
    expect(isProductInScope(unrestricted, null)).toBe(true);
  });

  it('admits only the assigned products', () => {
    expect(isProductInScope(scoped, 12)).toBe(true);
    expect(isProductInScope(scoped, 40)).toBe(true);
    expect(isProductInScope(scoped, 13)).toBe(false);
  });

  it('accepts the id as a string, as it arrives from params and bodies', () => {
    expect(isProductInScope(scoped, '12' as any)).toBe(true);
    expect(isProductInScope(scoped, '13' as any)).toBe(false);
  });

  it('refuses a missing product id rather than treating it as unscoped', () => {
    expect(isProductInScope(scoped, null)).toBe(false);
    expect(isProductInScope(scoped, undefined)).toBe(false);
  });
});

describe('applyProductScope', () => {
  it('leaves the where untouched when unrestricted', () => {
    const where = { userId: 3 };
    expect(applyProductScope(where, unrestricted)).toEqual({ userId: 3 });
  });

  it('adds the scope without disturbing the existing filters', () => {
    const where: any = { userId: 3 };
    applyProductScope(where, scoped);
    expect(where.userId).toBe(3);
    expect(where.AND).toEqual([{ productId: { in: [12, 40] } }]);
  });

  it('scopes on a named column, for the models keyed by the product itself', () => {
    const where: any = { ownerId: 3 };
    applyProductScope(where, scoped, 'id');
    expect(where.AND).toEqual([{ id: { in: [12, 40] } }]);
  });

  it('narrows rather than replaces when the caller already filters that column', () => {
    // The links list filters on `product` for its Vendeur/Affilié modes. An
    // assignment would drop that filter and hand back MORE rows than asked for.
    const where: any = { influencerId: 3, productId: 8 };
    applyProductScope(where, scoped);
    expect(where.productId).toBe(8);
    expect(where.AND).toEqual([{ productId: { in: [12, 40] } }]);
  });

  it('appends to an existing AND instead of overwriting it', () => {
    const where: any = { AND: [{ status: 'APPROVED' }] };
    applyProductScope(where, scoped);
    expect(where.AND).toEqual([{ status: 'APPROVED' }, { productId: { in: [12, 40] } }]);
  });
});

describe('referral-link scoping', () => {
  it('has no filter to contribute when unrestricted', () => {
    expect(referralLinkProductFilter(unrestricted)).toBeNull();
  });

  it('reaches the product through the link, for leads and commissions', () => {
    expect(referralLinkProductFilter(scoped)).toEqual({
      referralLink: { productId: { in: [12, 40] } },
    });
  });

  it('keeps the vendor filter and adds its own', () => {
    const where: any = { vendorId: 3 };
    applyReferralLinkProductScope(where, scoped);
    expect(where.vendorId).toBe(3);
    expect(where.AND).toEqual([{ referralLink: { productId: { in: [12, 40] } } }]);
  });

  it('excludes leads with no link at all', () => {
    // A manual entry or an integration import cannot be attributed to a product,
    // so it falls outside every restricted scope. Prisma's relation filter on a
    // null relation matches nothing, which is the behaviour relied on here — this
    // asserts the SHAPE that produces it, so a rewrite to `referralLinkId` or a
    // flattened `productId` cannot pass silently.
    const filter = referralLinkProductFilter(scoped);
    expect(Object.keys(filter)).toEqual(['referralLink']);
  });

  it('leaves the where untouched when unrestricted', () => {
    const where = { vendorId: 3 };
    expect(applyReferralLinkProductScope(where, unrestricted)).toEqual({ vendorId: 3 });
  });
});
