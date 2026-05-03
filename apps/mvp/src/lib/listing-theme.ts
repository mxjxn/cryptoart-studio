/**
 * Member listing page theme: structured JSON, validation, and CSS composition.
 * Do not persist raw CSS strings from clients.
 */

export type ListingTitleFont = "spaceGrotesk" | "mekMono" | "system";
export type ListingTitleSize = "sm" | "md" | "lg";
export type ListingBodySize = "sm" | "md";

export interface ListingThemeGradientStop {
  color: string;
  positionPct: number;
}

export interface ListingThemeGradient {
  kind: "linear";
  angleDeg: number;
  stops: ListingThemeGradientStop[];
}

export interface ListingThemeData {
  gradient: ListingThemeGradient;
  titleFont: ListingTitleFont;
  titleSize: ListingTitleSize;
  bodySize: ListingBodySize;
}

/** CSS linear-gradient strings — shared with featured carousels/grids. */
export const GRADIENT_CSS_PRESETS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
] as const;

/** Structured presets matching GRADIENT_CSS_PRESETS (same order). */
export const LISTING_THEME_EDITOR_PRESETS: readonly ListingThemeData[] = [
  {
    gradient: {
      kind: "linear",
      angleDeg: 135,
      stops: [
        { color: "#667eea", positionPct: 0 },
        { color: "#764ba2", positionPct: 100 },
      ],
    },
    titleFont: "spaceGrotesk",
    titleSize: "md",
    bodySize: "md",
  },
  {
    gradient: {
      kind: "linear",
      angleDeg: 135,
      stops: [
        { color: "#f093fb", positionPct: 0 },
        { color: "#f5576c", positionPct: 100 },
      ],
    },
    titleFont: "spaceGrotesk",
    titleSize: "md",
    bodySize: "md",
  },
  {
    gradient: {
      kind: "linear",
      angleDeg: 135,
      stops: [
        { color: "#4facfe", positionPct: 0 },
        { color: "#00f2fe", positionPct: 100 },
      ],
    },
    titleFont: "spaceGrotesk",
    titleSize: "md",
    bodySize: "md",
  },
  {
    gradient: {
      kind: "linear",
      angleDeg: 135,
      stops: [
        { color: "#fa709a", positionPct: 0 },
        { color: "#fee140", positionPct: 100 },
      ],
    },
    titleFont: "spaceGrotesk",
    titleSize: "md",
    bodySize: "md",
  },
  {
    gradient: {
      kind: "linear",
      angleDeg: 135,
      stops: [
        { color: "#30cfd0", positionPct: 0 },
        { color: "#330867", positionPct: 100 },
      ],
    },
    titleFont: "spaceGrotesk",
    titleSize: "md",
    bodySize: "md",
  },
  {
    gradient: {
      kind: "linear",
      angleDeg: 135,
      stops: [
        { color: "#a8edea", positionPct: 0 },
        { color: "#fed6e3", positionPct: 100 },
      ],
    },
    titleFont: "spaceGrotesk",
    titleSize: "md",
    bodySize: "md",
  },
] as const;

