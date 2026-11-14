/** Local sample artwork for the /dev/preview route — no external hosts. */

export const PREVIEW_ART = {
  portrait: {
    src: '/preview/portrait.svg',
    aspectRatio: '3 / 4',
    title: 'Chromatic Frequencies',
    subtitle: 'Portrait study',
  },
  landscape: {
    src: '/preview/landscape.svg',
    aspectRatio: '7 / 4',
    title: 'Evening Field',
    subtitle: 'Landscape',
  },
  square: {
    src: '/preview/square.svg',
    aspectRatio: '1 / 1',
    title: 'Signal / Square',
    subtitle: 'Square',
  },
  motion: {
    src: '/preview/motion.svg',
    aspectRatio: '3 / 2',
    title: 'Pulse Study',
    subtitle: 'Animated',
    animated: true,
  },
} as const;

export type PreviewArtKind = keyof typeof PREVIEW_ART;
