/**
 * Landing-page cloaking rules.
 *
 * Each resolver returns the URL to send the visitor to, or null to let them through,
 * rather than redirecting itself. That lets the public page run the instant rules
 * *before* it renders anything, so a blocked visitor never sees the protected page.
 *
 * Rules split into two groups:
 *  - instant: decided from data already in the browser (user agent, referrer, URL,
 *    language). Free to evaluate, so the page waits on them.
 *  - geo: needs an IP lookup, served by our own /public/geo endpoint. Evaluated
 *    after render so legitimate visitors are not held behind a round-trip.
 */
import { SOURCE_PARAM, isAllowedSource, parseDomainList, parseSourceSpecs, parseSourceToken, readMaxUses, readSourceRef, registerTokenUse } from './referral';

/**
 * User agents that are genuinely automated.
 *
 * Every entry here must be absent from real browsers. The previous version of
 * this pattern contained a bare `moz` alternative — and every mainstream browser
 * sends "Mozilla/5.0" — so enabling filterBots without an explicit
 * selectedUserAgents list redirected 100% of human traffic to wikipedia.org.
 * Verified against real user agents: Chrome on Android, Safari on iOS, and the
 * Instagram and Facebook in-app browsers all matched.
 *
 * Bare `instagram`, `linkedin`, `snapchat`, `duckduckgo`, `reddit`, `pinterest`,
 * `skype`, `telegram` and `youtube` were removed for the same reason: those
 * strings appear in the user agent of an app's built-in browser, which is how a
 * large share of social traffic arrives. Only the explicit crawler forms
 * (`linkedinbot`, `redditbot`, …) belong here.
 *
 * Kept in step by hand with CRAWLER_PATTERN in
 * backend/src/services/landingCompiler/cloak.ts, which is the canonical copy and
 * carries the test suite.
 */
const DEFAULT_BOT_PATTERN = new RegExp([
  'bot\\b', 'bot/', 'crawler', 'spider', 'crawling', 'scraper', 'headless',
  'curl/', 'wget', 'python-requests', 'python-urllib', 'postman', 'axios/',
  'node-fetch', 'httpclient', 'go-http-client', 'libwww', 'lwp-trivial',
  'java/', 'okhttp', 'apache-httpclient',
  'puppeteer', 'phantomjs', 'selenium', 'cypress', 'playwright', 'lighthouse',
  'googlebot', 'google-inspectiontool', 'bingbot', 'slurp', 'duckduckbot',
  'baiduspider', 'yandexbot', 'sogou', 'exabot', 'seznambot', 'petalsearch',
  'qwantify', 'coccocbot',
  'facebookexternalhit', 'facebookcatalog', 'facebookbot', 'facebot',
  'twitterbot', 'linkedinbot', 'slackbot', 'telegrambot', 'discordbot',
  'redditbot', 'pinterestbot', 'whatsapp/', 'skypeuripreview', 'vkshare',
  'flipboardproxy', 'applebot',
  'ahrefs', 'semrushbot', 'mj12bot', 'dotbot', 'rogerbot', 'majestic12',
  'screaming\\sfrog', 'zoominfo', 'megaindex', 'grapeshot', 'dataminr',
  'pingdom', 'statuscake', 'updown', 'uptimerobot', 'catchpoint', 'datadog',
  'appinsights', 'incapsula', 'bubing', 'zmeu',
  'ia_archiver', 'archive\\.org_bot', 'ccbot', 'amazonbot', 'bytespider',
  'gptbot', 'chatgpt-user', 'claudebot', 'perplexitybot', 'feedfetcher',
  'feedburner',
].join('|'), 'i');

const DEFAULT_BLOCKED_DNS = ['facebook.com', 'fb.com', 'facebook.net', 'fbcdn.net', 'fbcdn.com', 'tfbnw.net', 'fbsbx.com', 'akamaihd.net', 'facebook.fr', 'facebook.de', 'whatsapp.net', 'messenger.com', 'foursquare.com', 'energized.pro', 'addtoany.com', 'whatsapp.com', 'instagram.com', 'hootsuite.com', 'edgesuite.net', 'internet.org', 'appspot.com', 'wechat.com', 'fb.me', 'freebasics.com', 'fburl.com'];

/** Pulls the active cloaking config out of a saved layout, or null when cloaking is off. */
export function getCloakingConfig(customStructure: any): any | null {
  if (!customStructure) return null;
  // Legacy layouts were a bare block array with no settings object.
  const settings = Array.isArray(customStructure) ? null : customStructure?.settings;
  return settings?.cloaking?.enabled ? settings.cloaking : null;
}

/**
 * Rules decidable without a network call. Returns a redirect URL, or null to allow.
 * Order matters: bots are checked first so crawlers land on the configured safe page
 * rather than on a narrower rule's destination.
 */
