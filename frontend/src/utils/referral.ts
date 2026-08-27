/**
 * Builds a referral link URL with the user's custom subdomain.
 * If no subdomain is present, returns the standard root-level link.
 */
export function buildReferralUrl(code: string, subdomain?: string | null, customDomain?: string | null, customDomainStatus?: string | null): string {
  if (customDomain && customDomainStatus === 'ACTIVE') {
    return `https://${customDomain}/r/${code}`;
  }

  const { protocol, host } = window.location;
  
  if (!subdomain) {
    return `${protocol}//${host}/r/${code}`;
  }

  // Normalize subdomain
  const sub = subdomain.trim().toLowerCase();

  // If host already starts with this subdomain, don't duplicate it
  const hostLower = host.toLowerCase();
  if (hostLower.startsWith(sub + '.')) {
    return `${protocol}//${host}/r/${code}`;
  }

  // Clean www. from host
  const cleanHost = host.replace(/^www\./i, '');

  return `${protocol}//${sub}.${cleanHost}/r/${code}`;
}

/** Query param carrying proof of the page a visitor was sent from. */
export const SOURCE_PARAM = '_s';

/** A source token older than this is treated as invalid. */
export const SOURCE_TOKEN_MAX_AGE_MS = 30 * 60 * 1000;

const RRoute = /^\/r\/([^/]+)/;

/** Where a visitor came from: which landing page, on which domain. */
export interface SourceRef {
  /** Referral code of the source page, e.g. "produit2". */
  code: string;
  /** Hostname the source page was served from, e.g. "tal9ezdirt.silacod.com". Port excluded. */
  host: string;
}

/**
 * One entry of the "allowed sources" setting. A bare code ("produit2") leaves the
 * host open, so the domain rules decide it. A pasted full URL pins both at once.
 */
export interface SourceSpec {
  code: string;
  host?: string;
}

/** The referral code of the page currently open, or null outside /r/. */
export function getCurrentLinkCode(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(RRoute);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Reads the landing page a URL points at. Returns null when the URL is
 * malformed or isn't an /r/ page.
 */
export function readSourceRef(url: string | URL): SourceRef | null {
  try {
    const parsed = url instanceof URL ? url : new URL(url);
    const match = parsed.pathname.match(RRoute);
    if (!match) return null;

    let code = match[1];
    try {
      code = decodeURIComponent(code);
    } catch { /* leave the raw segment */ }

    // hostname, not host — the port is irrelevant to who owns the site, and keeping
    // it out means "a-maa.localhost" matches during local dev on :5173.
    return { code, host: parsed.hostname.toLowerCase() };
  } catch {
    return null;
  }
}

/**
 * Stamps the source page's URL and the current time into a URL-safe token, so a
 * destination page can tell where the visitor came from even when the browser
 * drops the referrer (an in-app browser handing the link off to Chrome, for one).
 *
 * This is a convenience bridge, not a security boundary — it is generated in the
 * browser and so is forgeable. The host is carried inside it precisely so the
 * destination applies the same domain rule to it as it does to a real referrer.
 */
export function buildSourceToken(sourceUrl: string): string {
  const raw = `${sourceUrl}|${Date.now()}`;
  // Encode to UTF-8 bytes first — btoa alone throws on non-Latin1 codes.
  const bytes = new TextEncoder().encode(raw);
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Reads back a token from buildSourceToken. Returns null if absent, malformed or stale. */
export function parseSourceToken(token: string | null | undefined): SourceRef | null {
  if (!token) return null;
  try {
    const binary = atob(token.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);

    // Split on the last '|' — the URL itself may contain one.
    const sep = decoded.lastIndexOf('|');
    if (sep <= 0) return null;

    const issuedAt = Number(decoded.slice(sep + 1));
    if (!Number.isFinite(issuedAt)) return null;

    const age = Date.now() - issuedAt;
    // Allow up to 24 hours of negative clock skew (instant tab opens / system clock differences)
    if (age < -86400000 || age > SOURCE_TOKEN_MAX_AGE_MS) return null;

    return readSourceRef(decoded.slice(0, sep));
  } catch {
    return null;
  }
}

const TOKEN_USE_PREFIX = 'sc_src_uses:';

/**
 * Verdicts already issued during this page load, so the same token counts once
 * however many times the rule is evaluated. React StrictMode runs effects twice in
 * development, which would otherwise burn two uses per visit.
 */
const verdictThisLoad = new Map<string, boolean>();

/** Drops counters for tokens that are now too old to be valid anyway. */
function pruneTokenUses(now: number): void {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(TOKEN_USE_PREFIX)) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(key) || 'null');
      if (!entry || typeof entry.firstUsedAt !== 'number' || now - entry.firstUsedAt > SOURCE_TOKEN_MAX_AGE_MS) {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }
}

