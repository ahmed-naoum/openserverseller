import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Request } from 'express';
import { canonicalUrl } from '../src/routes/landing.routes';

/**
 * The apex redirect.
 *
 * An influencer with no subdomain is handed `https://silacod.com/r/<code>` by the
 * dashboard, and that URL can never pass `validateInfluencerHost`. Five accounts
 * ran Facebook ads on links of exactly that shape — 2,867 clicks and 33 leads —
 * and the creatives cannot be edited after the fact, so the fix has to happen at
 * request time.
 */

const originalFrontend = process.env.FRONTEND_URL;

function req(host: string, originalUrl = '/r/18B74E7E', protocol = 'https'): Request {
  return { headers: { host }, originalUrl, protocol } as unknown as Request;
}

beforeEach(() => {
  process.env.FRONTEND_URL = 'https://silacod.com';
});
afterEach(() => {
  if (originalFrontend === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = originalFrontend;
});

describe('canonicalUrl', () => {
  it('sends an apex hit to the owner subdomain', () => {
    expect(canonicalUrl(req('silacod.com'), 'yousfard')).toBe(
      'https://yousfard.silacod.com/r/18B74E7E'
    );
  });

  it('sends a hit on the wrong subdomain to the right one', () => {
    expect(canonicalUrl(req('vigas.silacod.com'), 'yousfard')).toBe(
      'https://yousfard.silacod.com/r/18B74E7E'
    );
  });

  it('treats www as the apex', () => {
    expect(canonicalUrl(req('www.silacod.com'), 'yousfard')).toBe(
      'https://yousfard.silacod.com/r/18B74E7E'
    );
  });

  it('keeps the query string byte for byte', () => {
    // fbclid is what the ad platform reads back and utm_* is what the cloaking
    // rules match on; dropping either would break attribution for the traffic
    // this redirect exists to rescue.
    const url = canonicalUrl(
      req('silacod.com', '/r/18B74E7E?fbclid=IwAR_abc.123-x&utm_source=fb&utm_id=120250'),
      'yousfard'
    );
    expect(url).toBe(
      'https://yousfard.silacod.com/r/18B74E7E?fbclid=IwAR_abc.123-x&utm_source=fb&utm_id=120250'
    );
  });

  it('does not re-encode a code that arrived percent-encoded', () => {
    expect(canonicalUrl(req('silacod.com', '/r/produit%202'), 'yousfard')).toBe(
      'https://yousfard.silacod.com/r/produit%202'
    );
  });

  it('declines when the influencer has no subdomain to send anyone to', () => {
    // The conservative half: a custom domain is not used as a target, because
    // the compiled page carries no customDomainStatus and a PENDING domain
    // would not resolve at all.
    expect(canonicalUrl(req('silacod.com'), null)).toBeNull();
    expect(canonicalUrl(req('silacod.com'), '')).toBeNull();
  });

  it('never redirects a host to itself', () => {
    // Host validation already failed by the time this runs, so this should be
    // unreachable — but a loop here would burn a real visitor's browser.
    expect(canonicalUrl(req('yousfard.silacod.com'), 'yousfard')).toBeNull();
    expect(canonicalUrl(req('www.yousfard.silacod.com'), 'yousfard')).toBeNull();
    expect(canonicalUrl(req('YOUSFARD.silacod.com'), 'YousFard')).toBeNull();
  });

  it('lowercases the subdomain it builds', () => {
    expect(canonicalUrl(req('silacod.com'), 'SanaAbarrag')).toBe(
      'https://sanaabarrag.silacod.com/r/18B74E7E'
    );
  });

  it('follows FRONTEND_URL rather than hardcoding the domain', () => {
    process.env.FRONTEND_URL = 'https://example.test';
    expect(canonicalUrl(req('example.test'), 'yousfard')).toBe(
      'https://yousfard.example.test/r/18B74E7E'
    );
  });

  it('falls back to the production domain when FRONTEND_URL is unusable', () => {
    process.env.FRONTEND_URL = 'not a url';
    expect(canonicalUrl(req('silacod.com'), 'yousfard')).toBe(
      'https://yousfard.silacod.com/r/18B74E7E'
    );
  });

  it('keeps the scheme the visitor arrived on', () => {
    expect(canonicalUrl(req('silacod.com', '/r/18B74E7E', 'http'), 'yousfard')).toBe(
      'http://yousfard.silacod.com/r/18B74E7E'
    );
  });

  it('declines when there is no Host header to compare against', () => {
    const bare = { headers: {}, originalUrl: '/r/x', protocol: 'https' } as unknown as Request;
    expect(canonicalUrl(bare, 'yousfard')).toBe('https://yousfard.silacod.com/r/x');
  });
});
