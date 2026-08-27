import { describe, it, expect } from 'vitest';
import { resolveServerCloak, __testing } from '../src/services/landingCompiler/cloak.js';

const { CRAWLER_PATTERN, primaryLanguage, inCidr } = __testing;

/** Real user agents. The whole point of this suite is that these are not guesses. */
const HUMANS: Record<string, string> = {
  'Chrome on Android':
    'Mozilla/5.0 (Linux; Android 10; SM-A505F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Safari on iPhone':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Instagram in-app browser':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 302.0.0.23.113',
  'Facebook in-app browser':
    'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/440.0.0.30.117;]',
  'Firefox desktop':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Edge desktop':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Samsung Internet':
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
  'DuckDuckGo browser':
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile DuckDuckGo/5 Safari/537.36',
};

const CRAWLERS: Record<string, string> = {
  Googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  facebookexternalhit: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  AhrefsBot: 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
  curl: 'curl/8.4.0',
  'python-requests': 'python-requests/2.31.0',
  TelegramBot: 'TelegramBot (like TwitterBot)',
  Twitterbot: 'Twitterbot/1.0',
  'WhatsApp preview': 'WhatsApp/2.23.20.0 A',
  GPTBot: 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)',
  'headless Chrome':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36',
};

function req(headers: Record<string, string | undefined>, ip = '81.192.1.1'): any {
  return { headers, ip, socket: { remoteAddress: ip } };
}

describe('crawler detection', () => {
  it('never matches a real browser', () => {
    for (const [name, ua] of Object.entries(HUMANS)) {
      expect(CRAWLER_PATTERN.test(ua), `${name} must not be treated as a bot`).toBe(false);
    }
  });

  it('matches genuine crawlers', () => {
    for (const [name, ua] of Object.entries(CRAWLERS)) {
      expect(CRAWLER_PATTERN.test(ua), `${name} must be treated as a bot`).toBe(true);
    }
  });

  it('does not contain the bare "moz" alternative that matched every browser', () => {
    // The defect this pattern exists to avoid: "Mozilla/5.0" contains "moz",
    // so filterBots with no allow-list sent 100% of humans to wikipedia.org.
    expect(CRAWLER_PATTERN.source).not.toMatch(/(^|\|)moz(\||$)/);
    expect(CRAWLER_PATTERN.test('Mozilla/5.0')).toBe(false);
  });
});

