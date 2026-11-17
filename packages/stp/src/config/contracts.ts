import type { Address } from 'viem';
import type { ContractConfig } from '../types/index.js';

/**
 * STP v2 contract configurations
 * 
 * IMPORTANT: These are PLACEHOLDER addresses. The contracts are NOT yet deployed.
 * Max deploys locally himself and will provide real addresses when ready.
 * 
 * This configuration follows the pattern from @cryptoart/chain-indexer
 * and will be integrated once PR #199 merges.
 */

/**
 * Placeholder STP v2 factory addresses (to be replaced with real deployments)
 */
export const STP_V2_FACTORY_ADDRESSES = {
  BASE: process.env.STP_V2_FACTORY_BASE || '0x0000000000000000000000000000000000000000',
  ETHEREUM: process.env.STP_V2_FACTORY_ETH || '0x0000000000000000000000000000000000000000',
} as const;

/**
 * Placeholder app-level STP contract for cryptoart.social membership
 * This will be deployed when the feature launches
 */
export const APP_MEMBERSHIP_STP = {
  chainId: 8453, // Base
  address: (process.env.APP_MEMBERSHIP_STP_ADDRESS || '0x0000000000000000000000000000000000000000') as Address,
  startBlock: 0n, // Will be set when deployed
  label: 'CryptoArt.Social Membership',
} as const;

/**
 * STP v2 contract configurations for indexing
 * Initially empty - contracts will be added as they're deployed
 */
export const STP_V2_CONTRACTS: ContractConfig[] = [
  // Example config (commented until real contracts exist):
  // {
  //   chainId: 8453, // Base
  //   address: '0x...' as Address,
  //   startBlock: 0n, // Deploy block
  //   label: 'Artist Name STP',
  // },
];

/**
 * Get STP contract config by chain ID and address
 */
export function getStpContractConfig(chainId: number, address: Address): ContractConfig | undefined {
  return STP_V2_CONTRACTS.find(
    (c) => c.chainId === chainId && c.address.toLowerCase() === address.toLowerCase()
  );
}

/**
 * Get all STP contracts for a specific chain
 */
export function getStpContractsByChain(chainId: number): ContractConfig[] {
  return STP_V2_CONTRACTS.filter((c) => c.chainId === chainId);
}

/**
 * Check if an address is a tracked STP contract
 */
export function isTrackedStpContract(chainId: number, address: Address): boolean {
  return getStpContractConfig(chainId, address) !== undefined;
}
