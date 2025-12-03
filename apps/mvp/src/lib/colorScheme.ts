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

export type ColorMode = 'minimal' | 'colorful'

/**
 * Generate color scheme from base hue and mode
 */
export function generateColorScheme(baseHue: number, mode: ColorMode = 'minimal'): ColorScheme {
  if (mode === 'minimal') {
    // Minimalist black/white with no color
    return {
      primary: hsl(0, 0, 100),
      secondary: hsl(0, 0, 60),
      tertiary: hsl(0, 0, 40),
      success: hsl(0, 0, 60),
      warning: hsl(0, 0, 60),
      error: hsl(0, 0, 60),
      background: hsl(0, 0, 0), // Pure black
      backgroundGradient: `linear-gradient(135deg, ${hsl(0, 0, 0)}, ${hsl(0, 0, 3)})`,
      text: hsl(0, 0, 85), // Light gray text
      border: hsl(0, 0, 20), // Dark gray borders
      accent: hsl(0, 0, 100), // White accent
    };
  } else {
    // Colorful mode - uses hue rotation like docs app
    return {
      primary: hsl(baseHue, 70, 60),
      secondary: hsl(baseHue + 60, 70, 60),
      tertiary: hsl(baseHue + 120, 70, 60),
      success: hsl(baseHue + 90, 70, 60),
      warning: hsl(baseHue + 30, 70, 60),
      error: hsl(baseHue - 30, 70, 60),
      background: hsl(baseHue, 20, 8),
      backgroundGradient: `linear-gradient(135deg, ${hsl(baseHue, 20, 8)}, ${hsl(baseHue, 20, 12)})`,
      text: hsl(baseHue, 10, 85),
      border: hsl(baseHue, 30, 25),
      accent: hsl(baseHue, 80, 50),
    };
  }
}

/**
 * Default hue value for colorful mode
 */
export const DEFAULT_HUE = 200;

