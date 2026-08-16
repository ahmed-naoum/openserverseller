import { describe, it, expect } from 'vitest';
import { renderDocument } from '../src/services/landingCompiler/document.js';

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

const spacer = (content: any) => render([{ id: 's1', type: 'spacer', content }]);
const hero = (content: any) => render([{ id: 'h1', type: 'hero', content }]);

/** The document with the stylesheet removed, so rules cannot satisfy an assertion. */
function markup(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script>[\s\S]*?<\/script>/g, '');
}

describe('spacer block', () => {
  it('uses the stored height', async () => {
    expect((await spacer({ height: 64 }))!).toContain('style="height:64px"');
  });

  it('treats an explicit 0 as 32, exactly as `content.height || 32` does', async () => {
    // A spacer stored {"height":0} exists in production. React's OR makes it a
    // 32px gap; reading it as a plain default would collapse the block and
    // reflow the page against its React original.
    expect((await spacer({ height: 0 }))!).toContain('style="height:32px"');
  });

  it('defaults an absent or unusable height to 32', async () => {
    for (const content of [{}, { height: null }, { height: '' }, { height: 'abc' }]) {
      expect((await spacer(content))!, JSON.stringify(content)).toContain('style="height:32px"');
    }
  });

  it('reads a numeric string', async () => {
    expect((await spacer({ height: '48' }))!).toContain('style="height:48px"');
  });

  it('never emits a negative length', async () => {
    expect((await spacer({ height: -20 }))!).toContain('style="height:32px"');
  });

  it('carries the shared width contract and nothing else', async () => {
    const html = markup((await spacer({ height: 40 }))!);
    expect(html).toContain('<div class="bk" style="height:40px"></div>');
  });
});

describe('hero block', () => {
  const FULL = {
    title: 'Offre Spéciale !',
    subtitle: 'Découvrez notre produit exclusif.',
    bgColor: '#f9fafb',
    titleColor: '#111827',
    subtitleColor: '#4b5563',
    paddingTop: 48,
    paddingBottom: 48,
    marginTop: 0,
    marginBottom: 24,
  };

  it('renders the stored copy and colours', async () => {
    const html = (await hero(FULL))!;
    // esc() encodes the five HTML-significant characters, not accents — the
    // document is UTF-8 and é must survive as itself.
    expect(html).toContain('Offre Spéciale !');
    expect(html).toContain('Découvrez notre produit exclusif.');
    expect(html).toContain('color:#111827');
    expect(html).toContain('color:#4b5563');
    expect(html).toContain('background:#f9fafb');
  });

  it('applies the block-specific spacing defaults', async () => {
    // 48/48 padding and a 24px bottom margin, unlike the 0 every other block uses.
    const html = (await hero({}))!;
    expect(html).toContain('padding-top:48px');
    expect(html).toContain('padding-bottom:48px');
    expect(html).toContain('margin-top:0px');
    expect(html).toContain('margin-bottom:24px');
  });

  it('keeps React’s placeholder copy for an empty block', async () => {
    const html = (await hero({}))!;
    expect(html).toContain('Headline goes here');
    expect(html).toContain('Subheadline goes here to explain the offer.');
  });

  it('escapes the headline and subheadline', async () => {
    const html = (await hero({
      title: '"><script>alert(1)</script>',
      subtitle: '<img src=x onerror=alert(2)>',
    }))!;
    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });

  it('rejects an injected colour rather than letting it close the declaration', async () => {
    const html = (await hero({
      bgColor: 'red;background-image:url(https://evil.example/x)',
      titleColor: '#111827',
    }))!;
    expect(html).not.toContain('evil.example');
    expect(html).toContain('background:#f9fafb');
  });

  it('emits the heading as an h2 with the subheadline below it', async () => {
    const html = markup((await hero(FULL))!);
    const h2 = html.indexOf('<h2');
    const p = html.indexOf('<p style="color:#4b5563"');
    expect(h2).toBeGreaterThan(-1);
    expect(p).toBeGreaterThan(h2);
  });
});

describe('spacer and hero — page integration', () => {
  it('lets a page carrying both compile alongside other blocks', async () => {
    const html = await render([
      { id: 'h1', type: 'hero', content: { title: 'Offre' } },
      { id: 's1', type: 'spacer', content: { height: 32 } },
      { id: 'c1', type: 'express_checkout', content: {} },
    ]);
    expect(html).toBeTruthy();
    expect(html).toContain('bk-hero');
    expect(html).toContain('height:32px');
    expect(html).toContain('data-ck-root');
  });

  it('ships the hero sheet once and none at all when no hero is present', async () => {
    const both = (await render([
      { id: 'h1', type: 'hero', content: {} },
      { id: 'h2', type: 'hero', content: {} },
    ]))!;
    // Keyed on the wrapper rule, which appears once per copy of the sheet.
    // `.bk-hero h2{` would count 2 in a single copy — the base rule and the
    // md: override are both spelled that way.
    expect(both.split('.bk-hero{width:100%').length - 1).toBe(1);

    const none = (await spacer({ height: 32 }))!;
    expect(none).not.toContain('.bk-hero');
  });
});
