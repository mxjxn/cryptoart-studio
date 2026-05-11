import {
  BASE_CHAIN_ID,
  ETHEREUM_MAINNET_CHAIN_ID,
} from "~/lib/server/subgraph-endpoints";

export type ChainNetworkInfo = {
  chainId: number;
  /** Full label for listings and docs */
  displayName: string;
  /** Shorter label when space is tight */
  shortName: string;
};

const KNOWN: Record<number, { displayName: string; shortName: string }> = {
  [ETHEREUM_MAINNET_CHAIN_ID]: {
    displayName: "Ethereum Mainnet",
    shortName: "Ethereum",
  },
  [BASE_CHAIN_ID]: {
    displayName: "Base",
    shortName: "Base",
  },
};

export function getChainNetworkInfo(chainId: number): ChainNetworkInfo {
  const row = KNOWN[chainId];
  if (row) {
    return { chainId, displayName: row.displayName, shortName: row.shortName };
  }
  return {
    chainId,
    displayName: `Chain ${chainId}`,
    shortName: `Chain ${chainId}`,
  };
}
