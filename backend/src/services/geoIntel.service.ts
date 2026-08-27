import type { Request } from 'express';
import geoip from 'geoip-lite';

/**
 * IP intelligence for landing-page cloaking, without ipapi.co.
 *
 * ipapi.co is rate limited (1k/day, and past that it answers HTTP 200 with an
 * error object rather than data), which silently disabled every geo rule on a
 * busy day. This module replaces it with two things:
 *
 *  1. Local resolution. The visitor's address, country and IP version come from
 *     the request itself — Cloudflare's CF-IPCountry header when present, then
 *     geoip-lite, which is already a dependency. No network call, no quota, and
 *     unspoofable by the client.
 *  2. Enrichment. Only the ISP/organisation and the VPN/proxy verdict need an
 *     external source. Those come from free keyless providers with failover,
 *     cached per IP, so a burst of visitors from one network costs a single
 *     upstream request.
 *
 * Every provider here is free and needs no account. If all of them fail the
 * local answer is still returned, so country, IPv6 and IP-range rules keep
 * working — which is more than ipapi.co gave us when it throttled.
 */

export interface GeoIntel {
  ip: string;
  countryCode: string;
  countryName: string;
  /** ISP / organisation / ASN description, used by the DNS keyword filter. */
  org: string;
  asn: string;
  hostname: string;
  vpn: boolean;
  proxy: boolean;
  tor: boolean;
  hosting: boolean;
  /** Which provider answered the enrichment, or 'local' when none did. */
  source: string;
}

interface Enrichment {
  countryCode?: string;
  countryName?: string;
  org?: string;
  asn?: string;
  hostname?: string;
  vpn?: boolean;
  proxy?: boolean;
  tor?: boolean;
  hosting?: boolean;
  source: string;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — an address rarely changes network
const FAILURE_TTL_MS = 5 * 60 * 1000; // don't retry a dead provider chain per request
const CACHE_MAX_ENTRIES = 5000;
const PROVIDER_TIMEOUT_MS = 2500;

const cache = new Map<string, { value: Enrichment | null; expiresAt: number }>();

function cacheGet(ip: string): { value: Enrichment | null } | undefined {
  const hit = cache.get(ip);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    cache.delete(ip);
    return undefined;
  }
  // Refresh insertion order so the eviction below is roughly LRU.
  cache.delete(ip);
  cache.set(ip, hit);
  return hit;
}

