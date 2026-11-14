/**
 * Thin SuchCollection / SuchCollection1155 adapter.
 * ABI fragments mirror PR 200 (`cursor/lazy-minting-airdrop-e4d4`).
 * When that PR merges, prefer importing generated ABIs from the contracts package
 * and keep these encode helpers as the UI boundary.
 */

import { encodeFunctionData, type Address, type Hex } from 'viem';

export const SUCH_COLLECTION_ABI = [
  {
    type: 'function',
    name: 'setMarketplaceApproval',
    inputs: [
      { name: 'marketplace', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isMarketplaceApproved',
    inputs: [{ name: 'marketplace', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setListingBaseURI',
    inputs: [
      { name: 'marketplace', type: 'address' },
      { name: 'listingId', type: 'uint40' },
      { name: 'baseURI', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'listingBaseURI',
    inputs: [
      { name: 'marketplace', type: 'address' },
      { name: 'listingId', type: 'uint40' },
    ],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setBlindMintConfig',
    inputs: [
      { name: 'placeholder', type: 'string' },
      { name: 'metadataHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'reveal',
    inputs: [
      { name: 'revealedBaseURI', type: 'string' },
      { name: 'verificationSalt', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isRevealed',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'placeholderURI',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'metadataCommitment',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isBlindMintLocked',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setTokenURI',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'uri', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'airdrop',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'uris', type: 'string[]' },
    ],
    outputs: [{ name: 'tokenIds', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'registerExtension',
    inputs: [
      { name: 'extension', type: 'address' },
      { name: 'baseURI', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

export const SUCH_COLLECTION_1155_ABI = [
  {
    type: 'function',
    name: 'setMarketplaceApproval',
    inputs: [
      { name: 'marketplace', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isMarketplaceApproved',
    inputs: [{ name: 'marketplace', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'prepareLazyToken',
    inputs: [
      { name: 'tokenURI_', type: 'string' },
      { name: 'maxSupply_', type: 'uint256' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setBlindMintConfig',
    inputs: [
      { name: 'placeholder', type: 'string' },
      { name: 'metadataHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'reveal',
    inputs: [
      { name: 'revealedBaseURI', type: 'string' },
      { name: 'verificationSalt', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'airdrop',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const;

/** Require trailing slash for listing / reveal base URIs (PR 200 review notes). */
export function ensureTrailingSlash(uri: string): string {
  if (!uri) return uri;
  return uri.endsWith('/') ? uri : `${uri}/`;
}

export function validateListingBaseURI(uri: string): string | null {
  const trimmed = uri.trim();
  if (!trimmed) return 'Listing base URI is required.';
  if (!trimmed.endsWith('/')) return 'Base URI must end with a trailing slash.';
  if (!/^(ar|ipfs|https):\/\//i.test(trimmed)) {
    return 'Use an ar://, ipfs://, or https:// URI.';
  }
  return null;
}

export function encodeSetMarketplaceApproval(marketplace: Address, approved: boolean): Hex {
  return encodeFunctionData({
    abi: SUCH_COLLECTION_ABI,
    functionName: 'setMarketplaceApproval',
    args: [marketplace, approved],
  });
}

export function encodeSetListingBaseURI(
  marketplace: Address,
  listingId: number,
  baseURI: string,
): Hex {
  return encodeFunctionData({
    abi: SUCH_COLLECTION_ABI,
    functionName: 'setListingBaseURI',
    args: [marketplace, listingId, ensureTrailingSlash(baseURI)],
  });
}

export function encodeSetBlindMintConfig(placeholder: string, metadataHash: Hex): Hex {
  return encodeFunctionData({
    abi: SUCH_COLLECTION_ABI,
    functionName: 'setBlindMintConfig',
    args: [placeholder, metadataHash],
  });
}

export function encodeReveal(revealedBaseURI: string, verificationSalt: Hex): Hex {
  return encodeFunctionData({
    abi: SUCH_COLLECTION_ABI,
    functionName: 'reveal',
    args: [ensureTrailingSlash(revealedBaseURI), verificationSalt],
  });
}

export function encodeSetTokenURI(tokenId: bigint, uri: string): Hex {
  return encodeFunctionData({
    abi: SUCH_COLLECTION_ABI,
    functionName: 'setTokenURI',
    args: [tokenId, uri],
  });
}

export function encodeAirdrop721(recipients: Address[], uris: string[]): Hex {
  return encodeFunctionData({
    abi: SUCH_COLLECTION_ABI,
    functionName: 'airdrop',
    args: [recipients, uris],
  });
}

export function encodeAirdrop1155(
  recipients: Address[],
  tokenId: bigint,
  amounts: bigint[],
): Hex {
  return encodeFunctionData({
    abi: SUCH_COLLECTION_1155_ABI,
    functionName: 'airdrop',
    args: [recipients, tokenId, amounts],
  });
}

export function encodePrepareLazyToken(tokenURI: string, maxSupply: bigint): Hex {
  return encodeFunctionData({
    abi: SUCH_COLLECTION_1155_ABI,
    functionName: 'prepareLazyToken',
    args: [tokenURI, maxSupply],
  });
}

export function encodeRegisterExtension(extension: Address, baseURI: string): Hex {
  return encodeFunctionData({
    abi: SUCH_COLLECTION_ABI,
    functionName: 'registerExtension',
    args: [extension, ensureTrailingSlash(baseURI || 'ar://')],
  });
}

/** keccak256(abi.encodePacked(revealedBaseURI, salt)) — computed client-side via viem. */
export { keccak256, encodePacked, toBytes } from 'viem';
