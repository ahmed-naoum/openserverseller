/**
 * What a lead is actually worth, resolved the one way the whole platform agrees on.
 *
 * This used to live as a private helper inside lead.routes.ts. It was lifted here
 * when the Google Sheets export needed the same answer and shipped with only the
 * first two steps of the chain — which silently wrote a blank price for every lead
 * that had no order yet, i.e. every prospect.
 */

/** The lead shape `getPackPrice` reads. Every field is optional. */
export interface PricedLead {
  confirmedPriceMad?: number | null;
  productVariant?: string | null;
  order?: { totalAmountMad?: number | null } | null;
  referralLink?: {
    landingPage?: { customStructure?: any } | null;
    product?: { retailPriceMad?: number | null } | null;
  } | null;
}

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
  if (lead?.productVariant && lead?.referralLink?.landingPage?.customStructure) {
    try {
      let structure = lead.referralLink.landingPage.customStructure;
      if (typeof structure === 'string') {
        structure = JSON.parse(structure);
      }
      const blocks = Array.isArray(structure) ? structure : structure.blocks || [];
      const checkoutBlock = blocks.find((b: any) => b.type === 'express_checkout');
      if (checkoutBlock?.content?.options) {
        const variant = lead.productVariant?.toLowerCase().trim();
        const option = checkoutBlock.content.options.find(
          (o: any) => o.name?.toLowerCase().trim() === variant || o.id?.toLowerCase().trim() === variant
        );
        if (option && option.price) {
          return Number(option.price);
        }
      }
    } catch (e) {}
  }
  return lead?.referralLink?.product?.retailPriceMad || 0;
};

/**
 * The Prisma `include` the chain above needs beyond the lead's own columns.
 * Exported so every caller selects the same thing — a caller that forgets the
 * referralLink silently falls through to 0.
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
