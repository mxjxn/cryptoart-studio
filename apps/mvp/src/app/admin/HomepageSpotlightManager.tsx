"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  BASE_CHAIN_ID,
  ETHEREUM_MAINNET_CHAIN_ID,
} from "~/lib/server/subgraph-endpoints";
import {
  HOMEPAGE_SPOTLIGHT_COPY_DEFAULTS,
  mergeSpotlightCopy,
  type HomepageSpotlightCopy,
} from "~/lib/homepage-spotlight-defaults";

type SpotlightRow = {
  id: string;
  listingId: string;
  chainId: number;
  displayOrder: number;
};

const CHAIN_OPTIONS = [
  { id: ETHEREUM_MAINNET_CHAIN_ID, label: "Ethereum (1)" },
  { id: BASE_CHAIN_ID, label: "Base (8453)" },
];

function chainLabel(chainId: number): string {
  return CHAIN_OPTIONS.find((c) => c.id === chainId)?.label ?? `Chain ${chainId}`;
}

const inputClass =
  "w-full border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm text-[var(--color-text)]";
const labelClass = "mb-1 block text-xs text-[var(--color-secondary)]";

export function HomepageSpotlightManager() {
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const [listingId, setListingId] = useState("");
  const [chainId, setChainId] = useState(String(ETHEREUM_MAINNET_CHAIN_ID));
  const [formError, setFormError] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copyDraft, setCopyDraft] = useState<HomepageSpotlightCopy>(() =>
    mergeSpotlightCopy(null),
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "homepage-spotlight", address],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/homepage-spotlight?adminAddress=${encodeURIComponent(address!)}`,
      );
      if (!res.ok) throw new Error("Failed to load spotlight config");
      return res.json() as Promise<{
        cardsVisible: boolean;
        copy: HomepageSpotlightCopy;
        listings: SpotlightRow[];
      }>;
    },
    enabled: !!address,
  });

  useEffect(() => {
    if (data?.copy) {
      setCopyDraft(data.copy);
    }
  }, [data?.copy]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "homepage-spotlight"] });
  };

  const toggleVisible = useMutation({
    mutationFn: async (cardsVisible: boolean) => {
      const res = await fetch("/api/admin/homepage-spotlight", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminAddress: address, cardsVisible }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update");
      }
    },
    onSuccess: invalidate,
  });

  const saveCopy = useMutation({
    mutationFn: async () => {
      setCopyError(null);
      const res = await fetch("/api/admin/homepage-spotlight", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminAddress: address, copy: copyDraft }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save copy");
      }
    },
    onSuccess: invalidate,
    onError: (e: Error) => setCopyError(e.message),
  });

  const resetCopyDefaults = () => {
    setCopyDraft(mergeSpotlightCopy(HOMEPAGE_SPOTLIGHT_COPY_DEFAULTS));
  };

  const addPin = useMutation({
    mutationFn: async () => {
      setFormError(null);
      const res = await fetch("/api/admin/homepage-spotlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listingId.trim(),
          chainId: parseInt(chainId, 10),
          adminAddress: address,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to add listing");
      }
    },
    onSuccess: () => {
      setListingId("");
      invalidate();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const removePin = useMutation({
    mutationFn: async (row: SpotlightRow) => {
      const params = new URLSearchParams({
        adminAddress: address!,
        id: row.id,
      });
      const res = await fetch(`/api/admin/homepage-spotlight?${params.toString()}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove");
    },
    onSuccess: invalidate,
  });

  const cardsVisible = data?.cardsVisible ?? false;
  const listings = data?.listings ?? [];

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-background)] p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">
          Homepage spotlight (lime section)
        </h2>
        <p className="mt-1 text-sm text-[var(--color-secondary)]">
          Edit the lime hero copy, CTA, pinned listing cards, and section header on{" "}
          <code className="text-xs">HomePageClientV2</code> — no deploy needed.
        </p>
      </div>

      <div className="mb-6 space-y-3 border-b border-[var(--color-border)] pb-6">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Section header (sticky)</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={labelClass}>Title</label>
            <input
              type="text"
              value={copyDraft.sectionTitle}
              onChange={(e) => setCopyDraft((c) => ({ ...c, sectionTitle: e.target.value }))}
              className={inputClass}
              placeholder={HOMEPAGE_SPOTLIGHT_COPY_DEFAULTS.sectionTitle}
            />
          </div>
          <div>
            <label className={labelClass}>Subline</label>
            <input
              type="text"
              value={copyDraft.sectionSubline}
              onChange={(e) => setCopyDraft((c) => ({ ...c, sectionSubline: e.target.value }))}
              className={inputClass}
              placeholder={HOMEPAGE_SPOTLIGHT_COPY_DEFAULTS.sectionSubline}
            />
          </div>
        </div>

        <h3 className="pt-2 text-sm font-semibold text-[var(--color-text)]">Lime hero card</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={labelClass}>Eyebrow (small caps above headline)</label>
            <input
              type="text"
              value={copyDraft.eyebrow}
              onChange={(e) => setCopyDraft((c) => ({ ...c, eyebrow: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Headline</label>
            <input
              type="text"
              value={copyDraft.headline}
              onChange={(e) => setCopyDraft((c) => ({ ...c, headline: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Body</label>
          <textarea
            value={copyDraft.description}
            onChange={(e) => setCopyDraft((c) => ({ ...c, description: e.target.value }))}
            rows={4}
            className={inputClass}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={labelClass}>Button label</label>
            <input
              type="text"
              value={copyDraft.ctaLabel}
              onChange={(e) => setCopyDraft((c) => ({ ...c, ctaLabel: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Button link (in-app path)</label>
            <input
              type="text"
              value={copyDraft.ctaHref}
              onChange={(e) => setCopyDraft((c) => ({ ...c, ctaHref: e.target.value }))}
              className={inputClass}
              placeholder="/create"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saveCopy.isPending || !address}
            onClick={() => saveCopy.mutate()}
            className="px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-[var(--color-background)] hover:opacity-90 disabled:opacity-50"
          >
            {saveCopy.isPending ? "Saving…" : "Save copy"}
          </button>
          <button
            type="button"
            onClick={resetCopyDefaults}
            className="px-4 py-2 text-sm border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-border)]"
          >
            Reset form to defaults
          </button>
        </div>
        {copyError && <p className="text-sm text-red-400">{copyError}</p>}
      </div>

      <label className="mb-4 flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={cardsVisible}
          disabled={toggleVisible.isPending || isLoading || !address}
          onChange={(e) => toggleVisible.mutate(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-sm text-[var(--color-text)]">
          Show artwork column (pinned listings)
        </span>
      </label>

      <div className="mb-4 flex flex-wrap items-end gap-2 border-t border-[var(--color-border)] pt-4">
        <div>
          <label className={labelClass}>Listing ID</label>
          <input
            type="text"
            value={listingId}
            onChange={(e) => setListingId(e.target.value)}
            placeholder="e.g. 1"
            className="w-32 border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm text-[var(--color-text)]"
          />
        </div>
        <div>
          <label className={labelClass}>Chain</label>
          <select
            value={chainId}
            onChange={(e) => setChainId(e.target.value)}
            className="border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm text-[var(--color-text)]"
          >
            {CHAIN_OPTIONS.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={!listingId.trim() || addPin.isPending || !address}
          onClick={() => addPin.mutate()}
          className="px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-[var(--color-background)] hover:opacity-90 disabled:opacity-50"
        >
          {addPin.isPending ? "Adding…" : "Add pin"}
        </button>
      </div>

      {formError && <p className="mb-3 text-sm text-red-400">{formError}</p>}

      {isLoading ? (
        <p className="text-sm text-[var(--color-secondary)]">Loading…</p>
      ) : listings.length === 0 ? (
        <p className="text-sm text-[var(--color-secondary)]">
          No listing pins. The hero copy still shows; enable the toggle above and add pins to show
          artwork cards beside it.
        </p>
      ) : (
        <ul className="space-y-2">
          {listings.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <span className="font-mono text-[var(--color-text)]">
                #{row.listingId} · {chainLabel(row.chainId)}
              </span>
              <button
                type="button"
                disabled={removePin.isPending}
                onClick={() => removePin.mutate(row)}
                className="text-xs text-red-400 hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
