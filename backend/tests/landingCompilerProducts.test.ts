import { describe, it, expect } from 'vitest';
import { renderDocument } from '../src/services/landingCompiler/document.js';
import { PRODUCTS_RUNTIME } from '../src/services/landingCompiler/runtime/products.js';
import { CHECKOUT_RUNTIME } from '../src/services/landingCompiler/runtime/checkout.js';

async function render(blocks: any[]): Promise<string | null> {
  const out = await renderDocument({
    code: 'CODE1',
    blocks,
    settings: {},
    landingPage: { themeColor: '#f97316', title: 'T', description: 'D' },
    product: { nameFr: 'P', retailPriceMad: 249, images: [] },
    influencerPixels: [],
    origin: 'https://sub.silacod.com',
  } as any);
  return out ? out.html : null;
}

const products = (content: any) => render([{ id: 'p1', type: 'products', content }]);

/** The block's settings, as the runtime will read them back. */
async function config(content: any): Promise<any> {
  const html = (await products(content))!;
  const match = html.match(/<script type="application\/json">([\s\S]*?)<\/script>/);
  expect(match).toBeTruthy();
  return JSON.parse(
    match![1].replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&')
  );
}

/** The shape the one live products block has today. */
const LIVE = {
  accountIds: [2],
  selectedProducts: [],
  layoutType: 'grid',
  gridCols: 3,
  cardBg: '#ffffff',
  cardRadius: 16,
  cardShadow: 'md',
  btnBg: '#f97316',
  btnColor: '#ffffff',
  titleColor: '#111827',
  descColor: '#4b5563',
  priceColor: '#f97316',
  paddingTop: 32,
  paddingBottom: 32,
};

describe('products block shell', () => {
  it('ships the skeleton React paints while its request is in flight', async () => {
    const html = (await products(LIVE))!;
    // gridCols * 2, the count React uses for a grid.
    expect(html.split('class="bk-pr-sk"').length - 1).toBe(6);
    expect(html).toContain('class="bk-pr-g g3"');
    expect(html).toContain('data-pr-body');
  });

  it('shows three skeletons in a flat three columns for a carousel', async () => {
    // cardsPerView is 3 until the resize effect runs, and the skeleton grid is
    // `grid-cols-3` with no breakpoints behind it.
    const html = (await products({ ...LIVE, layoutType: 'slider' }))!;
    expect(html.split('class="bk-pr-sk"').length - 1).toBe(3);
    expect(html).toContain('class="bk-pr-g gs"');
  });

  it('goes straight to the empty state when no account is selected', async () => {
    // React never fetches in this case, so a skeleton would promise something
    // that is never coming.
    const html = (await products({ ...LIVE, accountIds: [] }))!;
    // Stripped: the sheet defines the skeleton rules whether or not one is drawn.
    expect(html.replace(/<style>[\s\S]*?<\/style>/g, '')).not.toContain('bk-pr-sk');
    expect(html).toContain('Aucun produit disponible ou sélectionné.');
  });

  it('applies the block spacing defaults, 32px top and bottom', async () => {
    const html = (await products({ accountIds: [2] }))!;
    expect(html).toContain('padding-top:32px;padding-bottom:32px;margin-top:0px;margin-bottom:0px');
  });

  it('grows the grid with the column count and stops at four', async () => {
    expect((await products({ ...LIVE, gridCols: 1 }))!).toContain('bk-pr-g g1');
    expect((await products({ ...LIVE, gridCols: 4 }))!).toContain('bk-pr-g g4');
    expect((await products({ ...LIVE, gridCols: 9 }))!).toContain('bk-pr-g g4');
  });
});

describe('products block config', () => {
  it('passes the accounts to fetch as a query-safe list', async () => {
    expect((await config({ ...LIVE, accountIds: [2, 7] })).accountIds).toBe('2,7');
  });

  it('drops an account id that is not a number', async () => {
    // The value reaches a query string; the builder only ever writes the
    // owner's numeric user id.
    expect((await config({ ...LIVE, accountIds: [2, 'x); DROP', null] })).accountIds).toBe('2');
  });

  it('sanitises every colour the runtime will write into a style', async () => {
    const cfg = await config({
      ...LIVE,
      cardBg: 'red;background-image:url(https://evil.example/x)',
      priceColor: '#00ff00',
    });
    expect(JSON.stringify(cfg)).not.toContain('evil.example');
    expect(cfg.cardBg).toBe('#ffffff');
    expect(cfg.priceColor).toBe('#00ff00');
  });

  it('keeps the per-card button settings, in the order they were chosen', async () => {
    const cfg = await config({
      ...LIVE,
      selectedProducts: [
        { productId: 12, buttonText: 'Acheter', btnBg: '#000000', btnColor: '#ffffff' },
        { productId: 4, link: 'https://shop.example/p/4' },
      ],
    });
    expect(cfg.selected.map((s: any) => s.id)).toEqual(['12', '4']);
    expect(cfg.selected[0].buttonText).toBe('Acheter');
    expect(cfg.selected[0].link).toBe('#express-checkout-block');
    expect(cfg.selected[1].link).toBe('https://shop.example/p/4');
  });

  it('refuses a card link that would run script, keeping the checkout anchor', async () => {
    const cfg = await config({
      ...LIVE,
      selectedProducts: [{ productId: 1, link: 'javascript:alert(1)' }],
    });
    expect(cfg.selected[0].link).toBe('#express-checkout-block');
  });

  it('keeps a plain anchor and rejects one carrying anything else', async () => {
    const clean = await config({
      ...LIVE,
      selectedProducts: [{ productId: 1, link: '#offre-2' }],
    });
    expect(clean.selected[0].link).toBe('#offre-2');

    // Cleaning rather than rejecting would leave a different, still-valid id.
    const dirty = await config({
      ...LIVE,
      selectedProducts: [{ productId: 1, link: '#express-checkout-block"><b>' }],
    });
    expect(dirty.selected[0].link).toBe('#express-checkout-block');
  });

  it('reads the two autoplay defaults the single speed field stands in for', async () => {
    const cfg = await config(LIVE);
    expect(cfg.speed).toBe(3500);
    expect(cfg.speedMarquee).toBe(15000);

    const set = await config({ ...LIVE, autoPlaySpeed: 8000 });
    expect(set.speed).toBe(8000);
    expect(set.speedMarquee).toBe(8000);
  });

  it('treats the price and autoplay flags as opt-outs, like React', async () => {
    expect((await config(LIVE)).showPrice).toBe(true);
    expect((await config(LIVE)).autoPlay).toBe(true);
    expect((await config({ ...LIVE, showPrice: false })).showPrice).toBe(false);
    expect((await config({ ...LIVE, autoPlay: false })).autoPlay).toBe(false);
  });

  it('maps the shadow name to the class the sheet defines', async () => {
    expect((await config({ ...LIVE, cardShadow: 'md' })).shadow).toBe('sh-m');
    expect((await config({ ...LIVE, cardShadow: 'xl' })).shadow).toBe('sh-x');
    expect((await config({ ...LIVE, cardShadow: 'none' })).shadow).toBe('');
  });

  it('cannot be closed early by a payload in the block content', async () => {
    const html = (await products({
      ...LIVE,
      selectedProducts: [{ productId: 1, buttonText: '</script><script>alert(1)</script>' }],
    }))!;
    // The config script and the runtime, and nothing else.
    expect((html.match(/<script/g) || []).length).toBe(2);
    expect(html).not.toContain('<script>alert(1)');
  });
});

