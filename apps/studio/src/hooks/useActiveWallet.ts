'use client';

import { useMemo } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { base, mainnet } from 'wagmi/chains';
import { useMiniApp } from '@neynar/react';
import { useAuthMode } from '~/hooks/useAuthMode';
import { usePrimaryWallet } from '~/hooks/usePrimaryWallet';
import { addressesMatch } from '~/lib/format';

const CHAIN_NAMES: Record<number, string> = {
  [base.id]: 'Base',
  [mainnet.id]: 'Ethereum',
};

export function useActiveWallet() {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const chainId = useChainId();
  const { isMiniApp, isLoading: authModeLoading } = useAuthMode();
  const { context } = useMiniApp();
  const farcasterPrimaryWallet = usePrimaryWallet();

  const user = context?.user as { username?: string; fid?: number } | undefined;

  const chainName = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;

  const walletDiffersFromFarcasterPrimary = useMemo(() => {
    if (!isConnected || !address || !farcasterPrimaryWallet) return false;
    return !addressesMatch(address, farcasterPrimaryWallet);
  }, [address, farcasterPrimaryWallet, isConnected]);

  return {
    address,
    isConnected,
    isConnecting: isConnecting || isReconnecting,
    authModeLoading,
    isMiniApp,
    chainId,
    chainName,
    farcasterUsername: user?.username,
    farcasterFid: user?.fid,
    farcasterPrimaryWallet,
    walletDiffersFromFarcasterPrimary,
  };
}
