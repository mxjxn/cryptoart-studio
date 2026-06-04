"use client";

import { useState, useEffect, useCallback } from "react";
import type { EnrichedAuctionData } from "~/lib/types";

export function useLiveBids(options: { limit?: number; enabled?: boolean } = {}) {
  const { limit = 4, enabled = true } = options;

  const [listings, setListings] = useState<EnrichedAuctionData[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveBids = useCallback(async () => {
    if (!enabled) {
      setListings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/listings/live-bids?limit=${limit}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { listings?: EnrichedAuctionData[] };
      setListings(Array.isArray(data.listings) ? data.listings : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch live bids";
      console.error("[useLiveBids]", message, err);
      setError(message);
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, limit]);

  useEffect(() => {
    void fetchLiveBids();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void fetchLiveBids();
    };
    const handleFocus = () => void fetchLiveBids();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchLiveBids]);

  return { listings, loading, error, refetch: fetchLiveBids };
}
