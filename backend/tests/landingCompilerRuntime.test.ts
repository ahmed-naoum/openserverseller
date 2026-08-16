import { describe, it, expect } from 'vitest';
import { CHECKOUT_RUNTIME } from '../src/services/landingCompiler/runtime/checkout.js';
import { renderDocument } from '../src/services/landingCompiler/document.js';

/**
 * The runtime is authored as a TypeScript template literal and shipped as text,
 * so nothing type-checks it and nothing runs it. A stray backtick or an
 * accidental ${...} would compile fine here and produce a landing page whose
 * order form silently does nothing.
 *
 * `new Function(src)` parses without executing, which is exactly the check
 * needed: it throws SyntaxError on malformed source but does not require a DOM.
 */

/** renderDocument returns { html, csp }; these assertions are about the markup. */
async function render(input: any): Promise<string | null> {
  const out = await renderDocument(input as any);
  return out ? out.html : null;
}

describe('checkout runtime', () => {
  it('is syntactically valid JavaScript', () => {
    expect(() => new Function(CHECKOUT_RUNTIME)).not.toThrow();
  });

  it('carries no unexpanded template placeholders', () => {
    // A `${...}` surviving into the shipped string means an interpolation was
    // written in the wrong kind of quotes and the value never made it in.
    expect(CHECKOUT_RUNTIME).not.toMatch(/\$\{/);
  });

  it('survives being embedded in a document and extracted again', async () => {
    const html = (await render({
      code: 'CODE1',
      blocks: [
        {
          id: 'c1',
          type: 'express_checkout',
          content: { options: [{ id: 'p1', name: 'Pack', price: 249 }] },
        },
      ],
      settings: {},
      landingPage: { themeColor: '#f97316', title: 'T', description: 'D' },
      product: { nameFr: 'P', retailPriceMad: 249, images: [] },
      influencerPixels: [],
      origin: 'https://sub.silacod.com',
    }))!;

    // The last <script> in the document is the runtime bundle.
    const scripts = [...html.matchAll(/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g)];
    const runtime = scripts[scripts.length - 1][1];

    expect(runtime.length).toBeGreaterThan(500);
    expect(() => new Function(runtime)).not.toThrow();
  });

  it('never emits a literal closing script tag that would end the block early', async () => {
    const html = (await render({
      code: 'CODE1',
      blocks: [
        {
          id: 'c1',
          type: 'express_checkout',
          // A payload aimed squarely at the inline JSON config.
          content: { options: [{ id: '</script><script>alert(1)</script>', name: 'X', price: 1 }] },
        },
      ],
      settings: {},
      landingPage: { themeColor: '#f97316', title: 'T', description: 'D' },
      product: { nameFr: 'P', retailPriceMad: 249, images: [] },
      influencerPixels: [],
      origin: 'https://sub.silacod.com',
    }))!;

    // Exactly two: the JSON config and the runtime. A third means the payload
    // opened one of its own.
    expect((html.match(/<script/g) || []).length).toBe(2);
    expect(html).not.toContain('<script>alert(1)');
  });

  it('queries only hooks the renderer actually emits', async () => {
    const html = (await render({
      code: 'CODE1',
      blocks: [{ id: 'c1', type: 'express_checkout', content: {} }],
      settings: {},
      landingPage: { themeColor: '#f97316', title: 'T', description: 'D' },
      product: { nameFr: 'P', retailPriceMad: 249, images: [] },
      influencerPixels: [],
      origin: 'https://sub.silacod.com',
    }))!;

    // Every data-ck hook the runtime queries must exist in the markup, or the
    // form is inert in a way no type checker would catch.
    const wanted = [...CHECKOUT_RUNTIME.matchAll(/\[data-ck="([a-z]+)"\]/g)].map((m) => m[1]);
    expect(new Set(wanted).size).toBeGreaterThan(3);
    for (const key of new Set(wanted)) {
      expect(html, `runtime queries [data-ck="${key}"]`).toContain(`data-ck="${key}"`);
    }
    // And the root the runtime iterates must be present.
    expect(CHECKOUT_RUNTIME).toContain('[data-ck-root]');
    expect(html).toContain('data-ck-root');
  });
});
