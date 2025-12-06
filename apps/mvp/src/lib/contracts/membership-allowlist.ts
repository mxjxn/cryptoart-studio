import { type Address } from 'viem';

// MembershipAllowlistRegistrySecure contract address on Base Mainnet
// Deployed at: 0x4C5c5E94393c1359158B3Ba980c1bd5FB502A7bA
// This secure version requires signature proof from the associated address
// Transaction: https://basescan.org/tx/0x1af63d8f3fe1b2fa81b9d409f9251c59052b4d8538b0f072c42b966a5d9a04a5
export const MEMBERSHIP_ALLOWLIST_REGISTRY_ADDRESS = (
  process.env.NEXT_PUBLIC_MEMBERSHIP_ALLOWLIST_REGISTRY_ADDRESS ||
  '0x4C5c5E94393c1359158B3Ba980c1bd5FB502A7bA' // Base Mainnet deployment (secure version)
) as Address;

// Legacy contract address (deprecated - no signature verification)
export const LEGACY_MEMBERSHIP_ALLOWLIST_REGISTRY_ADDRESS = '0xF190fD214844931a92076aeCB5316f769f4A8483' as Address;

// ABI for MembershipAllowlistRegistrySecure contract
export const MEMBERSHIP_ALLOWLIST_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'isAuthorized',
    inputs: [
      { name: 'seller', type: 'address' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'addAssociatedAddress',
    inputs: [
      { name: 'associatedAddress', type: 'address' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'removeAssociatedAddress',
    inputs: [{ name: 'associatedAddress', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'removeSelfAssociation',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getMembershipHolder',
    inputs: [{ name: 'associatedAddress', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'membershipAssociatedCount',
    inputs: [{ name: 'membershipHolder', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nonces',
    inputs: [{ name: 'associatedAddress', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAssociationMessageHash',
    inputs: [
      { name: 'membershipHolder', type: 'address' },
      { name: 'associatedAddress', type: 'address' },
      { name: 'nonce', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getNftContract',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'AssociatedAddressAdded',
    inputs: [
      { name: 'membershipHolder', type: 'address', indexed: true },
      { name: 'associatedAddress', type: 'address', indexed: true },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AssociatedAddressRemoved',
    inputs: [
      { name: 'membershipHolder', type: 'address', indexed: true },
      { name: 'associatedAddress', type: 'address', indexed: true },
    ],
    anonymous: false,
  },
] as const;
