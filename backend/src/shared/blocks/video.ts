import { z } from 'zod';
import { defineBlock, color, url, spacing, SPACING_GROUP } from './define.js';

export const video = defineBlock({
  type: 'video',
  meta: {
    label: { fr: 'Lecteur Vidéo', en: 'Video', ar: 'فيديو' },
    description: {
      fr: 'YouTube, Vimeo ou fichier local, avec bouton « Activer le son » et lecture automatique.',
      en: 'YouTube, Vimeo or an uploaded file, with an unmute button and autoplay.',
    },
    category: 'media',
    icon: 'Video',
    badge: 'Ultra-Rapide',
  },
  schema: z
    .object({
      url: url(),
      autoplay: z.boolean().optional(),
      controls: z.boolean().optional(),
      loop: z.boolean().optional(),
      muted: z.boolean().optional(),
      poster: url(),
      posterUrl: url(),
      thumbnail: url(),
      /** Percentage of the column. */
      width: z.number().optional(),
      maxHeight: z.number().optional(),
      /** Where the visitor is sent when the video ends. Empty means nowhere. */
      redirectUrl: url(),
      restartOnUnmute: z.boolean().optional(),
      unmuteText: z.string().optional(),
      unmuteBtnColor: color(),
      unmuteTextColor: color(),
      ...spacing,
    })
    .passthrough(),
  defaults: {
    url: '',
    autoplay: true,
    muted: true,
    loop: true,
    controls: false,
    width: 100,
    restartOnUnmute: true,
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  inspector: {
    groups: [
      { title: 'Média', fields: ['url', 'poster', 'width', 'maxHeight'] },
      { title: 'Lecture', fields: ['autoplay', 'muted', 'loop', 'controls', 'restartOnUnmute'] },
      { title: 'Bouton son', fields: ['unmuteText', 'unmuteBtnColor', 'unmuteTextColor'] },
      { title: 'Fin de vidéo', fields: ['redirectUrl'] },
      SPACING_GROUP,
    ],
  },
  binds: [],
  needsRuntime: true,
  compiled: true,
});
