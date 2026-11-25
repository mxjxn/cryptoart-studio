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

/** Public-node defaults (archive getLogs; avoid Alchemy free-tier 10-block window). */
export const DEFAULT_CHAIN_RPC_URLS: Partial<Record<number, string>> = {
  8453: 'https://base-rpc.publicnode.com',
  1: 'https://ethereum-rpc.publicnode.com',
};

/**
 * RPC URL from CHAIN_<id>_RPC_URL, falling back to DEFAULT_CHAIN_RPC_URLS for known chains.
 */
export function getChainRpcUrl(chainId: number): string | undefined {
  const envKey = `CHAIN_${chainId}_RPC_URL`;
  const fromEnv = process.env[envKey]?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_CHAIN_RPC_URLS[chainId];
}

function getRpcUrl(chainId: number): string {
  const rpcUrl = getChainRpcUrl(chainId);
  if (!rpcUrl) {
    throw new Error(
      `No RPC URL configured for chain ${chainId}. Set CHAIN_${chainId}_RPC_URL or use a chain with a default.`
    );
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
