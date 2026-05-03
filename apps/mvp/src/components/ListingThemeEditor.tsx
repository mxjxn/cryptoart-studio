"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ListingThemeData, ListingThemeSource } from "~/lib/listing-theme";
import {
  DEFAULT_LISTING_THEME,
  LISTING_THEME_EDITOR_PRESETS,
  composeLinearGradientCss,
  hexForColorInput,
  listingThemeTypographyClasses,
  validateListingTheme,
} from "~/lib/listing-theme";

interface ListingThemeEditorProps {
  mode: "default" | "listing";
  /** Lowercase or mixed; must be valid connected user address */
  userAddress: string;
  verifiedAddresses: string[];
  listingId?: string;
  /** Light page (listing detail) vs dark (profile) */
  surface?: "light" | "dark";
  /** Called when resolved theme updates (load / save / refetch). Includes `source` for listing accent UI. */
  onThemeResolved?: (theme: ListingThemeData, source: ListingThemeSource) => void;
}

type ThemeApiResponse = {
  theme: ListingThemeData;
  source: "override" | "default" | "fallback";
};

const fetchThemeInit: RequestInit = {
  cache: "no-store",
  headers: { "Cache-Control": "no-cache" },
};

function cloneTheme(t: ListingThemeData): ListingThemeData {
  return JSON.parse(JSON.stringify(t)) as ListingThemeData;
}

