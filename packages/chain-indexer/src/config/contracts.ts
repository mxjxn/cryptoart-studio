import type { Address } from 'viem';
import type { ContractConfig } from '../types/events';
import { MarketplaceLibABI } from './abis/MarketplaceLib';
import { SettlementLibABI } from './abis/SettlementLib';

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
    // Proxy address from docs/CONTRACT_ADDRESSES.md
    address: '0xfd35bF63448595377d5bc2fCB435239Ba2AFB3ea' as Address,
    // Deploy block is env-driven — docs don't list it; require CHAIN_84532_START_BLOCK
    startBlock: 0n,
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
 * All known marketplace configs (may include chains without RPC/start block yet).
 * Prefer getConfiguredContracts() for runtime indexing.
 */
export const ALL_CONTRACTS: ContractConfig[] = [
  ...MARKETPLACE_CONTRACTS,
  // ...STP_V2_CONTRACTS, // Uncomment when ready
  // ...LSSVM_CONTRACTS, // Uncomment when ready
];

/**
 * Resolve start block from CHAIN_<id>_START_BLOCK, falling back to config.startBlock.
 * Returns null when neither yields a positive block (skip indexing that chain).
 */
export function resolveStartBlock(chainId: number, fallback: bigint): bigint | null {
  const envKey = `CHAIN_${chainId}_START_BLOCK`;
  const envValue = process.env[envKey];
  if (envValue !== undefined && envValue !== '') {
    const parsed = BigInt(envValue);
    if (parsed > 0n) return parsed;
    return null;
  }
  if (fallback > 0n) return fallback;
  return null;
}

/**
 * Contracts ready to index this run: RPC configured and a sane start block.
 */
export function getConfiguredContracts(): ContractConfig[] {
  return ALL_CONTRACTS.flatMap((config) => {
    const rpcUrl = process.env[`CHAIN_${config.chainId}_RPC_URL`];
    if (!rpcUrl) {
      return [];
    }
    const startBlock = resolveStartBlock(config.chainId, config.startBlock);
    if (startBlock === null) {
      console.warn(
        `[Contracts] Skipping ${config.label || config.address} on chain ${config.chainId}: set CHAIN_${config.chainId}_START_BLOCK to a positive deploy block`
      );
      return [];
    }
    return [{ ...config, startBlock }];
  });
}

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
