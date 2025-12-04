// STP v2 Contract Addresses (Base Mainnet)
// TODO: Update these with actual deployed addresses
export const STPV2_FACTORY_ADDRESS = process.env.NEXT_PUBLIC_STPV2_FACTORY_ADDRESS || "";
export const STPV2_IMPLEMENTATION_ADDRESS = process.env.NEXT_PUBLIC_STPV2_IMPLEMENTATION_ADDRESS || "";

// Chain configuration
export const CHAIN_ID = 8453; // Base Mainnet
export const CHAIN_NAME = "Base";

// Fee configuration
export const DEFAULT_PROTOCOL_FEE_BPS = 500; // 5%
export const DEFAULT_CLIENT_FEE_BPS = 250; // 2.5%
export const MAX_FEE_BPS = 10000; // 100%

// Subscription defaults
export const DEFAULT_PERIOD_DURATION = 30 * 24 * 60 * 60; // 30 days in seconds
export const DEFAULT_REWARD_BPS = 2000; // 20%

// Time constants
export const SECONDS_PER_DAY = 86400;
export const SECONDS_PER_MONTH = 30 * SECONDS_PER_DAY;
export const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY;
