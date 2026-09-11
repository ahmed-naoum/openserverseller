import { describe, it, expect } from 'vitest';
import { composeStorePage, compileStoreDocument } from '../src/services/storeCompiler/index.js';
import { fromLegacy, applyOps } from '../src/shared/document/index.js';

const store = {
  name: 'Ma Boutique',
  primaryColor: '#11aa22',
  secondaryColor: '#1e293b',
  metaTitle: null,
  metaDescription: 'La meilleure boutique',
  logoUrl: '/uploads/logo.png',
};
const user = { subdomain: 'abdo', customDomain: 'vegas.ma', customDomainStatus: 'ACTIVE', pixels: [] };

const header = fromLegacy([{ id: 'sh', type: 'site_header', content: { brandText: 'MA BOUTIQUE', links: [{ label: 'Accueil', url: '/' }] } }]);
const footer = fromLegacy([{ id: 'sf', type: 'site_footer', content: { brandText: 'MA BOUTIQUE', copyright: '© Ma Boutique' } }]);
const home = fromLegacy([{ id: 'h1', type: 'hero', content: { title: 'Bienvenue', bgColor: '$primary' } }]);

describe('composing a store page', () => {
  it('splices header and footer around the body with prefixed ids', () => {
    const doc = composeStorePage({ store, user, kind: 'home', page: home, header, footer, path: '/' })!;
    expect(doc.root.map((s) => s.id)).toEqual(['h_page', 'page', 'f_page']);
    expect((doc.root[0].children[0] as any).id).toBe('h_sh');
    expect((doc.root[2].children[0] as any).id).toBe('f_sf');
  });

  it('resolves theme tokens against the store', () => {
    const doc = composeStorePage({ store, user, kind: 'home', page: home, header: null, footer: null, path: '/' })!;
    expect(((doc.root[0].children[0] as any).props).bgColor).toBe('#11aa22');
  });

  it('returns null when the store has not built the page', () => {
    expect(composeStorePage({ store, user, kind: 'home', page: null, header, footer, path: '/' })).toBeNull();
    expect(composeStorePage({ store, user, kind: 'home', page: { version: 3, kind: 'home', settings: {}, root: [] }, header, footer, path: '/' })).toBeNull();
  });
});

describe('compiling a store page', () => {
  it('produces the page with the store title, canonical URL and both chrome blocks', async () => {
    const out = (await compileStoreDocument({ store, user, kind: 'home', page: home, header, footer, path: '/' }))!;
    expect(out.html).toContain('<title>Ma Boutique</title>');
    expect(out.html).toContain('rel="canonical" href="https://vegas.ma/"');
    expect(out.html).toContain('class="bk bk-sh');
    expect(out.html).toContain('class="bk bk-sf"');
    expect(out.html).toContain('Bienvenue');
    expect(out.html).toContain('#11aa22');
    expect(out.html).not.toContain('$primary');
    expect(out.csp).toContain("script-src");
  });

  it('titles a custom page after itself and canonicalises its path', async () => {
    const page = fromLegacy([{ id: 't', type: 'text', content: { text: 'Livraison sous 48h' } }]);
    const out = (await compileStoreDocument({ store, user, kind: 'page', page, header, footer, path: '/pages/livraison', title: 'Livraison' }))!;
    expect(out.html).toContain('<title>Livraison — Ma Boutique</title>');
    expect(out.html).toContain('href="https://vegas.ma/pages/livraison"');
  });

  it('keeps the header sticky rule and a row layout from the body', async () => {
    const body = applyOps(fromLegacy([
      { id: 'a', type: 'hero', content: { title: 'A' } },
      { id: 'b', type: 'image', content: { url: '/uploads/x.jpg' } },
    ]), [{ op: 'wrap', nodeIds: ['a', 'b'], wrapperId: 'row', layout: 'row', columns: [7, 5] }]).doc;
    const out = (await compileStoreDocument({ store, user, kind: 'home', page: body, header, footer, path: '/' }))!;
    expect(out.html).toContain('grid-template-columns:7fr 5fr');
    expect(out.html).toContain('.bk-sh.st{position:sticky');
  });

  it('falls back to the subdomain host when no custom domain is active', async () => {
    const out = (await compileStoreDocument({ store, user: { subdomain: 'abdo', pixels: [] }, kind: 'home', page: home, header: null, footer: null, path: '/' }))!;
    expect(out.html).toMatch(/rel="canonical" href="https?:\/\/abdo\.[^/]+\/"/);
  });
});
