import { createPublicClient, http, type PublicClient, type Address } from 'viem';
import { base, mainnet } from 'viem/chains';

/**
 * RPC client cache to avoid recreating clients
 */
const clients = new Map<number, PublicClient>();

/**
 * Get or create a viem public client for a chain
 */
export function getPublicClient(chainId: number): PublicClient {
  if (clients.has(chainId)) {
    return clients.get(chainId)!;
  }

  const rpcUrl = getRpcUrl(chainId);
  const chain = getChain(chainId);

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl, {
      timeout: 30_000,
      retryCount: 3,
      retryDelay: 1000,
    }),
  });

  clients.set(chainId, client);
  return client;
}

/**
 * Get RPC URL from environment variables
 */
function getRpcUrl(chainId: number): string {
  switch (chainId) {
    case 8453: // Base
      return process.env.BASE_RPC_URL || process.env.RPC_URL_BASE || 'https://mainnet.base.org';
    case 1: // Ethereum
      return process.env.ETH_RPC_URL || process.env.RPC_URL_MAINNET || `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
    default:
      throw new Error(`No RPC URL configured for chain ${chainId}`);
  }
}

/**
 * Get viem chain object
 */
function getChain(chainId: number) {
  switch (chainId) {
    case 8453:
      return base;
    case 1:
      return mainnet;
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`);
  }
}

/**
 * Get current block number with reorg safety margin
 * @param chainId - Chain ID
 * @param safetyMargin - Number of blocks to stay behind head (default: 3)
 */
export async function getSafeBlockNumber(chainId: number, safetyMargin = 3): Promise<bigint> {
  const client = getPublicClient(chainId);
  const latestBlock = await client.getBlockNumber();
  return latestBlock - BigInt(safetyMargin);
}

/**
 * Clear client cache (useful for testing)
 */
export function clearClientCache(): void {
  clients.clear();
}
