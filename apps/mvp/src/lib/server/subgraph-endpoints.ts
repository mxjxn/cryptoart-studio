export type SubgraphEndpoint = {
  chainId: number;
  url: string;
};

// Keep these numeric constants in one place so we don't drift.
export const BASE_CHAIN_ID = 8453;
export const ETHEREUM_MAINNET_CHAIN_ID = 1;

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Auctionhouse subgraph endpoint not configured. Set ${key}`);
  }
  return value;
}

/**
 * Returns the subgraph endpoints configured via env vars.
 *
 * For now, the app mostly uses the Base endpoint, but this helper is the
 * single source of truth when we add dual-chain browsing later.
 */
export function getConfiguredSubgraphEndpoints(): SubgraphEndpoint[] {
  const baseUrl = requireEnv("NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL");
  const endpoints: SubgraphEndpoint[] = [
    { chainId: BASE_CHAIN_ID, url: baseUrl },
  ];

  const mainnetUrl = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL_MAINNET;
  if (mainnetUrl) {
    endpoints.push({ chainId: ETHEREUM_MAINNET_CHAIN_ID, url: mainnetUrl });
  }

  return endpoints;
}

/**
 * Backwards-compatible helper for the current (mostly Base-only) code paths.
 * When `chainId` is omitted, returns the Base endpoint.
 */
export function getSubgraphEndpoint(chainId?: number): string {
  const endpoints = getConfiguredSubgraphEndpoints();
  if (chainId == null) return endpoints[0].url;

  const match = endpoints.find((e) => e.chainId === chainId);
  if (!match) {
    throw new Error(`Auctionhouse subgraph endpoint not configured for chainId=${chainId}`);
  }
  return match.url;
}

export function getSubgraphEndpointOrNull(chainId?: number): string | null {
  try {
    return getSubgraphEndpoint(chainId);
  } catch {
    return null;
  }
}

