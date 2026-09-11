import { z } from 'zod';
import { defineBlock, color, url, spacing, SPACING_GROUP } from './define.js';

/**
 * One customer, one big sentence. The testimonial band of the reference
 * designs: a large quotation, the stars, the name and city, optionally a
 * portrait — on a coloured band or on the page ground.
 */
export const quote = defineBlock({
  type: 'quote',
  meta: {
    label: { fr: 'Grande citation', en: 'Quote', ar: 'اقتباس' },
    description: {
      fr: 'Un témoignage en grand : phrase, étoiles, prénom et ville, portrait optionnel.',
      en: 'One testimonial, large: the sentence, the stars, the name and city, an optional portrait.',
    },
    category: 'engagement',
    icon: 'Quote',
  },
  schema: z
    .object({
      text: z.string().optional(),
      author: z.string().optional(),
      role: z.string().optional(),
      stars: z.number().optional(),
      avatarUrl: url(),
      /** A short label above the sentence: "Avis vérifié", "Ils en parlent". */
      kicker: z.string().optional(),
      align: z.enum(['left', 'center']).optional(),
      size: z.enum(['md', 'lg', 'xl']).optional(),
      serif: z.boolean().optional(),
      textColor: color(),
      mutedColor: color(),
      starColor: color(),
      maxWidth: z.number().optional(),
      ...spacing,
    })
    .passthrough(),
  defaults: {
    text: 'Absolument délicieux ! Livré en deux jours, emballé avec soin. Je recommande les yeux fermés.',
    author: 'Imane L.',
    role: 'Casablanca',
    stars: 5,
    avatarUrl: '',
    kicker: '',
    align: 'center',
    size: 'lg',
    serif: false,
    textColor: '#0f172a',
    mutedColor: '#64748b',
    starColor: '#f59e0b',
    maxWidth: 820,
    paddingTop: 24,
    paddingBottom: 24,
    marginTop: 0,
    marginBottom: 0,
  },
  inspector: {
    groups: [
      { title: 'Contenu', fields: ['kicker', 'text', 'author', 'role', 'stars', 'avatarUrl'] },
      { title: 'Style', fields: ['align', 'size', 'serif', 'maxWidth'] },
      { title: 'Couleurs', fields: ['textColor', 'mutedColor', 'starColor'] },
      SPACING_GROUP,
    ],
  },
  binds: [],
  needsRuntime: false,
  compiled: true,
});
