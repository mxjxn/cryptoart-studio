import { useState, useEffect } from 'react';
import type { AuctionData } from '@cryptoart/unified-indexer';
import { getActiveAuctions } from '~/lib/subgraph';

export function useActiveAuctions() {
  const [auctions, setAuctions] = useState<AuctionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchAuctions() {
      try {
        setLoading(true);
        setError(null);
        const data = await getActiveAuctions({ first: 100, skip: 0 });
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

