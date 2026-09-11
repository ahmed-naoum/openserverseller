import { z } from 'zod';
import { defineBlock, color, spacing, SPACING_GROUP } from './define.js';

export const text = defineBlock({
  type: 'text',
  meta: {
    label: { fr: 'Texte & Paragraphe', en: 'Text', ar: 'نص' },
    description: {
      fr: 'Bloc de texte personnalisable avec alignement horizontal et vertical.',
      en: 'A paragraph or section heading with alignment control.',
    },
    category: 'content',
    icon: 'Type',
  },
  schema: z
    .object({
      text: z.string().optional(),
      isHeading: z.boolean().optional(),
      color: color(),
      align: z.enum(['left', 'center', 'right']).optional(),
      verticalAlign: z.enum(['top', 'center', 'bottom']).optional(),
      /** Type scale: a heading goes 20/24/32/40px, a paragraph 14/16/18/20px. */
      size: z.enum(['sm', 'md', 'lg', 'xl']).optional(),
      weight: z.enum(['normal', 'medium', 'bold', 'black']).optional(),
      uppercase: z.boolean().optional(),
      /** Letter spacing, for small capitals and labels. */
      tracking: z.enum(['tight', 'normal', 'wide']).optional(),
      ...spacing,
    })
    .passthrough(),
  defaults: {
    text: 'Nouveau paragraphe de description.',
    isHeading: false,
    color: '#334155',
    align: 'left',
    verticalAlign: 'center',
    paddingTop: 16,
    paddingBottom: 16,
    marginTop: 0,
    marginBottom: 0,
  },
  inspector: {
    groups: [
      { title: 'Contenu', fields: ['text', 'isHeading'] },
      { title: 'Style', fields: ['color', 'align', 'verticalAlign', 'size', 'weight', 'uppercase', 'tracking'] },
      SPACING_GROUP,
    ],
  },
  binds: [],
  needsRuntime: false,
  compiled: true,
});
