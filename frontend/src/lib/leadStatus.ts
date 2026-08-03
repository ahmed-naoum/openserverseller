/**
 * Shared lead/order status semantics.
 *
 * These rules used to be copy-pasted into vendor/Leads, vendor/Dashboard and
 * influencer/Leads. The copies drifted, so the same account showed a different
 * "confirmed" count depending on which page you were looking at. Every page that
 * reports a lead statistic must import from here.
 */

/** Minimal shape the helpers need — avoids coupling to the full API types. */
type LeadRow = {
  createdAt: string | Date;
  order?: {
    status?: string | null;
    createdAt?: string | Date | null;
    coliatyPackageCode?: string | null;
  } | null;
};

/**
 * Statuses a lead can only reach AFTER it has been confirmed — the order and
 * parcel lifecycle. A later cancellation or return does not un-confirm the lead,
 * which is why the cancellation states live here too.
 */
export const DELIVERY_STATUSES = [
  'PENDING', 'ORDERED', 'IN_PRODUCTION', 'READY_FOR_SHIPPING',
  'PUSHED_TO_DELIVERY', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED', 'CONFIRMED_DELIVERY',
  'NEW_PARCEL', 'WAITING_PICKUP', 'PICKED_UP', 'SENT', 'RECEIVED', 'DISTRIBUTION', 'PROGRAMMER_AUTO', 'POSTPONED',
  'WAITING_PREPARATION', 'PREPARED', 'ENCORE_PREPARED', 'CANCELED_BY_SELLER', 'CANCELED_BY_SYSTEM', 'REFUSE',
  'NOANSWER', 'CANCELED', 'ERR', 'PROGRAMMER', 'INCORRECT_ADDRESS'
];

/** Single definition of "this lead was confirmed". */
export const isConfirmedStatus = (status: string) => {
  const s = (status || '').toUpperCase();
  return s === 'CONFIRMED' || s === 'PRICE_CONFIRMED' || DELIVERY_STATUSES.includes(s);
};

export const isConfirmedRow = (c: LeadRow) => isConfirmedStatus((c.order?.status || 'UNKNOWN').toUpperCase());

export const isDeliveredRow = (c: LeadRow) => (c.order?.status || '').toUpperCase() === 'DELIVERED';

/**
 * The status a row is presented under. Confirmed leads that already have a
 * tracking number are shown as CONFIRMED_DELIVERY. Status chip counts and the
 * row filter must both use this, or a chip advertises N rows and matches none.
 */
export const getDisplayStatus = (c: LeadRow) => {
  const s = (c.order?.status || 'UNKNOWN').toUpperCase();
  if ((s === 'CONFIRMED' || s === 'PRICE_CONFIRMED') && c.order?.coliatyPackageCode) return 'CONFIRMED_DELIVERY';
  return s;
};

/**
 * "When did this lead happen". Date filters, trend charts and table sorting must
 * all read the same field or the numbers disagree with the rows.
 */
export const getLeadDate = (c: LeadRow) => new Date((c.order?.createdAt as any) || c.createdAt);
