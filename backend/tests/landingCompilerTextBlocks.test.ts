import { describe, it, expect } from 'vitest';
import { renderDocument } from '../src/services/landingCompiler/document.js';

function page(blocks: any[]) {
  return renderDocument({
    code: 'CODE1',
    blocks,
    settings: {},
    landingPage: { themeColor: '#f97316', title: 'T', description: 'D' },
    product: { nameFr: 'P', retailPriceMad: 249, images: [] },
    influencerPixels: [],
    origin: 'https://sub.silacod.com',
  } as any);
}

describe('text block', () => {
  it('renders a paragraph with the React defaults', async () => {
    const html = (await page([{ id: 't1', type: 'text', content: { text: 'Bonjour <b>' } }]))!.html;
    expect(html).toContain('<p style="color:#374151;text-align:left">Bonjour &lt;b&gt;</p>');
    expect(html).toContain('min-height:80px');
  });

  it('renders a heading with its own default colour, and honours alignment', async () => {
    const html = (await page([{ id: 't1', type: 'text', content: { text: 'Titre', isHeading: true, align: 'center', verticalAlign: 'top' } }]))!.html;
    expect(html).toContain('<h3 style="color:#111827">Titre</h3>');
    expect(html).toContain('text-align:center;justify-content:flex-start;min-height:auto');
  });

  it('refuses a colour that is not one', async () => {
    const html = (await page([{ id: 't1', type: 'text', content: { text: 'x', color: 'red;}body{display:none' } }]))!.html;
    expect(html).not.toContain('display:none');
    expect(html).toContain('color:#374151');
  });
});

describe('header (brand bar) block', () => {
  it('renders the bar with a 4px default bottom margin like React', async () => {
    const html = (await page([{ id: 'h1', type: 'header', content: { text: 'MA MARQUE', bgColor: '#0f172a', color: '#fff' } }]))!.html;
    expect(html).toContain('<header class="bk bk-hd" style="background:#0f172a;');
    expect(html).toContain('margin-bottom:4px');
    expect(html).toContain('<h1 style="color:#fff">MA MARQUE</h1>');
  });
});

describe('countdown block', () => {
  it('renders the static banner and escapes the text', async () => {
    const html = (await page([{ id: 'c1', type: 'countdown', content: { text: 'Expire <soon>' } }]))!.html;
    expect(html).toContain('<span>⏳</span><span>Expire &lt;soon&gt;</span>');
    expect(html).toContain('padding-top:24px');
  });

  it('does not add a script: the banner never ticked in React either', async () => {
    const html = (await page([{ id: 'c1', type: 'countdown', content: {} }]))!.html;
    expect(html).not.toContain('<script>');
  });
});

describe('coverage', () => {
  it('compiles a page that mixes all three with a checkout', async () => {
    const out = await page([
      { id: 'h', type: 'header', content: { text: 'X' } },
      { id: 't', type: 'text', content: { text: 'Y' } },
      { id: 'c', type: 'countdown', content: {} },
      { id: 'k', type: 'express_checkout', content: {} },
    ]);
    expect(out).not.toBeNull();
    expect(out!.html).toContain('id="express-checkout-block"');
  });
});
