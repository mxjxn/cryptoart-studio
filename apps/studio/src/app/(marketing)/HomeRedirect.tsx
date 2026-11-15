'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveWallet } from '~/hooks/useActiveWallet';

/** When a wallet is connected, send artists straight to their contract dashboard. */
export function HomeRedirect() {
  const router = useRouter();
  const { isConnected, address, isConnecting, authModeLoading } = useActiveWallet();

  useEffect(() => {
    if (authModeLoading || isConnecting) return;
    if (isConnected && address) {
      router.replace('/dashboard');
    }
  }, [authModeLoading, isConnecting, isConnected, address, router]);

  return null;
}
