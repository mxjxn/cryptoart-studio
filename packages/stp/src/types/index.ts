import type { Address } from 'viem';

export interface SubscriptionView {
  tierId: number;
  tokenId: bigint;
  expiresAt: number;
  purchaseExpiresAt: number;
  rewardShares: bigint;
  rewardBalance: bigint;
}

export interface TierParams {
  periodDurationSeconds: number;
  maxSupply: bigint;
  maxCommitmentSeconds: number;
  startTimestamp: number;
  endTimestamp: number;
  paused: boolean;
  transferrable: boolean;
  initialMintingAllowlistId: `0x${string}`;
  rewardCurveId: number;
  rewardBasisPoints: number;
}

export interface TierDetail {
  params: TierParams;
  pricePerPeriod: bigint;
  subCount: bigint;
}

export interface ContractDetail {
  tierCount: number;
  subCount: bigint;
  supplyCap: bigint;
  transferRecipient: Address;
  currency: Address;
  creatorBalance: bigint;
  numCurves: number;
  rewardShares: bigint;
  rewardBalance: bigint;
  rewardSlashGracePeriod: number;
  rewardSlashable: boolean;
}

export interface MintParams {
  recipient: Address;
  tierId: number;
  purchaseValue: bigint;
  referralCode: bigint;
  referrer: Address;
}

export interface ContractConfig {
  chainId: number;
  address: Address;
  startBlock: bigint;
  label: string;
}

export enum AppPerk {
  CUSTOM_GALLERY_URI = 'custom_gallery_uri',
  PROFILE_CUSTOMIZATION = 'profile_customization',
}

export interface SubscriptionState {
  contractAddress: Address;
  chainId: number;
  owner: Address;
  tokenId: bigint;
  tierId: number;
  expiresAt: number;
  isActive: boolean;
}

export interface EventConfig {
  chainId: number;
  contractAddress: Address;
  events: string[];
}
