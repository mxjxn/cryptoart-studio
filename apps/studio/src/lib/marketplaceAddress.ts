import { marketplaceAddress } from '@cryptoart/marketplace';

/**
 * Server-only. Reads `CHAIN_<chainId>_MARKETPLACE_ADDRESS` at request time.
 * Base (8453) and Ethereum (1) fall back to the addresses in @cryptoart/marketplace.
 * Base Sepolia (84532) has no fallback.
 */
export function configuredMarketplaceAddress(chainId: number): string | null {
  const fromEnv = process.env[`CHAIN_${chainId}_MARKETPLACE_ADDRESS`];
  try {
    return marketplaceAddress(chainId, fromEnv);
  } catch {
    return null;
  }
}
