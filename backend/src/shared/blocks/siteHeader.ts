import { z } from 'zod';
import { defineBlock, color, url, link } from './define.js';

export const siteHeader = defineBlock({
  type: 'site_header',
  meta: {
    label: { fr: 'En-tête du site', en: 'Site header', ar: 'رأس الموقع' },
    description: {
      fr: "Barre d'annonce, logo, menu de navigation et bouton d'action. Compilé avec la page, sans JavaScript au chargement.",
      en: 'Announcement bar, logo, navigation and call to action. Compiles with the page; no script on load.',
    },
    category: 'chrome',
    icon: 'PanelTop',
    badge: 'Rapide',
  },
  schema: z
    .object({
      brandText: z.string().optional(),
      logoUrl: url(),
      logoHeight: z.number().optional(),
      bgColor: color(),
      textColor: color(),
      borderColor: color(),
      sticky: z.boolean().optional(),
      align: z.enum(['left', 'center']).optional(),
      /** Brand between the links and the actions, the boutique way. */
      brandAlign: z.enum(['left', 'center']).optional(),
      /** Laid over the section below it, with no background of its own. */
      overlay: z.boolean().optional(),
      linkCase: z.enum(['normal', 'upper']).optional(),
      announcementActive: z.boolean().optional(),
      announcementText: z.string().optional(),
      announcementBg: color(),
      announcementColor: color(),
      links: z.array(link).optional(),
      showCart: z.boolean().optional(),
      /** A search icon linking to the catalogue, and an account icon linking to order tracking. */
      showSearch: z.boolean().optional(),
      showAccount: z.boolean().optional(),
      cartUrl: url(),
      cartBg: color(),
      ctaText: z.string().optional(),
      ctaUrl: url(),
      ctaBg: color(),
      ctaColor: color(),
      ctaRadius: z.number().optional(),
      /** A quieter second button before the main one: "Se connecter", "Nous écrire". */
      secondaryText: z.string().optional(),
      secondaryUrl: url(),
    })
    .passthrough(),
  defaults: {
    brandText: 'MA BOUTIQUE',
    logoUrl: '',
    logoHeight: 36,
    bgColor: '#ffffff',
    textColor: '#0f172a',
    borderColor: '#e2e8f0',
    sticky: true,
    announcementActive: true,
    announcementText: 'Livraison express 24/48h partout au Maroc — Paiement à la livraison !',
    announcementBg: '#0f172a',
    announcementColor: '#ffffff',
    links: [
      { label: 'Accueil', url: '/' },
      { label: 'Tous les Produits', url: '/products' },
    ],
    showCart: true,
    cartUrl: '/cart',
    ctaText: '',
    ctaUrl: '',
    ctaBg: '#ea580c',
    ctaColor: '#ffffff',
  },
  presets: {
    minimal: { announcementActive: false, showCart: false, links: [] },
    'landing-cta': { links: [], showCart: false, ctaText: 'Commander', ctaUrl: '' },
  },
  inspector: {
    groups: [
      { title: 'Marque', fields: ['brandText', 'logoUrl', 'logoHeight'] },
      { title: 'Annonce', fields: ['announcementActive', 'announcementText', 'announcementBg', 'announcementColor'] },
      { title: 'Menu', fields: ['links'] },
      { title: 'Actions', fields: ['showCart', 'showSearch', 'showAccount', 'cartUrl', 'cartBg', 'ctaText', 'ctaUrl', 'ctaBg', 'ctaColor', 'ctaRadius', 'secondaryText', 'secondaryUrl'] },
      { title: 'Style', fields: ['bgColor', 'textColor', 'borderColor', 'sticky', 'align', 'brandAlign', 'overlay', 'linkCase'] },
    ],
  },
  binds: [],
  needsRuntime: true,
  compiled: true,
});
