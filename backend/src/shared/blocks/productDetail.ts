import { z } from 'zod';
import { defineBlock, color, spacing, SPACING_GROUP } from './define.js';

/**
 * A product, in full: gallery, name, price, description, add to cart.
 *
 * The first block whose content is not in the page. It is BOUND: the product
 * template carries one of these with `bind: { product: '$page.product' }`, and
 * the store compiler resolves that per URL, so `/p/creme-x` and `/p/serum-y`
 * are the same template compiled twice with different data. The builder
 * canvas shows a sample product in its place.
 *
 * `product` is therefore a prop the seller never edits directly; it arrives
 * from the binding. It is in the schema so a resolved document validates.
 */
export const productDetail = defineBlock({
  type: 'product_detail',
  meta: {
    label: { fr: 'Fiche produit', en: 'Product detail', ar: 'صفحة المنتج' },
    description: {
      fr: 'Galerie, nom, prix, description et bouton « Ajouter au panier ». Se remplit avec le produit de la page.',
      en: 'Gallery, name, price, description and add-to-cart, filled from the page\'s product.',
    },
    category: 'commerce',
    icon: 'ShoppingBag',
    badge: 'Lié',
  },
  schema: z
    .object({
      /** Resolved by the compiler from the binding; never authored. */
      product: z.any().optional(),
      showGallery: z.boolean().optional(),
      showDescription: z.boolean().optional(),
      showStock: z.boolean().optional(),
      buttonText: z.string().optional(),
      buyNowText: z.string().optional(),
      showBuyNow: z.boolean().optional(),
      priceColor: color(),
      buttonBg: color(),
      buttonColor: color(),
      ...spacing,
    })
    .passthrough(),
  defaults: {
    showGallery: true,
    showDescription: true,
    showStock: true,
    buttonText: 'Ajouter au panier',
    buyNowText: 'Commander maintenant',
    showBuyNow: true,
    priceColor: '$primary',
    buttonBg: '$primary',
    buttonColor: '#ffffff',
    paddingTop: 24,
    paddingBottom: 24,
    marginTop: 0,
    marginBottom: 0,
  },
  inspector: {
    groups: [
      { title: 'Affichage', fields: ['showGallery', 'showDescription', 'showStock', 'showBuyNow'] },
      { title: 'Boutons', fields: ['buttonText', 'buyNowText', 'buttonBg', 'buttonColor', 'priceColor'] },
      SPACING_GROUP,
    ],
  },
  binds: ['product'],
  needsRuntime: true,
  compiled: true,
});
