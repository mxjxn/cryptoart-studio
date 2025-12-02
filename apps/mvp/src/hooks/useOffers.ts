import { useReadContract } from "wagmi";
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI } from "~/lib/contracts/marketplace";
import type { Offer } from "~/lib/types";

/**
 * Hook to fetch offers for a listing
 */
export function useOffers(listingId: string | number | undefined) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "getOffers",
    args: listingId !== undefined ? [Number(listingId) as any] : undefined,
    query: {
      enabled: listingId !== undefined,
      retry: 1,
    },
  });

  // Transform contract data to Offer interface
  const offers: Offer[] = data
    ? (data as any[]).map((offer) => ({
        offerer: offer.offerer.toLowerCase(),
        amount: offer.amount.toString(),
        timestamp: offer.timestamp.toString(),
        accepted: offer.accepted,
      }))
    : [];

  // Filter out accepted offers for display
  const activeOffers = offers.filter((offer) => !offer.accepted);

  return {
    offers,
    activeOffers,
    isLoading,
    error,
    refetch,
  };
}

