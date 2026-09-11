import { z } from 'zod';
import { defineBlock, color, spacing, SPACING_GROUP } from './define.js';

export const products = defineBlock({
  type: 'products',
  meta: {
    label: { fr: 'Propositions Produits', en: 'Product grid', ar: 'شبكة المنتجات' },
    description: {
      fr: 'Grille ou carrousel dynamique de produits issus de votre catalogue.',
      en: 'A grid or carousel of products from the catalogue.',
    },
    category: 'commerce',
    icon: 'ShoppingBag',
  },
  schema: z
    .object({
      /** Accounts whose catalogue feeds the block. Usually just the owner. */
      accountIds: z.array(z.number()).optional(),
      /** Explicit product ids; empty means the whole catalogue of `accountIds`. */
      selectedProducts: z.array(z.number()).optional(),
      layoutType: z.enum(['grid', 'slider']).optional(),
      gridCols: z.number().optional(),
      showPrice: z.boolean().optional(),
      cardBg: color(),
      cardRadius: z.number().optional(),
      cardShadow: z.enum(['none', 'sm', 'md', 'lg', 'xl']).optional(),
      titleColor: color(),
      descColor: color(),
      priceColor: color(),
      btnBg: color(),
      btnColor: color(),
      /** card: surface, border and shadow. flat: picture and text on the page, no box. minimal: no box, no button, a text link. */
      cardStyle: z.enum(['card', 'flat', 'minimal']).optional(),
      /** The picture box height in px (192 by default). */
      imageHeight: z.number().optional(),
      imageFit: z.enum(['contain', 'cover']).optional(),
      buttonStyle: z.enum(['solid', 'outline', 'text']).optional(),
      buttonRadius: z.number().optional(),
      buttonText: z.string().optional(),
      titleAlign: z.enum(['left', 'center']).optional(),
      animationType: z.string().optional(),
      autoPlay: z.boolean().optional(),
      autoPlaySpeed: z.number().optional(),
      slideStep: z.number().optional(),
      ...spacing,
    })
    .passthrough(),
  defaults: {
    accountIds: [],
    layoutType: 'grid',
    selectedProducts: [],
    gridCols: 3,
    cardBg: '#ffffff',
    cardRadius: 16,
    cardShadow: 'md',
    titleColor: '#0f172a',
    descColor: '#64748b',
    priceColor: '#ea580c',
    btnBg: '#ea580c',
    btnColor: '#ffffff',
    paddingTop: 32,
    paddingBottom: 32,
    marginTop: 0,
    marginBottom: 0,
  },
  inspector: {
    groups: [
      { title: 'Produits', fields: ['accountIds', 'selectedProducts', 'showPrice'] },
      { title: 'Disposition', fields: ['layoutType', 'gridCols', 'animationType', 'autoPlay', 'autoPlaySpeed', 'slideStep'] },
      { title: 'Style', fields: ['cardStyle', 'cardBg', 'cardRadius', 'cardShadow', 'imageHeight', 'imageFit', 'titleAlign', 'titleColor', 'descColor', 'priceColor'] },
      { title: 'Bouton', fields: ['buttonText', 'buttonStyle', 'buttonRadius', 'btnBg', 'btnColor'] },
      SPACING_GROUP,
    ],
  },
  // The catalogue is resolved at run time today (and against an endpoint that
  // does not exist — see the compiler's products block). Declaring the bind is
  // what lets the store compiler resolve it at compile time instead.
  binds: ['items'],
  needsRuntime: true,
  compiled: true,
});
