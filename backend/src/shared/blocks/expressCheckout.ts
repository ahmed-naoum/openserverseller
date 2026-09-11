import { z } from 'zod';
import { defineBlock, color, spacing, SPACING_GROUP } from './define.js';

/**
 * One pack the customer can pick. `id` is the join key the lead stores as
 * `variantOptionId`; `name` is what `getPackPrice` falls back to matching. A
 * pack's `price` is the whole bundle's total and `quantity` is how many units
 * it moves from stock — see lib/leadPricing.ts for why those never mix.
 */
export const packOption = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    name: z.string().optional(),
    price: z.union([z.number(), z.string()]).optional(),
    oldPrice: z.union([z.number(), z.string()]).optional(),
    quantity: z.union([z.number(), z.string()]).optional(),
    badge: z.string().optional(),
    description: z.string().optional(),
  })
  .passthrough();

export const expressCheckout = defineBlock({
  type: 'express_checkout',
  meta: {
    label: { fr: 'Formulaire Checkout (COD)', en: 'Checkout form', ar: 'نموذج الطلب' },
    description: {
      fr: 'Formulaire de commande optimisé pour le paiement à la livraison (packs, villes, prix barré).',
      en: 'The cash-on-delivery order form: packs, cities, strike-through price.',
    },
    category: 'commerce',
    icon: 'ShoppingCart',
    badge: 'Essentiel',
  },
  schema: z
    .object({
      title: z.string().optional(),
      subtitle: z.string().optional(),
      buttonText: z.string().optional(),
      nameLabel: z.string().optional(),
      namePlaceholder: z.string().optional(),
      phoneLabel: z.string().optional(),
      phonePlaceholder: z.string().optional(),
      cityLabel: z.string().optional(),
      cityPlaceholder: z.string().optional(),
      addressLabel: z.string().optional(),
      addressPlaceholder: z.string().optional(),

      options: z.array(packOption).optional(),

      showPrice: z.boolean().optional(),
      showOldPrice: z.boolean().optional(),
      oldPriceValue: z.union([z.number(), z.string()]).optional(),
      currency: z.string().optional(),

      themeColor: color(),
      formBgColor: color(),
      containerBgColor: color(),
      bgColor: color(),
      borderColor: color(),
      borderWidth: z.number().optional(),
      borderRadiusTL: z.number().optional(),
      borderRadiusTR: z.number().optional(),
      borderRadiusBL: z.number().optional(),
      borderRadiusBR: z.number().optional(),
      priceColor: color(),
      priceSize: z.number().optional(),
      oldPriceColor: color(),
      oldPriceSize: z.number().optional(),
      packColor: color(),
      packBorderWidth: z.number().optional(),
      packBorderRadius: z.number().optional(),
      buttonSize: z.number().optional(),
      buttonTextColor: color(),
      buttonBorderRadius: z.number().optional(),
      paddingLeft: z.number().optional(),
      paddingRight: z.number().optional(),
      ...spacing,
    })
    .passthrough(),
  defaults: {
    title: 'اطلب الآن (الدفع عند الاستلام)',
    subtitle: 'املأ النموذج أدناه لتأكيد طلبك. التوصيل مجاني والدفع عند الاستلام.',
    buttonText: 'تأكيد الطلب',
    themeColor: '#ea580c',
    formBgColor: '#ffffff',
    containerBgColor: '#ffffff',
    nameLabel: 'الاسم الكامل *',
    namePlaceholder: 'مثال: يوسف بن جلون',
    phoneLabel: 'رقم الهاتف *',
    phonePlaceholder: '06 XX XX XX XX',
    cityLabel: 'المدينة *',
    cityPlaceholder: 'مثال: الدار البيضاء',
    addressLabel: 'العنوان (اختياري)',
    addressPlaceholder: 'عنوانك الكامل لترهين التوصيل...',
    borderRadiusTL: 16,
    borderRadiusTR: 16,
    borderRadiusBL: 16,
    borderRadiusBR: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    priceColor: '#ea580c',
    priceSize: 32,
    showPrice: true,
    options: [],
    packColor: '#ea580c',
    packBorderWidth: 2,
    packBorderRadius: 16,
    paddingTop: 32,
    paddingBottom: 32,
    paddingLeft: 16,
    paddingRight: 16,
    marginTop: 0,
    marginBottom: 0,
  },
  inspector: {
    groups: [
      { title: 'Textes', fields: ['title', 'subtitle', 'buttonText'] },
      { title: 'Packs & prix', fields: ['options', 'showPrice', 'showOldPrice', 'oldPriceValue', 'currency'] },
      { title: 'Champs', fields: ['nameLabel', 'namePlaceholder', 'phoneLabel', 'phonePlaceholder', 'cityLabel', 'cityPlaceholder', 'addressLabel', 'addressPlaceholder'] },
      { title: 'Couleurs', fields: ['themeColor', 'formBgColor', 'containerBgColor', 'borderColor', 'priceColor', 'oldPriceColor', 'packColor', 'buttonTextColor'] },
      { title: 'Formes', fields: ['borderWidth', 'borderRadiusTL', 'borderRadiusTR', 'borderRadiusBL', 'borderRadiusBR', 'priceSize', 'oldPriceSize', 'packBorderWidth', 'packBorderRadius', 'buttonSize', 'buttonBorderRadius'] },
      { title: 'Espacement', fields: ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'marginTop', 'marginBottom'] },
    ],
  },
  // The prop a store page binds to its product; a landing page fixes it instead.
  binds: ['product'],
  needsRuntime: true,
  compiled: true,
});
