import { z } from 'zod';
import { defineBlock, color, url } from './define.js';

export const whatsapp = defineBlock({
  type: 'whatsapp',
  meta: {
    label: { fr: 'Widget WhatsApp Flottant', en: 'WhatsApp widget', ar: 'واتساب' },
    description: {
      fr: 'Bouton de chat WhatsApp flottant avec message de bienvenue pré-rempli et badge de notification.',
      en: 'A floating WhatsApp chat button with a prefilled greeting.',
    },
    category: 'engagement',
    icon: 'MessageSquare',
    badge: 'Flottant',
  },
  schema: z
    .object({
      enableWidget: z.boolean().optional(),
      phoneNumber: z.string().optional(),
      headline: z.string().optional(),
      subHeadline: z.string().optional(),
      nickname: z.string().optional(),
      welcomeMessage: z.string().optional(),
      preSetMessage: z.string().optional(),
      headerBg: color(),
      iconStyle: z.string().optional(),
      iconType: z.string().optional(),
      iconColor: color(),
      hoverText: z.string().optional(),
      profileImage: url(),
      position: z.enum(['bottom-right', 'bottom-left']).optional(),
      offsetX: z.number().optional(),
      offsetY: z.number().optional(),
      animation: z.string().optional(),
      badgeCount: z.number().optional(),
      badgeMessage: z.string().optional(),
      showOnDesktop: z.boolean().optional(),
      showOnMobile: z.boolean().optional(),
      openOnLoad: z.boolean().optional(),
      useWhatsappWebOnDesktop: z.boolean().optional(),
    })
    .passthrough(),
  defaults: {
    enableWidget: true,
    phoneNumber: '',
    headline: 'Discutons sur WhatsApp',
    nickname: 'Service Client',
    welcomeMessage: 'Bonjour ! Comment pouvons-nous vous aider ?',
    headerBg: '#25D366',
    iconStyle: 'bubble',
    iconType: 'whatsapp',
    position: 'bottom-right',
    showOnDesktop: true,
    showOnMobile: true,
    openOnLoad: false,
    useWhatsappWebOnDesktop: true,
  },
  inspector: {
    groups: [
      { title: 'Contact', fields: ['phoneNumber', 'nickname', 'profileImage', 'preSetMessage'] },
      { title: 'Messages', fields: ['headline', 'subHeadline', 'welcomeMessage', 'hoverText', 'badgeCount', 'badgeMessage'] },
      { title: 'Apparence', fields: ['headerBg', 'iconStyle', 'iconType', 'iconColor', 'position', 'offsetX', 'offsetY', 'animation'] },
      { title: 'Affichage', fields: ['enableWidget', 'showOnDesktop', 'showOnMobile', 'openOnLoad', 'useWhatsappWebOnDesktop'] },
    ],
  },
  binds: [],
  needsRuntime: true,
  compiled: true,
});
