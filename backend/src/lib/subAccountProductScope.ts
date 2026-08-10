import { prisma } from './prisma.js';

/**
 * Narrowing a vendor sub-account to part of the vendor's catalogue.
 *
 * The grants in vendorSubAccount.ts answer "which screens?"; this answers "how
 * much of the catalogue?". They compose: a helper with `subCanViewInventory` and
 * a product scope of [12, 40] gets the inventory screen showing products 12 and
 * 40 and nothing else.
 *
 * The convention is the same one AgentProductAssignment uses for call-center
 * agents, and it has to stay the same in both places:
 *
 *   NO rows  → the whole catalogue (`null` here, "unrestricted")
 *   rows     → only those products
 *
 * "No rows means everything" is what keeps this backwards compatible: every
 * sub-account that existed before the table did has no rows, so nothing about
 * its reach changes. It also means an empty selection can never be used to lock
 * a helper out by accident — the vendor has to suspend or un-grant for that.
 *
 * Scoping is applied at the query, not in a `.filter()` after the fact, so
 * pagination totals and counts stay honest.
 */

/** `null` = the whole catalogue. A list = only those product ids. */
export type ProductScope = number[] | null;

/**
 * The product ids a helper is pinned to, or null when it holds the whole
 * catalogue. Called once per request from `authenticate`.
 */
export const loadSubAccountProductScope = async (subAccountId: number): Promise<ProductScope> => {
  const rows = await (prisma as any).vendorSubAccountProduct.findMany({
    where: { subAccountId },
    select: { productId: true },
  });
  if (!rows || rows.length === 0) return null;
  return rows.map((r: { productId: number }) => r.productId);
};

/**
 * The scope on a request, or null when there is none.
 *
 * Everyone who is not a sub-account is unrestricted, so call sites can apply
 * this without first branching on the role — a vendor, an admin and an
 * unassigned helper all take the same path.
 */
export const productScopeOf = (req: { user?: { subProductIds?: ProductScope } }): ProductScope =>
  req.user?.subProductIds ?? null;

/** Is this one product inside the scope? Unrestricted callers always pass. */
export const isProductInScope = (scope: ProductScope, productId: number | null | undefined): boolean => {
  if (!scope) return true;
  if (productId == null) return false;
  return scope.includes(Number(productId));
};

/**
 * Merge a scope into a Prisma `where`, on whichever column holds the product id.
 *
 * Written as an AND rather than an assignment because the caller may already be
 * filtering on the same column — `where.productId = { in: scope }` would quietly
 * drop their filter and widen the result instead of narrowing it.
 */
export const applyProductScope = (where: any, scope: ProductScope, field = 'productId'): any => {
  if (!scope) return where;
  where.AND = [...(where.AND || []), { [field]: { in: scope } }];
  return where;
};

/**
 * A product scope for the models that reach a product through a referral link
 * rather than holding a productId themselves — Lead and InfluencerCommission.
 *
 * A restricted helper sees one of those rows only when the link behind it
 * carries one of its products, which also means a lead with NO link (manual
 * entry, an integration import) falls outside every restricted scope. That is
 * the intended reading: such a lead cannot be attributed to a product, so it
 * cannot be part of a per-product hand-off.
 *
 * Returns null when unrestricted, so a caller building an AND-array can skip the
 * push instead of adding a clause that matches everything.
 */
export const referralLinkProductFilter = (scope: ProductScope): any | null =>
  scope ? { referralLink: { productId: { in: scope } } } : null;

/** `referralLinkProductFilter` merged into a `where`, the same way as products. */
export const applyReferralLinkProductScope = (where: any, scope: ProductScope): any => {
  const filter = referralLinkProductFilter(scope);
  if (!filter) return where;
  where.AND = [...(where.AND || []), filter];
  return where;
};

/**
 * The order-side translation: an Order reaches its product one hop further out
 * again, through the lead it was raised from.
 *
 * Scoping on the lead rather than on `orderItems` on purpose — the lead is what
 * ties the order to the referral link the sale actually came through, and it is
 * the same join every other list on this screen uses. Going via order items
 * would let a multi-product order half-qualify.
 */
export const applyOrderProductScope = (where: any, scope: ProductScope): any => {
  const filter = referralLinkProductFilter(scope);
  if (!filter) return where;
  where.AND = [...(where.AND || []), { lead: filter }];
  return where;
};

/**
 * Whether one lead falls inside a product scope.
 *
 * For the handlers that have already loaded the lead and only need a yes/no —
 * cheaper to ask the database than to widen their `include` just to reach
 * `referralLink.productId`.
 */
export const isLeadInProductScope = async (
  scope: ProductScope,
  leadId: number,
): Promise<boolean> => {
  const filter = referralLinkProductFilter(scope);
  if (!filter) return true;
  const count = await prisma.lead.count({ where: { id: leadId, ...filter } });
  return count > 0;
};

/** Reason text shown when a scoped helper reaches for a product it wasn't given. */
export const OUT_OF_SCOPE =
  "Ce produit ne fait pas partie de ceux que le vendeur vous a attribués.";

/**
 * Replace a sub-account's assignments with `productIds`.
 *
 * Ids are intersected with what the vendor actually holds before anything is
 * written: the list arrives from the browser, and a vendor must not be able to
 * hand out a competitor's product by posting its id. An empty (or fully
 * filtered-out) list clears the restriction, which by the convention above means
 * "the whole catalogue" — the same state a brand-new sub-account is in.
 */
export const setSubAccountProducts = async (
  subAccountId: number,
  vendorId: number,
  productIds: number[],
): Promise<number[]> => {
  const wanted = [...new Set(productIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];

  const owned = wanted.length
    ? await prisma.product.findMany({
        where: { id: { in: wanted }, ...vendorCatalogueWhere(vendorId) },
        select: { id: true },
      })
    : [];
  const allowed = owned.map((p) => p.id);

  await prisma.$transaction([
    (prisma as any).vendorSubAccountProduct.deleteMany({ where: { subAccountId } }),
    ...(allowed.length
      ? [
          (prisma as any).vendorSubAccountProduct.createMany({
            data: allowed.map((productId) => ({ subAccountId, productId })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  return allowed;
};

/**
 * Every product a vendor may hand to a helper: the ones it owns, the ones it
 * bought into its inventory, and the ones it has an approved claim on. That is
 * the same three sources /leads/my-products merges, so the picker can never
 * offer something the helper would then not be able to sell.
 */
export const vendorCatalogueWhere = (vendorId: number) => ({
  OR: [
    { ownerId: vendorId },
    { inventories: { some: { userId: vendorId } } },
    { claims: { some: { userId: vendorId, status: 'APPROVED' } } },
  ],
});
