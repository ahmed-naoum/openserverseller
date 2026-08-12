/**
 * Shared lead/order status semantics.
 *
 * These rules used to be copy-pasted into vendor/Leads, vendor/Dashboard and
 * influencer/Leads. The copies drifted, so the same account showed a different
 * "confirmed" count depending on which page you were looking at. Every page that
 * reports a lead statistic must import from here.
 */

/** One row of `order_status_history` / `lead_status_history` as the API returns it. */
type StatusHistoryEntry = {
  oldStatus?: string | null;
  newStatus?: string | null;
  createdAt?: string | Date | null;
};

/** Minimal shape the helpers need — avoids coupling to the full API types. */
type LeadRow = {
  createdAt: string | Date;
  /** Server-precomputed newest history timestamp (slim list rows). */
  statusChangedAt?: string | Date | null;
  /** Server-precomputed newest timestamp per parcel step (slim list rows). */
  milestones?: Record<string, string | Date | null> | null;
  statusHistory?: StatusHistoryEntry[] | null;
  order?: {
    status?: string | null;
    createdAt?: string | Date | null;
    coliatyPackageCode?: string | null;
    statusHistory?: StatusHistoryEntry[] | null;
    lead?: {
      createdAt?: string | Date | null;
      statusHistory?: StatusHistoryEntry[] | null;
    } | null;
  } | null;
  lead?: {
    createdAt?: string | Date | null;
    statusHistory?: StatusHistoryEntry[] | null;
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

export const isConfirmedRow = (c: LeadRow) => isConfirmedStatus((c.order?.status || (c as any).status || 'UNKNOWN').toUpperCase());

export const isDeliveredRow = (c: LeadRow) => (c.order?.status || (c as any).status || '').toUpperCase() === 'DELIVERED';

/**
 * The status a row is presented under. Confirmed leads that already have a
 * tracking number are shown as CONFIRMED_DELIVERY. Status chip counts and the
 * row filter must both use this, or a chip advertises N rows and matches none.
 */
export const getDisplayStatus = (c: LeadRow) => {
  const s = (c.order?.status || (c as any).status || 'UNKNOWN').toUpperCase();
  if ((s === 'CONFIRMED' || s === 'PRICE_CONFIRMED') && c.order?.coliatyPackageCode) return 'CONFIRMED_DELIVERY';
  return s;
};

/**
 * "When did this lead happen". Date filters, trend charts and table sorting must
 * all read the same field or the numbers disagree with the rows.
 *
 * For a lead that became an order, the lead's original creation date takes
 * priority over the order creation date (which can occur days later). If no
 * lead creation date exists, fallback to row `createdAt` or `order.createdAt`.
 */
export const getLeadDate = (c: LeadRow): Date => {
  const leadCreated = (c as any).order?.lead?.createdAt || (c as any).lead?.createdAt;
  const directCreated = c.createdAt;
  const orderCreated = c.order?.createdAt;
  const dateVal = leadCreated || directCreated || orderCreated;
  return new Date(dateVal as any);
};

/**
 * When the row last actually MOVED status, or null if it never has.
 *
 * Read from the status history rather than `updatedAt`: the order row is written
 * for things that are not status changes (payment situation, tracking number,
 * notes), and none of those should look like a delivery. Entries whose old and
 * new status are equal are skipped for the same reason — the parcel webhook logs
 * one on every situation push even when the status stayed put.
 *
 * A row carries up to three histories (order, the order's lead, and a bare lead
 * row's own) and the caller cannot know which one holds the newest entry, so all
 * three are scanned.
 */
export const getStatusChangedAt = (c: LeadRow): Date | null => {
  // Slim list rows don't carry the arrays at all — the server already reduced
  // them to their newest timestamp, which is exactly what the scan below
  // computes. Rows from the full-fat shape fall through to the scan.
  if (c.statusChangedAt != null) {
    const time = new Date(c.statusChangedAt as any).getTime();
    if (!Number.isNaN(time)) return new Date(time);
  }

  const histories = [
    c.order?.statusHistory,
    c.order?.lead?.statusHistory,
    (c as any).lead?.statusHistory,
    c.statusHistory
  ];
  let latest: number | null = null;

  for (const history of histories) {
    if (!Array.isArray(history)) continue;
    for (const entry of history) {
      if (!entry?.createdAt) continue;
      const time = new Date(entry.createdAt as any).getTime();
      if (!Number.isNaN(time) && (latest === null || time > latest)) {
        latest = time;
      }
    }
  }

  return latest === null ? null : new Date(latest);
};

/**
 * "When did this lead last move" — the last status change, or the creation date
 * for a row that has never changed status.
 *
 * Never returns anything earlier than the creation date: a lead's early history
 * (NEW → ASSIGNED) can predate the order row that `getLeadDate` reports, and a
 * date filter that moved rows BACKWARDS in time would hide leads instead of
 * surfacing them. On this basis a filter can only ever add rows.
 */
export const getLeadActivityDate = (c: LeadRow) => {
  const created = getLeadDate(c);
  const changed = getStatusChangedAt(c);
  return changed && changed.getTime() > created.getTime() ? changed : created;
};

/**
 * The parcel steps a date filter can be based on, and the statuses that mark
 * each one. A step is a group rather than a single status because Coliaty logs
 * some of them under more than one code (SENT/SHIPPED), and because a delivery
 * that was pushed forward reaches the same step through POSTPONED, PROGRAMMER
 * or PROGRAMMER_AUTO depending on who moved it.
 */
export const MILESTONE_STATUSES = {
  POSTPONED: ['POSTPONED', 'PROGRAMMER', 'PROGRAMMER_AUTO'],
  PICKUP: ['PICKED_UP'],
  SHIPPING: ['SENT', 'SHIPPED'],
  RECEPTION: ['RECEIVED'],
  DELIVERY: ['DELIVERED'],
} as const;

export type MilestoneBasis = keyof typeof MILESTONE_STATUSES;

/** Every date a row can be filtered, sorted and charted on. */
export type DateBasis = 'STATUS' | 'CREATED' | MilestoneBasis;

/**
 * When the row reached a parcel step, or null if it never did.
 *
 * The newest matching transition wins: a parcel that was postponed twice is
 * asked about under its latest postponement, and a redelivery is reported on
 * the day it was actually delivered.
 */
export const getMilestoneDate = (c: LeadRow, basis: MilestoneBasis): Date | null => {
  const statuses = MILESTONE_STATUSES[basis] as readonly string[];

  // Slim list rows: the server already reduced both histories to one timestamp
  // per step, so there is nothing to scan.
  const precomputed = (c as any).milestones?.[basis];
  if (precomputed) {
    const time = new Date(precomputed as any).getTime();
    if (!Number.isNaN(time)) return new Date(time);
  }

  const histories = [
    c.order?.statusHistory,
    c.order?.lead?.statusHistory,
    (c as any).lead?.statusHistory,
    c.statusHistory
  ];
  let latest: number | null = null;

  for (const history of histories) {
    if (!Array.isArray(history)) continue;
    for (const entry of history) {
      if (!entry?.createdAt) continue;
      if (!statuses.includes((entry.newStatus || '').toUpperCase())) continue;
      const time = new Date(entry.createdAt as any).getTime();
      if (!Number.isNaN(time) && (latest === null || time > latest)) latest = time;
    }
  }
  if (latest !== null) return new Date(latest);

  // Rows whose status was written without a history entry — imports, orders
  // raised before the webhook logged transitions — would otherwise read as
  // "never delivered" while sitting on DELIVERED. Fall back to when they last
  // moved, which for those rows is the only timestamp the step has.
  if (statuses.includes(getDisplayStatus(c))) return getStatusChangedAt(c) || getLeadDate(c);
  return null;
};

/**
 * The date a row is filtered, sorted and plotted under, for any basis.
 *
 * Null means the row never reached the chosen step. Callers must drop those
 * rows from a date range rather than fall back to another date: a lead that was
 * never delivered is not a delivery of any day.
 */
export const getRowDateFor = (c: LeadRow, basis: DateBasis): Date | null => {
  if (basis === 'STATUS' || basis === 'CREATED') {
    const date = basis === 'STATUS' ? getLeadActivityDate(c) : getLeadDate(c);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return getMilestoneDate(c, basis);
};
