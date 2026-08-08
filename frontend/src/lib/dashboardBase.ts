/**
 * Where a signed-in user's dashboard lives.
 *
 * Two dashboards render from the same page components: the vendor's own tree at
 * `/dashboard`, and its sub-accounts' tree at `/vendor-agent-helper-dashboard`.
 * Any code that builds a link by asking "what role is this?" answers
 * `/dashboard` for both and throws sub-account users out of their own tree, so
 * prefer `basePathFor(role, location.pathname)` — it trusts the URL the user is
 * actually on before it falls back to the role.
 */

export const VENDOR_BASE = '/dashboard';
export const VENDOR_HELPER_BASE = '/vendor-agent-helper-dashboard';

/** Every dashboard root, longest first so `/dashboard` can't shadow a longer prefix. */
const DASHBOARD_ROOTS = [
  VENDOR_HELPER_BASE,
  '/grosseller',
  '/confirmation',
  '/influencer',
  '/helper',
  '/admin',
  '/agent',
  VENDOR_BASE,
];

const ROLE_BASE: Record<string, string> = {
  SUPER_ADMIN: '/admin',
  FINANCE_ADMIN: '/admin',
  SYSTEM_SUPPORT: '/admin',
  CALL_CENTER_AGENT: '/agent',
  CONFIRMATION_AGENT: '/confirmation',
  FULFILLMENT_OPERATOR: '/warehouse',
  COURIER_PARTNER: '/courier',
  GROSSELLER: '/grosseller',
  INFLUENCER: '/influencer',
  HELPER: '/helper',
  UNCONFIRMED: '/verify',
  VENDOR: VENDOR_BASE,
  VENDOR_HELPER: VENDOR_HELPER_BASE,
};

/** The dashboard root that owns a pathname, or null if it isn't under one. */
export const dashboardRootOf = (pathname: string): string | null =>
  DASHBOARD_ROOTS.find((root) => pathname === root || pathname.startsWith(`${root}/`)) || null;

/**
 * Base path to build in-dashboard links from. Pass `location.pathname` whenever
 * you have it: a vendor and its sub-account share every page component, and only
 * the URL says which of the two trees the user is currently in.
 */
export const basePathFor = (role?: string | null, pathname?: string | null): string => {
  if (pathname) {
    const root = dashboardRootOf(pathname);
    if (root) return root;
  }
  return ROLE_BASE[role || ''] || VENDOR_BASE;
};

/**
 * `basePathFor` against the URL in the address bar. Use it in click handlers and
 * anywhere a component doesn't already hold `location.pathname`.
 */
export const currentBasePath = (role?: string | null): string =>
  basePathFor(role, typeof window !== 'undefined' ? window.location.pathname : null);

/** True when this role is a vendor sub-account. */
export const isVendorHelperRole = (role?: string | null): boolean => role === 'VENDOR_HELPER';

/** True when the pathname is inside either vendor tree (own or sub-account). */
export const isVendorTree = (pathname: string): boolean => {
  const root = dashboardRootOf(pathname);
  return root === VENDOR_BASE || root === VENDOR_HELPER_BASE;
};