function cacheSet(ip: string, value: Enrichment | null): void {
  cache.set(ip, { value, expiresAt: Date.now() + (value ? CACHE_TTL_MS : FAILURE_TTL_MS) });
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

async function getJson(url: string): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'silacod-geo/1.0' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const str = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

/**
 * ipapi.is — the richest of the three: ASN, company and explicit
 * datacenter/VPN/proxy/tor verdicts. Free, no key.
 *
 * Anonymous callers get a flat, compact body (`asn_org`, `company_name`, `cc`);
 * keyed callers get the nested one (`asn.org`, `company.name`, `location.*`).
 * Both are read here so the mapping survives either.
 */
async function fromIpapiIs(ip: string): Promise<Enrichment | null> {
  const data = await getJson(`https://api.ipapi.is/?q=${encodeURIComponent(ip)}`);
  if (!data || data.error || !data.ip) return null;

  const asn = data.asn || {};
  const company = data.company || {};
  const location = data.location || {};
  const asnNumber = asn.asn ?? data.asn_num;

  return {
    countryCode: str(location.country_code || data.cc).toUpperCase(),
    countryName: str(location.country),
    org: [company.name, data.company_name, asn.org, data.asn_org, asn.descr, company.domain, asn.domain]
      .map(str)
      .filter(Boolean)
      // The same name arrives under several keys; keep the DNS haystack short.
      .filter((value, index, all) => all.indexOf(value) === index)
      .join(' '),
    asn: asnNumber ? `AS${str(asnNumber)}` : '',
    hostname: str(company.domain || asn.domain),
    vpn: !!data.is_vpn,
    proxy: !!data.is_proxy,
    tor: !!data.is_tor,
    hosting: !!data.is_datacenter,
    source: 'ipapi.is',
  };
}

/** ipwho.is — unlimited and keyless, gives ASN/ISP but no VPN verdict. */
async function fromIpWhoIs(ip: string): Promise<Enrichment | null> {
  const data = await getJson(`https://ipwho.is/${encodeURIComponent(ip)}`);
  if (!data || data.success === false) return null;

  const connection = data.connection || {};

  return {
    countryCode: str(data.country_code).toUpperCase(),
    countryName: str(data.country),
    org: [connection.isp, connection.org, connection.domain].map(str).filter(Boolean).join(' '),
    asn: connection.asn ? `AS${str(connection.asn)}` : '',
    hostname: str(connection.domain),
    source: 'ipwho.is',
  };
}

/** freeipapi.com — last resort. Country plus a coarse proxy flag. */
async function fromFreeIpApi(ip: string): Promise<Enrichment | null> {
  const data = await getJson(`https://freeipapi.com/api/json/${encodeURIComponent(ip)}`);
  if (!data || !data.countryCode) return null;

  return {
    countryCode: str(data.countryCode).toUpperCase(),
    countryName: str(data.countryName),
    org: '',
    asn: '',
    hostname: '',
    proxy: !!data.isProxy,
    source: 'freeipapi.com',
  };
}

const PROVIDERS = [fromIpapiIs, fromIpWhoIs, fromFreeIpApi];

async function enrich(ip: string): Promise<Enrichment | null> {
  const cached = cacheGet(ip);
  if (cached) return cached.value;

  for (const provider of PROVIDERS) {
    const result = await provider(ip);
    if (result) {
      cacheSet(ip, result);
      return result;
    }
  }

  cacheSet(ip, null);
  return null;
}

/**
 * Country name for a code, from ICU data bundled with Node.
 *
 * The cloaking config lets a vendor list countries either way ("MA" or
 * "Morocco"), and the name half of that comparison used to come from ipapi.co's
 * `country_name`. Deriving it here keeps name-based lists working no matter
 * which provider answered — ipapi.is's anonymous response omits the name.
 */
const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();

function countryNameFor(code: string): string {
  if (!code || code.length !== 2 || !regionNames) return '';
  try {
    const name = regionNames.of(code);
    return name && name !== code ? name : '';
  } catch {
    return '';
  }
}

/** Reserved ranges never have a useful public answer — skip the round trip. */
function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip.includes(':')) return ip === '::1' || /^f[cd]/i.test(ip) || /^fe80:/i.test(ip);
  return (
    /^10\./.test(ip) ||
    /^127\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^169\.254\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

/** The visitor's real address. Cloudflare first, then the proxy chain. */
export function clientIp(req: Request): string {
  const raw =
    (req.headers['cf-connecting-ip'] as string) ||
    (req.headers['x-real-ip'] as string) ||
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.ip ||
    req.socket?.remoteAddress ||
    '';
  return raw.trim().replace(/^::ffff:/, '');
}

/**
 * Full intelligence for the request's visitor.
 *
 * `withEnrichment` is false when the caller only needs country or IP version —
 * that answer is local, instant and free, so no provider is contacted at all.
 */
export async function lookupClientGeo(req: Request, withEnrichment = true): Promise<GeoIntel> {
  const ip = clientIp(req);

  // Cloudflare resolves the country at the edge for every request it proxies.
  const edgeCountry = str(req.headers['cf-ipcountry']).toUpperCase();
  const local = !isPrivateIp(ip) ? geoip.lookup(ip) : null;

  const localCode =
    (edgeCountry && edgeCountry !== 'XX' ? edgeCountry : str(local?.country).toUpperCase()) || '';

  const base: GeoIntel = {
    ip,
    countryCode: localCode,
    countryName: countryNameFor(localCode),
    org: '',
    asn: '',
    hostname: '',
    vpn: false,
    proxy: false,
    tor: false,
    hosting: false,
    source: 'local',
  };

  if (!withEnrichment || isPrivateIp(ip)) return base;

  const extra = await enrich(ip);
  if (!extra) return base;

  // The local/edge country wins when we have one: it cannot be spoofed.
  const countryCode = base.countryCode || str(extra.countryCode).toUpperCase();

  return {
    ...base,
    countryCode,
    countryName: str(extra.countryName) || countryNameFor(countryCode),
    org: str(extra.org),
    asn: str(extra.asn),
    hostname: str(extra.hostname),
    vpn: !!extra.vpn,
    proxy: !!extra.proxy,
    tor: !!extra.tor,
    hosting: !!extra.hosting,
    source: extra.source,
  };
}

export const __testing = { cache, isPrivateIp };
