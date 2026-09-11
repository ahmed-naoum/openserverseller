import { describe, it, expect } from 'vitest';
import { generateDesign, EXAMPLE_BRIEFS } from '../src/shared/templates/opendesign.js';
import { THEMES } from '../src/shared/templates/themes.js';
import { validateDocument, flatBlocks, binds } from '../src/shared/document/index.js';
import { compileStoreDocument } from '../src/services/storeCompiler/index.js';

/**
 * OpenDesign has no model behind it, so every design it can produce is a
 * function of the words and the seed — and every one of them must validate
 * and compile, because a seller applies it to a live store in one click.
 */

const product = { id: 9, ref: 'p9', sku: 'S9', nameFr: 'Produit', retailPriceMad: 99, stockQuantity: 3, images: [], categories: [] };
const catalogue = async () => [product];

async function compiles(design: ReturnType<typeof generateDesign>) {
  const store = { name: 'Test', primaryColor: design.palette.primary, secondaryColor: design.palette.secondary, fontFamily: design.fontFamily };
  const user = { subdomain: 's', pixels: [] };
  const bindings = { product, collection: null, catalogue, storeId: 1 };
  const home = await compileStoreDocument({ store, user, kind: 'home', page: design.pages.home, header: design.pages.header, footer: design.pages.footer, path: '/', bindings });
  const prod = await compileStoreDocument({ store, user, kind: 'product', page: design.pages.product, header: design.pages.header, footer: design.pages.footer, path: '/p/p9', title: 'Produit', bindings });
  const cat = await compileStoreDocument({ store, user, kind: 'catalogue', page: design.pages.catalogue, header: design.pages.header, footer: design.pages.footer, path: '/products', title: 'Tous', bindings });
  return { home, prod, cat };
}

describe('OpenDesign engine', () => {
  it('reads the niche, the mood and a colour out of the brief', () => {
    const d = generateDesign({ prompt: 'Boutique de soins anti-âge au safran, rose poudré, élégante' });
    expect(d.niche).toBe('beauty');
    expect(d.mood).toBe('light');
    expect(d.palette.primary).toBe('#db2777');
    expect(d.fontFamily).toBe('Playfair Display');

    const dark = generateDesign({ prompt: 'gadgets high-tech, ambiance dark néon cyan' });
    expect(dark.niche).toBe('tech');
    expect(dark.mood).toBe('dark');
    expect(dark.palette.primary).toBe('#06b6d4');
  });

  it('is deterministic for a brief and seed, and varies with the seed', () => {
    const a = generateDesign({ prompt: 'streetwear sombre orange', seed: 0 });
    const b = generateDesign({ prompt: 'streetwear sombre orange', seed: 0 });
    expect(JSON.stringify(a.pages)).toBe(JSON.stringify(b.pages));

    const variants = new Set<string>();
    for (let seed = 0; seed < 8; seed++) variants.add(JSON.stringify(generateDesign({ prompt: 'streetwear sombre orange', seed }).variant));
    expect(variants.size).toBeGreaterThan(2);
  });

  it('honours brand overrides and a forced mode', () => {
    const d = generateDesign({ prompt: 'épicerie fine', mode: 'dark', palette: { primary: '#123456' }, fontFamily: 'Cairo' });
    expect(d.mood).toBe('dark');
    expect(d.palette.primary).toBe('#123456');
    expect(d.fontFamily).toBe('Cairo');
    expect(JSON.stringify(d.pages.home)).toContain('$primary');
  });

  it('composes a complete store: eight or more home sections, bound catalogue, product and collection', () => {
    for (const ex of EXAMPLE_BRIEFS) {
      const d = generateDesign({ prompt: ex.prompt, storeName: 'Ma boutique' });
      expect(d.sections.length, ex.title).toBeGreaterThanOrEqual(6);
      expect(binds(d.pages.home).some((b) => b.expression === '$catalogue'), ex.title).toBe(true);
      expect(binds(d.pages.product).some((b) => b.expression === '$page.product'), ex.title).toBe(true);
      expect(binds(d.pages.catalogue).some((b) => b.expression === '$page.collection'), ex.title).toBe(true);
      for (const [name, doc] of Object.entries(d.pages)) {
        expect(validateDocument(doc), `${ex.title}.${name}`).toEqual([]);
        expect(flatBlocks(doc).length, `${ex.title}.${name}`).toBeGreaterThan(0);
      }
    }
  });

  it('compiles every example brief across several seeds, with the brand font loaded', async () => {
    for (const ex of EXAMPLE_BRIEFS) {
      for (const seed of [0, 1, 2]) {
        const d = generateDesign({ prompt: ex.prompt, seed });
        const { home, prod, cat } = await compiles(d);
        expect(home, `${ex.title}#${seed} home`).not.toBeNull();
        expect(prod, `${ex.title}#${seed} product`).not.toBeNull();
        expect(cat, `${ex.title}#${seed} catalogue`).not.toBeNull();
        expect(home!.html).toContain('fonts.googleapis.com/css2?family=');
        expect(home!.html).not.toContain('$primary');
        expect(home!.csp).toContain('https://fonts.gstatic.com');
        expect(prod!.html).toContain('data-cart-add="add"');
      }
    }
  });

  it('gives an empty or unknown brief a sensible generalist store', () => {
    const d = generateDesign({ prompt: 'ma boutique' });
    expect(d.niche).toBe('general');
    expect(validateDocument(d.pages.home)).toEqual([]);
  });
});

