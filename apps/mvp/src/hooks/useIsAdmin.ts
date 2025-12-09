import { useAccount } from 'wagmi';
import { useMiniApp } from '@neynar/react';
import { ADMIN_CONFIG, ALL_ADMIN_ADDRESSES } from '~/lib/constants';
import { usePrimaryWallet } from './usePrimaryWallet';

interface UseIsAdminResult {
  isAdmin: boolean;
  isLoading: boolean;
}

/**
 * Hook to check if the current user is an admin.
 * Checks both wallet address and Farcaster identity for maximum security.
 * Supports multiple admin addresses via ADDITIONAL_ADMIN_ADDRESSES env var.
 * 
 * For Farcaster web login: Also checks FID match and wallet from Farcaster context.
 * 
 * @returns Object with isAdmin boolean and isLoading state
 */
export function useIsAdmin(): UseIsAdminResult {
  const { address: wagmiAddress, isConnecting, isReconnecting } = useAccount();
  const { context } = useMiniApp();
  const farcasterWallet = usePrimaryWallet();
  
  // Consider loading if wallet is still connecting
  const isLoading = isConnecting || isReconnecting;
  
  // Get Farcaster user info
  const user = context?.user as { username?: string; fid?: number | string; custody_address?: string } | undefined;
  // Ensure FID is a number for comparison
  const userFid = user?.fid ? Number(user.fid) : undefined;
  
  // Check Farcaster identity match (FID or username)
  const isAdminFarcaster = user?.username === ADMIN_CONFIG.farcasterUsername || 
                           (userFid !== undefined && userFid === ADMIN_CONFIG.fid);
  
  // Get wallet address from either wagmi (connected wallet) or Farcaster context
  const address = wagmiAddress || farcasterWallet;
  
  // If we have a wallet address, check if it matches any admin address
  let isAdminWallet = false;
  if (address) {
    const normalizedAddress = address.toLowerCase();
    isAdminWallet = ALL_ADMIN_ADDRESSES.some(adminAddr => adminAddr.toLowerCase() === normalizedAddress);
  }
  
  // Admin access rules (in priority order):
  // 1. FID matches primary admin FID -> admin (works for Farcaster web login, regardless of wallet)
  // 2. Wallet matches admin address -> admin (for all admins)
  // 3. For primary admin in mini-app: if both wallet and FID match, extra security verified
  
  // Priority 1: FID-based access (for Farcaster web login)
  // This works even if wallet doesn't match - either FID OR wallet should work
  if (userFid !== undefined && ADMIN_CONFIG.fid > 0 && userFid === ADMIN_CONFIG.fid) {
    return { isAdmin: true, isLoading };
  }
  
  // Priority 2: Wallet-based access
  if (isAdminWallet) {
    // Wallet address matches an admin address
    if (context?.user) {
      // In mini-app context: for primary admin, also verify Farcaster identity for extra security
      const isPrimaryAdmin = address?.toLowerCase() === ADMIN_CONFIG.walletAddress.toLowerCase();
      if (isPrimaryAdmin) {
        // Primary admin: require both wallet AND Farcaster match for extra security
        return { isAdmin: isAdminWallet && isAdminFarcaster, isLoading };
      }
      // Additional admins only need wallet match
      return { isAdmin: true, isLoading };
    }
    // Outside mini-app: wallet match is sufficient
    return { isAdmin: true, isLoading };
  }
  
  return { isAdmin: false, isLoading };
}

