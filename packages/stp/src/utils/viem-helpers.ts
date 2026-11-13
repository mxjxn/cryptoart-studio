import type { Address, PublicClient } from 'viem';
import { STPV2ABI } from '../abis/STPV2.js';
import { STPV2FactoryABI } from '../abis/STPV2Factory.js';
import type {
  SubscriptionView,
  TierDetail,
  ContractDetail,
  MintParams,
} from '../types/index.js';

/**
 * Read subscription details for an address
 */
export async function readSubscription(
  client: PublicClient,
  contractAddress: Address,
  account: Address
): Promise<SubscriptionView> {
  const result = await client.readContract({
    address: contractAddress,
    abi: STPV2ABI,
    functionName: 'subscriptionOf',
    args: [account],
  });

  return {
    tierId: Number(result.tierId),
    tokenId: result.tokenId,
    expiresAt: Number(result.expiresAt),
    purchaseExpiresAt: Number(result.purchaseExpiresAt),
    rewardShares: result.rewardShares,
    rewardBalance: result.rewardBalance,
  };
}

/**
 * Check if a subscription is currently active (not expired)
 */
export function isSubscriptionActive(subscription: SubscriptionView): boolean {
  const now = Math.floor(Date.now() / 1000);
  return subscription.expiresAt > now;
}

/**
 * Get remaining time in seconds for a subscription
 */
export function getRemainingTime(subscription: SubscriptionView): number {
  const now = Math.floor(Date.now() / 1000);
  const remaining = subscription.expiresAt - now;
  return remaining > 0 ? remaining : 0;
}

/**
 * Read balance of an address (time remaining in seconds)
 */
export async function readBalance(
  client: PublicClient,
  contractAddress: Address,
  account: Address
): Promise<bigint> {
  return await client.readContract({
    address: contractAddress,
    abi: STPV2ABI,
    functionName: 'balanceOf',
    args: [account],
  });
}

/**
 * Read balance for a specific tier
 */
export async function readTierBalance(
  client: PublicClient,
  contractAddress: Address,
  tierId: number,
  account: Address
): Promise<bigint> {
  return await client.readContract({
    address: contractAddress,
    abi: STPV2ABI,
    functionName: 'tierBalanceOf',
    args: [tierId, account],
  });
}

/**
 * Read tier details
 */
export async function readTierDetail(
  client: PublicClient,
  contractAddress: Address,
  tierId: number
): Promise<TierDetail> {
  const result = await client.readContract({
    address: contractAddress,
    abi: STPV2ABI,
    functionName: 'tierDetail',
    args: [tierId],
  });

  return {
    params: {
      periodDurationSeconds: Number(result.params.periodDurationSeconds),
      maxSupply: result.params.maxSupply,
      maxCommitmentSeconds: Number(result.params.maxCommitmentSeconds),
      startTimestamp: Number(result.params.startTimestamp),
      endTimestamp: Number(result.params.endTimestamp),
      paused: result.params.paused,
      transferrable: result.params.transferrable,
      initialMintingAllowlistId: result.params.initialMintingAllowlistId,
      rewardCurveId: Number(result.params.rewardCurveId),
      rewardBasisPoints: Number(result.params.rewardBasisPoints),
    },
    pricePerPeriod: result.pricePerPeriod,
    subCount: result.subCount,
  };
}

/**
 * Read contract-level details
 */
export async function readContractDetail(
  client: PublicClient,
  contractAddress: Address
): Promise<ContractDetail> {
  const result = await client.readContract({
    address: contractAddress,
    abi: STPV2ABI,
    functionName: 'contractDetail',
  });

  return {
    tierCount: Number(result.tierCount),
    subCount: result.subCount,
    supplyCap: result.supplyCap,
    transferRecipient: result.transferRecipient,
    currency: result.currency,
    creatorBalance: result.creatorBalance,
    numCurves: Number(result.numCurves),
    rewardShares: result.rewardShares,
    rewardBalance: result.rewardBalance,
    rewardSlashGracePeriod: Number(result.rewardSlashGracePeriod),
    rewardSlashable: result.rewardSlashable,
  };
}

/**
 * Read owner of a token
 */
export async function readOwnerOf(
  client: PublicClient,
  contractAddress: Address,
  tokenId: bigint
): Promise<Address> {
  return await client.readContract({
    address: contractAddress,
    abi: STPV2ABI,
    functionName: 'ownerOf',
    args: [tokenId],
  });
}

/**
 * Read contract name
 */
export async function readName(
  client: PublicClient,
  contractAddress: Address
): Promise<string> {
  return await client.readContract({
    address: contractAddress,
    abi: STPV2ABI,
    functionName: 'name',
  });
}

/**
 * Read contract symbol
 */
export async function readSymbol(
  client: PublicClient,
  contractAddress: Address
): Promise<string> {
  return await client.readContract({
    address: contractAddress,
    abi: STPV2ABI,
    functionName: 'symbol',
  });
}

/**
 * Build a mint transaction for the default tier
 */
export function buildMint(numTokens: bigint) {
  return {
    abi: STPV2ABI,
    functionName: 'mint' as const,
    args: [numTokens] as const,
  };
}

/**
 * Build a mintFor transaction (for renewals)
 */
export function buildMintFor(account: Address, numTokens: bigint) {
  return {
    abi: STPV2ABI,
    functionName: 'mintFor' as const,
    args: [account, numTokens] as const,
  };
}

/**
 * Build an advanced mint transaction with tier and referral
 */
export function buildMintAdvanced(params: MintParams) {
  return {
    abi: STPV2ABI,
    functionName: 'mintAdvanced' as const,
    args: [params] as const,
  };
}

/**
 * Read factory fee schedule
 */
export async function readFactoryFeeSchedule(
  client: PublicClient,
  factoryAddress: Address
): Promise<{ deployFee: bigint; protocolFeeBps: number; recipient: Address }> {
  const result = await client.readContract({
    address: factoryAddress,
    abi: STPV2FactoryABI,
    functionName: 'feeSchedule',
  });

  return {
    deployFee: result.deployFee,
    protocolFeeBps: Number(result.protocolFeeBps),
    recipient: result.recipient,
  };
}
