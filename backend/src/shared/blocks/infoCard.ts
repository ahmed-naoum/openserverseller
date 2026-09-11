import { z } from 'zod';
import { defineBlock, color, url, spacing, SPACING_GROUP } from './define.js';

/**
 * The floating card every modern hero seems to carry: a title, a few
 * label/value rows, a progress bar, a button — the "performance metrics"
 * panel beside a villa, the "6 million units installed" card over a solar
 * field, the product card next to a running athlete. In a store it says
 * what matters at a glance: delivery time, availability, a price, a promise.
 *
 * Glass by default (translucent background, blurred backdrop, thin border),
 * solid when asked. Sits in a row column beside a hero, or anywhere else.
 */
export const infoCard = defineBlock({
  type: 'info_card',
  meta: {
    label: { fr: 'Carte info', en: 'Info card', ar: 'بطاقة معلومات' },
    description: {
      fr: 'Carte flottante avec titre, lignes libellé / valeur, barre de progression et bouton. Effet verre ou fond plein.',
      en: 'A floating card with a title, label/value rows, a progress bar and a button. Glass or solid.',
    },
    category: 'content',
    icon: 'CreditCard',
  },
  schema: z
    .object({
      title: z.string().optional(),
      subtitle: z.string().optional(),
      /** A small badge line above the title: "EN STOCK", "ÉDITION LIMITÉE". */
      badge: z.string().optional(),
      badgeColor: color(),
      rows: z.array(z.object({ label: z.string().optional(), value: z.string().optional() }).passthrough()).optional(),
      progressLabel: z.string().optional(),
      progressValue: z.string().optional(),
      progressPct: z.number().optional(),
      progressColor: color(),
      /** A big figure, like a price, shown before the button. */
      figure: z.string().optional(),
      figureCaption: z.string().optional(),
      figureColor: color(),
      ctaText: z.string().optional(),
      ctaUrl: url(),
      ctaBg: color(),
      ctaColor: color(),
      style: z.enum(['glass', 'solid']).optional(),
      bgColor: color(),
      textColor: color(),
      mutedColor: color(),
      borderColor: color(),
      radius: z.number().optional(),
      maxWidth: z.number().optional(),
      align: z.enum(['left', 'center', 'right']).optional(),
      ...spacing,
    })
    .passthrough(),
  defaults: {
    badge: '',
    title: 'Livraison 24/48h',
    subtitle: 'Partout au Maroc, paiement à la réception.',
    rows: [
      { label: 'Délai moyen', value: '24h' },
      { label: 'Frais de livraison', value: 'Offerts dès 300 DH' },
      { label: 'Paiement', value: 'À la réception' },
    ],
    progressLabel: 'Disponibilité',
    progressValue: '92 %',
    progressPct: 92,
    progressColor: '#22c55e',
    figure: '',
    figureCaption: '',
    ctaText: 'Commander maintenant',
    ctaUrl: '/products',
    ctaBg: '#0f172a',
    ctaColor: '#ffffff',
    style: 'glass',
    bgColor: 'rgba(255,255,255,0.86)',
    textColor: '#0f172a',
    mutedColor: '#475569',
    borderColor: 'rgba(255,255,255,0.6)',
    radius: 20,
    maxWidth: 380,
    align: 'right',
    paddingTop: 16,
    paddingBottom: 16,
    marginTop: 0,
    marginBottom: 0,
  },
  inspector: {
    groups: [
      { title: 'Contenu', fields: ['badge', 'title', 'subtitle', 'rows'] },
      { title: 'Progression & chiffre', fields: ['progressLabel', 'progressValue', 'progressPct', 'progressColor', 'figure', 'figureCaption', 'figureColor'] },
      { title: 'Bouton', fields: ['ctaText', 'ctaUrl', 'ctaBg', 'ctaColor'] },
      { title: 'Style', fields: ['style', 'bgColor', 'textColor', 'mutedColor', 'borderColor', 'badgeColor', 'radius', 'maxWidth', 'align'] },
      SPACING_GROUP,
    ],
  },
  presets: {
    dark: { style: 'glass', bgColor: 'rgba(15,23,42,0.72)', textColor: '#ffffff', mutedColor: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.18)', ctaBg: '#ffffff', ctaColor: '#0f172a' },
    solid: { style: 'solid', bgColor: '#ffffff', borderColor: '#e2e8f0' },
  },
  binds: [],
  needsRuntime: false,
  compiled: true,
});
