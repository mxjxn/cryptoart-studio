import { useState, useEffect } from 'react';
import type { EnrichedAuctionData } from '~/lib/types';
import { getAuction } from '~/lib/subgraph';

// Request deduplication: track in-flight requests to prevent duplicate fetches
const inFlightRequests = new Map<string, Promise<EnrichedAuctionData | null>>();

export function useAuction(listingId: string | null) {
  const [auction, setAuction] = useState<EnrichedAuctionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!listingId) {
      setLoading(false);
      return;
    }

    async function fetchAuction() {
      if (!listingId) return;
      
      // Check if there's already an in-flight request for this listing
      const existingRequest = inFlightRequests.get(listingId);
      if (existingRequest) {
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
      
      // Create new request
      const requestPromise = getAuction(listingId);
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
    }

    fetchAuction();
  }, [listingId]);

  return { auction, loading, error };
}

