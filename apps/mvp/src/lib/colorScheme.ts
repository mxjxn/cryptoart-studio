/**
 * Color Scheme System
 * 
 * Provides HSL-based color scheme with hue rotation.
 * All colors maintain consistent relationships as hue rotates.
 */

export interface ColorScheme {
  primary: string;
  secondary: string;
  tertiary: string;
  success: string;
  warning: string;
  error: string;
  background: string;
  backgroundGradient: string;
  text: string;
  border: string;
  accent: string;
}

/**
 * Normalize hue to 0-360 range
 */
function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

/**
 * Convert HSL to CSS color string
 */
function hsl(h: number, s: number, l: number): string {
  return `hsl(${normalizeHue(h)}, ${s}%, ${l}%)`;
}

/**
 * Generate color scheme from base hue and theme
 */
export function generateColorScheme(baseHue: number, theme: 'light' | 'dark' = 'dark'): ColorScheme {
  if (theme === 'light') {
    return {
      primary: hsl(baseHue, 60, 40),
      secondary: hsl(baseHue + 60, 60, 40),
      tertiary: hsl(baseHue + 120, 60, 40),
      success: hsl(baseHue + 90, 60, 40),
      warning: hsl(baseHue + 30, 60, 40),
      error: hsl(baseHue - 30, 60, 40),
      background: hsl(baseHue, 15, 95),
      backgroundGradient: `linear-gradient(135deg, ${hsl(baseHue, 15, 95)}, ${hsl(baseHue, 15, 92)})`,
      text: hsl(baseHue, 20, 15),
      border: hsl(baseHue, 25, 70),
      accent: hsl(baseHue, 70, 35),
    };
  } else {
    // Dark mode (default) - minimalist black/white with subtle accents
    return {
      primary: hsl(baseHue, 70, 60),
      secondary: hsl(baseHue + 60, 70, 60),
      tertiary: hsl(baseHue + 120, 70, 60),
      success: hsl(baseHue + 90, 70, 60),
      warning: hsl(baseHue + 30, 70, 60),
      error: hsl(baseHue - 30, 70, 60),
      background: hsl(0, 0, 0), // Pure black for minimalist
      backgroundGradient: `linear-gradient(135deg, ${hsl(0, 0, 0)}, ${hsl(0, 0, 3)})`,
      text: hsl(0, 0, 85), // Light gray text
      border: hsl(0, 0, 20), // Dark gray borders
      accent: hsl(0, 0, 100), // White accent
    };
  }
}

/**
 * Default hue value (minimalist - no color)
 */
export const DEFAULT_HUE = 0;

