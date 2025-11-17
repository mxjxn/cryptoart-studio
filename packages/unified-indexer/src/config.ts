/**
 * Contract addresses configuration
 * Base Mainnet addresses
 */

export const CONTRACT_ADDRESSES = {
  // Marketplace (Auctionhouse)
  MARKETPLACE: '0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9' as const,
  
  // LSSVM contracts
  LSSVM_FACTORY: '0xF6B4bDF778db19DD5928248DE4C18Ce22E8a5f5e' as const,
  LSSVM_ROUTER: '0x4352c72114C4b9c4e1F8C96347F2165EECaDeb5C' as const,
} as const;

// Subgraph endpoints
export const SUBGRAPH_ENDPOINTS = {
  LSSVM_BASE_MAINNET: 'https://api.studio.thegraph.com/query/5440/such-lssvm/0.0.1',
  AUCTIONHOUSE: '', // To be determined/verified
} as const;

// Chain IDs
export const CHAIN_IDS = {
  BASE_MAINNET: 8453,
} as const;

