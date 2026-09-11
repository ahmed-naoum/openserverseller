import { z } from 'zod';
import { defineBlock, color, url, link } from './define.js';

export const siteFooter = defineBlock({
  type: 'site_footer',
  meta: {
    label: { fr: 'Pied de page', en: 'Site footer', ar: 'تذييل الموقع' },
    description: {
      fr: 'Marque, colonnes de liens, badges de confiance, réseaux sociaux et mentions légales.',
      en: 'Brand, link columns, trust badges, social links and the legal line.',
    },
    category: 'chrome',
    icon: 'PanelBottom',
  },
  schema: z
    .object({
      brandText: z.string().optional(),
      logoUrl: url(),
      logoHeight: z.number().optional(),
      about: z.string().optional(),
      badges: z.array(z.string()).optional(),
      columns: z
        .array(
          z
            .object({
              title: z.string().optional(),
              links: z.array(link).optional(),
            })
            .passthrough()
        )
        .optional(),
      socials: z
        .object({
          instagram: url(),
          facebook: url(),
          tiktok: url(),
          whatsapp: url(),
        })
        .passthrough()
        .optional(),
      copyright: z.string().optional(),
      note: z.string().optional(),
      bgColor: color(),
      textColor: color(),
      mutedColor: color(),
      borderColor: color(),
      paddingTop: z.number().optional(),
      paddingBottom: z.number().optional(),
    })
    .passthrough(),
  defaults: {
    brandText: 'MA BOUTIQUE',
    logoUrl: '',
    logoHeight: 40,
    about: 'Des produits sélectionnés, livrés partout au Maroc avec paiement à la livraison.',
    bgColor: '#0f172a',
    textColor: '#ffffff',
    mutedColor: 'rgba(255,255,255,0.7)',
    borderColor: 'rgba(255,255,255,0.14)',
    badges: ['Livraison 24/48h', 'Paiement à la livraison', 'Support 7j/7'],
    columns: [
      {
        title: 'Boutique',
        links: [
          { label: 'Tous les produits', url: '/products' },
          { label: 'Mon panier', url: '/cart' },
        ],
      },
      {
        title: 'Informations',
        links: [
          { label: 'Livraison & retours', url: '/pages/livraison' },
          { label: 'Nous contacter', url: '/pages/contact' },
        ],
      },
    ],
    socials: { instagram: '', facebook: '', tiktok: '', whatsapp: '' },
    copyright: '© 2026 Ma Boutique. Tous droits réservés.',
    note: 'Paiement à la livraison — partout au Maroc',
    paddingTop: 48,
    paddingBottom: 32,
  },
  presets: {
    light: { bgColor: '#f8fafc', textColor: '#0f172a', mutedColor: '#475569', borderColor: '#e2e8f0' },
  },
  inspector: {
    groups: [
      { title: 'Marque', fields: ['brandText', 'logoUrl', 'logoHeight', 'about', 'badges'] },
      { title: 'Colonnes', fields: ['columns'] },
      { title: 'Réseaux', fields: ['socials'] },
      { title: 'Bas de page', fields: ['copyright', 'note'] },
      { title: 'Style', fields: ['bgColor', 'textColor', 'mutedColor', 'borderColor', 'paddingTop', 'paddingBottom'] },
    ],
  },
  binds: [],
  needsRuntime: false,
  compiled: true,
});
