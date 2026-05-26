import { createPublicClient, http, type PublicClient, type Chain } from 'viem';
import { base, mainnet, sepolia } from 'viem/chains';
import type { ChainConfig } from './config.js';

const KNOWN_CHAINS: Record<number, Chain> = {
  1: mainnet,
  8453: base,
  11155111: sepolia,
};

export type ClientMap = Map<number, PublicClient>;

export function createClients(chainConfigs: ChainConfig[]): ClientMap {
  const clients = new Map<number, PublicClient>();
  for (const cfg of chainConfigs) {
    const chain: Chain = KNOWN_CHAINS[cfg.chainId] ?? {
      id: cfg.chainId,
      name: `chain-${cfg.chainId}`,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [cfg.rpcUrl] } },
    };
    const client = createPublicClient({
      chain,
      transport: http(cfg.rpcUrl),
    });
    clients.set(cfg.chainId, client);
  }
  return clients;
}
