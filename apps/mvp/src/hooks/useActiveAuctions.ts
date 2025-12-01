import { useState, useEffect } from 'react';
import type { EnrichedAuctionData } from '~/lib/types';
import { getActiveAuctions } from '~/lib/subgraph';

export function useActiveAuctions() {
  const [auctions, setAuctions] = useState<EnrichedAuctionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchAuctions() {
      try {
        setLoading(true);
        setError(null);
        const data = await getActiveAuctions({ first: 16, skip: 0, enrich: true });
        setAuctions(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch auctions'));
        setAuctions([]);
      } finally {
        setLoading(false);
      }
    }

    fetchAuctions();
    
    // Poll every 30 seconds for updates
    const interval = setInterval(fetchAuctions, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return { auctions, loading, error };
}

