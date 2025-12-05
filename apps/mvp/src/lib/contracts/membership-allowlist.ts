import { type Address } from 'viem';

// MembershipAllowlistRegistry contract address on Base Mainnet
// TODO: Update with actual deployed address after deployment
export const MEMBERSHIP_ALLOWLIST_REGISTRY_ADDRESS = (
  process.env.NEXT_PUBLIC_MEMBERSHIP_ALLOWLIST_REGISTRY_ADDRESS ||
  '0x0000000000000000000000000000000000000000' // Placeholder - update after deployment
) as Address;

// ABI for MembershipAllowlistRegistry contract
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
    inputs: [{ name: 'associatedAddress', type: 'address' }],
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

