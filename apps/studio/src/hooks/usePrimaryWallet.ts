'use client';

import { useMemo } from 'react';
import { useMiniApp } from '@neynar/react';
import { isAddress } from 'viem';

export function usePrimaryWallet(): string | null {
  const { context } = useMiniApp();

  return useMemo(() => {
    if (!context?.user) return null;

    const user = context.user as {
      verified_addresses?: { primary?: { eth_address?: string } };
      custody_address?: string;
      verifications?: string[];
    };

    const primaryAddress = user.verified_addresses?.primary?.eth_address;
    if (primaryAddress && isAddress(primaryAddress)) {
      return primaryAddress.toLowerCase();
    }

    const custodyAddress = user.custody_address;
    if (custodyAddress && isAddress(custodyAddress)) {
      return custodyAddress.toLowerCase();
    }

    const verifications = user.verifications;
    if (Array.isArray(verifications) && verifications.length > 0) {
      const first = verifications[0];
      if (typeof first === 'string' && isAddress(first)) {
        return first.toLowerCase();
      }
    }

    return null;
  }, [context?.user]);
}
