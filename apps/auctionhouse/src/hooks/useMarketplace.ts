/**
 * React hooks for interacting with marketplace contract
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent } from 'wagmi';
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI } from '~/lib/contracts/marketplace';
import { type Listing } from '~/lib/contracts/types';

/**
 * Hook to fetch a single listing by ID
 */
export function useListing(listingId: number | bigint | null) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: 'getListing',
    args: listingId !== null ? [BigInt(listingId)] : undefined,
    query: {
      enabled: listingId !== null,
    },
  });

  return {
    listing: data as Listing | undefined,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to get current price of a listing
 */
export function useListingCurrentPrice(listingId: number | bigint | null) {
  const { data, isLoading, error } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: 'getListingCurrentPrice',
    args: listingId !== null ? [BigInt(listingId)] : undefined,
    query: {
      enabled: listingId !== null,
    },
  });

  return {
    currentPrice: data as bigint | undefined,
    isLoading,
    error,
  };
}

/**
 * Hook to place a bid on an auction
 */
export function useBid() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const bid = async (listingId: number | bigint, increase: boolean = true, value?: bigint) => {
    try {
      await writeContract({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: 'bid',
        args: [BigInt(listingId), increase],
        value: value,
      });
    } catch (err) {
      console.error('Error placing bid:', err);
      throw err;
    }
  };

  return {
    bid,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}

/**
 * Hook to watch for new bids on a listing
 */
export function useWatchBids(listingId: number | bigint | null, onBid?: (bidder: string, amount: bigint) => void) {
  useWatchContractEvent({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    eventName: 'BidEvent',
    args: listingId !== null ? { listingId: BigInt(listingId) } : undefined,
    onLogs(logs) {
      logs.forEach((log) => {
        if (onBid && log.args.bidder && log.args.amount) {
          onBid(log.args.bidder, log.args.amount);
        }
      });
    },
  });
}

