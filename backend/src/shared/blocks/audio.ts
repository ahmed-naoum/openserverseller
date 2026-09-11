import { z } from 'zod';
import { defineBlock, color, url, spacing, SPACING_GROUP } from './define.js';

export const audio = defineBlock({
  type: 'audio',
  meta: {
    label: { fr: 'Message Vocal WhatsApp', en: 'Voice note', ar: 'رسالة صوتية' },
    description: {
      fr: 'Bulle de message vocal WhatsApp avec onde sonore, avatar et double coche bleue.',
      en: 'A WhatsApp-style voice note bubble with a waveform.',
    },
    category: 'engagement',
    icon: 'MessageSquare',
    badge: '💬 WhatsApp',
  },
  schema: z
    .object({
      url: url(),
      /** Several notes in one bubble stack. Newer rows use this over `url`. */
      audios: z.array(z.object({ url: url(), title: z.string().optional() }).passthrough()).optional(),
      title: z.string().optional(),
      autoplay: z.boolean().optional(),
      controls: z.boolean().optional(),
      loop: z.boolean().optional(),
      themeStyle: z.string().optional(),
      bgColor: color(),
      borderColor: color(),
      bubbleColor: color(),
      playBtnColor: color(),
      activeWaveColor: color(),
      showCheckmarks: z.boolean().optional(),
      showSpeedToggle: z.boolean().optional(),
      ...spacing,
    })
    .passthrough(),
  defaults: {
    url: '',
    audios: [],
    title: 'Message vocal',
    autoplay: false,
    controls: true,
    loop: false,
    themeStyle: 'whatsapp',
    showCheckmarks: true,
    showSpeedToggle: true,
    paddingTop: 16,
    paddingBottom: 16,
    marginTop: 0,
    marginBottom: 0,
  },
  inspector: {
    groups: [
      { title: 'Audio', fields: ['url', 'audios', 'title'] },
      { title: 'Lecture', fields: ['autoplay', 'controls', 'loop', 'showSpeedToggle'] },
      { title: 'Style', fields: ['themeStyle', 'bgColor', 'borderColor', 'bubbleColor', 'playBtnColor', 'activeWaveColor', 'showCheckmarks'] },
      SPACING_GROUP,
    ],
  },
  binds: [],
  needsRuntime: true,
  compiled: true,
});
