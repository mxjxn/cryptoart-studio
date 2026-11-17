export const BASE_CHAIN_ID = 8453;
export const ETHEREUM_CHAIN_ID = 1;

export const BASE_MARKETPLACE_ADDRESS = '0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9' as const;
export const ETHEREUM_MARKETPLACE_ADDRESS = '0x3CEE515879FFe4620a1F8aC9bf09B97e858815Ef' as const;

export type MarketplaceChainId = typeof BASE_CHAIN_ID | typeof ETHEREUM_CHAIN_ID;

export const BASE_SEPOLIA_CHAIN_ID = 84532;

/**
 * Known mainnet proxies live in this package. Other chains, including Base
 * Sepolia (84532), need the address passed in from `CHAIN_<id>_MARKETPLACE_ADDRESS`.
 */
export function marketplaceAddress(chainId: number, configured?: string | null) {
  const override = configured?.trim();
  if (override) return override;
  if (chainId === ETHEREUM_CHAIN_ID) return ETHEREUM_MARKETPLACE_ADDRESS;
  if (chainId === BASE_CHAIN_ID) return BASE_MARKETPLACE_ADDRESS;
  throw new Error(
    `Unsupported marketplace chain ${chainId}. Set CHAIN_${chainId}_MARKETPLACE_ADDRESS.`,
  );
}

export const CRYPTOART_SOCIAL_ORIGIN = 'https://cryptoart.social' as const;

export function listingPath(chainId: number, listingId: string) {
  if (chainId === ETHEREUM_CHAIN_ID) return `/listing/eth/${listingId}`;
  if (chainId === BASE_CHAIN_ID) return `/listing/base/${listingId}`;
  throw new Error(`Unsupported marketplace chain ${chainId}`);
}

/** Public listing page on cryptoart.social. Preview chains like Base Sepolia return null. */
export function listingPublicUrl(chainId: number, listingId: string): string | null {
  try {
    return `${CRYPTOART_SOCIAL_ORIGIN}${listingPath(chainId, listingId)}`;
  } catch {
    return null;
  }
}

export function parseListingPath(pathname: string): { chainId: MarketplaceChainId; listingId: string } | null {
  const match = /^\/listing\/(?:(eth|base)\/)?(\d+)\/?$/.exec(pathname);
  if (!match) return null;
  const listingId = BigInt(match[2]!).toString();
  const chainId = match[1] === 'eth' ? ETHEREUM_CHAIN_ID : BASE_CHAIN_ID;
  return { chainId, listingId };
}
