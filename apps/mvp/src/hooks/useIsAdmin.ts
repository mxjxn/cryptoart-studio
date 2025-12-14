import { useAccount } from 'wagmi';
import { useMiniApp } from '@neynar/react';
import { ADMIN_CONFIG, ALL_ADMIN_ADDRESSES } from '~/lib/constants';
import { usePrimaryWallet } from './usePrimaryWallet';
import { useEffect, useState } from 'react';

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
  const [connectionTimeout, setConnectionTimeout] = useState(false);
  
  // Add timeout to prevent infinite loading if wallet connection is stuck
  useEffect(() => {
    if (isConnecting || isReconnecting) {
      const timeout = setTimeout(() => {
        setConnectionTimeout(true);
      }, 5000); // 5 second timeout
      
      return () => clearTimeout(timeout);
    } else {
      setConnectionTimeout(false);
    }
  }, [isConnecting, isReconnecting]);
  
  // Consider loading if wallet is still connecting, but not if we've hit the timeout
  const isLoading = (isConnecting || isReconnecting) && !connectionTimeout;
  
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
  
  // Debug logging (only log once per session to avoid spam)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    const debugKey = 'useIsAdmin-debug-logged';
    if (!sessionStorage.getItem(debugKey)) {
      sessionStorage.setItem(debugKey, 'true');
      console.log('[useIsAdmin] Config loaded:', {
        walletAddress: ADMIN_CONFIG.walletAddress,
        fid: ADMIN_CONFIG.fid,
        hasEnvVars: !!process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS,
      });
    }
  }
  
  // Admin access rules (in priority order):
  // 1. FID matches primary admin FID -> admin (works for Farcaster web login, regardless of wallet)
  // 2. Wallet matches admin address -> admin (for all admins)
  // 3. For primary admin in mini-app: if both wallet and FID match, extra security verified
  
  // Priority 1: FID-based access (for Farcaster web login)
  // This works even if wallet doesn't match - either FID OR wallet should work
  if (userFid !== undefined && ADMIN_CONFIG.fid > 0 && userFid === ADMIN_CONFIG.fid) {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('[useIsAdmin] Admin access granted via FID match');
    }
    return { isAdmin: true, isLoading };
  }
  
  // Priority 2: Wallet-based access
  if (isAdminWallet) {
    // Wallet address matches an admin address - grant access
    // Note: FID check already happened above, so if we get here, either:
    // - FID didn't match (but wallet does), OR
    // - We're in a non-Farcaster context (web3 app)
    // In both cases, wallet match is sufficient for admin access
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('[useIsAdmin] Admin access granted via wallet match', { 
        isAdminWallet, 
        isAdminFarcaster, 
        hasContext: !!context?.user,
        isPrimaryAdmin: address?.toLowerCase() === ADMIN_CONFIG.walletAddress.toLowerCase()
      });
    }
    return { isAdmin: true, isLoading };
  }
  
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[useIsAdmin] Admin access denied');
  }
  
  return { isAdmin: false, isLoading };
}

