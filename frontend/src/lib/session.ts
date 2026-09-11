import { dashboardRootOf } from './dashboardBase';

/**
 * Cross-tab session synchronisation.
 *
 * Every tab of a browser shares one localStorage, so signing out in one tab
 * already takes the tokens away from all of them. What it never took away was
 * the *other tabs' React trees*: they kept painting a signed-in dashboard, and
 * the user only found out the session was over when their next click failed
 * with a bare error toast — no sign that a logout, done minutes earlier in
 * another tab, was the cause.
 *
 * This module is the bus that closes that gap. `endSession()` clears the tokens
 * and announces it; every tab listening through `onSessionEnded()` tears its own
 * session down in the same instant.
 */

/** Only shapes the notice shown on the login page — the teardown is identical. */
export type SessionEndReason = 'logout' | 'expired' | 'revoked';

export interface SessionEndedEvent {
  reason: SessionEndReason;
  at: number;
}

/** Everything localStorage holds on behalf of a signed-in user, impersonation included. */
const AUTH_KEYS = [
  'accessToken',
  'refreshToken',
  'originalToken',
  'originalRefreshToken',
  'originalUserRole',
  'originalUserFullName',
];

const CHANNEL_NAME = 'silacod:session';

/**
 * The fan-out key for browsers without BroadcastChannel. A `storage` event fires
 * in every tab EXCEPT the one that wrote it, which is exactly the delivery we
 * want, and it costs nothing where BroadcastChannel already did the job.
 */
const PING_KEY = 'session-sync-ping';

let channel: BroadcastChannel | null = null;

const getChannel = (): BroadcastChannel | null => {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      channel = null;
    }
  }
  return channel;
};

/** Drop the stored session without telling anyone — for callers that only want this tab. */
export const clearSessionStorage = (): void => {
  AUTH_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* private mode, quota, disabled storage — nothing to recover from */
    }
  });
};

/**
 * End the session in this tab and in every other tab of this browser.
 *
 * Safe to call twice: the listeners it wakes are idempotent, and a second call
 * simply re-clears keys that are already gone.
 */
export const endSession = (reason: SessionEndReason = 'logout'): void => {
  clearSessionStorage();

  const event: SessionEndedEvent = { reason, at: Date.now() };
  try {
    getChannel()?.postMessage(event);
  } catch {
    /* the storage ping below still delivers it */
  }
  try {
    // The nonce guarantees the value actually changes. Two logouts in a row
    // would otherwise write an identical string, and `storage` does not fire
    // when the value is unchanged.
    localStorage.setItem(PING_KEY, JSON.stringify({ ...event, nonce: Math.random() }));
  } catch {
    /* ignore */
  }
};

/**
 * Run `handler` when the session ends anywhere in this browser.
 *
 * The handler can fire more than once for a single logout — BroadcastChannel and
 * the storage ping both deliver, and the raw token removal below is a third
 * path — so it must be idempotent. Returns the unsubscribe function.
 */
export const onSessionEnded = (handler: (event: SessionEndedEvent) => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  const fromChannel = (message: MessageEvent) => {
    const data = message?.data as SessionEndedEvent | undefined;
    if (data?.reason) handler(data);
  };

  const fromStorage = (event: StorageEvent) => {
    if (event.key === PING_KEY && event.newValue) {
      try {
        handler(JSON.parse(event.newValue));
      } catch {
        handler({ reason: 'logout', at: Date.now() });
      }
      return;
    }

    // Belt and braces: any code path that drops the access token ends the
    // session here too, even one that never calls endSession(). Only a removal
    // counts — a token refresh writes a new value to the same key.
    if (event.key === 'accessToken' && event.newValue === null && event.oldValue) {
      handler({ reason: 'logout', at: Date.now() });
    }
  };

  getChannel()?.addEventListener('message', fromChannel);
  window.addEventListener('storage', fromStorage);

  return () => {
    getChannel()?.removeEventListener('message', fromChannel);
    window.removeEventListener('storage', fromStorage);
  };
};

/** Session-bound pages that live outside a dashboard root. */
const SESSION_BOUND_PATHS = ['/verify', '/verify-email', '/pending-verification'];

/** True when the pathname is something only a signed-in user is meant to see. */
export const isSessionBoundPath = (pathname: string): boolean =>
  dashboardRootOf(pathname) !== null ||
  SESSION_BOUND_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

let leaving = false;

/**
 * Send a tab whose session just ended to the login page.
 *
 * Only tabs that are actually showing a signed-in page move. A tab parked on the
 * public site or on a seller's storefront keeps browsing — bouncing a shopper to
 * /login because the owner signed out in another window would be a bug, not a
 * feature.
 *
 * The navigation is a full document load on purpose. A React <Navigate> leaves
 * every in-flight request, polling timer and cached page in place, and those are
 * precisely what would fire the next unauthenticated call.
 *
 * Returns whether this tab is leaving.
 */
export const leaveIfSessionBound = (reason: SessionEndReason = 'logout'): boolean => {
  if (typeof window === 'undefined') return false;
  if (leaving) return true;
  if (!isSessionBoundPath(window.location.pathname)) return false;

  leaving = true;
  window.location.replace(`/login?reason=${reason}`);
  return true;
};