export function ListingThemeEditor({
  mode,
  userAddress,
  verifiedAddresses,
  listingId,
  surface = "dark",
  onThemeResolved,
}: ListingThemeEditorProps) {
  const onThemeResolvedRef = useRef(onThemeResolved);
  onThemeResolvedRef.current = onThemeResolved;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ListingThemeData>(cloneTheme(DEFAULT_LISTING_THEME));
  /** Listing mode: whether a DB override row exists (or user chose custom) */
  const [hasOverride, setHasOverride] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const fetchTheme = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      try {
        if (mode === "listing" && listingId) {
          const res = await fetch(
            `/api/listing-theme?listingId=${encodeURIComponent(listingId)}`,
            fetchThemeInit
          );
          if (!res.ok) {
            setError("Could not load theme");
            return;
          }
          const data = (await res.json()) as ThemeApiResponse;
          setDraft(cloneTheme(data.theme));
          setHasOverride(data.source === "override");
          onThemeResolvedRef.current?.(data.theme, data.source);
        } else {
          const res = await fetch(
            `/api/listing-theme?seller=${encodeURIComponent(userAddress)}`,
            fetchThemeInit
          );
          if (!res.ok) {
            setError("Could not load theme");
            return;
          }
          const data = (await res.json()) as ThemeApiResponse;
          setDraft(cloneTheme(data.theme));
          onThemeResolvedRef.current?.(data.theme, data.source);
        }
      } catch {
        setError("Could not load theme");
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [mode, listingId, userAddress]
  );

  useEffect(() => {
    void fetchTheme();
  }, [fetchTheme]);

  const persistDefault = async (theme: ListingThemeData) => {
    const res = await fetch("/api/listing-theme/default", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userAddress,
        verifiedAddresses,
        theme,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error((j as { error?: string }).error || "Save failed");
    }
  };

  const persistOverride = async (theme: ListingThemeData | null) => {
    if (!listingId) return;
    const res = await fetch("/api/listing-theme/override", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userAddress,
        verifiedAddresses,
        listingId,
        theme,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error((j as { error?: string }).error || "Save failed");
    }
  };

  const onSave = async () => {
    const v = validateListingTheme(draft);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (mode === "default") {
        await persistDefault(v.theme);
      } else {
        await persistOverride(v.theme);
        setHasOverride(true);
      }
      // Keep UI aligned with what we saved (canonical stops/order from validation).
      setDraft(cloneTheme(v.theme));
      onThemeResolvedRef.current?.(
        v.theme,
        mode === "listing" ? "override" : "default"
      );
      // Re-fetch without unmounting skeleton; no router.refresh() — it remounts and
      // combined with HTTP caching previously showed stale/wrong colors.
      await fetchTheme({ silent: true });
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onUseDefaultForListing = async () => {
    if (mode !== "listing" || !listingId) return;
    setSaving(true);
    setError(null);
    try {
      await persistOverride(null);
      setHasOverride(false);
      await fetchTheme({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const labelMuted =
    surface === "light" ? "text-neutral-500" : "text-[#999999]";
  const border = surface === "light" ? "border-neutral-200" : "border-[#333333]";
  const text = surface === "light" ? "text-neutral-900" : "text-white";
  const inputBg =
    surface === "light"
      ? "border-neutral-300 bg-white text-neutral-900"
      : "border-[#444444] bg-[#1a1a1a] text-white";

  const typo = listingThemeTypographyClasses(draft);
  const gradientCss = composeLinearGradientCss(draft);

  if (loading) {
    return (
      <div className={`rounded-lg border ${border} p-4 ${labelMuted} text-sm`}>
        Loading listing appearance…
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${border} p-4 space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={`text-sm font-medium uppercase tracking-wide ${labelMuted}`}>
          Listing page appearance
        </h3>
        {mode === "listing" && (
          <span className={`text-xs ${labelMuted}`}>
            {hasOverride ? "Custom for this listing" : "Using your default"}
          </span>
        )}
      </div>

      {mode === "listing" && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving || !hasOverride}
            onClick={() => void onUseDefaultForListing()}
            className={`rounded border px-3 py-1.5 text-xs ${
              surface === "light"
                ? "border-neutral-300 bg-white hover:bg-neutral-50 disabled:opacity-40"
                : "border-[#444444] bg-[#1a1a1a] hover:bg-[#222] disabled:opacity-40"
            }`}
          >
            Use my default for this listing
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {LISTING_THEME_EDITOR_PRESETS.map((preset, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setDraft(cloneTheme(preset))}
            className="h-8 w-8 rounded-full border border-white/20 shadow-sm"
            style={{ background: composeLinearGradientCss(preset) }}
            title={`Preset ${i + 1}`}
          />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`flex flex-col gap-1 text-xs ${labelMuted}`}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>Gradient start</span>
            <span className={`font-mek-mono text-[11px] ${labelMuted}`}>
              {hexForColorInput(draft.gradient.stops[0]?.color, "#667eea")}
            </span>
          </span>
          <input
            type="color"
            value={hexForColorInput(draft.gradient.stops[0]?.color, "#667eea")}
            onChange={(e) => {
              const c = e.target.value;
              setDraft((d) => {
                const next = cloneTheme(d);
                if (next.gradient.stops[0]) next.gradient.stops[0].color = c;
                return next;
              });
            }}
            className="h-9 w-full cursor-pointer rounded border-0 bg-transparent p-0"
          />
        </label>
        <label className={`flex flex-col gap-1 text-xs ${labelMuted}`}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>Gradient end</span>
            <span className={`font-mek-mono text-[11px] ${labelMuted}`}>
              {hexForColorInput(
                draft.gradient.stops[draft.gradient.stops.length - 1]?.color,
                "#764ba2"
              )}
            </span>
          </span>
          <input
            type="color"
            value={hexForColorInput(
              draft.gradient.stops[draft.gradient.stops.length - 1]?.color,
              "#764ba2"
            )}
            onChange={(e) => {
              const c = e.target.value;
              setDraft((d) => {
                const next = cloneTheme(d);
                const last = next.gradient.stops.length - 1;
                if (last >= 0) next.gradient.stops[last]!.color = c;
                return next;
              });
            }}
            className="h-9 w-full cursor-pointer rounded border-0 bg-transparent p-0"
          />
        </label>
      </div>

      <label className={`flex flex-col gap-1 text-xs ${labelMuted}`}>
        Angle ({draft.gradient.angleDeg}°)
        <input
          type="range"
          min={0}
          max={360}
          value={draft.gradient.angleDeg}
          onChange={(e) =>
            setDraft((d) => {
              const next = cloneTheme(d);
              next.gradient.angleDeg = Number(e.target.value);
              return next;
            })
          }
          className="w-full"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className={`flex flex-col gap-1 text-xs ${labelMuted}`}>
          Title font
          <select
            value={draft.titleFont}
            onChange={(e) =>
              setDraft((d) => ({
                ...cloneTheme(d),
                titleFont: e.target.value as ListingThemeData["titleFont"],
              }))
            }
            className={`rounded border px-2 py-1.5 text-sm ${inputBg}`}
          >
            <option value="spaceGrotesk">Space Grotesk</option>
            <option value="mekMono">Mek Mono</option>
            <option value="system">System</option>
          </select>
        </label>
        <label className={`flex flex-col gap-1 text-xs ${labelMuted}`}>
          Title size
          <select
            value={draft.titleSize}
            onChange={(e) =>
              setDraft((d) => ({
                ...cloneTheme(d),
                titleSize: e.target.value as ListingThemeData["titleSize"],
              }))
            }
            className={`rounded border px-2 py-1.5 text-sm ${inputBg}`}
          >
            <option value="sm">Small</option>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
          </select>
        </label>
        <label className={`flex flex-col gap-1 text-xs ${labelMuted}`}>
          Description size
          <select
            value={draft.bodySize}
            onChange={(e) =>
              setDraft((d) => ({
                ...cloneTheme(d),
                bodySize: e.target.value as ListingThemeData["bodySize"],
              }))
            }
            className={`rounded border px-2 py-1.5 text-sm ${inputBg}`}
          >
            <option value="sm">Small</option>
            <option value="md">Medium</option>
          </select>
        </label>
      </div>

      <div
        className={`rounded-lg border p-4 ${surface === "light" ? "border-neutral-200 bg-neutral-50" : "border-[#333333] bg-black/40"}`}
      >
        <p className={`text-xs ${labelMuted} mb-2`}>Preview</p>
        <div
          className="mb-3 h-24 w-full rounded-md"
          style={{ background: gradientCss }}
        />
        <h4 className={`${typo.titleClass} ${text}`}>Listing title preview</h4>
        <p className={`${typo.bodyClass} mt-1 ${surface === "light" ? "text-neutral-600" : "text-[#aaaaaa]"}`}>
          Description text preview for your listing.
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave()}
          className={
            surface === "light"
              ? "rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              : "rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
          }
        >
          {saving ? "Saving…" : mode === "default" ? "Save default" : "Save for this listing"}
        </button>
        {justSaved && (
          <span className="text-sm font-medium text-emerald-600" role="status">
            Saved — colors below match your listing accent.
          </span>
        )}
      </div>
    </div>
  );
}
