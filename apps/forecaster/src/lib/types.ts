export interface DeploymentParams {
  name: string;
  symbol: string;
  contractUri: string;
  globalSupplyCap: number;
  tierConfig: TierConfig;
  rewardConfig: RewardConfig;
}

export interface TierConfig {
  periodDurationDays: number;
  maxSupply: number;
  pricePerPeriod: string; // in ETH
  initialMintPrice: string; // in ETH
  rewardBasisPoints: number;
  transferrable: boolean;
}

export interface RewardConfig {
  slashable: boolean;
  slashGracePeriodDays: number;
  curveNumPeriods: number;
}

export interface SubscriptionInfo {
  tierId: number;
  tokenId: bigint;
  expiresAt: number;
  purchaseExpiresAt: number;
  rewardShares: bigint;
  rewardBalance: bigint;
  isActive: boolean;
  timeRemaining: number;
}

export interface TierInfo {
  tierId: number;
  periodDurationSeconds: number;
  maxSupply: number;
  currentSupply: number;
  pricePerPeriod: bigint;
  initialMintPrice: bigint;
  rewardBasisPoints: number;
  paused: boolean;
  transferrable: boolean;
}

export interface ContractInfo {
  address: string;
  name: string;
  symbol: string;
  tierCount: number;
  subCount: bigint;
  supplyCap: bigint;
  creatorBalance: bigint;
  rewardBalance: bigint;
}
