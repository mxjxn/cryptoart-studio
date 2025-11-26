import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import type { AuctionData } from '@cryptoart/unified-indexer';
import { getAuctionsBySeller, getAuctionsWithBids } from '~/lib/subgraph';
import { Address } from 'viem';

export function useUserAuctions() {
  const { address } = useAccount();
  const [createdAuctions, setCreatedAuctions] = useState<AuctionData[]>([]);
  const [activeBids, setActiveBids] = useState<AuctionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    async function fetchUserAuctions() {
      try {
        setLoading(true);
        setError(null);
        
        const [created, bids] = await Promise.all([
          getAuctionsBySeller(address as Address, { first: 100, skip: 0 }),
          getAuctionsWithBids(address as Address, { first: 100, skip: 0 }),
        ]);
        
        setCreatedAuctions(created);
        setActiveBids(bids);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch user auctions'));
      } finally {
        setLoading(false);
      }
    }

    fetchUserAuctions();
    
    // Poll every 30 seconds for updates
    const interval = setInterval(fetchUserAuctions, 30000);
    
    return () => clearInterval(interval);
  }, [address]);

  return { createdAuctions, activeBids, loading, error };
}

