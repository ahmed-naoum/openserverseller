import { describe, it, expect } from 'vitest';
import { TEMPLATES, templatesFor } from '../src/shared/templates/index.js';
import { THEMES, themeSummaries } from '../src/shared/templates/themes.js';
import { validateDocument, flatBlocks, binds } from '../src/shared/document/index.js';
import { compileStoreDocument } from '../src/services/storeCompiler/index.js';

/**
 * A template that does not validate is a template that cannot be applied,
 * and a theme page the compiler declines is a store that silently falls back
 * to the React app. Both are caught here, once, for every entry.
 */

describe('page templates', () => {
  it('every template validates and carries at least one block', () => {
    for (const t of TEMPLATES) {
      expect(validateDocument(t.document), t.id).toEqual([]);
      expect(flatBlocks(t.document).length, t.id).toBeGreaterThan(0);
    }
  });

  it('has unique ids and a template for each editable kind', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(templatesFor('landing').length).toBeGreaterThan(0);
    expect(templatesFor('home').length).toBeGreaterThan(1);
    expect(templatesFor('page').length).toBeGreaterThan(0);
  });

  it('uses theme tokens for brand colours rather than literals everywhere', () => {
    const home = templatesFor('home')[0].document;
    expect(JSON.stringify(home)).toContain('$primary');
  });
});

describe('store themes', () => {
  it('ships twelve distinct themes', () => {
    expect(THEMES).toHaveLength(12);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(12);
    expect(new Set(THEMES.map((t) => t.palette.primary)).size).toBeGreaterThanOrEqual(11);
  });

  it('every page of every theme validates', () => {
    for (const t of THEMES) {
      for (const [name, doc] of Object.entries(t.pages)) {
        expect(validateDocument(doc), `${t.id}.${name}`).toEqual([]);
        expect(flatBlocks(doc).length, `${t.id}.${name}`).toBeGreaterThan(0);
      }
    }
  });

  it('binds the product template to the page product and the catalogue to the collection', () => {
    for (const t of THEMES) {
      expect(binds(t.pages.product).some((b) => b.expression === '$page.product'), t.id).toBe(true);
      expect(binds(t.pages.catalogue).some((b) => b.expression === '$page.collection'), t.id).toBe(true);
      expect(binds(t.pages.home).some((b) => b.expression === '$catalogue'), t.id).toBe(true);
    }
  });

  it('compiles every theme home with its own header and footer and the brand colour resolved', async () => {
    const catalogue = async () => [{ id: 1, ref: 'x', nameFr: 'X', retailPriceMad: 10, images: [] }];
    for (const t of THEMES) {
      const store = { name: 'Test', primaryColor: t.palette.primary, secondaryColor: t.palette.secondary };
      const out = await compileStoreDocument({
        store, user: { subdomain: 's', pixels: [] }, kind: 'home',
        page: t.pages.home, header: t.pages.header, footer: t.pages.footer, path: '/',
        bindings: { product: null, collection: null, catalogue, storeId: 1 },
      });
      expect(out, t.id).not.toBeNull();
      expect(out!.html, t.id).toContain(t.palette.primary);
      expect(out!.html, t.id).not.toContain('$primary');
      expect(out!.html, t.id).toContain('class="bk bk-sh');
      expect(out!.html, t.id).toContain('class="bk bk-sf"');
    }
  });

  it('compiles every theme product and catalogue page with bound data', async () => {
    const product = { id: 9, ref: 'p9', sku: 'S9', nameFr: 'Produit', retailPriceMad: 99, stockQuantity: 3, images: [], categories: [] };
    const catalogue = async () => [product];
    for (const t of THEMES) {
      const store = { name: 'Test', primaryColor: t.palette.primary, secondaryColor: t.palette.secondary };
      const prod = await compileStoreDocument({
        store, user: { subdomain: 's', pixels: [] }, kind: 'product', page: t.pages.product, header: t.pages.header, footer: t.pages.footer,
        path: '/p/p9', title: 'Produit', bindings: { product, collection: null, catalogue, storeId: 1 },
      });
      expect(prod, t.id + ' product').not.toBeNull();
      expect(prod!.html, t.id + ' product').toContain('data-cart-add="add"');
      expect(prod!.html, t.id + ' product').toContain('<h1>Produit</h1>');
      const cat = await compileStoreDocument({
        store, user: { subdomain: 's', pixels: [] }, kind: 'catalogue', page: t.pages.catalogue, header: t.pages.header, footer: t.pages.footer,
        path: '/products', title: 'Tous les produits', bindings: { product: null, collection: null, catalogue, storeId: 1 },
      });
      expect(cat, t.id + ' catalogue').not.toBeNull();
      expect(cat!.html, t.id + ' catalogue').toContain('"href":"/p/p9"');
    }
  });

  it('summaries carry no page documents', () => {
    for (const s of themeSummaries() as any[]) expect(s.pages).toBeUndefined();
  });
});
