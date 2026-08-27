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
 * Deciding server-side is both faster (no IP-lookup round trip, no waiting for
 * a framework to boot) and harder to evade: a visitor who blocks the client's
 * lookup would otherwise sail past every geo rule.
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

/** Pulls the active cloaking config out of a saved layout, or null when cloaking is off. */
export function getCloakingConfig(customStructure: any): any | null {
  if (!customStructure) return null;
  const settings = Array.isArray(customStructure) ? null : customStructure?.settings;
  return settings?.cloaking?.enabled ? settings.cloaking : null;
}

/**
 * Ad-platform reviewers that MUST always reach the page, exempt from every rule.
 *
 * Deliberately NOT the search indexers (googlebot, bingbot): those are an SEO
 * choice and filterBots may legitimately want to block them. These are the ad
 * review fetchers only. Blocking AdsBot does not hide the page from review — it
 * fails review, because AdsBot is Google's landing-page checker and a page it
 * cannot load is disapproved for a broken destination. filterDirect compounds it,
 * since these fetchers send no Referer. Letting them through keeps the ad account
 * approved, which is the whole point of getting cloaking right.
 */
const MUST_REACH_PATTERN = /adsbot-google|google-ads/i;

export interface CloakDecision {
  /** Absolute URL to redirect to, or null to serve a page. */
  redirect: string | null;
  /**
   * When set, serve one of the seller's OTHER pages (a /r/ code) at 200 on the
   * same URL, instead of redirecting away. The caller resolves and serves it.
   * Only ever set by an audience rule, never by the bots rule.
   */
  renderCode?: string | null;
  /** Which rule fired, for logging. */
  rule?: string;
}

function fallback(raw: unknown, def: string): string {
  return safeUrl(raw) || def;
}

/**
 * The action for a cloaking rule (country / language / device / direct / bots) that has
 * matched a visitor who should not see the primary page.
 *
 * `<rule>Mode` chooses the shape:
 *   'render'   — serve one of the seller's own pages (a /r/ code) at 200 on the
 *                SAME url, so the visitor never leaves and the display URL still
 *                matches the landing domain.
 *   'redirect' — 302 to the configured decoy URL. Default, unchanged behaviour.
 */
function audienceAction(
  mode: unknown,
  altCode: unknown,
  redirectUrl: unknown,
  redirectDefault: string,
  rule: string
): CloakDecision {
  const code = typeof altCode === 'string' ? altCode.trim() : '';
  if (mode === 'render' && code) {
    return { redirect: null, renderCode: code, rule };
  }
  return { redirect: fallback(redirectUrl, redirectDefault), rule };
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
  const headers = req.headers || {};
  const cfIp = headers['cf-connecting-ip'] as string;
  if (cfIp) return cfIp.trim();

  const xRealIp = headers['x-real-ip'] as string;
  if (xRealIp) return xRealIp.trim();

  const xForwardedFor = headers['x-forwarded-for'] as string;
  if (xForwardedFor) {
    const first = xForwardedFor.split(',')[0].trim();
    if (first) return first;
  }

  const raw = req.ip || req.socket?.remoteAddress || '';
  return raw.replace(/^::ffff:/, '').trim();
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

  // 0. Reviewers and indexers always reach the page, ahead of every rule.
  if (MUST_REACH_PATTERN.test(ua)) {
    return { redirect: null, rule: 'allowlisted' };
  }

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
      return audienceAction(
        c.botMode || c.botsMode,
        c.botAlternateCode || c.botsAlternateCode,
        c.botRedirectUrl,
        'https://wikipedia.org',
        'bots'
      );
    }
  }

const RRoute = /^\/r\/([^/]+)/;

function readSourceRef(urlStr: string): { code: string; host: string } | null {
  try {
    const parsed = new URL(urlStr.includes('://') ? urlStr : `https://${urlStr}`);
    const match = parsed.pathname.match(RRoute);
    if (!match) return null;
    let code = match[1];
    try { code = decodeURIComponent(code); } catch {}
    return { code, host: parsed.hostname.toLowerCase() };
  } catch {
    return null;
  }
}