describe('resolveServerCloak', () => {
  it('allows the page through when nothing is enabled', () => {
    expect(resolveServerCloak({}, req({ 'user-agent': HUMANS['Chrome on Android'] })).redirect).toBeNull();
  });

  it('redirects crawlers but not humans when filterBots is on', () => {
    const c = { filterBots: true, botRedirectUrl: 'https://example.com/safe' };
    expect(resolveServerCloak(c, req({ 'user-agent': CRAWLERS.Googlebot })).redirect).toBe(
      'https://example.com/safe'
    );
    expect(
      resolveServerCloak(c, req({ 'user-agent': HUMANS['Instagram in-app browser'] })).redirect
    ).toBeNull();
  });

  it('lets AdsBot reach the page even with every filter on', () => {
    const c = {
      filterBots: true,
      filterDirect: true,
      redirectDesktop: true,
      filterCountry: true,
      allowedCountries: 'MA',
    };
    // No Referer, desktop UA, wrong country — every rule would fire — yet the ad
    // reviewer must still see the real page, or the ad is disapproved.
    for (const ua of [
      'AdsBot-Google (+http://www.google.com/adsbot.html)',
      'Mozilla/5.0 (Linux; Android 6.0.1) (compatible; AdsBot-Google-Mobile; +http://www.google.com/mobile/adsbot.html)',
      'Mozilla/5.0 (compatible; Google-Ads-Quality; +http://www.google.com/adsbot.html)',
    ]) {
      const decision = resolveServerCloak(c, req({ 'user-agent': ua }));
      expect(decision.redirect).toBeNull();
      expect(decision.rule).toBe('allowlisted');
    }
  });

  it('honours an explicit user-agent list instead of the default pattern', () => {
    const c = { filterBots: true, selectedUserAgents: ['acmebot'] };
    expect(resolveServerCloak(c, req({ 'user-agent': 'AcmeBot/1.0' })).redirect).toBeTruthy();
    // Googlebot is not on the caller's list, so it is allowed — matching the client.
    expect(resolveServerCloak(c, req({ 'user-agent': CRAWLERS.Googlebot })).redirect).toBeNull();
  });

  it('falls back to a safe destination when the configured URL is unusable', () => {
    const c = { filterBots: true, botRedirectUrl: 'javascript:alert(1)' };
    expect(resolveServerCloak(c, req({ 'user-agent': CRAWLERS.curl })).redirect).toBe(
      'https://wikipedia.org'
    );
  });

  it('treats a missing Referer as a direct visit', () => {
    const c = { filterDirect: true, directRedirectUrl: 'https://example.com/d' };
    expect(resolveServerCloak(c, req({})).redirect).toBe('https://example.com/d');
    expect(
      resolveServerCloak(c, req({ referer: 'https://www.facebook.com/' })).redirect
    ).toBeNull();
  });

  it('redirects desktop when mobile-only is set', () => {
    const c = { redirectDesktop: true, desktopRedirectUrl: 'https://example.com/m' };
    expect(resolveServerCloak(c, req({ 'user-agent': HUMANS['Firefox desktop'] })).redirect).toBe(
      'https://example.com/m'
    );
    expect(
      resolveServerCloak(c, req({ 'user-agent': HUMANS['Chrome on Android'] })).redirect
    ).toBeNull();
  });

  it('compares only the top-weighted Accept-Language tag', () => {
    const c = { filterLanguage: true, allowedLanguages: 'fr', languageRedirectUrl: 'https://x.com' };
    // Arabic outranks French here, so this visitor is not a French speaker.
    expect(
      resolveServerCloak(c, req({ 'accept-language': 'ar,fr;q=0.9,en;q=0.8' })).redirect
    ).toBe('https://x.com');
    expect(resolveServerCloak(c, req({ 'accept-language': 'fr-FR,fr;q=0.9' })).redirect).toBeNull();
  });

  it('reads IPv6 from the socket', () => {
    const c = { filterIpv6: true };
    expect(resolveServerCloak(c, req({}, '2a01:cb00::1')).redirect).toBeTruthy();
    expect(resolveServerCloak(c, req({}, '81.192.1.1')).redirect).toBeNull();
  });

  it('unwraps IPv4-mapped IPv6 so those visitors are not misclassified', () => {
    expect(resolveServerCloak({ filterIpv6: true }, req({}, '::ffff:81.192.1.1')).redirect).toBeNull();
  });

  it('blocks configured CIDR ranges', () => {
    const c = { filterIpRange: true, blockedIpRanges: '10.0.0.0/8, 192.168.1.0/24' };
    expect(resolveServerCloak(c, req({}, '192.168.1.55')).redirect).toBeTruthy();
    expect(resolveServerCloak(c, req({}, '81.192.1.1')).redirect).toBeNull();
  });

  it('checks bots before every other rule', () => {
    const c = {
      filterBots: true,
      botRedirectUrl: 'https://bots.example',
      filterDirect: true,
      directRedirectUrl: 'https://direct.example',
    };
    // A crawler sends no Referer either; the bot destination must win.
    expect(resolveServerCloak(c, req({ 'user-agent': CRAWLERS.Googlebot })).rule).toBe('bots');
  });
});

