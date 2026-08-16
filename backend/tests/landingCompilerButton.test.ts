import { describe, it, expect } from 'vitest';
import { renderDocument } from '../src/services/landingCompiler/document.js';
import { BUTTON_RUNTIME } from '../src/services/landingCompiler/runtime/button.js';

async function render(input: any): Promise<string | null> {
  const out = await renderDocument(input as any);
  return out ? out.html : null;
}

/** The runtime carries its own selector strings; strip it before asserting on markup. */
function markup(html: string): string {
  return html.replace(/<script>[\s\S]*?<\/script>/g, '');
}

function page(blocks: any[]) {
  return render({
    code: 'CODE1',
    blocks,
    settings: {},
    landingPage: { themeColor: '#f97316', title: 'T', description: 'D' },
    product: { nameFr: 'P', retailPriceMad: 249, images: [] },
    influencerPixels: [],
    origin: 'https://sub.silacod.com',
  });
}

const withButton = (content: any) => page([{ id: 'b1', type: 'button', content }]);

describe('button block', () => {
  it('renders the default label', async () => {
    const html = (await withButton({}))!;
    expect(html).toContain('Commander Maintenant');
    expect(html).toContain('<button type="button"');
  });

  it('uses the block default of 24px vertical padding', async () => {
    const html = (await withButton({}))!;
    expect(html).toContain('padding-top:24px');
  });

  it('opens an external link in a new tab rather than scrolling', async () => {
    const html = (await withButton({ behavior: 'link', link: 'https://wa.me/212600000000' }))!;
    expect(html).toContain('data-btn-href="https://wa.me/212600000000"');
    expect(markup(html)).not.toContain('data-btn-checkout');
  });

  it('drops a javascript: link instead of wiring it up', async () => {
    const html = (await withButton({ behavior: 'link', link: 'javascript:alert(1)' }))!;
    expect(html).not.toContain('javascript:');
    expect(markup(html)).not.toContain('data-btn-href');
  });

  it('defaults to scrolling to the checkout when no link is set', async () => {
    const html = (await withButton({}))!;
    expect(html).toContain('data-btn-checkout');
  });

  it('marks the first checkout block as the scroll anchor', async () => {
    const html = (await page([
      { id: 'b1', type: 'button', content: {} },
      { id: 'c1', type: 'express_checkout', content: {} },
    ]))!;
    expect(html).toContain('id="express-checkout-block"');
    expect(BUTTON_RUNTIME).toContain('express-checkout-block');
  });

  it('gives the anchor id to only one checkout block', async () => {
    const html = (await page([
      { id: 'c1', type: 'express_checkout', content: {} },
      { id: 'c2', type: 'express_checkout', content: {} },
    ]))!;
    // Duplicated ids would be invalid HTML; React gets away with it only
    // because getElementById returns the first match.
    expect((markup(html).match(/id="express-checkout-block"/g) || []).length).toBe(1);
  });

  it('applies sticky classes only for the sides that ask for them', async () => {
    expect((await withButton({ stickyMobile: true }))!).toMatch(/class="bk bk-btn sm"/);
    expect((await withButton({ stickyDesktop: true }))!).toMatch(/class="bk bk-btn sd"/);
    const both = (await withButton({ stickyMobile: true, stickyDesktop: true }))!;
    expect(both).toMatch(/class="bk bk-btn sm sd"/);
    expect(both).toContain('data-btn-sticky');
  });

  it('does not mark a non-sticky button for the in-view observer', async () => {
    expect(markup((await withButton({}))!)).not.toContain('data-btn-sticky');
  });

  it('accepts only known animations and easings', async () => {
    const good = (await withButton({ animationLayout: 'scale', animationTiming: 'linear' }))!;
    expect(good).toContain('bk-btn-scale');
    expect(good).toContain('animation-timing-function:linear');

    const bad = (await withButton({
      animationLayout: 'x;}</style><script>alert(1)</script>',
      animationTiming: 'url(evil)',
    }))!;
    expect(bad).not.toContain('<script>alert(1)');
    expect(bad).not.toContain('url(evil)');
    expect(markup(bad)).not.toContain('animation-timing-function');
  });

  it('hides a video-gated button until the runtime reveals it', async () => {
    const html = (await withButton({ showAfterVideoSeconds: 8 }))!;
    expect(html).toContain('pending');
    expect(html).toContain('data-btn-after="8"');
    // display:none in CSS, so it cannot be tapped before the runtime loads.
    expect(html).toContain('.bk-btn.pending{display:none}');
  });

  it('falls back to a timer when no <video> can report progress', async () => {
    // Only a <video> element fires video-time-update. A YouTube or Vimeo block
    // renders an iframe, and a page may have a delayed button and no video at
    // all — without this the button would stay hidden forever, which is a CTA
    // the merchant configured and no customer can reach.
    expect(BUTTON_RUNTIME).toContain("document.querySelector('video')");
    expect(BUTTON_RUNTIME).toContain('setTimeout(reveal, after * 1000)');
  });

  it('reveals a delayed button only once', async () => {
    // Both the event and the timer can fire; the second must be a no-op or the
    // listener would be removed twice and the class toggled after teardown.
    expect(BUTTON_RUNTIME).toContain('if (revealed) return;');
  });

  it('does not gate a button whose delay is zero or missing', async () => {
    const html = (await withButton({ showAfterVideoSeconds: 0 }))!;
    expect(markup(html)).not.toContain('data-btn-after');
    expect(markup(html)).not.toContain('bk-btn pending');
  });

  it('builds the tinted shadow only when the colour is hex', async () => {
    const hex = (await withButton({ bgColor: '#123456' }))!;
    expect(hex).toContain('box-shadow:0 10px 30px #12345644');

    // `${bg}44` is only valid for 6-digit hex; anything else must not produce a
    // malformed colour.
    const named = (await withButton({ bgColor: 'rgba(1,2,3,0.5)' }))!;
    expect(named).toContain('box-shadow:0 10px 30px rgba(0,0,0,.16)');
    expect(named).not.toContain('rgba(1,2,3,0.5)44');
  });

  it('rejects an injected colour', async () => {
    const html = (await withButton({ bgColor: 'red;background-image:url(https://evil.example/x)' }))!;
    expect(html).not.toContain('evil.example');
    expect(html).toContain('background:#f97316');
  });

  it('escapes the label', async () => {
    const html = (await withButton({ text: '"><script>alert(1)</script>' }))!;
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('&lt;script&gt;');
  });

  it('emits one runtime for several buttons', async () => {
    const html = (await page([
      { id: 'b1', type: 'button', content: {} },
      { id: 'b2', type: 'button', content: { stickyMobile: true } },
    ]))!;
    expect((markup(html).match(/data-btn(?![-a-z])/g) || []).length).toBe(2);
    expect((html.match(/<script>/g) || []).length).toBe(1);
  });
});

describe('button runtime', () => {
  it('is syntactically valid JavaScript', () => {
    expect(() => new Function(BUTTON_RUNTIME)).not.toThrow();
  });

  it('carries no unexpanded template placeholders', () => {
    expect(BUTTON_RUNTIME).not.toMatch(/\$\{/);
  });

  it('listens for the event the video runtime dispatches', async () => {
    const { VIDEO_RUNTIME } = await import('../src/services/landingCompiler/runtime/video.js');
    // The two runtimes are coupled only through this event name; a typo in
    // either would silently leave the button hidden forever.
    expect(BUTTON_RUNTIME).toContain("'video-time-update'");
    expect(VIDEO_RUNTIME).toContain("'video-time-update'");
  });

  it('opens external links with noopener', async () => {
    expect(BUTTON_RUNTIME).toContain("'noopener'");
  });
});
