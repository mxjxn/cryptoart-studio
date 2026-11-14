/**
 * Tailwind preset for gallery tokens.
 * Apps can add this to `presets` in their Tailwind config.
 */
export const galleryTailwindPreset = {
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        'background-raised': 'var(--background-raised)',
        'background-sunken': 'var(--background-sunken)',
        foreground: 'var(--foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        'accent-faint': 'var(--accent-faint)',
        success: 'var(--success)',
        'success-faint': 'var(--success-faint)',
        warning: 'var(--warning)',
        'warning-faint': 'var(--warning-faint)',
        error: 'var(--error)',
        'error-faint': 'var(--error-faint)',
        paper: 'var(--gallery-paper)',
        ink: 'var(--gallery-ink)',
        forest: 'var(--gallery-forest)',
      },
      borderRadius: {
        sm: 'var(--gallery-radius-sm)',
        md: 'var(--gallery-radius-md)',
        lg: 'var(--gallery-radius-lg)',
      },
      fontFamily: {
        display: ['var(--gallery-font-display)'],
        sans: ['var(--gallery-font-sans)'],
        mono: ['var(--gallery-font-mono)'],
      },
      transitionDuration: {
        fast: 'var(--gallery-duration-fast)',
        base: 'var(--gallery-duration-base)',
        slow: 'var(--gallery-duration-slow)',
      },
      transitionTimingFunction: {
        gallery: 'var(--gallery-ease-out)',
      },
      spacing: {
        'gallery-1': 'var(--gallery-space-1)',
        'gallery-2': 'var(--gallery-space-2)',
        'gallery-3': 'var(--gallery-space-3)',
        'gallery-4': 'var(--gallery-space-4)',
        'gallery-5': 'var(--gallery-space-5)',
        'gallery-6': 'var(--gallery-space-6)',
        'gallery-8': 'var(--gallery-space-8)',
        'gallery-10': 'var(--gallery-space-10)',
        'gallery-12': 'var(--gallery-space-12)',
        'gallery-16': 'var(--gallery-space-16)',
        'gallery-20': 'var(--gallery-space-20)',
      },
    },
  },
};

export default galleryTailwindPreset;
