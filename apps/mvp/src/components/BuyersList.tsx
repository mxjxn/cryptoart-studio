"use client";

import { useState, useEffect } from "react";
import { TransitionLink } from "./TransitionLink";
import { useUsername } from "~/hooks/useUsername";

interface Buyer {
  address: string;
  totalCount: number;
  firstPurchase: string;
  lastPurchase: string;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
  fid: number | null;
}

interface BuyersListProps {
  listingId: string;
  onBuyerAdded?: (buyer: Buyer) => void;
}

export function BuyersList({ listingId, onBuyerAdded }: BuyersListProps) {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBuyers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/listings/${listingId}/purchases`, {
        cache: 'no-store', // Always fetch fresh data
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch buyers');
      }
      
      const data = await response.json();
      setBuyers(data.buyers || []);
    } catch (err) {
      console.error('Error fetching buyers:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (listingId) {
      fetchBuyers();
    }
  }, [listingId]);

  // Listen for buyer added events (for optimistic updates)
  useEffect(() => {
    if (onBuyerAdded) {
      // This will be called from parent component when purchase succeeds
      const handleBuyerAdded = (buyer: Buyer) => {
        setBuyers(prev => {
          // Check if buyer already exists
          const existingIndex = prev.findIndex(
            b => b.address.toLowerCase() === buyer.address.toLowerCase()
          );
          
          if (existingIndex >= 0) {
            // Update existing buyer's count
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              totalCount: updated[existingIndex].totalCount + buyer.totalCount,
              lastPurchase: buyer.lastPurchase,
            };
            // Re-sort by last purchase
            return updated.sort(
              (a, b) => parseInt(b.lastPurchase) - parseInt(a.lastPurchase)
            );
          } else {
            // Add new buyer and sort
            return [...prev, buyer].sort(
              (a, b) => parseInt(b.lastPurchase) - parseInt(a.lastPurchase)
            );
          }
        });
      };
      
      // Store handler for parent to call
      (window as any)[`buyerAdded_${listingId}`] = handleBuyerAdded;
      
      return () => {
        delete (window as any)[`buyerAdded_${listingId}`];
      };
    }
  }, [listingId, onBuyerAdded]);

  if (loading && buyers.length === 0) {
    return null; // Don't show loading state, just return nothing
  }

  if (error && buyers.length === 0) {
    return null; // Don't show error state, just return nothing
  }

  if (buyers.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <h3 className="text-xs font-medium text-[#999999] mb-2 uppercase tracking-wider">
        Buyers ({buyers.length})
      </h3>
      <div className="space-y-1">
        {buyers.map((buyer) => (
          <BuyerRow key={buyer.address} buyer={buyer} />
        ))}
      </div>
    </div>
  );
}

function BuyerRow({ buyer }: { buyer: Buyer }) {
  const { username } = useUsername(buyer.address);
  const displayName = buyer.username || buyer.displayName || username;
  const pfpUrl = buyer.pfpUrl;

  return (
    <div className="flex items-center justify-between py-1.5 text-xs border-b border-[#222]">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {pfpUrl ? (
          <img
            src={pfpUrl}
            alt={displayName || buyer.address}
            className="w-5 h-5 rounded-full flex-shrink-0"
            onError={(e) => {
              // Hide image on error
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-white/10 flex-shrink-0" />
        )}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {displayName ? (
            <TransitionLink
              href={`/user/${buyer.username || buyer.address}`}
              className="text-white hover:underline truncate"
            >
              {displayName}
            </TransitionLink>
          ) : (
            <TransitionLink
              href={`/user/${buyer.address}`}
              className="font-mono text-white hover:underline truncate"
            >
              {buyer.address.slice(0, 6)}...{buyer.address.slice(-4)}
            </TransitionLink>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[#999999] flex-shrink-0 ml-2">
        <span className="font-medium text-white">{buyer.totalCount}</span>
        <span className="text-[#666]">•</span>
        <span className="font-mono text-[10px]">{buyer.address.slice(0, 6)}...{buyer.address.slice(-4)}</span>
      </div>
    </div>
  );
}

