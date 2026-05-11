import { useReadContract } from "wagmi";
import { base, mainnet } from "wagmi/chains";
import {
  MARKETPLACE_ADDRESS,
  MARKETPLACE_ABI,
  ETHEREUM_MAINNET_MARKETPLACE_ADDRESS,
} from "~/lib/contracts/marketplace";
import { ETHEREUM_MAINNET_CHAIN_ID } from "~/lib/server/subgraph-endpoints";
import type { Offer } from "~/lib/types";

export type UseOffersOptions = {
  /** When `1`, reads offers from the Ethereum mainnet marketplace proxy. */
  chainId?: number;
};

/**
 * Hook to fetch offers for a listing
 */
export function useOffers(
  listingId: string | number | undefined,
  options?: UseOffersOptions
) {
  const chainId = options?.chainId;
  const onMainnet = chainId === ETHEREUM_MAINNET_CHAIN_ID;
  const { data, isLoading, error, refetch } = useReadContract({
    address: onMainnet ? ETHEREUM_MAINNET_MARKETPLACE_ADDRESS : MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    chainId: onMainnet ? mainnet.id : base.id,
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

