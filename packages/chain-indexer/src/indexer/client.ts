import { createPublicClient, http, type PublicClient, type Address } from 'viem';
import { base, baseSepolia, mainnet } from 'viem/chains';

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
  }) as unknown as PublicClient;

  clients.set(chainId, client);
  return client;
}

/**
 * Get RPC URL from environment variables
 * Uses CHAIN_<id>_RPC_URL pattern
 */
function getRpcUrl(chainId: number): string {
  const envKey = `CHAIN_${chainId}_RPC_URL`;
  const rpcUrl = process.env[envKey];
  
  if (!rpcUrl) {
    throw new Error(`No RPC URL configured for chain ${chainId}. Set ${envKey} environment variable.`);
  }
  
  return rpcUrl;
}

/**
 * Get viem chain object
 */
function getChain(chainId: number) {
  switch (chainId) {
    case 8453: // Base
      return base;
    case 84532: // Base Sepolia
      return baseSepolia;
    case 1: // Ethereum Mainnet
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
