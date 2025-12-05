import { useAccount } from 'wagmi';
import { useMiniApp } from '@neynar/react';
import { ADMIN_CONFIG } from '~/lib/constants';

interface UseIsAdminResult {
  isAdmin: boolean;
  isLoading: boolean;
}

/**
 * Hook to check if the current user is an admin.
 * Checks both wallet address and Farcaster identity for maximum security.
 * 
 * @returns Object with isAdmin boolean and isLoading state
 */
export function useIsAdmin(): UseIsAdminResult {
  const { address, isConnecting, isReconnecting } = useAccount();
  const { context } = useMiniApp();
  
  // Consider loading if wallet is still connecting
  const isLoading = isConnecting || isReconnecting;
  
  if (!address) {
    return { isAdmin: false, isLoading };
  }
  
  // Check wallet address match (case-insensitive)
  const isAdminWallet = address.toLowerCase() === ADMIN_CONFIG.walletAddress.toLowerCase();
  
  // Check Farcaster identity
  const user = context?.user as { username?: string; fid?: number } | undefined;
  const isAdminFarcaster = user?.username === ADMIN_CONFIG.farcasterUsername || 
                           user?.fid === ADMIN_CONFIG.fid;
  
  // Require wallet match; Farcaster check is optional but provides extra verification
  // If we're in a mini-app context, we can also verify Farcaster identity
  if (context?.user) {
    // In mini-app: require both wallet and Farcaster match for maximum security
    return { isAdmin: isAdminWallet && isAdminFarcaster, isLoading };
  }
  
  // Outside mini-app: wallet match is sufficient
  return { isAdmin: isAdminWallet, isLoading };
}

