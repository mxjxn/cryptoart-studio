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
 * Parse a block-number env var.
 * - unset or empty  -> { kind: 'unset' }
 * - positive integer -> { kind: 'ok', value }
 * - anything else (0, negative, non-integer, garbage) -> { kind: 'invalid' }, with an error logged
 */
export type BlockEnv = { kind: 'unset' } | { kind: 'ok'; value: bigint } | { kind: 'invalid' };

export function parseBlockEnv(envKey: string): BlockEnv {
  const raw = process.env[envKey];
  if (raw === undefined || raw.trim() === '') return { kind: 'unset' };
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    console.error(`[Contracts] Invalid ${envKey}=${JSON.stringify(raw)}: must be a positive integer block number`);
    return { kind: 'invalid' };
  }
  const value = BigInt(trimmed);
  if (value <= 0n) {
    console.error(`[Contracts] Invalid ${envKey}=${JSON.stringify(raw)}: must be > 0`);
    return { kind: 'invalid' };
  }
  return { kind: 'ok', value };
}

/**
 * Marketplace start block for a chain.
 *
 * CHAIN_<id>_START_BLOCK applies to the marketplace only. It supplies the block when the config has
 * none (e.g. Base Sepolia) and may move the start EARLIER than a hard-coded deploy block, but
 * never later. A later value is ignored with a warning so history is not skipped.
 * Returns null (skip the chain) when no positive block is available or the env value is invalid.
 */
export function resolveStartBlock(chainId: number, fallback: bigint): bigint | null {
  const envKey = `CHAIN_${chainId}_START_BLOCK`;
  const env = parseBlockEnv(envKey);
  if (env.kind === 'invalid') return null;
  if (env.kind === 'ok') {
    if (fallback > 0n && env.value > fallback) {
      console.warn(
        `[Contracts] Ignoring ${envKey}=${env.value} on chain ${chainId}: later than the marketplace deploy block ${fallback}; using ${fallback}`
      );
      return fallback;
    }
    return env.value;
  }
  return fallback > 0n ? fallback : null;
}

/**
 * Factory start block for a chain, from CHAIN_<id>_FACTORY_START_BLOCK.
 * Independent of the marketplace's CHAIN_<id>_START_BLOCK.
 * Returns null (skip the chain's factories) when unset or invalid.
 */
export function resolveFactoryStartBlock(chainId: number): bigint | null {
  const env = parseBlockEnv(`CHAIN_${chainId}_FACTORY_START_BLOCK`);
  return env.kind === 'ok' ? env.value : null;
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
