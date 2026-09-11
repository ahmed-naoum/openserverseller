import { z } from 'zod';
import { defineBlock, spacing, SPACING_GROUP } from './define.js';

export const countdown = defineBlock({
  type: 'countdown',
  meta: {
    label: { fr: "Compteur d'Urgence", en: 'Countdown', ar: 'عداد تنازلي' },
    description: {
      fr: "Bannière de compte à rebours pour stimuler l'achat impulsif.",
      en: 'A ticking banner that creates urgency.',
    },
    category: 'conversion',
    icon: 'Clock',
  },
  schema: z
    .object({
      text: z.string().optional(),
      ...spacing,
    })
    .passthrough(),
  defaults: {
    text: "🔥 L'offre flash expire bientôt !",
    paddingTop: 16,
    paddingBottom: 16,
    marginTop: 0,
    marginBottom: 8,
  },
  inspector: {
    groups: [{ title: 'Contenu', fields: ['text'] }, SPACING_GROUP],
  },
  binds: [],
  needsRuntime: false,
  compiled: true,
});
