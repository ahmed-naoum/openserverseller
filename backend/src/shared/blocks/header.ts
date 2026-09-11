import { z } from 'zod';
import { defineBlock, color, spacing, SPACING_GROUP } from './define.js';

/**
 * The original brand bar: a name on a coloured strip. Predates `site_header`,
 * which is the real page header; this one stays for the pages that carry it.
 */
export const header = defineBlock({
  type: 'header',
  meta: {
    label: { fr: 'En-tête de Marque', en: 'Brand bar', ar: 'شريط العلامة' },
    description: {
      fr: 'Barre de marque supérieure avec logo ou texte.',
      en: 'A top strip carrying the brand name.',
    },
    category: 'chrome',
    icon: 'Type',
  },
  schema: z
    .object({
      text: z.string().optional(),
      bgColor: color(),
      color: color(),
      ...spacing,
    })
    .passthrough(),
  defaults: {
    text: 'MON ENTREPRISE',
    bgColor: '#0f172a',
    color: '#ffffff',
    paddingTop: 16,
    paddingBottom: 16,
    marginTop: 0,
    marginBottom: 0,
  },
  inspector: {
    groups: [
      { title: 'Contenu', fields: ['text'] },
      { title: 'Couleurs', fields: ['bgColor', 'color'] },
      SPACING_GROUP,
    ],
  },
  binds: [],
  needsRuntime: false,
  compiled: true,
});
