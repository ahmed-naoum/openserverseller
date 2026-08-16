import { describe, it, expect } from 'vitest';
import { renderDocument } from '../src/services/landingCompiler/document.js';

/**
 * The checkout block is the money path, so these tests pin the behaviours that
 * would cost real orders if they drifted: which price wins, what productVariant
 * carries, and whether a conversion can fire.
 */


/**
 * The document with the runtime <script> removed.
 *
 * The runtime contains selector strings like [data-ck="price"], so asserting
 * against the whole document would match the JavaScript that looks for an
 * element rather than the element itself.
 */

/** renderDocument returns { html, csp }; these assertions are about the markup. */
async function render(input: any): Promise<string | null> {
  const out = await renderDocument(input as any);
  return out ? out.html : null;
}

function markup(html: string): string {
  return html.replace(/<script>[\s\S]*?<\/script>/g, '');
}

async function withCheckout(content: any, overrides: any = {}): Promise<string | null> {
  return render({
    code: 'CODE1',
    blocks: [{ id: 'c1', type: 'express_checkout', content }],
    settings: {},
    landingPage: { themeColor: '#f97316', title: 'T', description: 'D' },
    product: { nameFr: 'P', retailPriceMad: 249, images: [] },
    influencerPixels: [],
    origin: 'https://sub.silacod.com',
    ...overrides,
  });
}

