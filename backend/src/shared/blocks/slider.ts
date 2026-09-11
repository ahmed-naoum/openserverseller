import { z } from 'zod';
import { defineBlock, color, url, spacing, SPACING_GROUP } from './define.js';

export const slider = defineBlock({
  type: 'slider',
  meta: {
    label: { fr: 'Slider / Carrousel', en: 'Slider', ar: 'شريط متحرك' },
    description: {
      fr: 'Carrousel multi-cartes pour les témoignages, fonctionnalités ou galerie avant/après.',
      en: 'A multi-card carousel for testimonials, features or before-and-after shots.',
    },
    category: 'media',
    icon: 'Layers',
  },
  schema: z
    .object({
      slides: z
        .array(
          z
            .object({
              title: z.string().optional(),
              description: z.string().optional(),
              mediaUrl: url(),
            })
            .passthrough()
        )
        .optional(),
      cardsPerView: z.number().optional(),
      cardGap: z.number().optional(),
      slideBy: z.number().optional(),
      autoPlay: z.boolean().optional(),
      autoPlaySpeed: z.number().optional(),
      autoplayMode: z.enum(['step', 'marquee']).optional(),
      marqueeSpeed: z.number().optional(),
      pauseOnHover: z.boolean().optional(),
      showArrows: z.boolean().optional(),
      showDots: z.boolean().optional(),
      mediaHeight: z.number().optional(),
      mediaHeight100: z.boolean().optional(),
      mediaFit: z.enum(['cover', 'contain']).optional(),
      titleColor: color(),
      descColor: color(),
      cardBg: color(),
      cardRadius: z.number().optional(),
      cardBorderWidth: z.number().optional(),
      cardBorderColor: color(),
      cardShadow: z.enum(['none', 'sm', 'md', 'lg', 'xl']).optional(),
      textAlign: z.enum(['left', 'center', 'right']).optional(),
      dotColor: color(),
      entranceAnimation: z.string().optional(),
      hoverEffect: z.string().optional(),
      transitionEffect: z.string().optional(),
      ...spacing,
    })
    .passthrough(),
  defaults: {
    slides: [
      { title: 'Bénéfice 1', description: 'Description de la première caractéristique clé.', mediaUrl: '' },
      { title: 'Bénéfice 2', description: 'Description de la deuxième caractéristique clé.', mediaUrl: '' },
    ],
    cardsPerView: 1,
    cardGap: 16,
    autoPlay: true,
    autoPlaySpeed: 4000,
    showArrows: true,
    showDots: true,
    mediaHeight: 260,
    titleColor: '#0f172a',
    descColor: '#64748b',
    cardBg: '#ffffff',
    cardRadius: 20,
    cardBorderWidth: 1,
    cardBorderColor: '#e2e8f0',
    cardShadow: 'md',
    textAlign: 'center',
    dotColor: '#ea580c',
    paddingTop: 24,
    paddingBottom: 24,
    marginTop: 0,
    marginBottom: 0,
  },
  presets: {
    testimonials: { cardsPerView: 1, textAlign: 'center', showDots: true, showArrows: false },
    gallery: { cardsPerView: 3, cardGap: 12, mediaFit: 'cover', showDots: false },
  },
  inspector: {
    groups: [
      { title: 'Cartes', fields: ['slides'] },
      { title: 'Défilement', fields: ['cardsPerView', 'cardGap', 'slideBy', 'autoPlay', 'autoPlaySpeed', 'autoplayMode', 'marqueeSpeed', 'pauseOnHover', 'showArrows', 'showDots'] },
      { title: 'Média', fields: ['mediaHeight', 'mediaHeight100', 'mediaFit'] },
      { title: 'Style', fields: ['titleColor', 'descColor', 'cardBg', 'cardRadius', 'cardBorderWidth', 'cardBorderColor', 'cardShadow', 'textAlign', 'dotColor'] },
      { title: 'Animations', fields: ['entranceAnimation', 'hoverEffect', 'transitionEffect'] },
      SPACING_GROUP,
    ],
  },
  binds: [],
  needsRuntime: true,
  compiled: true,
});