describe('render mode (serve another of the seller\'s pages, same URL)', () => {
  const MA = '105.157.0.1'; // geoip-lite resolves this to MA
  const FR = '90.80.0.1'; // and this to FR

  it('renders the alternate page for a blocked country instead of redirecting', () => {
    const c = {
      filterCountry: true,
      allowedCountries: 'MA',
      countryMode: 'render',
      countryAlternateCode: 'other-page',
    };
    const d = resolveServerCloak(c, req({ 'user-agent': HUMANS['Chrome on Android'] }, FR));
    expect(d.redirect).toBeNull();
    expect(d.renderCode).toBe('other-page');
    expect(d.rule).toBe('country');
  });

  it('still redirects when mode is left at the default', () => {
    const c = {
      filterCountry: true,
      allowedCountries: 'MA',
      countryRedirectUrl: 'https://google.com',
      countryAlternateCode: 'other-page', // present but mode is not 'render'
    };
    const d = resolveServerCloak(c, req({ 'user-agent': HUMANS['Chrome on Android'] }, FR));
    expect(d.redirect).toBe('https://google.com');
    expect(d.renderCode).toBeUndefined();
  });

  it('does not touch an allowed-country visitor', () => {
    const c = { filterCountry: true, allowedCountries: 'MA', countryMode: 'render', countryAlternateCode: 'other-page' };
    const d = resolveServerCloak(c, req({ 'user-agent': HUMANS['Chrome on Android'] }, MA));
    expect(d.redirect).toBeNull();
    expect(d.renderCode).toBeUndefined();
  });

  it('never renders for an ad reviewer — the allow-list wins first', () => {
    const c = { filterCountry: true, allowedCountries: 'MA', countryMode: 'render', countryAlternateCode: 'other-page' };
    const d = resolveServerCloak(c, req({ 'user-agent': 'AdsBot-Google (+http://www.google.com/adsbot.html)' }, FR));
    expect(d.renderCode).toBeUndefined();
    expect(d.rule).toBe('allowlisted');
  });

  it('falls back to redirect when render is enabled but no alternate code is set', () => {
    const c = {
      filterCountry: true,
      allowedCountries: 'MA',
      countryMode: 'render',
      countryAlternateCode: '',
      countryRedirectUrl: 'https://google.com',
    };
    const d = resolveServerCloak(c, req({ 'user-agent': HUMANS['Chrome on Android'] }, FR));
    expect(d.redirect).toBe('https://google.com');
    expect(d.renderCode).toBeUndefined();
  });

  it('renders for a desktop visitor in render mode (mobile-only page)', () => {
    const c = { redirectDesktop: true, desktopMode: 'render', desktopAlternateCode: 'pc-page' };
    const d = resolveServerCloak(c, req({ 'user-agent': HUMANS['Firefox desktop'] }));
    expect(d.redirect).toBeNull();
    expect(d.renderCode).toBe('pc-page');
    expect(d.rule).toBe('desktop');
  });

  it('renders for a direct visit in render mode', () => {
    const c = { filterDirect: true, directMode: 'render', directAlternateCode: 'direct-page' };
    // no referer header => direct visit
    const d = resolveServerCloak(c, req({ 'user-agent': HUMANS['Chrome on Android'] }));
    expect(d.redirect).toBeNull();
    expect(d.renderCode).toBe('direct-page');
    expect(d.rule).toBe('direct');
  });

  it('renders for a crawler in render mode (bot alternate page at same URL)', () => {
    const c = {
      filterBots: true,
      botRedirectUrl: 'https://wikipedia.org',
      botsMode: 'render',
      botsAlternateCode: 'bot-safe-page',
    } as any;
    const d = resolveServerCloak(c, req({ 'user-agent': CRAWLERS.curl }, FR));
    expect(d.rule).toBe('bots');
    expect(d.redirect).toBeNull();
    expect(d.renderCode).toBe('bot-safe-page');
  });

  it('renders for a crawler when using botMode and botAlternateCode', () => {
    const c = {
      filterBots: true,
      botMode: 'render',
      botAlternateCode: 'bot-safe-page-2',
    } as any;
    const d = resolveServerCloak(c, req({ 'user-agent': CRAWLERS.Googlebot }, FR));
    expect(d.rule).toBe('bots');
    expect(d.redirect).toBeNull();
    expect(d.renderCode).toBe('bot-safe-page-2');
  });

  it('falls back to redirect for crawlers when render is specified but alternate code is empty', () => {
    const c = {
      filterBots: true,
      botRedirectUrl: 'https://wikipedia.org',
      botMode: 'render',
      botAlternateCode: '',
    } as any;
    const d = resolveServerCloak(c, req({ 'user-agent': CRAWLERS.curl }, FR));
    expect(d.rule).toBe('bots');
    expect(d.redirect).toBe('https://wikipedia.org');
    expect(d.renderCode).toBeUndefined();
  });
});

describe('helpers', () => {
  it('primaryLanguage sorts by q-weight', () => {
    expect(primaryLanguage('ar,fr;q=0.9')).toBe('ar');
    expect(primaryLanguage('fr;q=0.2,en;q=0.9')).toBe('en');
    expect(primaryLanguage(undefined)).toBe('');
  });

  it('inCidr handles boundaries and rejects malformed input', () => {
    expect(inCidr('10.1.2.3', '10.0.0.0/8')).toBe(true);
    expect(inCidr('11.1.2.3', '10.0.0.0/8')).toBe(false);
    expect(inCidr('1.2.3.4', '1.2.3.4')).toBe(true);
    expect(inCidr('1.2.3.4', 'not-a-cidr')).toBe(false);
    expect(inCidr('1.2.3.4', '0.0.0.0/0')).toBe(true);
  });
});
