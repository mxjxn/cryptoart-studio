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
 * Theme mode configuration
 */
export interface ThemeMode {
  name: string;
  // Color generation parameters
  primarySaturation: number;
  primaryLightness: number;
  backgroundSaturation: number;
  backgroundLightness: number;
  backgroundLightnessEnd: number;
  textSaturation: number;
  textLightness: number;
  borderSaturation: number;
  borderLightness: number;
  accentSaturation: number;
  accentLightness: number;
}

/**
 * Predefined theme modes
 */
export const THEME_MODES: Record<string, ThemeMode> = {
  dark: {
    name: 'Dark',
    primarySaturation: 70,
    primaryLightness: 60,
    backgroundSaturation: 20,
    backgroundLightness: 8,
    backgroundLightnessEnd: 12,
    textSaturation: 10,
    textLightness: 85,
    borderSaturation: 30,
    borderLightness: 25,
    accentSaturation: 80,
    accentLightness: 50,
  },
  light: {
    name: 'Light',
    primarySaturation: 60,
    primaryLightness: 40,
    backgroundSaturation: 15,
    backgroundLightness: 95,
    backgroundLightnessEnd: 92,
    textSaturation: 20,
    textLightness: 15,
    borderSaturation: 25,
    borderLightness: 70,
    accentSaturation: 70,
    accentLightness: 35,
  },
  // Future themes can be added here
  // terminal: { ... },
  // neon: { ... },
};

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
 * Generate color scheme from base hue and theme mode
 */
export function generateColorScheme(baseHue: number, mode: ThemeMode = THEME_MODES.dark): ColorScheme {
  return {
    primary: hsl(baseHue, mode.primarySaturation, mode.primaryLightness),
    secondary: hsl(baseHue + 60, mode.primarySaturation, mode.primaryLightness),
    tertiary: hsl(baseHue + 120, mode.primarySaturation, mode.primaryLightness),
    success: hsl(baseHue + 90, mode.primarySaturation, mode.primaryLightness),
    warning: hsl(baseHue + 30, mode.primarySaturation, mode.primaryLightness),
    error: hsl(baseHue - 30, mode.primarySaturation, mode.primaryLightness),
    background: hsl(baseHue, mode.backgroundSaturation, mode.backgroundLightness),
    backgroundGradient: `linear-gradient(135deg, ${hsl(baseHue, mode.backgroundSaturation, mode.backgroundLightness)}, ${hsl(baseHue, mode.backgroundSaturation, mode.backgroundLightnessEnd)})`,
    text: hsl(baseHue, mode.textSaturation, mode.textLightness),
    border: hsl(baseHue, mode.borderSaturation, mode.borderLightness),
    accent: hsl(baseHue, mode.accentSaturation, mode.accentLightness),
  };
}

/**
 * Default hue value
 */
export const DEFAULT_HUE = 200;

/**
 * Default theme mode
 */
export const DEFAULT_THEME_MODE = 'dark';

