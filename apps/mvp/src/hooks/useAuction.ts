import { useState, useEffect, useRef } from "react";
import type { EnrichedAuctionData } from "~/lib/types";
import { getAuction } from "~/lib/subgraph";
import {
  AmbiguousListingError,
  isAmbiguousListingError,
  parseAmbiguousChainsFromBody,
} from "~/lib/auction-errors";
import { BASE_CHAIN_ID, ETHEREUM_MAINNET_CHAIN_ID } from "~/lib/server/subgraph-endpoints";

// Request deduplication: track in-flight requests to prevent duplicate fetches
const inFlightRequests = new Map<string, Promise<EnrichedAuctionData | null>>();

function auctionRequestKey(listingId: string, chainId?: number) {
  return `${listingId}::${chainId ?? ""}`;
}

function normalizeAmbiguousChains(chains: number[]): number[] {
  const u = [...new Set(chains.filter((n) => Number.isFinite(n)))].sort(
    (a, b) => a - b
  );
  return u.length >= 2 ? u : [ETHEREUM_MAINNET_CHAIN_ID, BASE_CHAIN_ID];
}

/** Server returned 504 — listing may exist; do not treat as 404. */
export const AUCTION_FETCH_TIMEOUT = "CRYPTOART_AUCTION_FETCH_TIMEOUT";

export type UseAuctionOptions = {
  /**
   * When true, the first fetch for this `listingId` calls `/api/auctions/:id?refresh=1`
   * so the server bypasses `unstable_cache` (avoids stale listings missing metadata/title/image).
   */
  initialFresh?: boolean;
  /** When set, fetches that subgraph only (e.g. `1` for Ethereum mainnet at `/listing/eth/…`). */
  chainId?: number;
};

export function useAuction(listingId: string | null, options?: UseAuctionOptions) {
  const initialFresh = options?.initialFresh ?? false;
  const chainIdOpt = options?.chainId;
  const initialFreshConsumed = useRef(false);
  const [auction, setAuction] = useState<EnrichedAuctionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  /** Set when `GET /api/auctions/:id` returns 409 without `chainId` (same id on multiple chains). */
  const [ambiguousChains, setAmbiguousChains] = useState<number[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchAuction = async (forceRefresh = false) => {
    if (!listingId) return;

    const reqKey = auctionRequestKey(listingId, chainIdOpt);
    if (forceRefresh) {
      inFlightRequests.delete(reqKey);
    }

    const existingRequest = inFlightRequests.get(reqKey);
    if (existingRequest && !forceRefresh) {
      try {
        const data = await existingRequest;
        setAmbiguousChains(null);
        setAuction(data);
        setError(null);
      } catch (err) {
        if (isAmbiguousListingError(err)) {
          setAmbiguousChains(normalizeAmbiguousChains(err.chains));
          setAuction(null);
          setError(null);
        } else {
          setError(err instanceof Error ? err : new Error("Failed to fetch auction"));
          setAuction(null);
          setAmbiguousChains(null);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    const requestPromise = (async () => {
      const params = new URLSearchParams();
      if (forceRefresh) {
        params.set("refresh", String(Date.now()));
      } else if (initialFresh && !initialFreshConsumed.current) {
        initialFreshConsumed.current = true;
        params.set("refresh", "1");
      }
      if (chainIdOpt != null) {
        params.set("chainId", String(chainIdOpt));
      }
      const qs = params.toString();
      try {
        const response = await fetch(`/api/auctions/${listingId}${qs ? `?${qs}` : ""}`, {
          cache: qs ? "no-store" : "default",
        });
        if (response.status === 404) {
          return null;
        }
        if (response.status === 409) {
          let body: unknown;
          try {
            body = await response.json();
          } catch {
            body = {};
          }
          throw new AmbiguousListingError(
            listingId,
            parseAmbiguousChainsFromBody(body)
          );
        }
        if (response.status === 504) {
          throw new Error(AUCTION_FETCH_TIMEOUT);
        }
        if (!response.ok) {
          throw new Error(`Failed to fetch auction: ${response.statusText}`);
        }
        const data = await response.json();
        return data.auction || null;
      } catch (err) {
        if (err instanceof AmbiguousListingError) {
          throw err;
        }
        if (err instanceof Error && err.message === AUCTION_FETCH_TIMEOUT) {
          throw err;
        }
        return getAuction(listingId, { chainId: chainIdOpt });
      }
    })();

    inFlightRequests.set(reqKey, requestPromise);

    try {
      setLoading(true);
      setError(null);
      const data = await requestPromise;
      setAmbiguousChains(null);
      setAuction(data);
    } catch (err) {
      if (isAmbiguousListingError(err)) {
        setAmbiguousChains(normalizeAmbiguousChains(err.chains));
        setAuction(null);
        setError(null);
      } else {
        setAmbiguousChains(null);
        setError(err instanceof Error ? err : new Error("Failed to fetch auction"));
        setAuction(null);
      }
    } finally {
      inFlightRequests.delete(auctionRequestKey(listingId, chainIdOpt));
      setLoading(false);
    }
  };

  useEffect(() => {
    initialFreshConsumed.current = false;
  }, [listingId, chainIdOpt]);

  useEffect(() => {
    setAmbiguousChains(null);
  }, [listingId, chainIdOpt]);

  useEffect(() => {
    if (!listingId) {
      setLoading(false);
      return;
    }

    fetchAuction();
  }, [listingId, refreshKey, chainIdOpt]);

  const refetch = (forceRefresh = true) => {
    if (forceRefresh) {
      fetchAuction(true);
    } else {
      setRefreshKey((prev) => prev + 1);
    }
  };

  const updateAuction = (updater: (prev: EnrichedAuctionData | null) => EnrichedAuctionData | null) => {
    setAuction((prev) => updater(prev));
  };

  return { auction, loading, error, ambiguousChains, refetch, updateAuction };
}
