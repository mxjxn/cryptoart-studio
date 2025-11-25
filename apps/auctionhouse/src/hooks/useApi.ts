/**
 * Hook to fetch active auctions from API
 */

import { useState, useEffect } from 'react';

// Use NEXT_PUBLIC_API_URL if set, otherwise use relative paths (same origin)
// This allows for a separate API server if needed, but defaults to same-app routes
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface Listing {
  listingId: number;
  seller: string;
  finalized: boolean;
  listingType: number;
  initialAmount: string;
  endTime: string;
  tokenId: string;
  tokenAddress: string;
  currentBidAmount?: string;
  currentBidder?: string;
  metadata?: {
    name?: string;
    image?: string;
    description?: string;
  };
}

export function useActiveAuctions() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchActiveAuctions = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/listings/active`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch active auctions');
        }

        const data = await response.json();
        setListings(data.listings || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setListings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveAuctions();
    
    // Poll every 30 seconds for updates
    const interval = setInterval(fetchActiveAuctions, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return { listings, loading, error };
}

export function useListing(listingId: number | bigint | null) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!listingId) {
      setLoading(false);
      return;
    }

    const fetchListing = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/listings/${listingId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setListing(null);
            setError(null);
            return;
          }
          throw new Error('Failed to fetch listing');
        }

        const data = await response.json();
        setListing(data.listing);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setListing(null);
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
    
    // Poll every 10 seconds for updates
    const interval = setInterval(fetchListing, 10000);
    
    return () => clearInterval(interval);
  }, [listingId]);

  return { listing, loading, error };
}