// Ad reviewers that must always reach the page — kept in step with MUST_REACH_PATTERN
// in backend/src/services/landingCompiler/cloak.ts. Not the search indexers, only the
// ad review fetchers: blocking AdsBot fails ad review, so it is exempt from every rule.
const MUST_REACH_PATTERN = /adsbot-google|google-ads/i;

export function resolveInstantCloakRedirect(c: any): string | null {
  // 0. Reviewers and indexers always reach the page, ahead of every rule.
  if (MUST_REACH_PATTERN.test(navigator.userAgent || '')) return null;

  // 1. Bot & crawler filtering
  if (c.filterBots) {
    const ua = (navigator.userAgent || '').toLowerCase();
    const targetAgents = Array.isArray(c.selectedUserAgents) && c.selectedUserAgents.length > 0
      ? c.selectedUserAgents.map((agent: any) => (typeof agent === 'string' ? agent : (agent?.value || agent?.name || String(agent || ''))).toLowerCase())
      : null;

    const isBlockedBot = targetAgents
      ? targetAgents.some((agent: string) => ua.includes(agent))
      : DEFAULT_BOT_PATTERN.test(ua);

    if (isBlockedBot) {
      if (c.botMode === 'render' || c.botsMode === 'render') return null;
      return c.botRedirectUrl || 'https://wikipedia.org';
    }
  }

  // 2. Direct visits (no referrer at all)
  if (c.filterDirect && !document.referrer) {
    // 'render' mode is a server-compiled feature (SSG on); the SPA cannot swap
    // the page without changing the URL, so show the primary instead of a decoy.
    if (c.directMode === 'render') return null;
    return c.directRedirectUrl || 'https://google.com';
  }

  // 3. Traffic source — visitor must arrive from an allowed /r/ page.
  // Two accepted proofs: the token the source page's Button puts in the URL, or the
  // referrer itself. The token covers browsers that drop the referrer. Both are held
  // to the same code AND domain rules, so a lookalike page on another domain
  // (evil.com/r/produit2) does not get through.
  if (c.filterSource) {
    const specs = parseSourceSpecs(c.allowedSources);

    // An enabled-but-empty list must not lock everyone out of the page.
    if (specs.length > 0) {
      const allowedDomains = parseDomainList(c.allowedSourceDomains);
      const currentHostname = window.location.hostname;

      const token = new URLSearchParams(window.location.search).get(SOURCE_PARAM);
      const maxUses = readMaxUses(c.sourceMaxUses);

      // A token only counts while it has uses left, so one link cannot be refreshed
      // or passed around forever. The use is spent only when the token is what would
      // let the visitor in.
      let cameFromAllowedSource =
        isAllowedSource(parseSourceToken(token), specs, allowedDomains, currentHostname) &&
        registerTokenUse(token as string, maxUses);

      // The referrer cannot be metered — the browser replays the same one on every
      // refresh, which would hand out unlimited entries behind the cap's back. So
      // once a use limit is set, the token is the only way in and plain links to
      // this page stop working by design.
      if (!cameFromAllowedSource && maxUses === 0) {
        const referrerRef = document.referrer ? readSourceRef(document.referrer) : null;
        cameFromAllowedSource = isAllowedSource(referrerRef, specs, allowedDomains, currentHostname);
      }

      if (!cameFromAllowedSource) {
        if (c.sourceMode === 'render') return null;
        return c.sourceRedirectUrl || 'https://google.com';
      }
    }
  }

  // 4. Desktop redirection (mobile-only mode)
  if (c.redirectDesktop) {
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) {
      // See note above: render is server-side; degrade to the primary on the SPA.
      if (c.desktopMode === 'render') return null;
      return c.desktopRedirectUrl || 'https://www.silacod.com';
    }
  }

  // 5. Browser language filtering
  if (c.filterLanguage && c.allowedLanguages) {
    const userLang = (navigator.language || (navigator as any).userLanguage || '').toLowerCase();
    const allowedList = c.allowedLanguages.split(',').map((l: string) => l.trim().toLowerCase());
    if (!allowedList.some((lang: string) => userLang.includes(lang))) {
      if (c.languageMode === 'render') return null;
      return c.languageRedirectUrl || 'https://google.com';
    }
  }

  return null;
}

/** Whether any enabled rule needs the IP lookup. */
export function needsGeoLookup(c: any): boolean {
  return !!((c.filterCountry && c.allowedCountries) || c.filterVpn || c.filterDns || c.filterIpRange || c.filterIpv6);
}

const hasAnyCountryList = (c: any): boolean =>
  !!(c.allowedCountries || (Array.isArray(c.selectedCountries) && c.selectedCountries.length > 0));

