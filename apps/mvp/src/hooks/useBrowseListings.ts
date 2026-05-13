"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { EnrichedAuctionData } from "~/lib/types";
import { isERC721, isERC1155, FARCON_STATIC_PREVIEW } from "~/lib/homepage-static-data";

type TokenSpecFilter = "ERC721" | "ERC1155";

function matchesSpec(tokenSpec: EnrichedAuctionData["tokenSpec"], filter: TokenSpecFilter): boolean {
  return filter === "ERC721" ? isERC721(tokenSpec) : isERC1155(tokenSpec);
}

function parseStreamedListings(
  buffer: string,
  listings: EnrichedAuctionData[],
  filter: TokenSpecFilter,
  onListing: (filtered: EnrichedAuctionData[]) => void,
): { listings: EnrichedAuctionData[]; metadata: { subgraphDown?: boolean; degraded?: boolean; count?: number } } {
  let listingsArrayStart = buffer.indexOf('"listings":[');
  if (listingsArrayStart === -1) return { listings, metadata: {} };
  listingsArrayStart += 11;

  const metadata: { subgraphDown?: boolean; degraded?: boolean; count?: number } = {};
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  let startIdx = -1;
  const listingsPart = buffer.substring(listingsArrayStart);

  for (let i = 0; i < listingsPart.length; i++) {
    const char = listingsPart[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === "\\") {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === "{") {
        if (braceCount === 0) startIdx = i;
        braceCount++;
      } else if (char === "}") {
        braceCount--;
        if (braceCount === 0 && startIdx !== -1) {
          try {
            const listingJson = listingsPart.substring(startIdx, i + 1);
            const listing = JSON.parse(listingJson);
            if (listing.listingId && !listings.find((l) => l.listingId === listing.listingId)) {
              listings.push(listing);
              const filtered = listings.filter((l: EnrichedAuctionData) => matchesSpec(l.tokenSpec, filter));
              if (filtered.length > 0) onListing(filtered);
            }
          } catch {
            // Partial JSON, will be completed in next chunk
          }
          startIdx = -1;
        }
      } else if (char === "]" && braceCount === 0) {
        const afterArray = buffer.substring(listingsArrayStart + i);
        try {
          const metaMatch = afterArray.match(/"count":(\d+)/);
          if (metaMatch) metadata.count = parseInt(metaMatch[1]);
          const subgraphMatch = afterArray.match(/"subgraphDown":(true|false)/);
          if (subgraphMatch) metadata.subgraphDown = subgraphMatch[1] === "true";
          const degradedMatch = afterArray.match(/"degraded":(true|false)/);
          if (degradedMatch) metadata.degraded = degradedMatch[1] === "true";
        } catch {
          // Continue
        }
        break;
      }
    }
  }

  return { listings, metadata };
}

export function useBrowseListings(options: {
  tokenSpec: TokenSpecFilter;
  displayCount?: number;
  initialFetchCount?: number;
  loadMoreCount?: number;
  enabled?: boolean;
}) {
  const {
    tokenSpec,
    displayCount = 4,
    initialFetchCount = 20,
    loadMoreCount = 20,
    enabled = true,
  } = options;

  const [listings, setListings] = useState<EnrichedAuctionData[]>(
    FARCON_STATIC_PREVIEW ? [] : [],
  );
  const [expandedListings, setExpandedListings] = useState<EnrichedAuctionData[]>([]);
  const [loading, setLoading] = useState(!FARCON_STATIC_PREVIEW);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subgraphDown, setSubgraphDown] = useState(false);
  const [hasMore, setHasMore] = useState(!FARCON_STATIC_PREVIEW);

  const loadingRef = useRef(true);
  const hasInitializedRef = useRef(false);
  const expandedRef = useRef(FARCON_STATIC_PREVIEW);

  const label = tokenSpec === "ERC721" ? "NFTs" : "Editions";

  const fetchRecent = useCallback(async () => {
    setLoading(true);
    loadingRef.current = true;
    setError(null);
    try {
      console.log(`[useBrowseListings:${label}] Fetching recent ${label}...`, { fetchCount: initialFetchCount });
      const startTime = Date.now();

      const response = await fetch(
        `/api/listings/browse?first=${initialFetchCount}&skip=0&orderBy=createdAt&orderDirection=desc&enrich=true&stream=true`,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      if (!response.body) throw new Error("Response body is null");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let allListings: EnrichedAuctionData[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const result = parseStreamedListings(buffer, allListings, tokenSpec, (filtered) => {
          if (filtered.length > 0) setListings(filtered.slice(0, displayCount));
        });
        allListings = result.listings;
      }

      try {
        const finalData = JSON.parse(buffer);
        if (finalData.listings && Array.isArray(finalData.listings)) {
          allListings = finalData.listings;
        }
      } catch {
        // Buffer might be incomplete, that's okay
      }

      const filtered = allListings.filter((l: EnrichedAuctionData) => matchesSpec(l.tokenSpec, tokenSpec));
      const fetchTime = Date.now() - startTime;
      console.log(`[useBrowseListings:${label}] fetch completed in ${fetchTime}ms, ${filtered.length} ${label} from ${allListings.length} total`);

      setListings(filtered.slice(0, displayCount));

      let isDown = false;
      try {
        const finalData = JSON.parse(buffer);
        isDown = finalData.subgraphDown || finalData.degraded || false;
      } catch {}
      setSubgraphDown(isDown);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to fetch ${label}`;
      console.error(`[useBrowseListings:${label}] Error:`, errorMessage, err);
      setError(errorMessage);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [displayCount, initialFetchCount, tokenSpec, label]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || expandedRef.current) return;

    setLoadingMore(true);
    expandedRef.current = true;

    try {
      const skip = initialFetchCount;
      const response = await fetch(
        `/api/listings/browse?first=${loadMoreCount}&skip=${skip}&orderBy=createdAt&orderDirection=desc&enrich=true&stream=true`,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      if (!response.body) throw new Error("Response body is null");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let allListings: EnrichedAuctionData[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const result = parseStreamedListings(buffer, allListings, tokenSpec, (filtered) => {
          setExpandedListings(filtered);
        });
        allListings = result.listings;
      }

      try {
        const finalData = JSON.parse(buffer);
        if (finalData.listings && Array.isArray(finalData.listings)) {
          allListings = finalData.listings;
        }
      } catch {
        // Buffer might be incomplete
      }

      const filtered = allListings.filter((l: EnrichedAuctionData) => matchesSpec(l.tokenSpec, tokenSpec));
      setExpandedListings(filtered);

      if (filtered.length < loadMoreCount) {
        setHasMore(false);
      }
    } catch (err) {
      console.error(`[useBrowseListings:${label}] Error loading more:`, err);
    } finally {
      setLoadingMore(false);
    }
  }, [initialFetchCount, loadMoreCount, hasMore, loadingMore, tokenSpec, label]);

  useEffect(() => {
    if (!enabled) return;
    if (FARCON_STATIC_PREVIEW) return;
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    fetchRecent();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") fetchRecent();
    };
    const handleFocus = () => fetchRecent();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchRecent, enabled]);

  return {
    listings,
    expandedListings,
    loading,
    loadingMore,
    error,
    subgraphDown,
    hasMore,
    loadMore,
  };
}
