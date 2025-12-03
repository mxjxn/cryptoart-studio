import { useMemo } from 'react';
import { useMiniApp } from '@neynar/react';
import { isAddress } from 'viem';

/**
 * Hook to get the user's primary wallet address from Farcaster context
 * Priority: verified_addresses?.primary?.eth_address → custody_address → verifications?.[0]
 * Returns the address in lowercase for consistency, or null if not available
 */
export function usePrimaryWallet(): string | null {
  const { context } = useMiniApp();

  const primaryWallet = useMemo(() => {
    if (!context?.user) {
      return null;
    }

    const user = context.user as any;

    // Priority 1: Primary verified address
    const primaryAddress = user.verified_addresses?.primary?.eth_address;
    if (primaryAddress && isAddress(primaryAddress)) {
      return primaryAddress.toLowerCase();
    }

    // Priority 2: Custody address (native Farcaster wallet)
    const custodyAddress = user.custody_address;
    if (custodyAddress && isAddress(custodyAddress)) {
      return custodyAddress.toLowerCase();
    }

    // Priority 3: First verification address (legacy format)
    const verifications = user.verifications;
    if (Array.isArray(verifications) && verifications.length > 0) {
      const firstVerification = verifications[0];
      if (typeof firstVerification === 'string' && isAddress(firstVerification)) {
        return firstVerification.toLowerCase();
      }
    }

    return null;
  }, [context?.user]);

  return primaryWallet;
}

