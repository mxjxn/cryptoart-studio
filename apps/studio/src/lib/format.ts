import { type Address, isAddress } from 'viem';

export function truncateAddress(address: string, chars = 4): string {
  if (!address || address.length < chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

export function normalizeAddress(address: string | null | undefined): Address | null {
  if (!address || !isAddress(address)) return null;
  return address.toLowerCase() as Address;
}

export function addressesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeAddress(a);
  const right = normalizeAddress(b);
  if (!left || !right) return false;
  return left === right;
}