/** Built-in fallback when no DB row (matches previous MediaDisplay placeholder). */
export const DEFAULT_LISTING_THEME: ListingThemeData = LISTING_THEME_EDITOR_PRESETS[0]!;

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function normalizeHexColor(input: string): string | null {
  const s = input.trim();
  if (!HEX.test(s)) return null;
  if (s.length === 4) {
    const r = s[1]!;
    const g = s[2]!;
    const b = s[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return s.toLowerCase();
}

/** `#rrggbb` for `<input type="color" />` (must be 7-char hex). */
export function hexForColorInput(hex: string | undefined, fallback: string): string {
  const n = normalizeHexColor(hex ?? "");
  if (n) return n;
  return normalizeHexColor(fallback) ?? "#667eea";
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function validateListingTheme(input: unknown): { ok: true; theme: ListingThemeData } | { ok: false; error: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Theme must be an object" };
  }
  const o = input as Record<string, unknown>;
  const g = o.gradient;
  if (!g || typeof g !== "object") {
    return { ok: false, error: "gradient is required" };
  }
  const go = g as Record<string, unknown>;
  if (go.kind !== "linear") {
    return { ok: false, error: "gradient.kind must be linear" };
  }
  if (!isFiniteNumber(go.angleDeg) || go.angleDeg < 0 || go.angleDeg > 360) {
    return { ok: false, error: "gradient.angleDeg must be between 0 and 360" };
  }
  if (!Array.isArray(go.stops) || go.stops.length < 2 || go.stops.length > 4) {
    return { ok: false, error: "gradient.stops must have 2 to 4 entries" };
  }
  const stops: ListingThemeGradientStop[] = [];
  for (const raw of go.stops) {
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: "Each stop must be an object" };
    }
    const so = raw as Record<string, unknown>;
    if (typeof so.color !== "string") {
      return { ok: false, error: "stop.color must be a string" };
    }
    const color = normalizeHexColor(so.color);
    if (!color) {
      return { ok: false, error: "stop.color must be #RGB or #RRGGBB" };
    }
    if (!isFiniteNumber(so.positionPct) || so.positionPct < 0 || so.positionPct > 100) {
      return { ok: false, error: "stop.positionPct must be between 0 and 100" };
    }
    stops.push({ color, positionPct: so.positionPct });
  }
  const sorted = [...stops].sort((a, b) => a.positionPct - b.positionPct);
  const fonts = ["spaceGrotesk", "mekMono", "system"] as const;
  const titleSizes = ["sm", "md", "lg"] as const;
  const bodySizes = ["sm", "md"] as const;
  if (typeof o.titleFont !== "string" || !fonts.includes(o.titleFont as ListingTitleFont)) {
    return { ok: false, error: "titleFont invalid" };
  }
  if (typeof o.titleSize !== "string" || !titleSizes.includes(o.titleSize as ListingTitleSize)) {
    return { ok: false, error: "titleSize invalid" };
  }
  if (typeof o.bodySize !== "string" || !bodySizes.includes(o.bodySize as ListingBodySize)) {
    return { ok: false, error: "bodySize invalid" };
  }
  return {
    ok: true,
    theme: {
      gradient: {
        kind: "linear",
        angleDeg: go.angleDeg,
        stops: sorted,
      },
      titleFont: o.titleFont as ListingTitleFont,
      titleSize: o.titleSize as ListingTitleSize,
      bodySize: o.bodySize as ListingBodySize,
    },
  };
}

export function composeLinearGradientCss(theme: ListingThemeData): string {
  const { angleDeg, stops } = theme.gradient;
  const parts = stops.map((s) => `${s.color} ${s.positionPct}%`);
  return `linear-gradient(${angleDeg}deg, ${parts.join(", ")})`;
}

const TITLE_SIZE_CLASS: Record<ListingTitleSize, string> = {
  sm: "text-xl sm:text-2xl",
  md: "text-2xl sm:text-3xl",
  lg: "text-3xl sm:text-4xl",
};

const BODY_SIZE_CLASS: Record<ListingBodySize, string> = {
  sm: "text-xs sm:text-sm",
  md: "text-sm sm:text-base",
};

const TITLE_FONT_CLASS: Record<ListingTitleFont, string> = {
  spaceGrotesk: "font-space-grotesk",
  mekMono: "font-mek-mono",
  system: "font-sans",
};

export function listingThemeTypographyClasses(theme: ListingThemeData): {
  titleClass: string;
  bodyClass: string;
  sectionFontClass: string;
} {
  return {
    titleClass: `${TITLE_FONT_CLASS[theme.titleFont]} ${TITLE_SIZE_CLASS[theme.titleSize]} font-medium tracking-tight`,
    bodyClass: `${BODY_SIZE_CLASS[theme.bodySize]} leading-relaxed`,
    sectionFontClass: TITLE_FONT_CLASS[theme.titleFont],
  };
}

export type ListingThemeSource = "override" | "default" | "fallback";

export function resolveThemeLayers(
  defaultTheme: ListingThemeData | null,
  overrideTheme: ListingThemeData | null
): { theme: ListingThemeData; source: ListingThemeSource } {
  if (overrideTheme) {
    return { theme: overrideTheme, source: "override" };
  }
  if (defaultTheme) {
    return { theme: defaultTheme, source: "default" };
  }
  return { theme: DEFAULT_LISTING_THEME, source: "fallback" };
}
