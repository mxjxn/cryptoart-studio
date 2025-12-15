import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useMiniApp } from '@neynar/react';
import type { AuctionData, EnrichedAuctionData } from '~/lib/types';
import { getAuctionsBySeller, getAuctionsWithBids, getAuctionsWithOffers } from '~/lib/subgraph';
import { Address } from 'viem';

export function useUserAuctions() {
  const { address } = useAccount();
  const { context } = useMiniApp();
  
  // Get verified addresses from Farcaster mini-app if available
  const farcasterMiniAppAddress = useMemo(() => {
    if (!context?.user) return null;
    return (
      (context.user as any).verified_addresses?.primary?.eth_address ||
      (context.user as any).custody_address ||
      ((context.user as any).verifications?.[0] as string)
    );
  }, [context?.user]);
  
  // Use connected wallet address, or fall back to Farcaster verified address
  const userAddress = address || farcasterMiniAppAddress;
  
  const [createdAuctions, setCreatedAuctions] = useState<AuctionData[]>([]);
  // activeBids is enriched data (enrich=true), so it includes highestBid and metadata
  const [activeBids, setActiveBids] = useState<EnrichedAuctionData[]>([]);
  const [activeOffers, setActiveOffers] = useState<AuctionData[]>([]);
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
        
        const [created, bids, offers] = await Promise.all([
          getAuctionsBySeller(userAddress as Address, { first: 100, skip: 0 }),
          getAuctionsWithBids(userAddress as Address, { first: 100, skip: 0 }),
          getAuctionsWithOffers(userAddress as Address, { first: 100, skip: 0 }),
        ]);
        
        setCreatedAuctions(created);
        // Don't filter here - we'll filter in the UI to show finalized in collected tab
        // getAuctionsWithBids returns enriched data (enrich=true), so cast to EnrichedAuctionData[]
        setActiveBids(bids as EnrichedAuctionData[]);
        setActiveOffers(offers);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch user auctions'));
      } finally {
        setLoading(false);
      }
    }

    fetchUserAuctions();
    
    // Poll every 180 seconds (3 minutes) for updates
    // Reduced from 30s to reduce subgraph load while maintaining reasonable freshness
    const interval = setInterval(fetchUserAuctions, 180000);
    
    return () => clearInterval(interval);
  }, [userAddress]);

  return { createdAuctions, activeBids, activeOffers, loading, error };
}

