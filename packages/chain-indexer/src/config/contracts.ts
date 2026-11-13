import type { Address } from 'viem';
import type { ContractConfig } from '../types/events.js';
import { MarketplaceLibABI } from './abis/MarketplaceLib.js';
import { SettlementLibABI } from './abis/SettlementLib.js';

/**
 * Marketplace contract configurations
 * Based on networks.json from auctionhouse-subgraph
 */
export const MARKETPLACE_CONTRACTS: ContractConfig[] = [
  {
    chainId: 8453, // Base
    address: '0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9' as Address,
    startBlock: 38886000n,
    abi: MarketplaceLibABI,
    events: [
      'CreateListing',
      'CreateListingTokenDetails',
      'CreateListingFees',
      'PurchaseEvent',
      'BidEvent',
      'OfferEvent',
      'RescindOfferEvent',
      'AcceptOfferEvent',
      'ModifyListing',
      'CancelListing',
      'FinalizeListing',
    ],
    label: 'Marketplace (Base)',
  },
  {
    chainId: 1, // Ethereum Mainnet
    address: '0x3CEE515879FFe4620a1F8aC9bf09B97e858815Ef' as Address,
    startBlock: 25068447n,
    abi: MarketplaceLibABI,
    events: [
      'CreateListing',
      'CreateListingTokenDetails',
      'CreateListingFees',
      'PurchaseEvent',
      'BidEvent',
      'OfferEvent',
      'RescindOfferEvent',
      'AcceptOfferEvent',
      'ModifyListing',
      'CancelListing',
      'FinalizeListing',
    ],
    label: 'Marketplace (Ethereum)',
  },
];

/**
 * Settlement contract configurations
 */
export const SETTLEMENT_CONTRACTS: ContractConfig[] = [
  {
    chainId: 8453, // Base
    address: '0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9' as Address,
    startBlock: 38886000n,
    abi: SettlementLibABI,
    events: ['Escrow'],
    label: 'Settlement (Base)',
  },
  {
    chainId: 1, // Ethereum Mainnet
    address: '0x3CEE515879FFe4620a1F8aC9bf09B97e858815Ef' as Address,
    startBlock: 25068447n,
    abi: SettlementLibABI,
    events: ['Escrow'],
    label: 'Settlement (Ethereum)',
  },
];

/**
 * All contracts to index
 */
export const ALL_CONTRACTS: ContractConfig[] = [
  ...MARKETPLACE_CONTRACTS,
  ...SETTLEMENT_CONTRACTS,
];

/**
 * Get contract config by chain ID and address
 */
export function getContractConfig(chainId: number, address: Address): ContractConfig | undefined {
  return ALL_CONTRACTS.find(
    (c) => c.chainId === chainId && c.address.toLowerCase() === address.toLowerCase()
  );
}

/**
 * Get all contracts for a specific chain
 */
export function getContractsByChain(chainId: number): ContractConfig[] {
  return ALL_CONTRACTS.filter((c) => c.chainId === chainId);
}
