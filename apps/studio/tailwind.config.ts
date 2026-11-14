import type { Config } from 'tailwindcss';
import { galleryTailwindPreset } from '../../packages/ui/src/tokens/tailwind-preset';

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  presets: [galleryTailwindPreset as unknown as Config],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