describe('products runtime', () => {
  it('is syntactically valid JavaScript', () => {
    expect(() => new Function(PRODUCTS_RUNTIME)).not.toThrow();
  });

  it('carries no unexpanded template placeholders', () => {
    expect(PRODUCTS_RUNTIME).not.toMatch(/\$\{/);
  });

  it('queries only hooks the renderer emits', async () => {
    const html = (await products(LIVE))!;
    expect(PRODUCTS_RUNTIME).toContain('[data-pr]');
    expect(PRODUCTS_RUNTIME).toContain('[data-pr-body]');
    expect(html).toContain('data-pr>');
    expect(html).toContain('data-pr-body');
  });

  it('asks the same endpoint React does', async () => {
    expect(PRODUCTS_RUNTIME).toContain('/api/v1/public/products-by-accounts?accountIds=');
  });

  it('writes API text as text, never as markup', async () => {
    // Product names and descriptions are the one input on this page that no
    // compile-time escaping has seen.
    expect(PRODUCTS_RUNTIME).toContain('h4.textContent');
    expect(PRODUCTS_RUNTIME).toContain('desc.textContent');
    expect(PRODUCTS_RUNTIME).not.toMatch(/\.innerHTML\s*=\s*(product|categoryName)/);
  });
});

describe('products and the checkout', () => {
  it('tells the checkout which product was clicked', async () => {
    expect(PRODUCTS_RUNTIME).toContain("new CustomEvent('select-product'");
    expect(CHECKOUT_RUNTIME).toContain("window.addEventListener('select-product'");
  });

  it('prices a clicked product ahead of the link’s own, behind any chosen pack', async () => {
    // ReferralForm.tsx:500 — pack, then the card's two price fields, then the
    // product this link sells.
    expect(CHECKOUT_RUNTIME).toContain('(selected && selected.price) ||');
    expect(CHECKOUT_RUNTIME).toContain('(fromBlock && fromBlock.retailPriceMad) ||');
    expect(CHECKOUT_RUNTIME).toContain('(fromBlock && fromBlock.priceMad) ||');
    expect(CHECKOUT_RUNTIME).toContain('cfg.retailPrice');
  });

  it('records the order as "Product (Pack)" once a card has been clicked', async () => {
    expect(CHECKOUT_RUNTIME).toContain("'Standard'");
    expect(CHECKOUT_RUNTIME).toContain('productVariant: variant()');
  });

  it('still parses with the listener in it', () => {
    expect(() => new Function(CHECKOUT_RUNTIME)).not.toThrow();
  });
});

describe('products — page integration', () => {
  it('ships one sheet and one runtime however many products blocks a page has', async () => {
    const html = (await render([
      { id: 'p1', type: 'products', content: LIVE },
      { id: 'p2', type: 'products', content: { ...LIVE, layoutType: 'slider' } },
    ]))!;
    expect(html.split('.bk-pr{max-width:1152px').length - 1).toBe(1);
    expect(html.split("document.querySelectorAll('[data-pr]')").length - 1).toBe(1);
  });

  it('is absent entirely from a page with no products block', async () => {
    const html = (await render([{ id: 'h1', type: 'hero', content: {} }]))!;
    expect(html).not.toContain('bk-pr');
    expect(html).not.toContain('data-pr');
  });

  it('lets a page carrying the last two block types compile', async () => {
    // With these registered, every reachable landing page in production is
    // covered — 32 of 32 with traffic.
    const html = await render([
      { id: 's1', type: 'slider', content: { slides: [{ title: 'A' }] } },
      { id: 'p1', type: 'products', content: LIVE },
      { id: 'c1', type: 'express_checkout', content: {} },
    ]);
    expect(html).toBeTruthy();
    expect(html).toContain('bk-sl');
    expect(html).toContain('bk-pr');
    expect(html).toContain('data-ck-root');
  });
});
