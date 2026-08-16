import { describe, it, expect } from 'vitest';
import { renderDocument } from '../src/services/landingCompiler/document.js';
import { WHATSAPP_RUNTIME } from '../src/services/landingCompiler/runtime/whatsapp.js';

async function render(input: any) {
  return renderDocument(input as any);
}

/**
 * Body markup only — no <script> and no <style>.
 *
 * Both carry the widget's own class and selector names, so asserting against the
 * whole document matches the stylesheet or the runtime rather than an element.
 */
function markup(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '');
}

function page(blocks: any[], overrides: any = {}) {
  return render({
    code: 'CODE1',
    blocks,
    settings: {},
    landingPage: { themeColor: '#f97316', title: 'T', description: 'D' },
    product: { nameFr: 'P', retailPriceMad: 249, images: [] },
    influencerPixels: [],
    influencerName: 'Fatima Zahra',
    influencerAvatar: '/uploads/avatar.webp',
    origin: 'https://sub.silacod.com',
    ...overrides,
  });
}

const withWa = async (content: any, overrides: any = {}) => {
  const out = await page([{ id: 'w1', type: 'whatsapp', content }], overrides);
  return out ? out.html : null;
};

describe('whatsapp widget', () => {
  it('renders a floating widget with the phone digits only', async () => {
    const html = (await withWa({ phoneNumber: '+212 600-112233' }))!;
    expect(html).toContain('data-wa');
    const cfg = JSON.parse(html.match(/<script type="application\/json" data-wa-cfg>(.*?)<\/script>/s)![1]);
    expect(cfg.phone).toBe('212600112233');
  });

  it('renders nothing without a phone number', async () => {
    // React still renders the widget, but its send button is permanently
    // disabled — shipping ~2 KB of markup that cannot do anything is worse.
    const html = (await withWa({ phoneNumber: '' }))!;
    expect(markup(html)).not.toContain('data-wa');
  });

  it('respects enableWidget as opt-out', async () => {
    expect(markup((await withWa({ phoneNumber: '212600112233', enableWidget: false }))!))
      .not.toContain('data-wa');
    // Undefined must still render — only an explicit false disables.
    expect((await withWa({ phoneNumber: '212600112233' }))!).toContain('data-wa');
  });

  it('contributes no page layout, only a fixed overlay', async () => {
    const html = (await withWa({ phoneNumber: '212600112233' }))!;
    // Unlike every other block, whatsapp renders null in the flow in React.
    expect(markup(html)).not.toContain('class="bk ');
    expect(html).toContain('.wa{position:fixed');
  });

  it('falls back to the influencer name and avatar', async () => {
    const html = (await withWa({ phoneNumber: '212600112233' }))!;
    expect(html).toContain('Fatima Zahra');
    expect(html).toContain('/uploads/avatar.webp');
  });

  it('uses the initial when there is no avatar', async () => {
    const html = (await withWa({ phoneNumber: '212600112233' }, { influencerAvatar: null }))!;
    expect(html).toContain('class="wa-ini">F<');
    expect(markup(html)).not.toContain('wa-pic');
  });

  it('positions from the configured corner', async () => {
    const tl = (await withWa({ phoneNumber: '212600112233', position: 'top-left', offsetX: 10, offsetY: 12 }))!;
    expect(tl).toMatch(/class="wa t l"[^>]*style="top:12px;left:10px"/);
    const br = (await withWa({ phoneNumber: '212600112233' }))!;
    expect(br).toMatch(/class="wa b r"[^>]*style="bottom:24px;right:24px"/);
  });

  it('hides per viewport when asked', async () => {
    expect((await withWa({ phoneNumber: '212600112233', showOnMobile: false }))!).toContain('wa b r no-m');
    expect((await withWa({ phoneNumber: '212600112233', showOnDesktop: false }))!).toContain('wa b r no-d');
  });

  it('stays hidden on desktop when both viewport toggles are off', async () => {
    const html = (await withWa({
      phoneNumber: '212600112233',
      showOnDesktop: false,
      showOnMobile: false,
    }))!;
    expect(html).toContain('wa b r no-d no-m');

    // Both desktop rules match this element at equal specificity, so source
    // order decides the winner. Each string occurs once, inside the 768px media
    // query, so comparing offsets in the document compares their order there.
    // `.wa.no-m{display:flex}` re-showing after `.wa.no-d` had hidden it is the
    // whole bug: a widget the page asked to hide everywhere reappears above
    // 768px.
    const restore = html.indexOf('.wa.no-m{display:flex}');
    const hide = html.indexOf('.wa.no-d{display:none}');
    expect(restore).toBeGreaterThan(-1);
    expect(hide).toBeGreaterThan(restore);
  });

  it('accepts only known animations, icons and styles', async () => {
    const good = (await withWa({ phoneNumber: '212600112233', animation: 'bounce', iconStyle: 'pill' }))!;
    expect(good).toContain('animation:wa-bounce 2s');
    expect(good).toContain('wa-fab pill');

    const bad = (await withWa({
      phoneNumber: '212600112233',
      animation: 'x;}</style><script>alert(1)</script>',
      iconType: 'evil',
      iconStyle: 'nope',
    }))!;
    expect(bad).not.toContain('<script>alert(1)');
    expect(markup(bad)).not.toContain('animation:wa-x');
    expect(bad).toContain('wa-fab bubble');
  });

  it('maps rubberBand to its shorter keyframe name', async () => {
    const html = (await withWa({ phoneNumber: '212600112233', animation: 'rubberBand' }))!;
    expect(html).toContain('animation:wa-rubber 2s');
    expect(html).toContain('@keyframes wa-rubber');
  });

  it('rejects an injected colour', async () => {
    const html = (await withWa({
      phoneNumber: '212600112233',
      iconColor: 'red;background-image:url(https://evil.example/x)',
    }))!;
    expect(html).not.toContain('evil.example');
    expect(html).toContain('#25D366');
  });

  it('escapes the message and headline', async () => {
    const html = (await withWa({
      phoneNumber: '212600112233',
      headline: '"><script>alert(1)</script>',
      welcomeMessage: '</script><img src=x onerror=alert(2)>',
      badgeMessage: '<b>hi</b>',
    }))!;
    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });

  it('caps the badge at 9+', async () => {
    expect((await withWa({ phoneNumber: '212600112233', badgeCount: 3 }))!).toContain('>3</span>');
    expect((await withWa({ phoneNumber: '212600112233', badgeCount: 42 }))!).toContain('>9+</span>');
  });

  it('lets a page with a whatsapp block compile alongside other blocks', async () => {
    const out = await page([
      { id: 'i1', type: 'image', content: { url: '/uploads/a.webp' } },
      { id: 'c1', type: 'express_checkout', content: {} },
      { id: 'w1', type: 'whatsapp', content: { phoneNumber: '212600112233' } },
    ]);
    expect(out).toBeTruthy();
    expect(out!.html).toContain('data-wa');
    expect(out!.html).toContain('data-ck-root');
  });

  it('allows WhatsApp in the CSP so the widget can reach it', async () => {
    const out = await page([
      { id: 'w1', type: 'whatsapp', content: { phoneNumber: '212600112233' } },
    ]);
    // form-action is 'none' and the widget uses window.open rather than a form
    // submit, so navigation is not blocked. The tracking call is same-origin.
    expect(out!.csp).toContain("connect-src 'self'");
    expect(out!.csp).toContain("form-action 'none'");
  });
});

