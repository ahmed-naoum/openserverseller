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
 *  - geo: needs a third-party IP lookup. Evaluated after render so legitimate
 *    visitors are not held behind a network round-trip.
 */
import { SOURCE_PARAM, isAllowedSource, parseDomainList, parseSourceSpecs, parseSourceToken, readMaxUses, readSourceRef, registerTokenUse } from './referral';

const DEFAULT_BOT_PATTERN = /bot|crawler|spider|crawling|scraper|snippet|curl|wget|python|postman|axios|node-fetch|httpclient|headless|puppeteer|phantomjs|selenium|cypress|facebookexternalhit|facebookplatform|facebookcatalog|facebookbot|googlebot|bingbot|slurp|yahoo|adbot|lighthouse|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|ia_archiver|linkedinbot|twitterbot|slackbot|telegrambot|applebot|whatsapp|skypeuripreview|ahrefsbot|semrushbot|mj12bot|dotbot|rogerbot|moz|majestics12|seznambot|pingdom|archive\.org_bot|discordbot|pinterest|vkshare|redditbot|tumblr|flipboardproxy|feedfetcher|amazonbot|bytespider|ccbot|chatgpt-user|claudebot|coccocbot|dataminr|go-http-client|grapeshot|java|libwww|lwp-trivial|mail\.ru|megaindex|petalsearch|qwantify|screaming\sfrog|soso|tencenttraveler|zite|zoominfo|ahrefs|alexa|appinsights|archive|ask\sjeeves|bubing|catchpoint|cloudflare|criteo|datadog|duckduckgo|fastly|feedburner|flipboard|hubspot|incapsula|instagram|linkedin|majestic|monitor|msn|naver|nuzzel|outbrain|pagespeed|quora|reddit|semrush|skype|slack|snapchat|statuscake|telegram|updown|uptimerobot|vkontakte|yelp|youtube|zillow|zmeu/i;

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
export function resolveInstantCloakRedirect(c: any): string | null {
  // 1. Bot & crawler filtering
  if (c.filterBots) {
    const ua = (navigator.userAgent || '').toLowerCase();
    const targetAgents = Array.isArray(c.selectedUserAgents) && c.selectedUserAgents.length > 0
      ? c.selectedUserAgents.map((agent: any) => (typeof agent === 'string' ? agent : (agent?.value || agent?.name || String(agent || ''))).toLowerCase())
      : null;

    const isBlockedBot = targetAgents
      ? targetAgents.some((agent: string) => ua.includes(agent))
      : DEFAULT_BOT_PATTERN.test(ua);

    if (isBlockedBot) return c.botRedirectUrl || 'https://wikipedia.org';
  }

  // 2. Direct visits (no referrer at all)
  if (c.filterDirect && !document.referrer) {
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

      if (!cameFromAllowedSource) return c.sourceRedirectUrl || 'https://google.com';
    }
  }

  // 4. Desktop redirection (mobile-only mode)
  if (c.redirectDesktop) {
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) return c.desktopRedirectUrl || 'https://www.silacod.com';
  }

  // 5. Browser language filtering
  if (c.filterLanguage && c.allowedLanguages) {
    const userLang = (navigator.language || (navigator as any).userLanguage || '').toLowerCase();
    const allowedList = c.allowedLanguages.split(',').map((l: string) => l.trim().toLowerCase());
    if (!allowedList.some((lang: string) => userLang.includes(lang))) {
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

/** Rules needing the IP lookup. Returns a redirect URL, or null to allow. */
export async function resolveGeoCloakRedirect(c: any): Promise<string | null> {
  try {
    const ipData = await fetch('https://ipapi.co/json/').then((res) => res.json());

    const userIp = ipData.ip || '';
    const countryCode = (ipData.country_code || '').toUpperCase();
    const isVpn = ipData.security?.vpn || ipData.security?.proxy || ipData.security?.tor;
    const orgDns = (ipData.org || ipData.asn || ipData.hostname || '').toLowerCase();

    // 5a. IPv6 filter
    if (c.filterIpv6 && userIp.includes(':')) {
      return c.ipv6RedirectUrl || 'https://google.com';
    }

    // 5b. Country cloaking
    if (c.filterCountry && hasAnyCountryList(c)) {
      const countryName = (ipData.country_name || '').toUpperCase();
      const isCountryAllowed = countryTokens(c).some((token: string) => {
        if (!token) return false;
        if (countryCode && (countryCode === token || token.includes(countryCode))) return true;
        if (countryName && (countryName.includes(token) || token.includes(countryName))) return true;
        return false;
      });

      if (!isCountryAllowed) return c.countryRedirectUrl || 'https://google.com';
    }

    // 5c. VPN & proxy filter (GeoIP plus extension DOM/window probing)
    const win = window as any;
    const hasExtensionVpnInjected = !!(
      win.urbanVpn || win.__URBAN_VPN__ || win.urban ||
      win.browsec || win.veepn || win.__VEEPN__ ||
      win.touchVpn || win.zenmate || win.setupVpn ||
      document.querySelector('[id*="urban-vpn"], [class*="urban-vpn"], [id*="browsec"], [class*="browsec"], [id*="veepn"], [class*="veepn"], [id*="touchvpn"], [class*="touchvpn"], [id*="zenmate"], [class*="zenmate"]')
    );
    const isExtensionVpn = (c.detectExtensionVpn !== false) && hasExtensionVpnInjected;

    if (c.filterVpn && (isVpn || isExtensionVpn)) {
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
    // Fallback to a lightweight country check if the primary GeoIP lookup fails.
    if (c.filterCountry && hasAnyCountryList(c)) {
      try {
        const resData = await fetch('https://api.country.is').then((res) => res.json());
        const countryCode = (resData.country || '').toUpperCase();
        const isAllowed = countryTokens(c).some((token: string) => countryCode === token || token.includes(countryCode));

        if (countryCode && !isAllowed) return c.countryRedirectUrl || 'https://google.com';
      } catch { /* give up and let the visitor through */ }
    }
    return null;
  }
}
