import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useMiniApp } from '@neynar/react';
import { type Address } from 'viem';

/**
 * Hook to get the effective wallet address for transactions.
 * 
 * In miniapp context: Uses wagmi's farcasterFrame connector which provides
 * the wallet address through the Farcaster wallet provider. The context.user
 * only contains metadata (fid, username, pfp) - NOT wallet addresses.
 * 
 * On web: Uses useAccount().address from standard web3 connector
 * 
 * This ensures transactions are signed by the correct wallet in each context.
 */
export function useEffectiveAddress(): {
  address: Address | undefined;
  isConnected: boolean;
  isMiniApp: boolean;
} {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { context } = useMiniApp();

  const result = useMemo(() => {
    // Check if we're in miniapp context (context.user contains fid, username, etc.)
    const isMiniApp = !!context?.user;

    // In both mini-app and web contexts, use wagmi's connected address.
    // In mini-app: the farcasterFrame() connector provides the wallet address
    // On web: standard wallet connectors (Coinbase, MetaMask) provide the address
    return {
      address: wagmiAddress,
      isConnected: wagmiConnected,
      isMiniApp,
    };
  }, [context?.user, wagmiAddress, wagmiConnected]);

  return result;
}