const countryTokens = (c: any): string[] =>
  (Array.isArray(c.selectedCountries) && c.selectedCountries.length > 0
    ? c.selectedCountries.map((item: any) => (typeof item === 'string' ? item : (item?.code || item?.value || String(item || ''))))
    : (c.allowedCountries || '').split(',').map((item: string) => item.trim())
  )
    .flatMap((item: string) => (typeof item === 'string' ? item : String(item)).split('-').map((part) => part.trim().toUpperCase()))
    .filter(Boolean);

/** Normalised IP facts, whichever source answered. */
interface GeoSnapshot {
  ip: string;
  countryCode: string;
  countryName: string;
  /** ISP / organisation / ASN text, matched against the DNS keyword list. */
  org: string;
  vpn: boolean;
}

const GEO_ENDPOINT = (() => {
  const configured = (import.meta as any).env?.VITE_API_URL;
  if (configured) return `${String(configured).replace(/\/$/, '')}/public/geo`;
  if ((import.meta as any).env?.PROD && typeof window !== 'undefined') {
    return `${window.location.origin}/api/v1/public/geo`;
  }
  return 'http://localhost:3001/api/v1/public/geo';
})();

const GEO_TIMEOUT_MS = 3000;

async function getJson(url: string): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal, credentials: 'omit' });
      if (!res.ok) return null;
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

/**
 * Resolves the visitor's IP facts.
 *
 * Our own endpoint first: it reads the address off the request (Cloudflare's
 * edge country, then geoip-lite) and caches the ISP/VPN lookup per address, so
 * it has no per-visitor quota — unlike ipapi.co, whose free tier used to run
 * out mid-campaign and quietly let every blocked visitor through.
 *
 * The two public fallbacks only matter if our own API is unreachable from the
 * page. Both are free and keyless; neither is asked for anything the first one
 * already answered.
 */
async function fetchGeoSnapshot(): Promise<GeoSnapshot | null> {
  // Developer URL testing override (e.g. ?__test_country=US or ?__test_country=FR)
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const testCountry = params.get('__test_country') || params.get('test_country');
    if (testCountry) {
      return {
        ip: '127.0.0.1',
        countryCode: testCountry.trim().toUpperCase(),
        countryName: testCountry.trim().toUpperCase(),
        org: 'test',
        vpn: params.get('__test_vpn') === '1',
      };
    }
  }

  const own = await getJson(GEO_ENDPOINT);
  const data = own?.data;
  const ownCountry = String(data?.countryCode || '').trim();

  // If local endpoint resolved a valid 2-letter country, use it
  if (data && ownCountry && ownCountry.length === 2 && ownCountry !== 'XX') {
    return {
      ip: String(data.ip || ''),
      countryCode: ownCountry.toUpperCase(),
      countryName: String(data.countryName || '').toUpperCase(),
      org: String(data.org || data.asn || data.hostname || '').toLowerCase(),
      vpn: !!(data.vpn || data.proxy || data.tor || data.hosting),
    };
  }

  // Fallback to public keyless GeoIP providers (routes through browser extension VPNs like Urban VPN)
  const who = await getJson('https://ipwho.is/');
  if (who && who.success !== false && who.ip) {
    const connection = who.connection || {};
    const security = who.security || {};
    const orgStr = [connection.isp, connection.org, connection.domain].filter(Boolean).join(' ').toLowerCase();
    const isVpnDetected = !!(
      security.vpn || security.proxy || security.tor || security.hosting ||
      /vpn|proxy|hosting|datacenter|m247|tzulo|leaseweb|choopa|vultr|digitalocean|linode|ovh|cloud/i.test(orgStr)
    );
    return {
      ip: String(who.ip || ''),
      countryCode: String(who.country_code || '').toUpperCase(),
      countryName: String(who.country || '').toUpperCase(),
      org: orgStr,
      vpn: isVpnDetected,
    };
  }

  const free = await getJson('https://freeipapi.com/api/json');
  if (free && free.countryCode) {
    return {
      ip: String(free.ipAddress || ''),
      countryCode: String(free.countryCode || '').toUpperCase(),
      countryName: String(free.countryName || '').toUpperCase(),
      org: '',
      vpn: !!(free.isProxy),
    };
  }

  return null;
}

