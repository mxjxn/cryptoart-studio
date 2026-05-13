"use client";

import { useState, useEffect } from "react";
import type { EnrichedAuctionData } from "~/lib/types";
import {
  HOMEPAGE_KISMET_STATIC_ONLY,
  KISMET_STATIC_LOTS,
  TIER1_TIMEOUT_MS,
  TIER2_TIMEOUT_MS,
  type Tier1ListingCard,
  type Tier2HydrationItem,
  sanitizeTier1Card,
  shouldSkipDynamicRedesignFetch,
  fetchJsonWithTimeout,
} from "~/lib/homepage-static-data";

export function useKismetAuctions(hideAuctionCards: boolean) {
  const [kismetTier1Lots, setKismetTier1Lots] = useState<Tier1ListingCard[]>(
    KISMET_STATIC_LOTS.map((auction) => ({
      listingId: auction.listingId,
      tokenId: auction.tokenId,
      seller: auction.seller,
      title: auction.title || "Listing",
      artist: auction.artist || "—",
      description:
        auction.description ||
        "Limited lot preview. Open listing for full details and bidding controls.",
      image: auction.image || null,
      thumbnailUrl: auction.thumbnailUrl || auction.image || null,
    })),
  );
  const [kismetHydratedLots, setKismetHydratedLots] = useState<Record<string, Tier2HydrationItem>>({});
  const [kismetHydrationDone, setKismetHydrationDone] = useState(HOMEPAGE_KISMET_STATIC_ONLY);
  const [kismetFullListings, setKismetFullListings] = useState<EnrichedAuctionData[] | null>(
    HOMEPAGE_KISMET_STATIC_ONLY ? KISMET_STATIC_LOTS : null,
  );

  useEffect(() => {
    let cancelled = false;

    const loadTier1 = async () => {
      if (HOMEPAGE_KISMET_STATIC_ONLY) {
        setKismetTier1Lots(
          KISMET_STATIC_LOTS.map((lot) =>
            sanitizeTier1Card({
              listingId: lot.listingId,
              tokenId: lot.tokenId,
              seller: lot.seller,
              title: lot.title || "Listing",
              artist: lot.artist || "—",
              description: lot.description || "Kismet Casa Rome auction lot.",
              image: lot.image || null,
              thumbnailUrl: lot.thumbnailUrl || lot.image || null,
            }),
          ),
        );
        setKismetFullListings(KISMET_STATIC_LOTS);
        return;
      }
      const startedAt = performance.now();
      if (shouldSkipDynamicRedesignFetch()) {
        console.log("[useKismetAuctions] Skipping tier1 dynamic fetch on constrained network");
        return;
      }
      try {
        const data = await fetchJsonWithTimeout("/api/redesign/sections", TIER1_TIMEOUT_MS);
        if (!data?.success || !data?.sections || cancelled) return;

        const rawLots = Array.isArray(data.sections.kismetLots) ? data.sections.kismetLots : [];
        setKismetTier1Lots(
          rawLots.length > 0 ? rawLots.map((c: Tier1ListingCard) => sanitizeTier1Card(c)) : [],
        );
        if (Array.isArray(data.sections.kismetFullListings) && data.sections.kismetFullListings.length > 0) {
          setKismetFullListings(data.sections.kismetFullListings);
        } else {
          setKismetFullListings(null);
        }
        console.log(
          `[useKismetAuctions] Tier1 loaded in ${Math.round(performance.now() - startedAt)}ms`,
        );
      } catch (error) {
        console.warn("[useKismetAuctions] Tier1 fetch timed out or failed, keeping curated fallback:", error);
      }
    };

    void loadTier1();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hideAuctionCards) {
      setKismetHydrationDone(true);
      return;
    }

    let cancelled = false;
    setKismetHydrationDone(false);

    const loadTier2 = async () => {
      const startedAt = performance.now();
      if (shouldSkipDynamicRedesignFetch()) {
        console.log("[useKismetAuctions] Skipping tier2 hydration on constrained network");
        if (!cancelled) setKismetHydrationDone(true);
        return;
      }
      try {
        const ids = kismetTier1Lots.map((lot) => lot.listingId).join(",");
        const data = await fetchJsonWithTimeout(
          `/api/redesign/hydration?ids=${encodeURIComponent(ids)}`,
          TIER2_TIMEOUT_MS,
        );

        if (cancelled) return;
        const hydrated = (data?.items || {}) as Record<string, Tier2HydrationItem>;
        setKismetHydratedLots(hydrated);
        console.log(
          `[useKismetAuctions] Tier2 hydration loaded in ${Math.round(performance.now() - startedAt)}ms`,
        );
      } catch (error) {
        console.warn("[useKismetAuctions] Tier2 hydration timed out or failed, keeping placeholder pricing:", error);
      } finally {
        if (!cancelled) setKismetHydrationDone(true);
      }
    };

    void loadTier2();

    return () => {
      cancelled = true;
    };
  }, [kismetTier1Lots, hideAuctionCards]);

  return {
    kismetTier1Lots,
    kismetHydratedLots,
    kismetHydrationDone,
    kismetFullListings,
  };
}
