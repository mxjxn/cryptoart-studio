import { useState, useEffect, useRef } from 'react';
import type { EnrichedAuctionData } from '~/lib/types';
import { getAuction } from '~/lib/subgraph';

// Request deduplication: track in-flight requests to prevent duplicate fetches
const inFlightRequests = new Map<string, Promise<EnrichedAuctionData | null>>();

/** Server returned 504 — listing may exist; do not treat as 404. */
export const AUCTION_FETCH_TIMEOUT = 'CRYPTOART_AUCTION_FETCH_TIMEOUT';

export type UseAuctionOptions = {
  /**
   * When true, the first fetch for this `listingId` calls `/api/auctions/:id?refresh=1`
   * so the server bypasses `unstable_cache` (avoids stale listings missing metadata/title/image).
   */
  initialFresh?: boolean;
};

export function useAuction(listingId: string | null, options?: UseAuctionOptions) {
  const initialFresh = options?.initialFresh ?? false;
  const initialFreshConsumed = useRef(false);
  const [auction, setAuction] = useState<EnrichedAuctionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchAuction = async (forceRefresh = false) => {
    if (!listingId) return;
    
    // If forcing refresh, clear any in-flight request
    if (forceRefresh) {
      inFlightRequests.delete(listingId);
    }
    
    // Check if there's already an in-flight request for this listing
    const existingRequest = inFlightRequests.get(listingId);
    if (existingRequest && !forceRefresh) {
      try {
        const data = await existingRequest;
        setAuction(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch auction'));
        setAuction(null);
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // Create new request - use cache busting query param to bypass browser cache
    // The API endpoint cache will be invalidated server-side via revalidateTag
    const requestPromise = (async () => {
      let query = '';
      if (forceRefresh) {
        query = `?refresh=${Date.now()}`;
      } else if (initialFresh && !initialFreshConsumed.current) {
        initialFreshConsumed.current = true;
        query = '?refresh=1';
      }
      try {
        // Fetch directly from API with cache busting
        const response = await fetch(`/api/auctions/${listingId}${query}`, {
          cache: query ? 'no-store' : 'default',
        });
        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          if (response.status === 504) {
            throw new Error(AUCTION_FETCH_TIMEOUT);
          }
          throw new Error(`Failed to fetch auction: ${response.statusText}`);
        }
        const data = await response.json();
        return data.auction || null;
      } catch (err) {
        if (err instanceof Error && err.message === AUCTION_FETCH_TIMEOUT) {
          throw err;
        }
        // Fallback to getAuction if direct fetch fails (network, 5xx other than 504, etc.)
        return getAuction(listingId);
      }
    })();
    
    inFlightRequests.set(listingId, requestPromise);
    
    try {
      setLoading(true);
      setError(null);
      const data = await requestPromise;
      setAuction(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch auction'));
      setAuction(null);
    } finally {
      // Clean up in-flight request
      inFlightRequests.delete(listingId);
      setLoading(false);
    }
  };

  useEffect(() => {
    initialFreshConsumed.current = false;
  }, [listingId]);

  useEffect(() => {
    if (!listingId) {
      setLoading(false);
      return;
    }

    fetchAuction();
  }, [listingId, refreshKey]);

  // Refetch function that can be called externally
  const refetch = (forceRefresh = true) => {
    if (forceRefresh) {
      // Force a fresh fetch by calling fetchAuction directly with forceRefresh=true
      fetchAuction(true);
    } else {
      // Just trigger a normal refetch
      setRefreshKey(prev => prev + 1);
    }
  };

  // Optimistic update function for immediate UI updates
  const updateAuction = (updater: (prev: EnrichedAuctionData | null) => EnrichedAuctionData | null) => {
    setAuction(prev => updater(prev));
  };

  return { auction, loading, error, refetch, updateAuction };
}

