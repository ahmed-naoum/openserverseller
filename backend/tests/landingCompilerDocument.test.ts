import { describe, it, expect } from 'vitest';
import { renderDocument } from '../src/services/landingCompiler/document.js';
import { selectActivePixels } from '../src/services/landingCompiler/head.js';

/**
 * A payload in every author-controlled string, so one assertion covers the whole
 * surface rather than one field at a time.
 */
const XSS = '"><script>alert(1)</script><img src=x onerror=alert(2)>';


/** renderDocument returns { html, csp }; these assertions are about the markup. */
async function render(input: any): Promise<string | null> {
  const out = await renderDocument(input as any);
  return out ? out.html : null;
}

function page(blocks: any[], overrides: any = {}) {
  return {
    code: 'TEST-CODE',
    blocks,
    settings: { backgroundColor: '#ffffff', maxWidth: 640 },
    landingPage: { themeColor: '#f97316', title: 'Crème', description: 'Desc' },
    product: { nameFr: 'Crème', images: [] },
    influencerPixels: [],
    origin: 'https://sub.silacod.com',
    ...overrides,
  };
}

describe('renderDocument', () => {
  it('declines a page containing a block with no renderer', async () => {
    // countdown, since slider and products gained renderers. Of the builder's
    // palette only header, text and countdown are left, and no live page has
    // ever carried one.
    const html = await render(
      page([{ id: 'a', type: 'countdown', content: {} }])
    );
    expect(html).toBeNull();
  });

  it('declines an empty page rather than emitting a blank document', async () => {
    expect(await render(page([]))).toBeNull();
  });

  it('compiles a page whose blocks are all supported', async () => {
    const html = await render(
      page([{ id: 'a', type: 'image', content: { url: '/uploads/x.webp', alt: 'Photo' } }])
    );
    expect(html).toBeTruthy();
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('/uploads/x.webp');
    expect(html).toContain('alt="Photo"');
  });

  it('neutralises a payload in every author-controlled field', async () => {
    const html = await render(
      page(
        [
          {
            id: XSS,
            type: 'image',
            content: { url: XSS, alt: XSS, width: XSS, paddingTop: XSS },
          },
        ],
        {
          settings: { backgroundColor: XSS, maxWidth: XSS },
          landingPage: { themeColor: XSS, title: XSS, description: XSS },
          product: { nameFr: XSS, images: [{ imageUrl: XSS, isPrimary: true }] },
        }
      )
    );

    expect(html).toBeTruthy();

    // Assert on executable forms, not on substrings. Correct escaping PRESERVES
    // the characters `onerror=alert(2)` as text — what makes them inert is that
    // the surrounding angle brackets became entities, so no element is created.
    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('<img src=x');

    // Nothing may break out of an attribute: every quote from the payload has to
    // arrive encoded, so `content="..."` cannot be terminated early.
    expect(html).not.toContain('content=""><script');
    expect(html).toContain('&quot;&gt;&lt;script&gt;');

    // And it must still be *there*, encoded — proving it was escaped rather than
    // silently dropped, which would hide a failure to render at all.
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');

    // The only tags in the document are ones the compiler chose to emit.
    const tags = [...html!.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)/g)].map((m) => m[1].toLowerCase());
    expect(tags).not.toContain('script');
    expect(tags).not.toContain('img');
  });

  it('rejects a javascript: image source', async () => {
    const html = await render(
      page([{ id: 'a', type: 'image', content: { url: 'javascript:alert(1)' } }])
    );
    expect(html).toBeTruthy();
    expect(html).not.toContain('javascript:');
  });

  it('falls back to the product name when no title is set', async () => {
    const html = await render(
      page([{ id: 'a', type: 'image', content: { url: '/uploads/x.webp' } }], {
        landingPage: { themeColor: '#f97316', title: '', description: '' },
        product: { nameFr: 'Crème anti-tache', images: [] },
      })
    );
    expect(html).toContain('<title>Crème anti-tache</title>');
  });

  it('puts the Meta pixel in the head, before the body', async () => {
    const html = await render(
      page([{ id: 'a', type: 'image', content: { url: '/uploads/x.webp' } }], {
        influencerPixels: [
          { type: 'GLOBAL', platform: 'META', pixelId: '123456', conversionEvent: 'Lead' },
        ],
      })
    );

    expect(html).toBeTruthy();
    const headEnd = html!.indexOf('</head>');
    const pixelAt = html!.indexOf("fbq('init'");
    expect(pixelAt).toBeGreaterThan(-1);
    expect(pixelAt).toBeLessThan(headEnd);
    expect(html).toContain('connect.facebook.net');
    expect(html).toContain('rel="preconnect"');
    expect(html).toContain('facebook.com/tr?id=123456');
  });

  it('only preconnects to platforms the page actually uses', async () => {
    const html = await render(
      page([{ id: 'a', type: 'image', content: { url: '/uploads/x.webp' } }], {
        influencerPixels: [
          { type: 'GLOBAL', platform: 'META', pixelId: '123', conversionEvent: 'Lead' },
        ],
      })
    );
    expect(html).toContain('connect.facebook.net');
    expect(html).not.toContain('analytics.tiktok.com');
    expect(html).not.toContain('sc-static.net');
  });

  it('marks the first image as the LCP candidate and lazy-loads later ones', async () => {
    const html = await render(
      page([
        { id: 'a', type: 'image', content: { url: '/uploads/first.webp' } },
        { id: 'b', type: 'image', content: { url: '/uploads/second.webp' } },
        { id: 'c', type: 'image', content: { url: '/uploads/third.webp' } },
      ])
    );

    expect(html).toContain('rel="preload" as="image" href="/uploads/first.webp"');
    expect(html).toMatch(/first\.webp[^>]*fetchpriority="high"/);
    expect(html).toMatch(/third\.webp[^>]*loading="lazy"/);
  });

  it('never lets the LCP preload disagree with the <img> it preloads', async () => {
    // The failure this guards is counter-intuitive: a preload whose imagesrcset
    // differs from the img's srcset makes the browser resolve the two candidate
    // lists independently and download BOTH files. Responsive images would then
    // cost bytes rather than save them, which is worse than shipping no srcset.
    const html = (await render(
      page([
        { id: 'a', type: 'image', content: { url: '/uploads/first.webp' } },
        { id: 'b', type: 'image', content: { url: '/uploads/second.webp' } },
      ])
    ))!;

    const preload = html.match(/<link rel="preload" as="image"[^>]*>/)?.[0] ?? '';
    const img = html.match(/<img src="\/uploads\/first\.webp"[^>]*>/)?.[0] ?? '';
    expect(preload).not.toBe('');
    expect(img).not.toBe('');

    const attr = (source: string, name: string) =>
      source.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null;

    // Either both carry a candidate list and they are identical, or neither does.
    expect(attr(preload, 'imagesrcset')).toBe(attr(img, 'srcset'));
    expect(attr(preload, 'imagesizes')).toBe(attr(img, 'sizes'));
  });

  it('reports PageView on a terminal navigation, and only once', async () => {
    // Deferring fbevents.js means the queued PageView is transmitted by an SDK
    // that has not loaded yet. A visitor who hits back before it does would take
    // that PageView with them — inserting a <script> during pagehide does not
    // help, because the fetch is cancelled when the navigation commits. So the
    // pagehide path reports through the pixel endpoint directly instead.
    const html = (await render(
      page([{ id: 'a', type: 'image', content: { url: '/uploads/x.webp' } }], {
        influencerPixels: [{ type: 'GLOBAL', platform: 'META', pixelId: '999' }],
      })
    ))!;

    expect(html).toContain("w.addEventListener('pagehide',bail)");
    expect(html).toContain('facebook.com/tr?id=999\\u0026ev=PageView');
    // Having beaconed it, the drain must remove the queued copy, or a page
    // restored from the back/forward cache would report the same view twice.
    expect(html).toContain('if(sent)strip()');
    expect(html).toMatch(/a\[1\]==='PageView'/);
  });

  it('emits no webfont request', async () => {
    const html = await render(
      page([{ id: 'a', type: 'image', content: { url: '/uploads/x.webp' } }])
    );
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('@font-face');
  });
});

describe('selectActivePixels', () => {
  const global = { type: 'GLOBAL', platform: 'META', pixelId: 'G1', conversionEvent: 'Lead' };
  const single = {
    type: 'SINGLE',
    platform: 'META',
    pixelId: 'S1',
    conversionEvent: 'Purchase',
    targetIds: ['MY-CODE'],
  };

  it('prefers a link-specific pixel and excludes the global one', () => {
    const active = selectActivePixels([global, single], 'MY-CODE');
    expect(active.map((p) => p.pixelId)).toEqual(['S1']);
  });

  it('falls back to global pixels when no single pixel targets this link', () => {
    const active = selectActivePixels([global, single], 'OTHER-CODE');
    expect(active.map((p) => p.pixelId)).toEqual(['G1']);
  });

  it('drops pixels with no id rather than emitting a broken snippet', () => {
    const active = selectActivePixels([{ type: 'GLOBAL', platform: 'META', pixelId: '' }], 'X');
    expect(active).toEqual([]);
  });
});
