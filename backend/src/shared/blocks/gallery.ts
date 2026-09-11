import { z } from 'zod';
import { defineBlock, color, url, spacing, SPACING_GROUP } from './define.js';

/**
 * Pictures in a grid — the "featured styles" mosaic of the reference
 * designs, a lookbook, the six views of a workshop. Tiles can span two
 * columns or two rows for a mosaic; a tile with no picture is skipped, so
 * the block is never a grid of grey boxes on a live page.
 */
export const gallery = defineBlock({
  type: 'gallery',
  meta: {
    label: { fr: 'Galerie mosaïque', en: 'Gallery', ar: 'معرض صور' },
    description: {
      fr: 'Grille de photos, avec des tuiles doubles pour une mosaïque. Légendes optionnelles.',
      en: 'A grid of photos, with double tiles for a mosaic. Optional captions.',
    },
    category: 'media',
    icon: 'LayoutGrid',
  },
  schema: z
    .object({
      images: z
        .array(
          z.object({
            url: url(),
            alt: z.string().optional(),
            caption: z.string().optional(),
            href: url(),
            /** 1 or 2: how many columns the tile takes. */
            span: z.number().optional(),
            /** 1 or 2: how many rows the tile takes. */
            rows: z.number().optional(),
          }).passthrough()
        )
        .optional(),
      columns: z.number().optional(),
      gap: z.number().optional(),
      radius: z.number().optional(),
      /** Height of one row in px. */
      rowHeight: z.number().optional(),
      captionColor: color(),
      captionBg: color(),
      hover: z.enum(['none', 'zoom', 'lift']).optional(),
      ...spacing,
    })
    .passthrough(),
  defaults: {
    images: [],
    columns: 4,
    gap: 12,
    radius: 16,
    rowHeight: 220,
    captionColor: '#ffffff',
    captionBg: 'rgba(0,0,0,0.45)',
    hover: 'zoom',
    paddingTop: 8,
    paddingBottom: 8,
    marginTop: 0,
    marginBottom: 0,
  },
  inspector: {
    groups: [
      { title: 'Photos', fields: ['images'] },
      { title: 'Grille', fields: ['columns', 'gap', 'radius', 'rowHeight', 'hover'] },
      { title: 'Légendes', fields: ['captionColor', 'captionBg'] },
      SPACING_GROUP,
    ],
  },
  binds: [],
  needsRuntime: false,
  compiled: true,
});