describe('shipped themes are complete stores', () => {
  it('every theme home has at least eight sections and every product page a related strip', () => {
    for (const t of THEMES) {
      expect(t.sections.length, t.id).toBeGreaterThanOrEqual(8);
      expect(binds(t.pages.product).some((b) => b.expression === '$catalogue'), t.id).toBe(true);
      expect(t.pages.home.settings.backgroundColor, t.id).toBe(t.palette.bg);
    }
  });

  it('no two themes share a home composition', () => {
    const shapes = THEMES.map((t) => t.sections.join('>'));
    expect(new Set(shapes).size).toBe(THEMES.length);
  });
});

describe('a model spec over the reader', () => {
  it('overrides niche, colours, elements and copy, and still composes a valid store', async () => {
    const { sanitizeSpec } = await import('../src/shared/templates/briefSpec.js');
    const spec = sanitizeSpec({
      niche: 'fashion', mood: 'dark', colours: { primary: '#DC2626', bg: '#0A0A0A', text: 'nope' }, font: 'Space Grotesk',
      wants: ['button', 'reviews', 'bogus'], drops: ['faq'], buttonLabel: 'Acheter mes sneakers',
      copy: { headline: 'Des sneakers qui claquent', subhead: 'Livrées en 24h.', cta: 'voir le drop', faqs: [{ q: 'Q ?', a: 'R.' }], usp: [{ title: 'x', description: 'y' }], quotes: [{ name: 'A', city: 'B', text: 'C' }] },
      summary: 'Boutique de sneakers sombre et rouge.',
      extra: 'dropped',
    });
    expect(spec).not.toBeNull();
    expect(spec!.colours).toEqual({ primary: '#dc2626', bg: '#0a0a0a' });
    expect(spec!.wants).toEqual(['button', 'reviews']);
    expect((spec as any).extra).toBeUndefined();

    const d = generateDesign({ prompt: 'something vague' }, spec);
    expect(d.niche).toBe('fashion');
    expect(d.mood).toBe('dark');
    expect(d.palette.primary).toBe('#dc2626');
    expect(d.palette.bg).toBe('#0a0a0a');
    expect(d.fontFamily).toBe('Space Grotesk');
    expect(d.sections).not.toContain('Questions fréquentes');
    expect(d.rationale[0]).toBe('Boutique de sneakers sombre et rouge.');
    const home = JSON.stringify(d.pages.home);
    expect(home).toContain('Des sneakers qui claquent');
    expect(home).toContain('Acheter mes sneakers');
    expect(home).toContain('VOIR LE DROP');
    for (const [name, doc] of Object.entries(d.pages)) expect(validateDocument(doc), name).toEqual([]);
  });
});
