import { describe, it, expect } from 'vitest';
import {
  themeFromStore,
  themeFromLandingPage,
  resolveBlocks,
  resolveDocument,
  resolveValue,
  DEFAULT_THEME,
} from '../src/shared/document/theme.js';
import { fromLegacy } from '../src/shared/document/migrate.js';
import { renderDocument } from '../src/services/landingCompiler/document.js';

describe('theme tokens', () => {
  it('reads a store row, falling to defaults for what is missing', () => {
    const t = themeFromStore({ primaryColor: '#123456', secondaryColor: '', fontFamily: 'Cairo' });
    expect(t.primary).toBe('#123456');
    expect(t.secondary).toBe(DEFAULT_THEME.secondary);
    expect(t.font).toBe('Cairo');
    expect(themeFromStore(null)).toEqual(DEFAULT_THEME);
  });

  it('uses a landing page\'s theme colour as $primary', () => {
    expect(themeFromLandingPage({ themeColor: '#abcdef' }).primary).toBe('#abcdef');
  });

  it('resolves known tokens and leaves everything else alone', () => {
    const t = themeFromStore({ primaryColor: '#ff0000' });
    expect(resolveValue('$primary', t)).toBe('#ff0000');
    expect(resolveValue('$font', t)).toBe('Inter');
    expect(resolveValue('$nope', t)).toBe('$nope');
    expect(resolveValue('#00ff00', t)).toBe('#00ff00');
    expect(resolveValue(12, t)).toBe(12);
  });

  it('resolves deep inside props and arrays without touching the input', () => {
    const t = themeFromStore({ primaryColor: '#ff0000' });
    const blocks = [
      { id: 'a', type: 'express_checkout', content: { themeColor: '$primary', options: [{ name: 'P', badgeColor: '$secondary' }] } },
    ];
    const out = resolveBlocks(blocks, t);
    expect((out[0].content as any).themeColor).toBe('#ff0000');
    expect((out[0].content as any).options[0].badgeColor).toBe(DEFAULT_THEME.secondary);
    expect((blocks[0].content as any).themeColor).toBe('$primary');
  });

  it('resolves node styles and block props across a document', () => {
    const doc = fromLegacy([{ id: 'h', type: 'hero', content: { titleColor: '$text', bgColor: '$bg' } }]);
    (doc.root[0] as any).style = { background: '$primary' };
    const out = resolveDocument(doc, themeFromStore({ primaryColor: '#0000ff' }));
    expect((out.root[0] as any).style.background).toBe('#0000ff');
    expect(((out.root[0].children[0] as any).props).titleColor).toBe(DEFAULT_THEME.text);
    expect(((doc.root[0].children[0] as any).props).titleColor).toBe('$text');
  });
});

describe('tokens through the compiler', () => {
  it('a resolved block compiles with the literal colour, not the token', async () => {
    const theme = themeFromLandingPage({ themeColor: '#12ab34' });
    const blocks = resolveBlocks([{ id: 'h', type: 'hero', content: { title: 'T', bgColor: '$primary' } }], theme);
    const out = await renderDocument({
      code: 'C', blocks, settings: {}, landingPage: { themeColor: '#12ab34' },
      product: { nameFr: 'P', images: [] }, influencerPixels: [], origin: null,
    } as any);
    expect(out!.html).toContain('#12ab34');
    expect(out!.html).not.toContain('$primary');
  });
});
