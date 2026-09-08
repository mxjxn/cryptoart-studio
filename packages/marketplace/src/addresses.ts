export const BASE_CHAIN_ID = 8453;
export const ETHEREUM_CHAIN_ID = 1;

export const BASE_MARKETPLACE_ADDRESS = '0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9' as const;
export const ETHEREUM_MARKETPLACE_ADDRESS = '0x3CEE515879FFe4620a1F8aC9bf09B97e858815Ef' as const;

export type MarketplaceChainId = typeof BASE_CHAIN_ID | typeof ETHEREUM_CHAIN_ID;

export function marketplaceAddress(chainId: number) {
  if (chainId === ETHEREUM_CHAIN_ID) return ETHEREUM_MARKETPLACE_ADDRESS;
  if (chainId === BASE_CHAIN_ID) return BASE_MARKETPLACE_ADDRESS;
  throw new Error(`Unsupported marketplace chain ${chainId}`);
}

export function listingPath(chainId: number, listingId: string) {
  if (chainId === ETHEREUM_CHAIN_ID) return `/listing/eth/${listingId}`;
  if (chainId === BASE_CHAIN_ID) return `/listing/base/${listingId}`;
  throw new Error(`Unsupported marketplace chain ${chainId}`);
}

export function parseListingPath(pathname: string): { chainId: MarketplaceChainId; listingId: string } | null {
  const match = /^\/listing\/(?:(eth|base)\/)?(\d+)\/?$/.exec(pathname);
  if (!match) return null;
  const listingId = BigInt(match[2]!).toString();
  const chainId = match[1] === 'eth' ? ETHEREUM_CHAIN_ID : BASE_CHAIN_ID;
  return { chainId, listingId };
}
