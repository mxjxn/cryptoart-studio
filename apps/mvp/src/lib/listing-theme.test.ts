import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeLinearGradientCss,
  composeListingThemeCursorCss,
  DEFAULT_LISTING_CURSOR,
  DEFAULT_LISTING_THEME,
  hexForColorInput,
  normalizeHexColor,
  resolveThemeLayers,
  validateListingTheme,
} from "./listing-theme";

describe("hexForColorInput", () => {
  it("returns #rrggbb for color inputs", () => {
    assert.equal(hexForColorInput("#f0a", "#000000"), "#ff00aa");
    assert.equal(hexForColorInput(undefined, "#00Ff00"), "#00ff00");
  });
});

describe("normalizeHexColor", () => {
  it("expands #RGB to #RRGGBB", () => {
    assert.equal(normalizeHexColor("#f0A"), "#ff00aa");
  });
  it("rejects invalid", () => {
    assert.equal(normalizeHexColor("red"), null);
    assert.equal(normalizeHexColor("#gggggg"), null);
  });
});

describe("validateListingTheme", () => {
  it("accepts a minimal valid theme", () => {
    const raw = {
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
      cursor: DEFAULT_LISTING_CURSOR,
    };
    const r = validateListingTheme(raw);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.theme.gradient.stops[0]!.color, "#667eea");
    }
  });

  it("defaults cursor when omitted (legacy stored themes)", () => {
    const r = validateListingTheme({
      gradient: {
        kind: "linear",
        angleDeg: 90,
        stops: [
          { color: "#000000", positionPct: 0 },
          { color: "#ffffff", positionPct: 100 },
        ],
      },
      titleFont: "spaceGrotesk",
      titleSize: "md",
      bodySize: "md",
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.theme.cursor.mode, "system");
      assert.equal(r.theme.cursor.size, "md");
    }
  });

  it("rejects bad hex", () => {
    const r = validateListingTheme({
      gradient: {
        kind: "linear",
        angleDeg: 0,
        stops: [
          { color: "#nothex", positionPct: 0 },
          { color: "#00ff00", positionPct: 100 },
        ],
      },
      titleFont: "spaceGrotesk",
      titleSize: "md",
      bodySize: "md",
      cursor: DEFAULT_LISTING_CURSOR,
    });
    assert.equal(r.ok, false);
  });

  it("rejects too many stops", () => {
    const r = validateListingTheme({
      gradient: {
        kind: "linear",
        angleDeg: 0,
        stops: [
          { color: "#000000", positionPct: 0 },
          { color: "#111111", positionPct: 25 },
          { color: "#222222", positionPct: 50 },
          { color: "#333333", positionPct: 75 },
          { color: "#444444", positionPct: 100 },
        ],
      },
      titleFont: "spaceGrotesk",
      titleSize: "md",
      bodySize: "md",
      cursor: DEFAULT_LISTING_CURSOR,
    });
    assert.equal(r.ok, false);
  });
});

describe("composeListingThemeCursorCss", () => {
  it("returns undefined for system cursor", () => {
    const t = { ...DEFAULT_LISTING_THEME, cursor: { ...DEFAULT_LISTING_CURSOR, mode: "system" as const } };
    assert.equal(composeListingThemeCursorCss(t), undefined);
  });
  it("returns data URL for custom cursor", () => {
    const t = {
      ...DEFAULT_LISTING_THEME,
      cursor: {
        mode: "custom" as const,
        icon: "dot" as const,
        color: "#ff0000",
        size: "sm" as const,
      },
    };
    const css = composeListingThemeCursorCss(t);
    assert.ok(css?.includes("data:image/svg+xml"));
    assert.ok(css?.includes("url("));
  });
});

describe("composeLinearGradientCss", () => {
  it("builds CSS from theme", () => {
    const css = composeLinearGradientCss(DEFAULT_LISTING_THEME);
    assert.match(css, /^linear-gradient\(135deg, #667eea 0%, #764ba2 100%\)$/);
  });
});

describe("resolveThemeLayers", () => {
  it("prefers override", () => {
    const d = { ...DEFAULT_LISTING_THEME, titleSize: "lg" as const };
    const o = { ...DEFAULT_LISTING_THEME, titleSize: "sm" as const };
    const { theme, source } = resolveThemeLayers(d, o);
    assert.equal(source, "override");
    assert.equal(theme.titleSize, "sm");
  });

  it("uses default when no override", () => {
    const d = { ...DEFAULT_LISTING_THEME, titleSize: "lg" as const };
    const { theme, source } = resolveThemeLayers(d, null);
    assert.equal(source, "default");
    assert.equal(theme.titleSize, "lg");
  });
});
