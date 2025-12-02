import { useState } from 'react';
import type { EnrichedAuctionData } from '~/lib/types';

/**
 * Hook to use server-rendered auctions data
 * No client-side fetching - data is fully server-side rendered
 * @param initialAuctions - Server-rendered auctions data
 * @returns Object with auctions array, loading state, and error state
 */
export function useActiveAuctions(initialAuctions: EnrichedAuctionData[] = []) {
  // Use server-rendered data directly, no client-side fetching
  const [auctions] = useState<EnrichedAuctionData[]>(initialAuctions);
  const loading = initialAuctions.length === 0;
  const error = null;

  return { auctions, loading, error };
}