/**
 * The precedence ReferralForm.tsx:721-731 applies: block first, page settings
 * second, nothing third. Every v2 site-builder template ships the widget in
 * settings and no block, so reading the block alone silently drops the widget
 * from pages that already compile.
 */
describe('whatsapp widget source', () => {
  const IMAGE = { id: 'i1', type: 'image', content: { url: '/uploads/a.webp' } };

  const withSettings = async (whatsappWidget: any, blocks: any[] = [IMAGE]) =>
    page(blocks, { settings: { whatsappWidget } });

  it('renders from page settings when the page has no whatsapp block', async () => {
    const out = (await withSettings({ enabled: true, phoneNumber: '+212 600 112233' }))!;
    expect(out.html).toContain('data-wa');
    const cfg = JSON.parse(out.html.match(/data-wa-cfg>(.*?)<\/script>/s)![1]);
    expect(cfg.phone).toBe('212600112233');
    // The sheet and the runtime have to come along, or the widget is inert markup.
    expect(out.html).toContain('.wa{position:fixed');
    expect(out.html).toContain('data-wa-toggle');
  });

  it('ignores page settings that are not enabled', async () => {
    const out = (await withSettings({ phoneNumber: '212600112233' }))!;
    expect(markup(out.html)).not.toContain('data-wa');
    expect(out.html).not.toContain('.wa{position:fixed');
  });

  it('prefers the block over page settings', async () => {
    const out = (await withSettings({ enabled: true, phoneNumber: '212611111111' }, [
      IMAGE,
      { id: 'w1', type: 'whatsapp', content: { phoneNumber: '212622222222' } },
    ]))!;
    const cfg = JSON.parse(out.html.match(/data-wa-cfg>(.*?)<\/script>/s)![1]);
    expect(cfg.phone).toBe('212622222222');
  });

  it('falls back to page settings when the block opts out', async () => {
    // enableWidget:false means "not from this block", not "no widget" — React
    // drops straight through to settings, and a page compiled without this
    // would lose a widget the SPA still shows.
    const out = (await withSettings({ enabled: true, phoneNumber: '212611111111' }, [
      IMAGE,
      { id: 'w1', type: 'whatsapp', content: { enableWidget: false, phoneNumber: '212622222222' } },
    ]))!;
    const cfg = JSON.parse(out.html.match(/data-wa-cfg>(.*?)<\/script>/s)![1]);
    expect(cfg.phone).toBe('212611111111');
  });

  it('renders nothing when the block opts out and settings carry no widget', async () => {
    const out = (await page([
      IMAGE,
      { id: 'w1', type: 'whatsapp', content: { enableWidget: false, phoneNumber: '212600112233' } },
    ]))!;
    expect(markup(out.html)).not.toContain('data-wa');
  });

  it('ships no widget stylesheet or runtime when nothing renders', async () => {
    const out = (await page([
      IMAGE,
      { id: 'w1', type: 'whatsapp', content: { phoneNumber: '' } },
    ]))!;
    expect(out.html).not.toContain('.wa{position:fixed');
    expect(out.html).not.toContain('data-wa-toggle');
  });

  it('places the overlay outside the page container', async () => {
    // `.pg` is a max-width column; a position:fixed child of it breaks the day
    // that column gains a transform.
    const out = (await withSettings({ enabled: true, phoneNumber: '212600112233' }))!;
    const container = out.html.match(/<div class="pg">([\s\S]*?)<\/div>(?=<div class="wa)/);
    expect(container).toBeTruthy();
    expect(container![1]).not.toContain('data-wa');
  });
});

describe('whatsapp runtime', () => {
  it('is syntactically valid JavaScript', () => {
    expect(() => new Function(WHATSAPP_RUNTIME)).not.toThrow();
  });

  it('carries no unexpanded template placeholders', () => {
    expect(WHATSAPP_RUNTIME).not.toMatch(/\$\{/);
  });

  it('tracks the click before opening the new tab', () => {
    // Opening a tab can suspend this page; on iOS the request may never send.
    // Match the CALL, not the prose: a comment above the fetch mentions
    // "window.open below", and indexOf would find that first.
    expect(WHATSAPP_RUNTIME.indexOf('track-whatsapp')).toBeLessThan(
      WHATSAPP_RUNTIME.indexOf('window.open(')
    );
    expect(WHATSAPP_RUNTIME).toContain('keepalive: true');
  });

  it('hits the real tracking endpoint', () => {
    expect(WHATSAPP_RUNTIME).toContain("'/api/v1/influencer/links/'");
    expect(WHATSAPP_RUNTIME).toContain('/track-whatsapp');
  });

  it('chooses wa.me on mobile and web.whatsapp.com on desktop', () => {
    expect(WHATSAPP_RUNTIME).toContain('https://wa.me');
    expect(WHATSAPP_RUNTIME).toContain('https://web.whatsapp.com/send');
    expect(WHATSAPP_RUNTIME).toContain('window.innerWidth > 768');
  });

  it('queries only hooks the renderer emits', async () => {
    const html = (await withWa({ phoneNumber: '212600112233', badgeMessage: 'Salam' }))!;
    const hooks = [...WHATSAPP_RUNTIME.matchAll(/\[data-wa[a-z-]*\]/g)].map((m) => m[0]);
    for (const hook of new Set(hooks)) {
      expect(html, `runtime queries ${hook}`).toContain(hook.slice(1, -1));
    }
  });
});
