import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useMiniApp } from '@neynar/react';
import type { AuctionData } from '@cryptoart/unified-indexer';
import { getAuctionsBySeller, getAuctionsWithBids } from '~/lib/subgraph';
import { Address } from 'viem';

export function useUserAuctions() {
  const { address } = useAccount();
  const { context } = useMiniApp();
  
  // Get verified addresses from Farcaster if available
  const farcasterAddress = useMemo(() => {
    if (!context?.user) return null;
    return (
      (context.user as any).verified_addresses?.primary?.eth_address ||
      (context.user as any).custody_address ||
      ((context.user as any).verifications?.[0] as string)
    );
  }, [context?.user]);
  
  // Use connected wallet address, or fall back to Farcaster verified address
  const userAddress = address || farcasterAddress;
  
  const [createdAuctions, setCreatedAuctions] = useState<AuctionData[]>([]);
  const [activeBids, setActiveBids] = useState<AuctionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userAddress) {
      setLoading(false);
      return;
    }

    async function fetchUserAuctions() {
      try {
        setLoading(true);
        setError(null);
        
        const [created, bids] = await Promise.all([
          getAuctionsBySeller(userAddress as Address, { first: 100, skip: 0 }),
          getAuctionsWithBids(userAddress as Address, { first: 100, skip: 0 }),
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
  }, [userAddress]);

  return { createdAuctions, activeBids, loading, error };
}

