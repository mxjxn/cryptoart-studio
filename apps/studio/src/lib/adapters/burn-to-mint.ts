/**
 * Burn-to-mint extension adapter (PR 200).
 *
 * Deploy bytecode is not on this branch until PR 200 merges.
 * `getBurnToMintBytecode()` returns null and the UI surfaces a clear stub.
 */

import { encodeDeployData, encodeFunctionData, type Address, type Hex } from 'viem';

export const BurnTokenSpec = {
  ERC721: 0,
  ERC1155: 1,
} as const;

export type BurnTokenSpecValue = (typeof BurnTokenSpec)[keyof typeof BurnTokenSpec];

export const BURN_TO_MINT_ABI = [
  {
    type: 'constructor',
    inputs: [{ name: 'initialOwner', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'createBurnConfig',
    inputs: [
      { name: 'sourceContract', type: 'address' },
      { name: 'sourceSpec', type: 'uint8' },
      { name: 'targetCollection', type: 'address' },
      { name: 'targetSpec', type: 'uint8' },
      { name: 'targetTokenId', type: 'uint256' },
      { name: 'burnRatio', type: 'uint256' },
      { name: 'mintRatio', type: 'uint256' },
      { name: 'requiresBurn', type: 'bool' },
      { name: 'totalRedemptionCap', type: 'uint256' },
      { name: 'perWalletCap', type: 'uint256' },
      { name: 'startTime', type: 'uint48' },
      { name: 'endTime', type: 'uint48' },
      { name: 'targetBaseURI', type: 'string' },
    ],
    outputs: [{ name: 'configId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setBurnConfigActive',
    inputs: [
      { name: 'configId', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'configCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const;

/**
 * STUB: bytecode lands with PR 200.
 * Optional override via NEXT_PUBLIC_BURN_TO_MINT_BYTECODE for local testing.
 */
export function getBurnToMintBytecode(): Hex | null {
  const fromEnv = process.env.NEXT_PUBLIC_BURN_TO_MINT_BYTECODE;
  if (fromEnv && fromEnv.startsWith('0x') && fromEnv.length > 4) {
    return fromEnv as Hex;
  }
  return null;
}

export function encodeDeployBurnToMint(owner: Address): { data: Hex } | { stub: true; reason: string } {
  const bytecode = getBurnToMintBytecode();
  if (!bytecode) {
    return {
      stub: true,
      reason:
        'BurnToMintExtension bytecode is not available until PR 200 merges. Set NEXT_PUBLIC_BURN_TO_MINT_BYTECODE to test locally.',
    };
  }
  return {
    data: encodeDeployData({
      abi: BURN_TO_MINT_ABI,
      bytecode,
      args: [owner],
    }),
  };
}

export type CreateBurnConfigParams = {
  sourceContract: Address;
  sourceSpec: BurnTokenSpecValue;
  targetCollection: Address;
  targetSpec: BurnTokenSpecValue;
  targetTokenId?: bigint;
  burnRatio: bigint;
  mintRatio: bigint;
  requiresBurn?: boolean;
  totalRedemptionCap?: bigint;
  perWalletCap?: bigint;
  startTime?: number;
  endTime?: number;
  targetBaseURI: string;
};

export function encodeCreateBurnConfig(params: CreateBurnConfigParams): Hex {
  const baseURI =
    params.targetSpec === BurnTokenSpec.ERC721
      ? params.targetBaseURI.endsWith('/')
        ? params.targetBaseURI
        : `${params.targetBaseURI}/`
      : '';

  return encodeFunctionData({
    abi: BURN_TO_MINT_ABI,
    functionName: 'createBurnConfig',
    args: [
      params.sourceContract,
      params.sourceSpec,
      params.targetCollection,
      params.targetSpec,
      params.targetTokenId ?? 0n,
      params.burnRatio,
      params.mintRatio,
      params.requiresBurn ?? true,
      params.totalRedemptionCap ?? 0n,
      params.perWalletCap ?? 0n,
      params.startTime ?? 0,
      params.endTime ?? 0,
      baseURI,
    ],
  });
}

export function validateBurnConfigForm(input: {
  sourceContract: string;
  targetBaseURI: string;
  burnRatio: number;
  mintRatio: number;
  targetSpec: BurnTokenSpecValue;
  startTime?: string;
  endTime?: string;
}): string[] {
  const errors: string[] = [];
  if (!/^0x[a-fA-F0-9]{40}$/.test(input.sourceContract.trim())) {
    errors.push('Source contract must be a valid address.');
  }
  if (input.burnRatio < 1) errors.push('Burn ratio must be at least 1.');
  if (input.mintRatio < 1) errors.push('Mint ratio must be at least 1.');
  if (input.targetSpec === BurnTokenSpec.ERC721) {
    if (!input.targetBaseURI.trim()) errors.push('Target base URI is required for ERC-721.');
    else if (!input.targetBaseURI.trim().endsWith('/')) {
      errors.push('Target base URI must end with a trailing slash.');
    }
  }
  if (input.startTime && input.endTime) {
    const start = Date.parse(input.startTime);
    const end = Date.parse(input.endTime);
    if (!Number.isNaN(start) && !Number.isNaN(end) && end <= start) {
      errors.push('End time must be after start time.');
    }
  }
  return errors;
}
