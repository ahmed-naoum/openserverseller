import type { Request } from 'express';
import geoip from 'geoip-lite';
import { safeUrl } from './escape.js';

/**
 * Cloaking rules evaluated from HTTP headers, before the first byte is written.
 *
 * Ported from frontend/src/utils/cloaking.ts. The patterns are duplicated rather
 * than imported because the backend's rootDir is backend/src and it cannot reach
 * into frontend/src — keep the two in step by hand.
 *
 * Deciding server-side is both faster (no ipapi.co round trip, no waiting for a
 * framework to boot) and harder to evade: a visitor who blocks the third-party
 * lookup currently sails past every geo rule.
 *
 * Three rules stay client-side and are not implemented here: the VPN browser-
 * extension probe, the localStorage use-meter behind filterSource, and
 * disableRightClick. They need a DOM by definition.
 */

/**
 * User agents that are genuinely automated.
 *
 * This list is deliberately NOT a copy of DEFAULT_BOT_PATTERN in cloaking.ts.
 * That pattern contains a bare `moz` alternative, and every mainstream browser
 * sends "Mozilla/5.0" — so turning bot filtering on with no explicit allow-list
 * redirects 100% of human traffic. Verified against real user agents: Chrome on
 * Android, Safari on iOS and the Instagram and Facebook in-app browsers all
 * matched.
 *
 * Several other entries there match real people too. In-app browsers are humans:
 * `instagram`, `linkedin`, `snapchat`, `duckduckgo`, `reddit` and `pinterest`
 * all appear in the user agent of an app's built-in browser, which is how a
 * large share of social traffic arrives. Only the explicit crawler forms
 * (`linkedinbot`, `redditbot`, …) belong here.
 */
const CRAWLER_PATTERN = new RegExp(
  [
    // Generic automation markers
    'bot\\b', 'bot/', 'crawler', 'spider', 'crawling', 'scraper', 'headless',
    // Tools and libraries
    'curl/', 'wget', 'python-requests', 'python-urllib', 'postman', 'axios/',
    'node-fetch', 'httpclient', 'go-http-client', 'libwww', 'lwp-trivial',
    'java/', 'okhttp', 'apache-httpclient',
    // Automation frameworks
    'puppeteer', 'phantomjs', 'selenium', 'cypress', 'playwright', 'lighthouse',
    // Search engines
    'googlebot', 'google-inspectiontool', 'bingbot', 'slurp', 'duckduckbot',
    'baiduspider', 'yandexbot', 'sogou', 'exabot', 'seznambot', 'petalsearch',
    'qwantify', 'coccocbot',
    // Social and messaging link-preview fetchers
    'facebookexternalhit', 'facebookcatalog', 'facebookbot', 'facebot',
    'twitterbot', 'linkedinbot', 'slackbot', 'telegrambot', 'discordbot',
    'redditbot', 'pinterestbot', 'whatsapp/', 'skypeuripreview', 'vkshare',
    'flipboardproxy', 'applebot',
    // SEO and monitoring
    'ahrefs', 'semrushbot', 'mj12bot', 'dotbot', 'rogerbot', 'majestic12',
    'screaming frog', 'zoominfo', 'megaindex', 'grapeshot', 'dataminr',
    'pingdom', 'statuscake', 'updown', 'uptimerobot', 'catchpoint', 'datadog',
    'appinsights', 'incapsula', 'bubing', 'zmeu',
    // Archives and AI crawlers
    'ia_archiver', 'archive.org_bot', 'ccbot', 'amazonbot', 'bytespider',
    'gptbot', 'chatgpt-user', 'claudebot', 'perplexitybot', 'feedfetcher',
    'feedburner',
  ].join('|'),
  'i'
);

const MOBILE_PATTERN = /Mobi|Android|iPhone|iPad|iPod/i;

export interface CloakDecision {
  /** Absolute URL to redirect to, or null to serve the page. */
  redirect: string | null;
  /** Which rule fired, for logging. */
  rule?: string;
}

function fallback(raw: unknown, def: string): string {
  return safeUrl(raw) || def;
}

/** First tag of Accept-Language, honouring q-weights. */
function primaryLanguage(header: string | undefined): string {
  if (!header) return '';
  const best = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.split('=')[1]) || 0 : 1 };
    })
    .filter((entry) => entry.tag)
    .sort((a, b) => b.q - a.q)[0];
  return best ? best.tag : '';
}

function clientIp(req: Request): string {
  // trust proxy is enabled, so req.ip already reflects X-Forwarded-For.
  const raw = req.ip || req.socket?.remoteAddress || '';
  // Express reports IPv4 through an IPv6 socket as ::ffff:1.2.3.4.
  return raw.replace(/^::ffff:/, '');
}

function ipv4ToLong(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    out = out * 256 + n;
  }
  return out;
}

