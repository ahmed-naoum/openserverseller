import { z } from 'zod';
import { defineBlock, color, url, spacing, SPACING_GROUP } from './define.js';

export const button = defineBlock({
  type: 'button',
  meta: {
    label: { fr: "Bouton d'Action (CTA)", en: 'Button', ar: 'زر' },
    description: {
      fr: "Bouton d'achat avec animations, redirection ou défilement instantané vers le checkout.",
      en: 'A call to action that scrolls to the checkout or opens a link.',
    },
    category: 'conversion',
    icon: 'Link',
    badge: 'Sticky',
  },
  schema: z
    .object({
      text: z.string().optional(),
      bgColor: color(),
      textColor: color(),
      textSize: z.number().optional(),
      link: url(),
      /** 'checkout' scrolls to the first checkout block; 'link' follows `link`. */
      behavior: z.enum(['checkout', 'link']).optional(),
      buttonBorderRadius: z.number().optional(),
      buttonBorderWidth: z.number().optional(),
      buttonBorderColor: color(),
      buttonPaddingX: z.number().optional(),
      buttonPaddingY: z.number().optional(),
      stickyMobile: z.boolean().optional(),
      stickyDesktop: z.boolean().optional(),
      animationLayout: z
        .enum(['none', 'bounceHorizontal', 'bounceVertical', 'rotate', 'scale', 'fade', 'appear'])
        .optional(),
      animationTiming: z.string().optional(),
      /** Append the referral source token to outbound links. */
      attachSourceToken: z.boolean().optional(),
      /** Stop responding after this many clicks; 0 or absent means unlimited. */
      maxClicks: z.number().optional(),
      /** Stay hidden until the page's video has played this many seconds. */
      showAfterVideoSeconds: z.number().optional(),
      ...spacing,
    })
    .passthrough(),
  defaults: {
    text: 'COMMANDER MAINTENANT',
    bgColor: '#ea580c',
    textColor: '#ffffff',
    textSize: 16,
    buttonBorderRadius: 16,
    buttonPaddingY: 16,
    buttonPaddingX: 32,
    link: '',
    behavior: 'checkout',
    stickyMobile: false,
    stickyDesktop: false,
    animationLayout: 'none',
    paddingTop: 16,
    paddingBottom: 16,
    marginTop: 0,
    marginBottom: 0,
  },
  presets: {
    'sticky-mobile': { stickyMobile: true, animationLayout: 'bounceVertical' },
  },
  inspector: {
    groups: [
      { title: 'Contenu', fields: ['text', 'behavior', 'link', 'attachSourceToken'] },
      {
        title: 'Style',
        fields: [
          'bgColor', 'textColor', 'textSize', 'buttonBorderRadius',
          'buttonBorderWidth', 'buttonBorderColor', 'buttonPaddingX', 'buttonPaddingY',
        ],
      },
      { title: 'Comportement', fields: ['stickyMobile', 'stickyDesktop', 'animationLayout', 'animationTiming', 'maxClicks', 'showAfterVideoSeconds'] },
      SPACING_GROUP,
    ],
  },
  binds: [],
  needsRuntime: true,
  compiled: true,
});
