import { z } from 'zod';
import { defineBlock, url, spacing, SPACING_GROUP } from './define.js';

export const image = defineBlock({
  type: 'image',
  meta: {
    label: { fr: 'Image & Bannière', en: 'Image', ar: 'صورة' },
    description: {
      fr: 'Image haute résolution avec contrôle de largeur, hauteur et espacement.',
      en: 'A picture with width, height and spacing control.',
    },
    category: 'media',
    icon: 'Image',
  },
  schema: z
    .object({
      url: url(),
      alt: z.string().optional(),
      /** Percentage of the column, 1–100. */
      width: z.number().optional(),
      maxHeight: z.number().optional(),
      /** Legacy: older rows store a fixed height instead of maxHeight. */
      height: z.number().optional(),
      ...spacing,
    })
    .passthrough(),
  defaults: {
    url: '',
    height: 500,
    width: 100,
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  inspector: {
    groups: [
      { title: 'Média', fields: ['url', 'alt'] },
      { title: 'Taille', fields: ['width', 'maxHeight'] },
      SPACING_GROUP,
    ],
  },
  binds: [],
  needsRuntime: false,
  compiled: true,
});
