import {
  BASE_CHAIN_ID,
  ETHEREUM_MAINNET_CHAIN_ID,
} from "~/lib/server/subgraph-endpoints";

/** URL segment for Ethereum mainnet listing pages, e.g. `/listing/eth/42`. */
export const LISTING_CHAIN_SLUG_ETH = "eth" as const;

export function listingChainSlugToChainId(slug: string): number | null {
  if (slug === LISTING_CHAIN_SLUG_ETH) return ETHEREUM_MAINNET_CHAIN_ID;
  if (slug === "base") return BASE_CHAIN_ID;
  return null;
}

export function chainIdToListingChainSlug(chainId: number): string | null {
  if (chainId === ETHEREUM_MAINNET_CHAIN_ID) return LISTING_CHAIN_SLUG_ETH;
  if (chainId === BASE_CHAIN_ID) return "base";
  return null;
}

/** Prefer an explicit path for Ethereum mainnet; Base stays on `/listing/:id`. */
export function canonicalListingDetailPath(chainId: number, listingId: string): string {
  if (chainId === ETHEREUM_MAINNET_CHAIN_ID) {
    return `/listing/${LISTING_CHAIN_SLUG_ETH}/${listingId}`;
  }
  return `/listing/${listingId}`;
}
