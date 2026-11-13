import type { Address } from 'viem';
import type { ContractConfig } from '../types/events.js';
import { MarketplaceLibABI } from './abis/MarketplaceLib.js';
import { SettlementLibABI } from './abis/SettlementLib.js';

/**
 * Marketplace contract configurations
 * Based on networks.json from auctionhouse-subgraph
 * 
 * Note: Marketplace and Settlement are the same contract on Base and Ethereum
 * We merge their events here to avoid duplicate checkpoint rows
 */
export const MARKETPLACE_CONTRACTS: ContractConfig[] = [
  {
    chainId: 8453, // Base
    address: '0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9' as Address,
    startBlock: 38886000n,
    abi: [...MarketplaceLibABI, ...SettlementLibABI],
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
      'Escrow', // Settlement event
    ],
    label: 'Marketplace + Settlement (Base)',
  },
  {
    chainId: 84532, // Base Sepolia
    address: '0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9' as Address,
    startBlock: 0n, // TODO: Set actual deploy block for Base Sepolia
    abi: [...MarketplaceLibABI, ...SettlementLibABI],
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
      'Escrow', // Settlement event
    ],
    label: 'Marketplace + Settlement (Base Sepolia)',
  },
  {
    chainId: 1, // Ethereum Mainnet
    address: '0x3CEE515879FFe4620a1F8aC9bf09B97e858815Ef' as Address,
    startBlock: 25068447n,
    abi: [...MarketplaceLibABI, ...SettlementLibABI],
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
      'Escrow', // Settlement event
    ],
    label: 'Marketplace + Settlement (Ethereum)',
  },
];

/**
 * Future: STP v2 subscription contracts (commented until contracts are deployed)
 * Uncomment and configure when ready
 */
// export const STP_V2_CONTRACTS: ContractConfig[] = [
//   {
//     chainId: 8453, // Base
//     address: '0x...' as Address, // TODO: Add deployed STP v2 contract address
//     startBlock: 0n, // TODO: Add deploy block
//     abi: [], // TODO: Import STP v2 ABI
//     events: [
//       'SubscriptionCreated',
//       'SubscriptionPurchased',
//       'SubscriptionRenewed',
//       'SubscriptionCancelled',
//     ],
//     label: 'STP v2 Subscriptions (Base)',
//   },
// ];

/**
 * Future: LSSVM pool contracts (commented until pools are chosen)
 * Uncomment and configure when ready
 */
// export const LSSVM_CONTRACTS: ContractConfig[] = [
//   {
//     chainId: 1, // Ethereum (LSSVM is primarily on mainnet)
//     address: '0x...' as Address, // TODO: Add LSSVM factory or pool address
//     startBlock: 0n, // TODO: Add deploy block
//     abi: [], // TODO: Import LSSVM ABI
//     events: [
//       'SwapNFTInPool',
//       'SwapNFTOutPool',
//       'NFTDeposit',
//       'NFTWithdrawal',
//       'PoolCreated',
//     ],
//     label: 'LSSVM Pools (Ethereum)',
//   },
// ];

/**
 * All contracts to index (marketplace includes settlement events)
 */
export const ALL_CONTRACTS: ContractConfig[] = [
  ...MARKETPLACE_CONTRACTS,
  // ...STP_V2_CONTRACTS, // Uncomment when ready
  // ...LSSVM_CONTRACTS, // Uncomment when ready
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
