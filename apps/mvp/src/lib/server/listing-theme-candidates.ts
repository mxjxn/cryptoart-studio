import { isAddress } from "viem";

/**
 * Wallets the client considers part of the same user session (primary + verified).
 */
export function collectCandidateAddresses(
  userAddress: string | undefined,
  verifiedAddresses?: string[]
): string[] {
  const out = new Set<string>();
  if (userAddress && isAddress(userAddress as `0x${string}`)) {
    out.add(userAddress.toLowerCase());
  }
  for (const a of verifiedAddresses ?? []) {
    if (typeof a === "string" && isAddress(a as `0x${string}`)) {
      out.add(a.toLowerCase());
    }
  }
  return [...out];
}

export function sellerMatchesCandidates(seller: string, candidates: string[]): boolean {
  const s = seller.toLowerCase();
  return candidates.some((c) => c === s);
}
