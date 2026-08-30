import { describe, it, expect } from 'vitest';
import { renderDocument } from '../src/services/landingCompiler/document.js';
import { CHECKOUT_RUNTIME } from '../src/services/landingCompiler/runtime/checkout.js';

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
    expect(html).toContain('299');
  });

  it('falls back to 150 for the old price when the product has no retail price', async () => {
    const html = (await withCheckout({ showOldPrice: true }, {
      product: { nameFr: 'P', images: [] },
    }))!;
    expect(html).toContain('150');
  });

  it('prefers an explicit oldPriceValue over the retail fallback', async () => {
    const html = (await withCheckout({ showOldPrice: true, oldPriceValue: 499 }))!;
    expect(html).toContain('499');
    expect(html).not.toContain('299');
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
    expect(html).toMatch(/data-ck="price"[\s\S]*?249/);
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
    // A pack the seller never gave a unit count to reserves one unit, not zero.
    expect(cfg.packs[0].qty).toBe(1);
  });

  /**
   * `qty` is stock and only stock. The price on a pack is the BUNDLE total — a
   * three-unit pack at 399 MAD is 399 MAD — so these pin that the number reaches
   * the browser intact and that nothing on the way multiplies money by it.
   */
  describe('pack quantity', () => {
    const cfgOf = (html: string) =>
      JSON.parse(html.match(/<script type="application\/json"[^>]*>(.*?)<\/script>/s)![1]);

    it('carries the seller-authored unit count through to the runtime config', async () => {
      const html = (await withCheckout({
        options: [
          { id: 'p1', name: '1 Pièce', price: 199, quantity: 1 },
          { id: 'p2', name: '2 Pièces + 1 Gratuite', price: 399, quantity: 3 },
        ],
      }))!;
      const cfg = cfgOf(html);
      expect(cfg.packs.map((p: any) => p.qty)).toEqual([1, 3]);
      // The three-unit pack still costs what the seller typed. If this ever reads
      // 1197 the stock quantity has leaked into the money path.
      expect(cfg.packs[1].price).toBe(399);
    });

    it('clamps a nonsense quantity instead of shipping it to the stock decrement', async () => {
      const html = (await withCheckout({
        options: [
          { id: 'p1', name: 'Énorme', price: 1, quantity: '500' },
          { id: 'p2', name: 'Zéro', price: 1, quantity: 0 },
          { id: 'p3', name: 'Texte', price: 1, quantity: 'trois' },
        ],
      }))!;
      // This value ends up subtracted from Product.stockQuantity, so the block is
      // the last place that can refuse an absurd one. A 0 in particular would let
      // a pack sell for ever without the stock ever running out.
      expect(cfgOf(html).packs.map((p: any) => p.qty)).toEqual([99, 1, 1]);
    });

    it('renders clean pack title without multiplier suffix on multi-unit pack', async () => {
      const html = (await withCheckout({
        options: [
          { id: 'p1', name: 'Un', price: 199, quantity: 1 },
          { id: 'p2', name: 'Trois', price: 399, quantity: 3 },
        ],
      }))!;
      const packs = [...markup(html).matchAll(/<div class="ck-pack[ "][\s\S]*?<\/div>/g)].map((m) => m[0]);
      expect(packs).toHaveLength(2);
      expect(packs[0]).not.toContain('ck-pack-q');
      expect(packs[1]).toContain('<span class="ck-pack-n">Trois</span>');
    });

    it('posts the pack alongside the legacy string, never instead of it', () => {
      // The three new fields are what the stock decrement, the Variante column and
      // the id-based pack lookup all join on. `productVariant` stays untouched
      // beside them — 25+ screens and two Prisma `contains` filters read it.
      expect(CHECKOUT_RUNTIME).toContain('variantOptionId:');
      expect(CHECKOUT_RUNTIME).toContain('variantName:');
      expect(CHECKOUT_RUNTIME).toContain('packQuantity: packQty()');
      expect(CHECKOUT_RUNTIME).toContain('productVariant: variant()');
      // Floored, not merely clamped: the column is an Int, and a page compiled
      // before packs had a quantity has no `qty` in its frozen cfg at all.
      expect(CHECKOUT_RUNTIME).toContain('Math.floor');
    });

    it('escapes a pack name even when the badge is rendered next to it', async () => {
      const html = (await withCheckout({
        options: [{ id: 'p1', name: '<script>alert(1)</script>', price: 1, quantity: 2 }],
      }))!;
      expect(markup(html)).toContain('&lt;script&gt;');
      expect(markup(html)).not.toContain('<script>alert(1)</script>');
    });
  });

  it('carries the pixels needed to fire a conversion on submit', async () => {
    const html = (await withCheckout({}, {
      influencerPixels: [
        // The Conversions API token rides on the same row in the database. The
        // exact-shape assertion below is the regression net: if it ever
        // reaches cfg.pixels, anyone viewing source on the landing page can
        // post arbitrary events to the seller's pixel.
        {
          type: 'GLOBAL', platform: 'META', pixelId: '99', conversionEvent: 'Purchase',
          accessToken: 'EAACapiSecretToken123', testEventCode: 'TEST777',
        },
      ],
    }))!;
    const cfg = JSON.parse(
      html.match(/<script type="application\/json">(.*?)<\/script>/s)![1]
    );
    expect(cfg.pixels).toEqual([
      { platform: 'META', pixelId: '99', conversionEvent: 'Purchase' },
    ]);
    expect(html).not.toContain('EAACapiSecretToken123');
  });

  it('redirects to the thank-you page after a successful order', async () => {
    const html = (await withCheckout({}))!;
    const cfg = JSON.parse(
      html.match(/<script type="application\/json">(.*?)<\/script>/s)![1]
    );
    // The per-link page, not the shared one — it falls back to the default when
    // the seller has not built a custom thank-you page. The '/thank-you'
    // segment must survive: the lead signal in index.ts matches on it.
    expect(cfg.thankYouUrl).toBe('/r/CODE1/thank-you');
    expect(cfg.thankYouUrl).toContain('/thank-you');
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
    expect(CHECKOUT_RUNTIME.indexOf('track(capiEventId);')).toBeLessThan(
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

  it('caps every field in the browser, with the same numbers the runtime checks', async () => {
    const html = (await withCheckout({}))!;
    const cfg = JSON.parse(
      html.match(/<script type="application\/json"[^>]*>(.*?)<\/script>/s)![1]
    );
    // Two sources of truth for a limit means the browser silently truncating at
    // one number while the message quotes another.
    for (const [key, limit] of [
      ['name', cfg.lim.nameMax],
      ['phone', cfg.lim.phoneMax],
      ['city', cfg.lim.cityMax],
      ['address', cfg.lim.addressMax],
    ] as const) {
      expect(html).toMatch(new RegExp(`data-ck="${key}"[^>]*maxlength="${limit}"`));
    }
  });

  it('keeps the floors where the React form had them', async () => {
    const html = (await withCheckout({}))!;
    const cfg = JSON.parse(
      html.match(/<script type="application\/json"[^>]*>(.*?)<\/script>/s)![1]
    );
    // Raising any of these starts rejecting leads that convert today, which is
    // the one failure mode this block cannot have.
    expect(cfg.lim.nameMin).toBe(2);
    expect(cfg.lim.cityMin).toBe(2);
    // The phone floor/ceiling pair is gone on purpose (owner request, 2026-08):
    // the field is Moroccan-pattern-only now, which fixes the length by itself.
    expect(cfg.lim.phoneMinDigits).toBeUndefined();
    expect(cfg.lim.phoneMaxDigits).toBeUndefined();
  });

  it('caps the address without making it required', async () => {
    const html = (await withCheckout({}))!;
    expect(html).toMatch(/data-ck="address"[^>]*maxlength="200"/);
    // A cap is not a requirement: an empty address must still submit.
    expect(html).not.toMatch(/data-ck="address"[^>]*\srequired/);
  });

  it('validates the address too, but only once it has been filled in', async () => {
    const html = (await withCheckout({}))!;
    const cfg = JSON.parse(
      html.match(/<script type="application\/json"[^>]*>(.*?)<\/script>/s)![1]
    );
    expect(cfg.msg.addressShort).toBeTruthy();
    expect(cfg.msg.addressLong).toBeTruthy();
  });

  it('carries a message for every rule the runtime can fail', async () => {
    const html = (await withCheckout({}))!;
    const cfg = JSON.parse(
      html.match(/<script type="application\/json"[^>]*>(.*?)<\/script>/s)![1]
    );
    // A missing message would surface as an empty red slot under the field —
    // the customer sees the form refuse and cannot tell why.
    for (const key of [
      'nameRequired', 'nameShort', 'nameLetters', 'nameLong',
      'cityRequired', 'cityShort', 'cityLetters', 'cityLong',
      'phoneRequired', 'phoneInvalid',
      'phonePrefix', 'phoneIncomplete', 'phoneLong',
      'addressShort', 'addressLong',
    ]) {
      expect(cfg.msg[key], key).toBeTruthy();
    }
  });

  it('accepts Moroccan numbers only, in every spelling a customer types them', () => {
    // The validator ships as text, so the shipped source is what gets pinned:
    // the full pattern once for the verdict, and the prefix ladder that lets a
    // wrong start fail while the customer is still typing.
    expect(CHECKOUT_RUNTIME).toContain('[5-7][0-9]{8}$');
    for (const prefix of ['\\+212', '00212', '212', '0']) {
      expect(CHECKOUT_RUNTIME, prefix).toContain(prefix);
    }
    // The loose digit-count fallback is gone: nothing in the runtime counts
    // phone digits against a floor and ceiling any more.
    expect(CHECKOUT_RUNTIME).not.toContain('phoneMinDigits');
    expect(CHECKOUT_RUNTIME).not.toContain('phoneMaxDigits');
  });

  it('hints the right keyboard and autofill on each field', async () => {
    const html = (await withCheckout({}))!;
    expect(html).toMatch(/data-ck="phone"[^>]*inputmode="tel"/);
    expect(html).toMatch(/data-ck="name"[^>]*autocomplete="name"/);
    expect(html).toMatch(/data-ck="phone"[^>]*autocomplete="tel"/);
    expect(html).toMatch(/data-ck="city"[^>]*autocomplete="address-level2"/);
    expect(html).toMatch(/data-ck="address"[^>]*autocomplete="street-address"/);
  });
});
