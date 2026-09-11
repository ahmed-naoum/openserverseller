import { z } from 'zod';
import { defineBlock, color, spacing, SPACING_GROUP } from './define.js';

/**
 * A row of small labels: tags under a hero, categories that link to
 * collections, the social links row of an editorial home, the "awards" strip.
 * Pills, outlines, or plain text separated by dots.
 */
export const chips = defineBlock({
  type: 'chips',
  meta: {
    label: { fr: 'Pastilles & tags', en: 'Chips', ar: 'وسوم' },
    description: {
      fr: 'Rangée de pastilles : catégories, tags, réseaux sociaux. Avec ou sans lien.',
      en: 'A row of chips: categories, tags, social links. With or without links.',
    },
    category: 'content',
    icon: 'Tags',
  },
  schema: z
    .object({
      items: z.array(z.object({ label: z.string().optional(), url: z.string().optional() }).passthrough()).optional(),
      /** A small label before the chips: "Social", "Catégories". */
      prefix: z.string().optional(),
      style: z.enum(['pill', 'outline', 'text']).optional(),
      align: z.enum(['left', 'center', 'right']).optional(),
      size: z.enum(['sm', 'md']).optional(),
      uppercase: z.boolean().optional(),
      bgColor: color(),
      textColor: color(),
      borderColor: color(),
      ...spacing,
    })
    .passthrough(),
  defaults: {
    items: [
      { label: 'Nouveautés', url: '/products' },
      { label: 'Best-sellers', url: '/products' },
      { label: 'Promotions', url: '/products' },
      { label: 'Coffrets', url: '/products' },
    ],
    prefix: '',
    style: 'pill',
    align: 'center',
    size: 'md',
    uppercase: false,
    bgColor: '#f1f5f9',
    textColor: '#0f172a',
    borderColor: '#e2e8f0',
    paddingTop: 8,
    paddingBottom: 8,
    marginTop: 0,
    marginBottom: 0,
  },
  inspector: {
    groups: [
      { title: 'Contenu', fields: ['prefix', 'items'] },
      { title: 'Style', fields: ['style', 'align', 'size', 'uppercase'] },
      { title: 'Couleurs', fields: ['bgColor', 'textColor', 'borderColor'] },
      SPACING_GROUP,
    ],
  },
  presets: {
    social: { prefix: 'Social', style: 'text', align: 'left', items: [{ label: 'Instagram', url: '' }, { label: 'TikTok', url: '' }, { label: 'Facebook', url: '' }] },
  },
  binds: [],
  needsRuntime: false,
  compiled: true,
});
