/**
 * @cryptoart/stp - STP v2 Subscription NFT Integration Layer
 * 
 * PARKED FEATURE: Not for day-one relaunch
 * 
 * This package provides integration with Fabric's STP v2 (Subscription Token Protocol)
 * for the cryptoart ecosystem. It enables artists to offer subscription-based supporter
 * memberships and provides app-level perks for cryptoart.social.
 */

// ABIs
export { STPV2ABI } from './abis/STPV2.js';
export { STPV2FactoryABI } from './abis/STPV2Factory.js';

// Types
export type {
  SubscriptionView,
  TierParams,
  TierDetail,
  ContractDetail,
  MintParams,
  ContractConfig,
  SubscriptionState,
  EventConfig,
} from './types/index.js';
export { AppPerk } from './types/index.js';

// Viem helpers for reading and writing
export {
  readSubscription,
  isSubscriptionActive,
  getRemainingTime,
  readBalance,
  readTierBalance,
  readTierDetail,
  readContractDetail,
  readOwnerOf,
  readName,
  readSymbol,
  buildMint,
  buildMintFor,
  buildMintAdvanced,
  readFactoryFeeSchedule,
} from './utils/viem-helpers.js';

// Configuration
export {
  STP_V2_FACTORY_ADDRESSES,
  APP_MEMBERSHIP_STP,
  STP_V2_CONTRACTS,
  getStpContractConfig,
  getStpContractsByChain,
  isTrackedStpContract,
} from './config/contracts.js';

// Entitlement queries
export {
  hasPerk,
  getUserPerks,
  getUsersWithPerk,
} from './queries/entitlements.js';

// Airdrop recipient queries
export {
  getActiveSubscribers,
  getAllStpHolders,
  getActiveSubscribersByTier,
  getSubscriptionStats,
  getTopSupporters,
} from './queries/airdrop-recipients.js';

// Event handlers (for chain-indexer integration)
export {
  processStpEvent,
  processFactoryEvent,
} from './handlers/event-handlers.js';