/** IPv4-only CIDR containment, matching the client implementation. */
function inCidr(ip: string, cidr: string): boolean {
  const [range, bitsRaw] = cidr.trim().split('/');
  const bits = bitsRaw === undefined ? 32 : Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;

  const ipLong = ipv4ToLong(ip);
  const rangeLong = ipv4ToLong(range);
  if (ipLong === null || rangeLong === null) return false;

  const mask = bits === 0 ? 0 : (-1 << (32 - bits)) >>> 0;
  return (ipLong & mask) === (rangeLong & mask);
}

function countryTokens(c: any): string[] {
  const source =
    Array.isArray(c.selectedCountries) && c.selectedCountries.length > 0
      ? c.selectedCountries.map((item: any) =>
          typeof item === 'string' ? item : item?.code || item?.value || String(item || '')
        )
      : String(c.allowedCountries || '').split(',');

  return source
    .flatMap((item: string) => String(item).split('-').map((part) => part.trim().toUpperCase()))
    .filter(Boolean);
}

/**
 * Evaluates every rule decidable from the request.
 *
 * Order matches the client: bots first, so a crawler lands on the configured
 * safe page rather than on a narrower rule's destination.
 */
export function resolveServerCloak(c: any, req: Request): CloakDecision {
  if (!c) return { redirect: null };

  const ua = String(req.headers['user-agent'] || '');

  // 1. Bots and crawlers
  if (c.filterBots) {
    const explicit =
      Array.isArray(c.selectedUserAgents) && c.selectedUserAgents.length > 0
        ? c.selectedUserAgents.map((agent: any) =>
            String(typeof agent === 'string' ? agent : agent?.value || agent?.name || '')
              .toLowerCase()
          )
        : null;

    const blocked = explicit
      ? explicit.some((token: string) => token && ua.toLowerCase().includes(token))
      : CRAWLER_PATTERN.test(ua);

    if (blocked) {
      return { redirect: fallback(c.botRedirectUrl, 'https://wikipedia.org'), rule: 'bots' };
    }
  }

  // 2. Direct visits. More accurate here than in the browser: a document request
  // carries the true cross-site Referer, which the SPA never sees.
  if (c.filterDirect && !req.headers.referer) {
    return { redirect: fallback(c.directRedirectUrl, 'https://google.com'), rule: 'direct' };
  }

  // 3. Desktop redirection
  if (c.redirectDesktop && !MOBILE_PATTERN.test(ua)) {
    return {
      redirect: fallback(c.desktopRedirectUrl, 'https://www.silacod.com'),
      rule: 'desktop',
    };
  }

  // 4. Language. Accept-Language is a q-weighted list, not navigator.language,
  // so only the top-ranked tag is compared.
  if (c.filterLanguage && c.allowedLanguages) {
    const userLang = primaryLanguage(req.headers['accept-language'] as string | undefined);
    const allowed = String(c.allowedLanguages)
      .split(',')
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length && !allowed.some((lang) => userLang.includes(lang))) {
      return { redirect: fallback(c.languageRedirectUrl, 'https://google.com'), rule: 'language' };
    }
  }

  const ip = clientIp(req);

  // 5. IPv6 — from the socket rather than a third-party lookup.
  if (c.filterIpv6 && ip.includes(':')) {
    return { redirect: fallback(c.ipv6RedirectUrl, 'https://google.com'), rule: 'ipv6' };
  }

  // 6. Blocked IP ranges. The real socket address cannot be spoofed by the
  // client, unlike the address ipapi.co reports back to it.
  if (c.filterIpRange && c.blockedIpRanges) {
    const ranges = String(c.blockedIpRanges)
      .split(/[\n,]+/)
      .map((r) => r.trim())
      .filter(Boolean);
    if (ranges.some((range) => inCidr(ip, range))) {
      return { redirect: fallback(c.ipRangeRedirectUrl, 'https://google.com'), rule: 'iprange' };
    }
  }

  // 7. Country, via geoip-lite. Already a dependency and already used by
  // lib/trafficTracker.ts, so this adds no install and no network call.
  if (c.filterCountry) {
    const wanted = countryTokens(c);
    if (wanted.length) {
      const geo = ip ? geoip.lookup(ip) : null;
      const country = (geo?.country || '').toUpperCase();
      // An unresolvable IP is allowed through rather than redirected: geoip-lite
      // has no answer for many mobile carrier ranges, and silently discarding
      // that traffic would be worse than letting it see the page.
      if (country && !wanted.includes(country)) {
        return { redirect: fallback(c.countryRedirectUrl, 'https://google.com'), rule: 'country' };
      }
    }
  }

  return { redirect: null };
}

/** Whether any rule this module cannot decide is enabled. */
export function needsClientCloak(c: any): boolean {
  return !!(c && (c.filterVpn || c.filterDns || c.filterSource || c.disableRightClick));
}

export const __testing = { CRAWLER_PATTERN, primaryLanguage, inCidr };
