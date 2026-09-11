import { z } from 'zod';
import { defineBlock } from './define.js';

export const spacer = defineBlock({
  type: 'spacer',
  meta: {
    label: { fr: "Séparateur d'Espace", en: 'Spacer', ar: 'فاصل' },
    description: {
      fr: 'Espacement vertical ajustable en pixels.',
      en: 'Vertical breathing room, in pixels.',
    },
    category: 'content',
    icon: 'Space',
  },
  schema: z
    .object({
      height: z.number().optional(),
    })
    .passthrough(),
  defaults: { height: 32 },
  inspector: {
    groups: [{ title: 'Taille', fields: ['height'] }],
  },
  binds: [],
  needsRuntime: false,
  compiled: true,
});
