/**
 * BidForm component - allows users to place bids on auctions
 */

'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useBid, useListing } from '~/hooks/useMarketplace';
import { calculateMinimumBid, formatEth, parseEth, isAuctionActive } from '~/lib/auctions';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/input';

interface BidFormProps {
  listingId: number | bigint;
  onSuccess?: () => void;
}

export function BidForm({ listingId, onSuccess }: BidFormProps) {
  const { address, isConnected } = useAccount();
  const { listing, refetch } = useListing(listingId);
  const { bid, isPending, isConfirming, isConfirmed, error } = useBid();
  const [bidAmount, setBidAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isConfirmed && onSuccess) {
      onSuccess();
      refetch();
    }
  }, [isConfirmed, onSuccess, refetch]);

  if (!listing) {
    return null;
  }

  const minBid = calculateMinimumBid(listing);
  const minBidEth = formatEth(minBid);
  const isActive = isAuctionActive(listing);

  if (!isActive) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This auction is not currently active.
        </p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Connect your wallet to place a bid.
        </p>
      </div>
    );
  }

  const handleBid = async () => {
    setErrorMessage(null);

    if (!bidAmount) {
      setErrorMessage('Please enter a bid amount');
      return;
    }

    try {
      const amount = parseEth(bidAmount);
      if (amount < minBid) {
        setErrorMessage(`Minimum bid is ${minBidEth} ETH`);
        return;
      }

      await bid(Number(listingId), true, amount);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to place bid');
    }
  };

  const isLoading = isPending || isConfirming;

  return (
    <div className="space-y-4">
      <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Minimum Bid</span>
            <span className="font-semibold">{minBidEth} ETH</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Your Bid</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.001"
                min={minBidEth}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={minBidEth}
                className="w-24 h-8 text-sm"
                disabled={isLoading}
              />
              <span className="text-sm">ETH</span>
            </div>
          </div>
        </div>
      </div>

      {(error || errorMessage) && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
          {errorMessage || (error as Error)?.message || 'Failed to place bid'}
        </div>
      )}

      {isConfirmed && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm text-green-600 dark:text-green-400">
          Bid placed successfully!
        </div>
      )}

      <Button
        onClick={handleBid}
        disabled={isLoading || !bidAmount}
        className="w-full"
      >
        {isLoading ? 'Processing...' : 'Place Bid'}
      </Button>
    </div>
  );
}

