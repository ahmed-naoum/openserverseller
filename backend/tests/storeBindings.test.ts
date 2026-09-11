import { describe, it, expect } from 'vitest';
import { resolveBindings, normaliseProduct } from '../src/services/storeCompiler/bindings.js';
import { compileStoreDocument } from '../src/services/storeCompiler/index.js';
import { DEFAULT_TEMPLATES } from '../src/services/store.service.js';
import { fromLegacy } from '../src/shared/document/index.js';

const product = {
  id: 316, ref: 'poils', sku: 'SKU-316', nameFr: 'Crème poils', description: 'Une crème.', retailPriceMad: 50, stockQuantity: 12,
  images: [{ id: 1, url: '/uploads/a.jpg' }, { id: 2, url: '/uploads/b.jpg' }], categories: [{ nameFr: 'Soins' }],
};
const catalogue = async () => [product, { ...product, id: 314, ref: 'vitiligo', nameFr: 'Vitiligo', retailPriceMad: 38, images: [] }];
const store = { name: 'jilaliy', primaryColor: '#0f172a' };
const user = { subdomain: 'abdo', pixels: [] };

describe('bindings', () => {
  it('fills a bound prop and stamps the store id on every block', async () => {
    const doc = await resolveBindings(DEFAULT_TEMPLATES.product, { product, collection: null, catalogue, storeId: 1 });
    const block: any = doc.root[0].children[0];
    expect(block.props.product.id).toBe(316);
    expect(block.props.product.images[0].imageUrl).toBe('/uploads/a.jpg');
    expect(block.props.product.href).toBe('/p/poils');
    expect(block.props.storeId).toBe(1);
  });

  it('resolves a catalogue and a collection', async () => {
    const doc = await resolveBindings(DEFAULT_TEMPLATES.catalogue, { product: null, collection: { slug: 'soins' }, catalogue, storeId: 1 });
    const block: any = doc.root[0].children[0];
    expect(block.props.items).toHaveLength(2);
    expect(block.props.items[1].href).toBe('/p/vitiligo');
  });

  it('resolves an unknown expression to nothing instead of failing', async () => {
    const doc = fromLegacy([{ id: 'x', type: 'products', content: {} }]);
    (doc.root[0].children[0] as any).bind = { items: '$mystery' };
    const out = await resolveBindings(doc, { product: null, collection: null, catalogue, storeId: 1 });
    expect((out.root[0].children[0] as any).props.items).toBeUndefined();
  });

  it('normalises image fields both ways', () => {
    const p = normaliseProduct({ id: 1, images: [{ imageUrl: '/x.jpg' }] }, 7);
    expect(p.images[0].url).toBe('/x.jpg');
    expect(p.href).toBe('/p/1');
    expect(p.storeId).toBe(7);
  });
});

describe('compiled product page', () => {
  it('renders the bound product with gallery, price, stock and the cart buttons', async () => {
    const out = (await compileStoreDocument({
      store, user, kind: 'product', page: DEFAULT_TEMPLATES.product, header: null, footer: null,
      path: '/p/poils', title: 'Crème poils',
      bindings: { product, collection: null, catalogue, storeId: 1 },
    }))!;
    expect(out.html).toContain('<title>Crème poils — jilaliy</title>');
    expect(out.html).toContain('<h1>Crème poils</h1>');
    expect(out.html).toContain('50<small>MAD</small>');
    expect(out.html).toContain('En stock');
    expect(out.html).toContain('data-cart-add="add"');
    expect(out.html).toContain('data-cart-add="buy"');
    expect(out.html).toContain('"storeId":1');
    expect(out.html).toContain('store_cart_');
    expect(out.html).toContain('/uploads/b.jpg');
    // $primary on the default template resolved against the store
    expect(out.html).toContain('background:#0f172a;color:#ffffff');
  });

  it('shows the out-of-stock state without buttons', async () => {
    const out = (await compileStoreDocument({
      store, user, kind: 'product', page: DEFAULT_TEMPLATES.product, header: null, footer: null, path: '/p/x',
      bindings: { product: { ...product, stockQuantity: 0 }, collection: null, catalogue, storeId: 1 },
    }))!;
    expect(out.html).toContain('Rupture de stock');
    // No buttons in the markup; the runtime script still carries the selector.
    expect(out.html).not.toContain('class="bk-pd-b"');
  });

  it('renders the placeholder when nothing is bound', async () => {
    const out = (await compileStoreDocument({
      store, user, kind: 'page', page: DEFAULT_TEMPLATES.product, header: null, footer: null, path: '/pages/x',
    }))!;
    expect(out.html).toContain('se remplit avec le produit de la page');
  });
});

describe('compiled catalogue page', () => {
  it('ships the resolved items in the products block and links cards to product pages', async () => {
    const out = (await compileStoreDocument({
      store, user, kind: 'catalogue', page: DEFAULT_TEMPLATES.catalogue, header: null, footer: null, path: '/products', title: 'Tous les produits',
      bindings: { product: null, collection: null, catalogue, storeId: 1 },
    }))!;
    expect(out.html).toContain('"items":[');
    expect(out.html).toContain('"href":"/p/poils"');
    expect(out.html).not.toContain('products-by-accounts?accountIds=' + '"');
    expect(out.html).toContain('product.href');
  });
});