describe('express_checkout', () => {
  it('renders the four fields the API expects, and nothing else', async () => {
    const html = (await withCheckout({}))!;
    for (const key of ['name', 'phone', 'city', 'address']) {
      expect(html).toContain(`data-ck="${key}"`);
    }
    expect(html).toContain('data-ck-root');
    expect(html).toContain('data-ck="submit"');
  });

  it('keeps the phone field left-to-right even on an RTL page', async () => {
    const html = (await withCheckout({}))!;
    expect(html).toMatch(/data-ck="phone"[^>]*dir="ltr"/);
  });

  it('shows the price by default and hides the old price by default', async () => {
    const html = (await withCheckout({}))!;
    expect(html).toContain('data-ck="price"');
    expect(html).not.toContain('class="ck-old"');
  });

  it('honours showPrice as opt-out', async () => {
    const html = (await withCheckout({ showPrice: false }))!;
    expect(markup(html)).not.toContain('data-ck="price"');
  });

  it('honours showOldPrice as opt-in and falls back to retail + 50', async () => {
    const html = (await withCheckout({ showOldPrice: true }))!;
    expect(html).toContain('class="ck-old"');
    // 249 + 50 — the magic number is preserved from the React original.
    expect(html).toContain('299 MAD');
  });

  it('falls back to 150 for the old price when the product has no retail price', async () => {
    const html = (await withCheckout({ showOldPrice: true }, {
      product: { nameFr: 'P', images: [] },
    }))!;
    expect(html).toContain('150 MAD');
  });

  it('prefers an explicit oldPriceValue over the retail fallback', async () => {
    const html = (await withCheckout({ showOldPrice: true, oldPriceValue: 499 }))!;
    expect(html).toContain('499 MAD');
    expect(html).not.toContain('299 MAD');
  });

  it('renders packs with the first pre-selected', async () => {
    const html = (await withCheckout({
      options: [
        { id: 'p1', name: 'Pack 1', price: 249 },
        { id: 'p2', name: 'Pack 2', price: 399 },
      ],
    }))!;
    expect(html).toContain('data-pack="p1"');
    expect(html).toContain('data-pack="p2"');
    expect(html).toMatch(/data-pack="p1"[^>]*aria-checked="true"/);
    expect(html).toMatch(/data-pack="p2"[^>]*aria-checked="false"/);
    // The header price follows the first pack, not the product retail price.
    expect(html).toMatch(/data-ck="price"[^>]*>249 MAD/);
  });

  it('drives the selected pack from a class, never an inline style', async () => {
    const html = (await withCheckout({
      options: [
        { id: 'p1', name: 'Un', price: 319 },
        { id: 'p2', name: 'Deux', price: 479 },
      ],
    }))!;

    const packs = [...markup(html).matchAll(/<div class="(ck-pack[^"]*)"[^>]*style="([^"]*)"/g)]
      .map((m) => ({ cls: m[1], style: m[2] }));
    expect(packs).toHaveLength(2);

    // The bug this pins: the selected look used to be an inline style on pack 1
    // while the runtime toggled a class. Inline wins, so clicking pack 2 moved
    // the DATA but left pack 1 looking selected — the customer saw one price
    // and would have been charged the other.
    for (const p of packs) {
      expect(p.style).not.toMatch(/(^|;)\s*border-width:/);
      expect(p.style).not.toMatch(/(^|;)\s*background:/);
      expect(p.style).toContain('--pk:');
    }
    expect(packs[0].cls).toContain('is-on');
    expect(packs[1].cls).not.toContain('is-on');
  });

  it('renders the selected badge on every pack so it can move', async () => {
    const html = (await withCheckout({
      options: [
        { id: 'p1', name: 'Un', price: 319 },
        { id: 'p2', name: 'Deux', price: 479 },
      ],
    }))!;
    expect((markup(html).match(/class="ck-badge"/g) || []).length).toBe(2);
    // Hidden unless the pack is selected, so only one is ever visible.
    expect(html).toContain('.ck-pack .ck-badge{display:none}');
    expect(html).toContain('.ck-pack.is-on .ck-badge{display:block}');
  });

  it('falls back to no fill when the pack colour is not 6-digit hex', async () => {
    const html = (await withCheckout({
      options: [{ id: 'p1', name: 'Un', price: 1, color: 'rgba(1,2,3,0.5)' }],
    }))!;
    // `${tint}08` is only valid on 6-digit hex; a malformed value would drop
    // the whole declaration.
    expect(html).toContain('--pkbg:transparent');
    expect(html).not.toContain('rgba(1,2,3,0.5)08');
  });

  it('lets a keyboard user choose a pack', async () => {
    const { CHECKOUT_RUNTIME } = await import(
      '../src/services/landingCompiler/runtime/checkout.js'
    );
    // They carry role="radio" and tabindex="0", which promises keyboard support.
    expect(CHECKOUT_RUNTIME).toContain("'keydown'");
    expect(CHECKOUT_RUNTIME).toContain("e.key === 'Enter'");
  });

  it('sends the bare pack name as productVariant, which is what getPackPrice matches', async () => {
    const html = (await withCheckout({
      options: [{ id: 'p1', name: 'Pack 2 pièces', price: 399 }],
    }))!;
    const cfg = JSON.parse(
      html.match(/<script type="application\/json">(.*?)<\/script>/s)![1]
    );
    expect(cfg.packs[0].name).toBe('Pack 2 pièces');
    // Not "Product (Pack 2 pièces)" — a composite string can never match
    // option.name or option.id, so the lead would silently price at retail.
    expect(cfg.packs[0].name).not.toContain('(');
  });

  it('carries the pixels needed to fire a conversion on submit', async () => {
    const html = (await withCheckout({}, {
      influencerPixels: [
        { type: 'GLOBAL', platform: 'META', pixelId: '99', conversionEvent: 'Purchase' },
      ],
    }))!;
    const cfg = JSON.parse(
      html.match(/<script type="application\/json">(.*?)<\/script>/s)![1]
    );
    expect(cfg.pixels).toEqual([
      { platform: 'META', pixelId: '99', conversionEvent: 'Purchase' },
    ]);
  });

  it('redirects to the thank-you page after a successful order', async () => {
    const html = (await withCheckout({}))!;
    const cfg = JSON.parse(
      html.match(/<script type="application\/json">(.*?)<\/script>/s)![1]
    );
    expect(cfg.thankYouUrl).toBe('/thank-you');
    // A delay is required, not cosmetic: the conversion pixels fire immediately
    // before this and a real navigation cancels requests still in flight.
    expect(cfg.thankYouDelayMs).toBeGreaterThan(0);
    // replace(), so Back does not land on a form that would resubmit — matching
    // navigate('/thank-you', { replace: true }).
    expect(html).toContain('location.replace(');
    expect(html).not.toContain('location.assign(');
  });

  it('fires the conversion before navigating away', async () => {
    const { CHECKOUT_RUNTIME } = await import(
      '../src/services/landingCompiler/runtime/checkout.js'
    );
    // Order matters — a redirect scheduled before track() would race the beacon.
    expect(CHECKOUT_RUNTIME.indexOf('track();')).toBeLessThan(
      CHECKOUT_RUNTIME.indexOf('location.replace(')
    );
  });

  it('posts to the real public endpoint', async () => {
    const html = (await withCheckout({}))!;
    expect(html).toContain('/api/v1/public/leads');
  });

  it('sets border-style explicitly, since there is no Tailwind preflight', async () => {
    const html = (await withCheckout({ options: [{ id: 'p1', name: 'A', price: 1 }] }))!;
    expect(html).toContain('border-style:solid');
  });

  it('escapes a payload in every checkout field', async () => {
    const XSS = '"><script>alert(1)</script>';
    const html = (await withCheckout({
      title: XSS,
      subtitle: XSS,
      buttonText: XSS,
      nameLabel: XSS,
      namePlaceholder: XSS,
      themeColor: XSS,
      priceColor: XSS,
      options: [{ id: XSS, name: XSS, price: XSS }],
    }))!;

    const tags = [...html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)/g)].map((m) => m[1].toLowerCase());
    // Two script tags are expected: the config block and the runtime.
    expect(tags.filter((t) => t === 'script').length).toBe(2);
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('&lt;script&gt;');
  });

  it('embeds the runtime and a parseable config', async () => {
    const html = (await withCheckout({ options: [{ id: 'p1', name: 'A', price: 10 }] }))!;
    expect(html).toContain('data-ck-root');
    const raw = html.match(/<script type="application\/json">(.*?)<\/script>/s)![1];
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(JSON.parse(raw).code).toBe('CODE1');
  });

  it('leaves the address optional, as a textarea', async () => {
    const html = (await withCheckout({}))!;
    // React renders a <textarea rows=2> with no required attribute and a label
    // that literally says "(optional)". The server requires only referralCode,
    // fullName and phone, so requiring it here would reject orders both sides
    // accept — call-centre agents collect the address on the confirmation call.
    expect(html).toMatch(/<textarea[^>]*data-ck="address"/);
    expect(html).toMatch(/data-ck="address"[^>]*rows="2"/);
    expect(html).not.toMatch(/data-ck="address"[^>]*\srequired/);
    expect(html).toContain('اختياري');
  });

  it('requires name, phone and city but not address', async () => {
    const html = (await withCheckout({}))!;
    expect(html).toMatch(/data-ck="name"[^>]*\srequired/);
    expect(html).toMatch(/data-ck="phone"[^>]*\srequired/);
    expect(html).toMatch(/data-ck="city"[^>]*\srequired/);
  });

  it('wires up every checkout block on the page, not just the first', async () => {
    const html = (await render({
      code: 'CODE1',
      blocks: [
        { id: 'c1', type: 'express_checkout', content: {} },
        { id: 'c2', type: 'express_checkout', content: {} },
      ],
      settings: {},
      landingPage: { themeColor: '#f97316', title: 'T', description: 'D' },
      product: { nameFr: 'P', retailPriceMad: 249, images: [] },
      influencerPixels: [],
      origin: 'https://sub.silacod.com',
    }))!;

    expect((markup(html).match(/data-ck-root/g) || []).length).toBe(2);
    // Ids must stay unique or the document is invalid HTML.
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    // One runtime for both, since it binds per root rather than by id.
    expect((html.match(/<script>/g) || []).length).toBe(1);
  });

  it('places the pack rows inside the same root as the form', async () => {
    const html = (await withCheckout({ options: [{ id: 'p1', name: 'A', price: 1 }] }))!;
    const root = html.slice(html.indexOf('data-ck-root'));
    const packAt = root.indexOf('data-pack=');
    const formAt = root.indexOf('<form');
    expect(packAt).toBeGreaterThan(-1);
    expect(formAt).toBeGreaterThan(-1);
    // The runtime scopes pack lookup to the root precisely because the packs
    // render BEFORE the form element.
    expect(packAt).toBeLessThan(formAt);
  });

  it('uses the landing page button text when the block sets none', async () => {
    const html = (await withCheckout({}, {
      landingPage: { themeColor: '#f97316', title: 'T', description: 'D', buttonText: 'اشتري الآن' },
    }))!;
    expect(html).toContain('اشتري الآن');
  });

  it('falls back to the default heading when the block sets no title', async () => {
    const html = (await withCheckout({}))!;
    expect(html).toContain('اطلب الآن');
  });

  it('gives an unnamed pack a visible label without changing what is submitted', async () => {
    const html = (await withCheckout({ options: [{ id: 'p1', price: 99 }] }))!;
    expect(html).toContain('Pack 1');
    const cfg = JSON.parse(
      html.match(/<script type="application\/json"[^>]*>(.*?)<\/script>/s)![1]
    );
    // The submitted value stays bare — a display fallback must not leak into
    // productVariant, or getPackPrice would stop matching.
    expect(cfg.packs[0].name).toBe('');
  });
});
