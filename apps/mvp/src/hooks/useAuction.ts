import { useState, useEffect } from 'react';
import type { EnrichedAuctionData } from '~/lib/types';
import { getAuction } from '~/lib/subgraph';

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
      
      try {
        setLoading(true);
        setError(null);
        const data = await getAuction(listingId);
        setAuction(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch auction'));
        setAuction(null);
      } finally {
        setLoading(false);
      }
    }

    fetchAuction();
  }, [listingId]);

  return { auction, loading, error };
}