/** Rules needing the IP lookup. Returns a redirect URL, or null to allow. */
export async function resolveGeoCloakRedirect(c: any): Promise<string | null> {
  try {
    const ipData = await fetchGeoSnapshot();
    // No source answered. Letting the visitor through beats redirecting real
    // traffic to google.com because a lookup was blocked or offline.
    if (!ipData) return null;

    const userIp = ipData.ip;
    const countryCode = ipData.countryCode;
    const isVpn = ipData.vpn;
    const orgDns = ipData.org;

    // 5a. IPv6 filter
    if (c.filterIpv6 && userIp.includes(':')) {
      if (c.ipv6Mode === 'render') return null;
      return c.ipv6RedirectUrl || 'https://google.com';
    }

    // 5b. Country cloaking
    if (c.filterCountry && hasAnyCountryList(c)) {
      const countryName = ipData.countryName;
      // Fail open when the source could not resolve a country at all: an IP with
      // no country is common on mobile carrier ranges, and redirecting that
      // traffic would cost real buyers. Matches the server engine's policy.
      if (!countryCode && !countryName) return null;
      const isCountryAllowed = countryTokens(c).some((token: string) => {
        if (!token) return false;
        if (countryCode && (countryCode === token || token.includes(countryCode))) return true;
        if (countryName && (countryName.includes(token) || token.includes(countryName))) return true;
        return false;
      });

      if (!isCountryAllowed) {
        // In 'render' mode the seller wants a blocked-country visitor to see one
        // of their other pages at the same URL. That is a server-compiled feature
        // (SSG on). On this SPA fallback the browser cannot swap the page without
        // changing the URL, so the safe degradation is to show the primary page
        // rather than bounce a real visitor to a decoy. Full behaviour needs SSG on.
        if (c.countryMode === 'render') return null;
        return c.countryRedirectUrl || 'https://google.com';
      }
    }

    // 5c. VPN & proxy filter (GeoIP plus extension DOM/window probing + Timezone disparity probe)
    const win = window as any;
    const docHtml = document.documentElement?.outerHTML || '';
    const hasExtensionVpnInjected = !!(
      win.urbanVpn || win.__URBAN_VPN__ || win.urban || win.urbanVPN || win.__urbanVpn__ ||
      win.browsec || win.veepn || win.__VEEPN__ || win.touchVpn || win.zenmate || win.setupVpn ||
      document.querySelector('[id*="urban"], [class*="urban"], [id*="browsec"], [class*="browsec"], [id*="veepn"], [class*="veepn"], [id*="touchvpn"], [class*="touchvpn"], [id*="zenmate"], [class*="zenmate"]') ||
      /urban-vpn|browsec|veepn|touchvpn|zenmate/i.test(docHtml)
    );
    const isExtensionVpn = (c.detectExtensionVpn !== false) && hasExtensionVpnInjected;

    let isTimezoneDisparity = false;
    try {
      if (countryCode && countryCode.length === 2 && typeof Intl !== 'undefined') {
        const sysTz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        if (countryCode === 'US' || countryCode === 'CA') {
          if (sysTz.startsWith('Africa/') || sysTz.startsWith('Europe/') || sysTz.startsWith('Asia/')) {
            isTimezoneDisparity = true;
          }
        } else if (countryCode === 'MA') {
          if (sysTz.startsWith('America/') || sysTz.startsWith('Asia/Tokyo') || sysTz.startsWith('Australia/')) {
            isTimezoneDisparity = true;
          }
        }
      }
    } catch { /* ignore */ }

    if (c.filterVpn && (isVpn || isExtensionVpn || isTimezoneDisparity)) {
      if (c.vpnMode === 'render') return null;
      return c.vpnRedirectUrl || 'https://google.com';
    }

    // 5d. DNS / ISP keyword filter
    if (c.filterDns) {
      const selectedDnsList = Array.isArray(c.selectedDns) && c.selectedDns.length > 0
        ? c.selectedDns.map((d: any) => (typeof d === 'string' ? d : (d?.value || String(d || ''))).toLowerCase())
        : DEFAULT_BLOCKED_DNS;

      const customDnsList = c.blockedDns
        ? c.blockedDns.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean)
        : [];

      if ([...selectedDnsList, ...customDnsList].some((kw: string) => orgDns.includes(kw))) {
        if (c.dnsMode === 'render') return null;
        return c.dnsRedirectUrl || 'https://google.com';
      }
    }

    // 5e. IP range subnet filter
    if (c.filterIpRange && c.blockedIpRanges && userIp) {
      const ranges = c.blockedIpRanges.split(/[\n,]+/).map((r: string) => r.trim()).filter(Boolean);

      const ipToLong = (ip: string) => ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;

      const isIpInCidr = (ipStr: string, cidrStr: string) => {
        if (!cidrStr.includes('/')) return ipStr === cidrStr;
        const [rangeIp, bits] = cidrStr.split('/');
        const mask = ~((1 << (32 - parseInt(bits, 10))) - 1) >>> 0;
        return (ipToLong(ipStr) & mask) === (ipToLong(rangeIp) & mask);
      };

      const isBlockedIp = ranges.some((range: string) => {
        try {
          return isIpInCidr(userIp, range);
        } catch {
          return false;
        }
      });

      if (isBlockedIp) return c.ipRangeRedirectUrl || 'https://google.com';
    }

    return null;
  } catch {
    // fetchGeoSnapshot already failed over across every source, so there is
    // nothing left to retry here. Let the visitor through rather than sending
    // real traffic away on a rule we could not evaluate.
    return null;
  }
}
