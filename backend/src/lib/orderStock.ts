/**
 * Stock movement for order lines, across both catalogues.
 *
 * An `OrderItem` points at exactly one of two tables: `productId` for a
 * marketplace product (the catalogue behind /dashboard/products and the
 * referral links) or `storeProductId` for one a seller created in their own
 * shop. Every reserve and every give-back has to land in the right table, and
 * there are eight places that move stock — a cancel, a return, a webhook status
 * change, a lead delete, the dispatch itself. Each of them branching on its own
 * is how one of them ends up quietly burning inventory that was never shipped,
 * so they all come through here.
 */

export interface StockLine {
  productId: number | null;
  storeProductId: number | null;
  quantity: number;
}

async function moveStock(tx: any, items: StockLine[], direction: 'increment' | 'decrement') {
  // Summed per product first: one basket can list the same product on two
  // lines, and a long basket would otherwise fire a statement per line.
  const marketplace = new Map<number, number>();
  const shop = new Map<number, number>();

  for (const item of items || []) {
    const qty = Number(item?.quantity) || 0;
    if (qty <= 0) continue;

    if (item.productId != null) {
      marketplace.set(item.productId, (marketplace.get(item.productId) || 0) + qty);
    } else if (item.storeProductId != null) {
      shop.set(item.storeProductId, (shop.get(item.storeProductId) || 0) + qty);
    }
    // A line with neither is one whose product was hard-deleted. Nothing to
    // move, and throwing here would block a cancel over missing bookkeeping.
  }

  for (const [id, quantity] of marketplace) {
    await tx.product.update({ where: { id }, data: { stockQuantity: { [direction]: quantity } } });
  }
  for (const [id, quantity] of shop) {
    await tx.storeProduct.update({ where: { id }, data: { stockQuantity: { [direction]: quantity } } });
  }
}

/** Give stock back — a cancel, a return, a deleted order. */
export const restockOrderItems = (tx: any, items: StockLine[]) => moveStock(tx, items, 'increment');

/** Hold stock for a parcel that is going out. */
export const reserveOrderItems = (tx: any, items: StockLine[]) => moveStock(tx, items, 'decrement');