function parseSourceSpecs(value: string | null | undefined): Array<{ code: string; host?: string }> {
  if (!value) return [];
  return value
    .split(/[,\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => {
      if (entry.includes('/') || entry.includes('://')) {
        const ref = readSourceRef(entry.includes('://') ? entry : `https://${entry}`);
        return ref ? { code: ref.code.toLowerCase(), host: ref.host } : null;
      }
      return { code: entry };
    })
    .filter((spec): spec is { code: string; host?: string } => spec !== null);
}

function parseDomainList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,\n]/)
    .map((s) =>
      s
        .trim()
        .toLowerCase()
        .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
        .split(/[/?#]/)[0]
        .replace(/:\d+$/, '')
    )
    .filter(Boolean);
}

function parseSourceToken(token: string | null | undefined): { code: string; host: string } | null {
  if (!token) return null;
  try {
    const binary = Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('binary');
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const sep = decoded.lastIndexOf('|');
    if (sep <= 0) return null;
    const issuedAt = Number(decoded.slice(sep + 1));
    if (!Number.isFinite(issuedAt)) return null;
    const age = Date.now() - issuedAt;
    if (age < -86400000 || age > 30 * 60 * 1000) return null;
    return readSourceRef(decoded.slice(0, sep));
  } catch {
    return null;
  }
}

function isAllowedSource(
  source: { code: string; host: string } | null,
  specs: Array<{ code: string; host?: string }>,
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

  if (!hasCodeOnlySpec && !pinnedHosts.includes(host)) return false;

  if (allowedDomains.length > 0) {
    return allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  }

  if (pinnedHosts.includes(host)) return true;

  return host === currentHostname.toLowerCase();
}

// 2. Direct visits. More accurate here than in the browser: a document request
// carries the true cross-site Referer, which the SPA never sees.
if (c.filterDirect && !req.headers.referer) {
  return audienceAction(c.directMode, c.directAlternateCode, c.directRedirectUrl, 'https://google.com', 'direct');
}

// 2b. Traffic Source Restriction (filterSource)
if (c.filterSource && c.allowedSources) {
  const specs = parseSourceSpecs(c.allowedSources);
  if (specs.length > 0) {
    const allowedDomains = parseDomainList(c.allowedSourceDomains);
    const currentHostname = (req.hostname || (req.headers.host || '').split(':')[0]).toLowerCase();
    const referer = req.headers.referer ? String(req.headers.referer) : '';
    const query = (req.query || {}) as Record<string, string>;
    const token = query._s || query._src || '';

    let cameFromAllowedSource = false;
    if (token) {
      const parsedToken = parseSourceToken(token);
      if (parsedToken) {
        cameFromAllowedSource = isAllowedSource(parsedToken, specs, allowedDomains, currentHostname);
      }
    }

    if (!cameFromAllowedSource && referer) {
      const refObj = readSourceRef(referer);
      if (refObj && refObj.code.toLowerCase() !== String(c.pageCode || '').toLowerCase()) {
        cameFromAllowedSource = isAllowedSource(refObj, specs, allowedDomains, currentHostname);
      }
    }

    if (!cameFromAllowedSource) {
      return audienceAction(c.sourceMode, c.sourceAlternateCode, c.sourceRedirectUrl, 'https://google.com', 'source');
    }
  }
}

  // 3. Desktop redirection
  if (c.redirectDesktop && !MOBILE_PATTERN.test(ua)) {
    return audienceAction(c.desktopMode, c.desktopAlternateCode, c.desktopRedirectUrl, 'https://www.silacod.com', 'desktop');
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
      return audienceAction(c.languageMode, c.languageAlternateCode, c.languageRedirectUrl, 'https://google.com', 'language');
    }
  }

  const ip = clientIp(req);

  // 5. IPv6 — from the socket rather than a third-party lookup.
  if (c.filterIpv6 && ip.includes(':')) {
    return audienceAction(c.ipv6Mode, c.ipv6AlternateCode, c.ipv6RedirectUrl, 'https://google.com', 'ipv6');
  }

  // 6. Blocked IP ranges. The real socket address cannot be spoofed by the
  // client, unlike an address a third-party lookup reports back to it.
  if (c.filterIpRange && c.blockedIpRanges) {
    const ranges = String(c.blockedIpRanges)
      .split(/[\n,]+/)
      .map((r) => r.trim())
      .filter(Boolean);
    if (ranges.some((range) => inCidr(ip, range))) {
      return audienceAction(c.ipRangeMode, c.ipRangeAlternateCode, c.ipRangeRedirectUrl, 'https://google.com', 'iprange');
    }
  }

  // 6b. HTTP Proxy Headers Layer Check
  if (c.filterVpn) {
    const headers = req.headers || {};
    const via = String(headers['via'] || '');
    const forwarded = String(headers['x-forwarded-for'] || headers['forwarded'] || '');
    const proxyUserIp = String(headers['x-proxyuser-ip'] || headers['proxy-client-ip'] || headers['wl-proxy-client-ip'] || headers['proxy-connection'] || '');

    // Multiple hop IPs in X-Forwarded-For, Via headers or proxy headers indicate a proxy layer
    const isProxyHeader = !!(via || (forwarded && forwarded.includes(',')) || proxyUserIp);
    if (isProxyHeader) {
      return audienceAction(c.vpnMode, c.vpnAlternateCode, c.vpnRedirectUrl, 'https://google.com', 'proxy');
    }
  }

  // 7. Country, via Cloudflare edge header or geoip-lite lookup
  if (c.filterCountry) {
    const wanted = countryTokens(c);
    if (wanted.length) {
      const headers = req.headers || {};
      const query = (req.query || {}) as Record<string, string>;

      const cfCountry = String(
        headers['cf-ipcountry'] ||
        headers['x-test-country'] ||
        query.__test_country ||
        ''
      ).toUpperCase();

      const geo = ip ? geoip.lookup(ip) : null;
      const country = (cfCountry && cfCountry !== 'XX' ? cfCountry : (geo?.country || '')).toUpperCase();

      if (country && !wanted.includes(country)) {
        return audienceAction(c.countryMode, c.countryAlternateCode, c.countryRedirectUrl, 'https://google.com', 'country');
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