/**
 * Records one use of a token and reports whether it is still within its allowance.
 * `maxUses` of 0 or less means unlimited.
 *
 * The count lives in localStorage, so it caps how often one link can be reopened or
 * refreshed in a browser. Clearing storage or switching to a private window resets
 * it — like the rest of this cloaking, it raises the effort rather than making
 * reuse impossible. If storage is unavailable the token is allowed through, so a
 * real buyer is never blocked by a browser that refuses to persist anything.
 */
export function registerTokenUse(token: string, maxUses: number): boolean {
  if (!maxUses || maxUses <= 0) return true;

  const cached = verdictThisLoad.get(token);
  if (cached !== undefined) return cached;

  let verdict = true;
  try {
    const now = Date.now();
    pruneTokenUses(now);

    const key = TOKEN_USE_PREFIX + token;
    let firstUsedAt = now;
    let used = 0;
    try {
      const entry = JSON.parse(localStorage.getItem(key) || 'null');
      if (entry && typeof entry.used === 'number') {
        used = entry.used;
        if (typeof entry.firstUsedAt === 'number') firstUsedAt = entry.firstUsedAt;
      }
    } catch { /* corrupt entry, start over */ }

    used += 1;
    localStorage.setItem(key, JSON.stringify({ used, firstUsedAt }));
    verdict = used <= maxUses;
  } catch {
    verdict = true; // storage blocked — fail open rather than bounce a real visitor
  }

  verdictThisLoad.set(token, verdict);
  return verdict;
}

/** Reads the max-uses setting. Blank, zero or nonsense all mean unlimited. */
export function readMaxUses(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/** Splits a comma-separated settings field into lowercase, de-blanked entries. */
export function splitList(value: string | null | undefined): string[] {
  return (value || '')
    .split(/[,\n]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Reads the "allowed sources" field. Accepts either style, mixed freely:
 *   "produit2"                              -> code only, domain rules decide the host
 *   "https://a-maa.silacod.com/r/produit2"  -> code and host pinned together
 * Pasting the source page's address is the obvious thing to do, so it is supported.
 */
export function parseSourceSpecs(value: string | null | undefined): SourceSpec[] {
  return splitList(value)
    .map((entry): SourceSpec | null => {
      // Anything with a path or a scheme is treated as an address, not a code.
      if (entry.includes('/') || entry.includes('://')) {
        const ref = readSourceRef(entry.includes('://') ? entry : `https://${entry}`);
        return ref ? { code: ref.code.toLowerCase(), host: ref.host } : null;
      }
      return { code: entry };
    })
    .filter((spec): spec is SourceSpec => spec !== null);
}

/**
 * Reads the "allowed domains" field, tolerating a pasted URL or a port:
 * "http://a-maa.localhost:5173/r/x", "a-maa.localhost:5173" and "a-maa.localhost"
 * all yield "a-maa.localhost".
 */
export function parseDomainList(value: string | null | undefined): string[] {
  return splitList(value)
    .map((entry) =>
      entry
        .replace(/^[a-z][a-z0-9+.-]*:\/\//, '') // scheme
        .split(/[/?#]/)[0]                       // path, query, fragment
        .replace(/:\d+$/, '')                    // port
    )
    .filter(Boolean);
}

/**
 * Checks a source against the page's configured allow-list.
 *
 * `specs` is required — an empty list means the rule is not configured and the
 * caller should skip it entirely rather than call this.
 *
 * The code must match. Then the host must clear two gates:
 *
 *  - a spec that pinned a host (pasted as a full URL) only accepts that host;
 *  - `allowedDomains`, once filled, is a strict whitelist — nothing outside it
 *    passes, not even the page's own domain or a pinned URL. That is what the
 *    "authorized domains" label promises, so filling it in always narrows access.
 *
 * With no domain list, a pinned spec vouches for its own host and a code-only spec
 * accepts `currentHostname` alone. Each domain entry also covers its subdomains, so
 * "silacod.com" admits "tal9ezdirt.silacod.com" but not "silacod.com.evil.com".
 */
export function isAllowedSource(
  source: SourceRef | null,
  specs: SourceSpec[],
  allowedDomains: string[],
  currentHostname: string
): boolean {
  if (!source) return false;

  const host = source.host.toLowerCase();
  const code = source.code.toLowerCase();
  if (!host) return false;

  const matching = specs.filter((spec) => spec.code === code);
  if (matching.length === 0) return false;

  const pinnedHosts = matching.map((spec) => spec.host).filter(Boolean) as string[];
  const hasCodeOnlySpec = matching.some((spec) => !spec.host);

  // Every matching spec named a host, so one of them has to be this host.
  if (!hasCodeOnlySpec && !pinnedHosts.includes(host)) return false;

  if (allowedDomains.length > 0) {
    return allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  }

  if (pinnedHosts.includes(host)) return true;

  return host === currentHostname.toLowerCase();
}
