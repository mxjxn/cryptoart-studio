import { useState, useEffect } from 'react';
import type { AuctionData } from '@cryptoart/unified-indexer';
import { getAuction } from '~/lib/subgraph';

export function useAuction(listingId: string | null) {
  const [auction, setAuction] = useState<AuctionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!listingId) {
      setLoading(false);
      return;
    }

    async function fetchAuction() {
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
    
    // Poll every 10 seconds for updates
    const interval = setInterval(fetchAuction, 10000);
    
    return () => clearInterval(interval);
  }, [listingId]);

  return { auction, loading, error };
}

