import { prisma } from './prisma.js';

/**
 * The set of vendor-owned domains allowed to talk to this API.
 *
 * A seller who connects `myshop.ma` serves the SPA from that host, so every XHR
 * it makes carries `Origin: https://myshop.ma`. The static allow-list in
 * `index.ts` only covers `FRONTEND_URL` and its subdomains, which would reject
 * all of them — the reason a connected custom domain looked live but could not
 * load a single lead.
 *
 * Only ACTIVE domains are admitted. A PENDING one has no certificate yet and a
 * FAILED one is not ours to trust, so neither should be able to reach the API.
 */

/** How long a loaded set is reused before the DB is consulted again. */
const TTL_MS = 60_000;

let cache: Set<string> | null = null;
let loadedAt = 0;
/** In-flight load, so a burst of preflights triggers one query, not twenty. */
let inFlight: Promise<Set<string>> | null = null;

async function load(): Promise<Set<string>> {
  const rows = await prisma.user.findMany({
    where: { customDomain: { not: null }, customDomainStatus: 'ACTIVE', deletedAt: null },
    select: { customDomain: true },
  });

  const set = new Set<string>();
  for (const row of rows) {
    if (row.customDomain) set.add(row.customDomain.trim().toLowerCase());
  }
  return set;
}

/**
 * Drops the cache so the next check re-reads the DB.
 *
 * Called whenever a domain is connected, refreshed or disconnected: a seller who
 * has just watched their domain flip to ACTIVE will reload the page immediately,
 * and waiting out the TTL would greet them with a CORS error.
 */
export function invalidateCustomDomainCache(): void {
  cache = null;
  loadedAt = 0;
}

/** True when `host` is a custom domain currently ACTIVE on some account. */
export async function isActiveCustomDomain(host: string): Promise<boolean> {
  const needle = host.trim().toLowerCase().replace(/^www\./, '');
  if (!needle) return false;

  if (!cache || Date.now() - loadedAt > TTL_MS) {
    if (!inFlight) {
      inFlight = load()
        .then((set) => {
          cache = set;
          loadedAt = Date.now();
          return set;
        })
        .catch((err) => {
          // Never fail an origin check open on a DB blip: keep whatever we had,
          // or an empty set, and let the static allow-list decide.
          console.error('[cors] failed to load custom domains:', err);
          return cache ?? new Set<string>();
        })
        .finally(() => {
          inFlight = null;
        });
    }
    return (await inFlight).has(needle);
  }

  return cache.has(needle);
}
