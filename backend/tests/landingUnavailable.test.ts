import { describe, it, expect } from 'vitest';
import type { Response } from 'express';
import {
  serveLinkUnavailable,
  LINK_UNAVAILABLE_HTML,
} from '../src/services/landingCompiler/unavailable.js';

/**
 * The page shown when a link has no host it can ever be served on.
 *
 * Reached when the influencer has neither a subdomain nor a custom domain, so
 * validateInfluencerHost can never pass and there is nothing to redirect to.
 */

interface Sent {
  status: number | null;
  headers: Record<string, string>;
  body: string | null;
}

function fakeRes(): { res: Response; sent: Sent } {
  const sent: Sent = { status: null, headers: {}, body: null };
  const res = {
    setHeader(name: string, value: string) {
      sent.headers[name.toLowerCase()] = value;
    },
    status(code: number) {
      sent.status = code;
      return this;
    },
    send(body: string) {
      sent.body = body;
      return this;
    },
  } as unknown as Response;
  return { res, sent };
}

describe('serveLinkUnavailable', () => {
  it('answers 404 with the page', () => {
    const { res, sent } = fakeRes();
    serveLinkUnavailable(res);
    expect(sent.status).toBe(404);
    expect(sent.body).toBe(LINK_UNAVAILABLE_HTML);
    expect(sent.headers['content-type']).toBe('text/html; charset=utf-8');
  });

  it('is never cached', () => {
    // One field away from being fixed: the moment a subdomain is assigned the
    // link works, and a cached copy of this would outlive the repair.
    const { res, sent } = fakeRes();
    serveLinkUnavailable(res);
    expect(sent.headers['cache-control']).toBe('no-store');
  });

  it('sets a CSP that allows the inline stylesheet and nothing else', () => {
    // helmet's default style-src 'self' would drop the inline <style> and leave
    // an unstyled page; every other directive here is tighter than the default.
    const { res, sent } = fakeRes();
    serveLinkUnavailable(res);
    const csp = sent.headers['content-security-policy'];
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("style-src 'unsafe-inline'");
    expect(csp).not.toContain('script-src');
  });
});

describe('the unavailable page itself', () => {
  it('carries no script and no external reference', () => {
    // Served to paid traffic on a page that is already failing, so it must have
    // no way to fail further.
    expect(LINK_UNAVAILABLE_HTML).not.toContain('<script');
    expect(LINK_UNAVAILABLE_HTML).not.toContain('http://');
    expect(LINK_UNAVAILABLE_HTML).not.toContain('https://');
    expect(LINK_UNAVAILABLE_HTML).not.toContain('<link');
  });

  it('is in French, like every other page a visitor sees', () => {
    expect(LINK_UNAVAILABLE_HTML).toContain('lang="fr"');
    expect(LINK_UNAVAILABLE_HTML).toContain("Ce lien n'est pas disponible");
  });

  it('keeps search engines off it', () => {
    expect(LINK_UNAVAILABLE_HTML).toContain('noindex,nofollow');
  });

  it('explains nothing a visitor cannot act on', () => {
    // The cause is an unclaimed subdomain, which is the influencer's business
    // and not something a stranger from an ad can do anything about.
    const lowered = LINK_UNAVAILABLE_HTML.toLowerCase();
    expect(lowered).not.toContain('subdomain');
    expect(lowered).not.toContain('sous-domaine');
    expect(lowered).not.toContain('influencer');
  });
});
