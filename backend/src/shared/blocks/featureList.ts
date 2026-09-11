import { z } from 'zod';
import { defineBlock, color, spacing, SPACING_GROUP } from './define.js';

/**
 * A heading, a paragraph and a list of points with check marks — the
 * "design innovation" panel of the reference designs, the "what's in the
 * box" list of a product page, the reasons-to-believe under a hero. Sits
 * alone or in a row column beside a picture.
 */
export const featureList = defineBlock({
  type: 'feature_list',
  meta: {
    label: { fr: 'Liste d’avantages', en: 'Feature list', ar: 'قائمة المزايا' },
    description: {
      fr: 'Titre, paragraphe et points forts avec coches, sur une ou deux colonnes.',
      en: 'A heading, a paragraph and check-marked points, in one or two columns.',
    },
    category: 'content',
    icon: 'ListChecks',
  },
  schema: z
    .object({
      kicker: z.string().optional(),
      title: z.string().optional(),
      text: z.string().optional(),
      items: z.array(z.object({ title: z.string().optional(), text: z.string().optional(), icon: z.string().optional() }).passthrough()).optional(),
      columns: z.number().optional(),
      /** The mark before each point: a check, a dot, a number, or the item's own icon. */
      marker: z.enum(['check', 'dot', 'number', 'icon']).optional(),
      align: z.enum(['left', 'center']).optional(),
      titleSize: z.enum(['md', 'lg', 'xl']).optional(),
      uppercase: z.boolean().optional(),
      titleColor: color(),
      textColor: color(),
      markerColor: color(),
      ctaText: z.string().optional(),
      ctaUrl: z.string().optional(),
      ctaBg: color(),
      ctaColor: color(),
      maxWidth: z.number().optional(),
      ...spacing,
    })
    .passthrough(),
  defaults: {
    kicker: '',
    title: 'Pourquoi nos clients reviennent',
    text: 'Des produits choisis un à un, livrés vite, payés à la réception.',
    items: [
      { title: 'Livraison 24/48h', text: 'Partout au Maroc, suivi par WhatsApp.' },
      { title: 'Paiement à la réception', text: 'Vous payez le livreur, en espèces.' },
      { title: 'Échange sous 7 jours', text: 'Un article abîmé est repris sans frais.' },
      { title: 'Support 7j/7', text: 'Une vraie personne répond à vos questions.' },
    ],
    columns: 2,
    marker: 'check',
    align: 'left',
    titleSize: 'lg',
    uppercase: false,
    titleColor: '#0f172a',
    textColor: '#475569',
    markerColor: '#16a34a',
    ctaText: '',
    ctaUrl: '/products',
    ctaBg: '#0f172a',
    ctaColor: '#ffffff',
    maxWidth: 0,
    paddingTop: 16,
    paddingBottom: 16,
    marginTop: 0,
    marginBottom: 0,
  },
  inspector: {
    groups: [
      { title: 'Contenu', fields: ['kicker', 'title', 'text', 'items'] },
      { title: 'Style', fields: ['columns', 'marker', 'align', 'titleSize', 'uppercase', 'maxWidth'] },
      { title: 'Couleurs', fields: ['titleColor', 'textColor', 'markerColor'] },
      { title: 'Bouton', fields: ['ctaText', 'ctaUrl', 'ctaBg', 'ctaColor'] },
      SPACING_GROUP,
    ],
  },
  binds: [],
  needsRuntime: false,
  compiled: true,
});
