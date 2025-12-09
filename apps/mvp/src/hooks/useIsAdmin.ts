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
  const user = context?.user as { username?: string; fid?: number; custody_address?: string } | undefined;
  const userFid = user?.fid;
  
  // Check Farcaster identity match (FID or username)
  const isAdminFarcaster = user?.username === ADMIN_CONFIG.farcasterUsername || 
                           userFid === ADMIN_CONFIG.fid;
  
  // Get wallet address from either wagmi (connected wallet) or Farcaster context
  const address = wagmiAddress || farcasterWallet;
  
  // If we have a wallet address, check if it matches any admin address
  let isAdminWallet = false;
  if (address) {
    const normalizedAddress = address.toLowerCase();
    isAdminWallet = ALL_ADMIN_ADDRESSES.some(adminAddr => adminAddr.toLowerCase() === normalizedAddress);
  }
  
  // Admin access rules:
  // 1. If wallet matches admin address -> admin (for all admins)
  // 2. If FID matches primary admin FID -> admin (for Farcaster web login without wallet)
  // 3. For primary admin in mini-app: require both wallet AND Farcaster match for extra security
  
  if (isAdminWallet) {
    // Wallet address matches an admin address
    if (context?.user) {
      // In mini-app context: for primary admin, also verify Farcaster identity
      const isPrimaryAdmin = address?.toLowerCase() === ADMIN_CONFIG.walletAddress.toLowerCase();
      if (isPrimaryAdmin) {
        return { isAdmin: isAdminWallet && isAdminFarcaster, isLoading };
      }
      // Additional admins only need wallet match
      return { isAdmin: true, isLoading };
    }
    // Outside mini-app: wallet match is sufficient
    return { isAdmin: true, isLoading };
  }
  
  // If no wallet match but FID matches primary admin, allow access (for Farcaster web login)
  if (isAdminFarcaster && userFid === ADMIN_CONFIG.fid) {
    return { isAdmin: true, isLoading };
  }
  
  return { isAdmin: false, isLoading };
}

