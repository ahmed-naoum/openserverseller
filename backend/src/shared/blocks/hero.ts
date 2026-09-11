import { z } from 'zod';
import { defineBlock, color, url, spacing, SPACING_GROUP } from './define.js';

/**
 * The hero: a headline, a supporting line, and — since the themes started
 * cloning real storefront designs — everything a modern opening band has:
 * a kicker, a photograph or gradient behind the copy with an overlay, left
 * alignment and giant type, a highlighted word in the title, and one or two
 * buttons inline under the copy instead of stacked button blocks.
 *
 * Every field is opt-in. A block that carries only title and subtitle
 * compiles to the same centred band it always did.
 */
export const hero = defineBlock({
  type: 'hero',
  meta: {
    label: { fr: 'Section Hero', en: 'Hero', ar: 'القسم الرئيسي' },
    description: {
      fr: 'Grand titre avec sous-titre, photo ou dégradé en fond, mot mis en couleur et boutons intégrés.',
      en: 'A large headline with a supporting line, a photo or gradient behind it, a highlighted word and inline buttons.',
    },
    category: 'content',
    icon: 'Heading',
  },
  schema: z
    .object({
      title: z.string().optional(),
      subtitle: z.string().optional(),
      /** A short line above the title: "NOUVELLE COLLECTION". */
      kicker: z.string().optional(),
      kickerStyle: z.enum(['plain', 'pill', 'line']).optional(),
      kickerColor: color(),
      /** A word or phrase of the title drawn in `highlightColor`. */
      highlight: z.string().optional(),
      highlightColor: color(),
      /** How the highlight is drawn: coloured, underlined with a brush stroke, or on a marker band. */
      highlightStyle: z.enum(['color', 'underline', 'mark']).optional(),
      /** The band's background: a colour, or a linear-gradient(...). */
      bgColor: color(),
      /** A photograph behind the copy, covering the band. */
      bgImage: url(),
      /** A colour laid over the photograph so the copy stays readable; rgba for transparency. */
      overlayColor: color(),
      titleColor: color(),
      subtitleColor: color(),
      align: z.enum(['left', 'center', 'right']).optional(),
      titleSize: z.enum(['md', 'lg', 'xl', '2xl']).optional(),
      titleFont: z.enum(['inherit', 'serif']).optional(),
      uppercase: z.boolean().optional(),
      /** Minimum height of the band in px; the copy centres vertically inside it. */
      minHeight: z.number().optional(),
      /** Corner radius of the band itself. */
      radius: z.number().optional(),
      /** Width the copy is capped at, in px. */
      maxWidth: z.number().optional(),
      /** Buttons under the copy, side by side. */
      ctaText: z.string().optional(),
      ctaUrl: url(),
      ctaBg: color(),
      ctaColor: color(),
      ctaRadius: z.number().optional(),
      secondaryText: z.string().optional(),
      secondaryUrl: url(),
      secondaryStyle: z.enum(['outline', 'link', 'filled']).optional(),
      secondaryColor: color(),
      ...spacing,
    })
    .passthrough(),
  defaults: {
    title: 'Offre Spéciale !',
    subtitle: 'Découvrez notre produit exclusif.',
    bgColor: '#ffffff',
    titleColor: '#0f172a',
    subtitleColor: '#475569',
    paddingTop: 40,
    paddingBottom: 32,
    marginTop: 0,
    marginBottom: 16,
  },
  inspector: {
    groups: [
      { title: 'Contenu', fields: ['kicker', 'title', 'highlight', 'subtitle'] },
      { title: 'Boutons', fields: ['ctaText', 'ctaUrl', 'ctaBg', 'ctaColor', 'ctaRadius', 'secondaryText', 'secondaryUrl', 'secondaryStyle', 'secondaryColor'] },
      { title: 'Fond', fields: ['bgColor', 'bgImage', 'overlayColor', 'minHeight', 'radius'] },
      { title: 'Style', fields: ['align', 'titleSize', 'titleFont', 'uppercase', 'kickerStyle', 'maxWidth'] },
      { title: 'Couleurs', fields: ['titleColor', 'subtitleColor', 'kickerColor', 'highlightColor', 'highlightStyle'] },
      SPACING_GROUP,
    ],
  },
  presets: {
    photo: { align: 'left', titleSize: 'xl', overlayColor: 'rgba(10,12,20,0.55)', titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.85)', minHeight: 560 },
    centered: { align: 'center', titleSize: 'xl', kickerStyle: 'pill' },
  },
  binds: [],
  needsRuntime: false,
  compiled: true,
});
