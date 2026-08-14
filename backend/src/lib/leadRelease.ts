/**
 * Policy for leads an agent finished with but did not convert.
 *
 * Two separate systems depend on these rules — the status write in
 * lead.routes.ts (which rolls the deadline) and the cron in
 * jobs/leadReassignment.ts (which enforces it) — so they live here rather than
 * being duplicated on both sides where they could drift apart.
 */

/**
 * Statuses the cron pulls back off an agent once their deadline passes. Each of
 * these means "worked, no sale, but the customer is still worth another call".
 * Anything terminal (CONFIRMED, PUSHED_TO_DELIVERY, DEAD_NO_REPLY) is absent on
 * purpose: those leads must never be recycled into the pool.
 */
export const RELEASE_TRACKED_STATUSES = [
  'NO_REPLY',
  'INVALID',
  'CONTACTED',
  'INTERESTED',
  'CALLBACK_REQUESTED',
  'NOT_INTERESTED',
  'UNREACHABLE',
  'CANCEL_REASON_PRICE',
];

/**
 * CALL_LATER is released too, but it is deliberately NOT in the list above: its
 * deadline is anchored to the agent's own reminder (`callbackAt`), not to a
 * randomised window, so the cron matches it with a separate predicate. Adding
 * it to RELEASE_TRACKED_STATUSES would let the legacy `updatedAt` fallback drop
 * leads whose callback is still hours in the future.
 */
export const CALL_LATER = 'CALL_LATER';

/**
 * How long an agent keeps a lead past the callback time they themselves chose.
 * The reminder is the commitment; one hour after it, an uncalled lead is not
 * being worked and goes back to the pool for someone else.
 */
export const CALL_LATER_GRACE_MS = 60 * 60 * 1000; // 1 hour

/**
 * CANCEL_REASON_PRICE holds for 24 hours before returning to the pool.
 */
export const PRICE_CANCEL_RELEASE_MS = 24 * 60 * 60 * 1000; // 24 hours

export const priceCancelReleaseAt = (from: number = Date.now()): Date =>
  new Date(from + PRICE_CANCEL_RELEASE_MS);

/**
 * The hold window is randomised per lead instead of being a fixed two hours.
 * A constant timeout is learnable — an agent can sit on a lead knowing exactly
 * when it drops — and it also bunches every lead claimed in the same minute
 * into one release spike. A 1–2 h roll removes both.
 */
export const MIN_RELEASE_MS = 1 * 60 * 60 * 1000; // 1 hour
export const MAX_RELEASE_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * How many times a lead may come back from NO_REPLY before the system stops
 * offering it. The count is on the lead, not the assignment, so it survives
 * passing between agents — which is the whole point: five different agents
 * failing to reach a number is the same signal as one agent failing five times.
 */
export const MAX_NO_REPLY_RELEASES = 5;

/**
 * Terminal parking status for a number nobody could ever reach. Deliberately
 * not in RELEASE_TRACKED_STATUSES and not 'AVAILABLE', which is what keeps it
 * out of the claimable pool (`/available` and `/claim` both require AVAILABLE)
 * and out of force-claim (FORCE_CLAIMABLE_STATUSES).
 */
export const DEAD_NO_REPLY = 'DEAD_NO_REPLY';

/**
 * Prefix every history row the cron writes carries.
 *
 * Those rows are stamped `changedBy: <the agent>` so the lead's timeline reads
 * as one story — but the system letting a lead go is not something the agent
 * did. The agent dashboard counts its figures out of that table and filters on
 * this prefix to tell the two apart: without it an agent would be credited with
 * an action for every lead that timed out on them, and the release row — being
 * the newest — would become their "last action" and pull the lead out of the
 * outcome they actually recorded.
 */
export const SYSTEM_NOTE_PREFIX = 'Système :';

/** A fresh randomised release deadline, 1–2 h out. */
export const rollReleaseAt = (from: number = Date.now()): Date =>
  new Date(from + MIN_RELEASE_MS + Math.random() * (MAX_RELEASE_MS - MIN_RELEASE_MS));

/**
 * Deadline for a CALL_LATER lead: the scheduled callback plus the grace period.
 * A lead parked in CALL_LATER without a usable reminder has nothing to anchor
 * to, so it falls back to the standard randomised hold rather than sitting on
 * an agent forever.
 */
export const callLaterReleaseAt = (callbackAt: Date | string | null | undefined): Date => {
  if (!callbackAt) return rollReleaseAt();
  const at = new Date(callbackAt);
  return Number.isNaN(at.getTime())
    ? rollReleaseAt()
    : new Date(at.getTime() + CALL_LATER_GRACE_MS);
};

export const SHORT_RELEASE_STATUSES = [
  'CANCEL_ORDER',
  'WRONG_ORDER',
];

export const SHORT_RELEASE_MS = 2 * 60 * 1000; // 2 minutes

export const shortReleaseAt = (from: number = Date.now()): Date =>
  new Date(from + SHORT_RELEASE_MS);

/**
 * The deadline a lead should carry after being written to `status`, or null
 * when the status is not one the cron reclaims. Callers pass this straight into
 * `data.releaseAt` so a lead moving out of a tracked status always drops its
 * stale countdown instead of leaving one to fire later.
 *
 * `callbackAt` is the reminder the lead ends up carrying after the write — only
 * CALL_LATER reads it, and it must be the post-write value, not the old one.
 */
export const releaseAtFor = (
  status: string,
  callbackAt?: Date | string | null,
): Date | null => {
  if (status === CALL_LATER) return callLaterReleaseAt(callbackAt);
  if (status === 'CANCEL_REASON_PRICE') return priceCancelReleaseAt();
  if (SHORT_RELEASE_STATUSES.includes(status)) return shortReleaseAt();
  return RELEASE_TRACKED_STATUSES.includes(status) ? rollReleaseAt() : null;
};

/**
 * What the cron should do with an expired lead: recycle it into the pool, or
 * retire it. Only NO_REPLY consumes an attempt — the other tracked statuses
 * recycle indefinitely, as they did before.
 */
export function resolveRelease(status: string, noReplyReleases: number): {
  newStatus: string;
  releases: number;
  exhausted: boolean;
} {
  if (status !== 'NO_REPLY') {
    return { newStatus: 'AVAILABLE', releases: noReplyReleases, exhausted: false };
  }

  const releases = noReplyReleases + 1;
  const exhausted = releases >= MAX_NO_REPLY_RELEASES;
  return { newStatus: exhausted ? DEAD_NO_REPLY : 'AVAILABLE', releases, exhausted };
}
