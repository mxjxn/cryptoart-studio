import {
  BASE_CHAIN_ID,
  ETHEREUM_MAINNET_CHAIN_ID,
} from "~/lib/server/subgraph-endpoints";

/** URL segment for Ethereum mainnet listing pages, e.g. `/listing/eth/42`. */
export const LISTING_CHAIN_SLUG_ETH = "eth" as const;
export const LISTING_CHAIN_SLUG_BASE = "base" as const;

export type ListingChainSlug =
  | typeof LISTING_CHAIN_SLUG_ETH
  | typeof LISTING_CHAIN_SLUG_BASE;

export type SupportedListingChainId =
  | typeof BASE_CHAIN_ID
  | typeof ETHEREUM_MAINNET_CHAIN_ID;

const ALLOWED_LISTING_CHAIN_IDS = new Set<SupportedListingChainId>([
  BASE_CHAIN_ID,
  ETHEREUM_MAINNET_CHAIN_ID,
]);

const CHAIN_NAME_TO_CHAIN_ID: Readonly<Record<string, SupportedListingChainId>> = {
  base: BASE_CHAIN_ID,
  basemainnet: BASE_CHAIN_ID,
  eth: ETHEREUM_MAINNET_CHAIN_ID,
  ethereum: ETHEREUM_MAINNET_CHAIN_ID,
  ethereummainnet: ETHEREUM_MAINNET_CHAIN_ID,
  mainnet: ETHEREUM_MAINNET_CHAIN_ID,
};

function sanitizeChainName(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function normalizeSupportedListingChainId(
  raw: unknown
): SupportedListingChainId | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return ALLOWED_LISTING_CHAIN_IDS.has(raw as SupportedListingChainId)
      ? (raw as SupportedListingChainId)
      : null;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return null;

    const parsed = parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return ALLOWED_LISTING_CHAIN_IDS.has(parsed as SupportedListingChainId)
        ? (parsed as SupportedListingChainId)
        : null;
    }

    return CHAIN_NAME_TO_CHAIN_ID[sanitizeChainName(trimmed)] ?? null;
  }

  return null;
}

export function deriveSupportedListingChainId(options: {
  chainId?: unknown;
  chainSlug?: unknown;
  chainName?: unknown;
  network?: unknown;
}): SupportedListingChainId | null {
  return (
    normalizeSupportedListingChainId(options.chainId) ??
    normalizeSupportedListingChainId(options.chainSlug) ??
    normalizeSupportedListingChainId(options.chainName) ??
    normalizeSupportedListingChainId(options.network)
  );
}

export function listingChainSlugToChainId(slug: string): number | null {
  if (slug === LISTING_CHAIN_SLUG_ETH) return ETHEREUM_MAINNET_CHAIN_ID;
  if (slug === LISTING_CHAIN_SLUG_BASE) return BASE_CHAIN_ID;
  return null;
}

export function chainIdToListingChainSlug(chainId: number): ListingChainSlug | null {
  if (chainId === ETHEREUM_MAINNET_CHAIN_ID) return LISTING_CHAIN_SLUG_ETH;
  if (chainId === BASE_CHAIN_ID) return LISTING_CHAIN_SLUG_BASE;
  return null;
}

/** Prefer an explicit path for Ethereum mainnet; Base stays on `/listing/:id`. */
export function canonicalListingDetailPath(chainId: number, listingId: string): string {
  if (chainId === ETHEREUM_MAINNET_CHAIN_ID) {
    return `/listing/${LISTING_CHAIN_SLUG_ETH}/${listingId}`;
  }
  return `/listing/${listingId}`;
}

export function explicitListingDetailPath(chainId: number, listingId: string): string {
  const slug = chainIdToListingChainSlug(chainId);
  return slug ? `/listing/${slug}/${listingId}` : `/listing/${listingId}`;
}

/** Parse `?chainId=` from listing URLs (legacy market links, shared links). */
export function parseListingChainIdQueryParam(
  raw: string | null | undefined
): number | null {
  return normalizeSupportedListingChainId(raw);
}
