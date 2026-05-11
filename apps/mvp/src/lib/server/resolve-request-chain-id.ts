import { CHAIN_ID } from "~/lib/contracts/marketplace";
import { BASE_CHAIN_ID, ETHEREUM_MAINNET_CHAIN_ID } from "~/lib/server/subgraph-endpoints";

const ALLOWED_CHAIN_IDS = new Set<number>([BASE_CHAIN_ID, ETHEREUM_MAINNET_CHAIN_ID]);

/**
 * Parse `chainId` from a query string for server routes (contract creator, artist, etc.).
 * Invalid or missing values return `fallback` (defaults to app Base chain).
 */
export function resolveRequestChainIdParam(
  raw: string | null | undefined,
  fallback: number = CHAIN_ID
): number {
  if (raw == null || raw.trim() === "") {
    return fallback;
  }
  const v = parseInt(raw, 10);
  if (!Number.isFinite(v) || !ALLOWED_CHAIN_IDS.has(v)) {
    return fallback;
  }
  return v;
}
