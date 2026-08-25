import { Request } from 'express';
import geoip from 'geoip-lite';

/**
 * Resolve the real client IP behind the reverse proxy / CDN.
 *
 * The app runs with `trust proxy` enabled, so `req.ip` already unwraps
 * X-Forwarded-For, but Cloudflare (and some other CDNs) put the true visitor IP
 * in their own header, which is more reliable than the first XFF hop. Returns
 * null when nothing usable can be extracted, so callers store a real absence
 * rather than a placeholder string.
 *
 * Note this is deliberately NOT used for anything security-critical on its own:
 * every header below is attacker-controlled, so treat the result as a signal
 * for fraud review and duplicate detection, not as proof of identity.
 */
export function getClientIp(req: Request): string | null {
  const headerCandidates = [
    req.headers['cf-connecting-ip'],
    req.headers['true-client-ip'],
    req.headers['x-real-ip'],
    req.headers['x-forwarded-for'],
  ];

  for (const candidate of headerCandidates) {
    const raw = Array.isArray(candidate) ? candidate[0] : candidate;
    if (!raw) continue;
    // X-Forwarded-For is a chain: "client, proxy1, proxy2" — the client is first.
    const first = String(raw).split(',')[0].trim();
    const normalized = normalizeIp(first);
    if (normalized) return normalized;
  }

  return normalizeIp(req.ip || req.socket.remoteAddress || '');
}

/** Strip the IPv4-mapped IPv6 prefix and reject empty / placeholder values. */
function normalizeIp(ip: string): string | null {
  if (!ip) return null;
  let value = ip.trim();
  if (value.startsWith('::ffff:')) value = value.slice(7);
  if (!value || value === 'unknown' || value === '::') return null;
  return value.slice(0, 45); // max length of an IPv6 textual address
}

/** ISO-3166 alpha-2 country for an IP, from the CDN header or the local GeoIP db. */
export function getClientCountry(req: Request, ip: string | null): string | null {
  const cdnCountry = (req.headers['cf-ipcountry'] || req.headers['x-country-code']) as string | undefined;
  if (cdnCountry && cdnCountry !== 'XX') return cdnCountry.toUpperCase();

  if (!ip) return null;
  try {
    return geoip.lookup(ip)?.country?.toUpperCase() || null;
  } catch {
    return null;
  }
}
