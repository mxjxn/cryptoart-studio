import { useAccount, useReadContracts } from 'wagmi';
import { useMiniApp } from '@neynar/react';
import { useProfile } from '@farcaster/auth-kit';
import { STP_V2_CONTRACT_ADDRESS } from '~/lib/constants';
import { type Address } from 'viem';
import { useMemo } from 'react';

// STP v2 ABI for subscription status (ERC721 NFT contract)
const STP_V2_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export interface MembershipStatus {
  isPro: boolean;
  expirationDate: Date | null;
  membershipAddress: string | null;
  timeRemainingSeconds: number | null;
  isFarcasterWallet: boolean;
  loading: boolean;
  error: Error | null;
}

export function useMembershipStatus(): MembershipStatus {
  const { address: connectedAddress, isConnected } = useAccount();
  const { context } = useMiniApp();
  const { profile: farcasterProfile } = useProfile();

  // Get all verified addresses from Farcaster SDK (miniapp) and auth-kit (web)
  const verifiedAddresses = useMemo(() => {
    const addresses: string[] = [];
    
    // Get verified addresses from miniapp context
    if (context?.user) {
      const user = context.user as any;
      
      // Debug: Log user object structure
      console.log('[useMembershipStatus] User object structure:', {
        custody_address: user.custody_address,
        verified_addresses: user.verified_addresses,
        verifications: user.verifications,
        full_user: user,
      });
      
      // Check if there's a verified_addresses field
      const verifiedAddrs = user.verified_addresses;
      if (verifiedAddrs?.eth_addresses) {
        const ethAddrs = verifiedAddrs.eth_addresses.map((addr: string) => addr.toLowerCase());
        console.log('[useMembershipStatus] Found eth_addresses:', ethAddrs);
        addresses.push(...ethAddrs);
      }
      
      // Check primary address
      if (verifiedAddrs?.primary?.eth_address) {
        const primaryAddr = verifiedAddrs.primary.eth_address.toLowerCase();
        console.log('[useMembershipStatus] Found primary address:', primaryAddr);
        if (!addresses.includes(primaryAddr)) {
          addresses.push(primaryAddr);
        }
      }
      
      // Also check verifications array (legacy format)
      if (user.verifications) {
        console.log('[useMembershipStatus] Found verifications array:', user.verifications);
        user.verifications.forEach((addr: string) => {
          const lowerAddr = addr.toLowerCase();
          if (!addresses.includes(lowerAddr)) {
            addresses.push(lowerAddr);
          }
        });
      }
      
      // Add custody address if it exists
      if (user.custody_address) {
        const custodyAddr = user.custody_address.toLowerCase();
        console.log('[useMembershipStatus] Found custody address:', custodyAddr);
        if (!addresses.includes(custodyAddr)) {
          addresses.push(custodyAddr);
        }
      }
    }
    
    // Get verified addresses from Farcaster web auth profile (when signed in via QR code on web)
    if (farcasterProfile) {
      const profile = farcasterProfile as any;
      
      console.log('[useMembershipStatus] Farcaster web auth profile:', {
        custody_address: profile.custody_address,
        verified_addresses: profile.verified_addresses,
        verifications: profile.verifications,
      });
      
      // Check verified_addresses.eth_addresses
      const verifiedAddrs = profile.verified_addresses;
      if (verifiedAddrs?.eth_addresses) {
        const ethAddrs = verifiedAddrs.eth_addresses.map((addr: string) => addr.toLowerCase());
        console.log('[useMembershipStatus] Web auth eth_addresses:', ethAddrs);
        ethAddrs.forEach((addr: string) => {
          if (!addresses.includes(addr)) {
            addresses.push(addr);
          }
        });
      }
      
      // Check primary address
      if (verifiedAddrs?.primary?.eth_address) {
        const primaryAddr = verifiedAddrs.primary.eth_address.toLowerCase();
        console.log('[useMembershipStatus] Web auth primary address:', primaryAddr);
        if (!addresses.includes(primaryAddr)) {
          addresses.push(primaryAddr);
        }
      }
      
      // Check verifications array (legacy format)
      if (profile.verifications) {
        console.log('[useMembershipStatus] Web auth verifications array:', profile.verifications);
        profile.verifications.forEach((addr: string) => {
          const lowerAddr = addr.toLowerCase();
          if (!addresses.includes(lowerAddr)) {
            addresses.push(lowerAddr);
          }
        });
      }
      
      // Add custody address if it exists
      if (profile.custody_address) {
        const custodyAddr = profile.custody_address.toLowerCase();
        console.log('[useMembershipStatus] Web auth custody address:', custodyAddr);
        if (!addresses.includes(custodyAddr)) {
          addresses.push(custodyAddr);
        }
      }
    }
    
    // Add connected wallet if not already in list
    if (connectedAddress) {
      const connectedAddrLower = connectedAddress.toLowerCase();
      console.log('[useMembershipStatus] Connected address:', connectedAddrLower);
      if (!addresses.includes(connectedAddrLower)) {
        addresses.push(connectedAddrLower);
      }
    }
    
    console.log('[useMembershipStatus] All verified addresses to check:', addresses);
    return addresses;
  }, [context?.user, farcasterProfile, connectedAddress]);

  // Get Farcaster native wallet addresses (custody + primary)
  // These are the "native" Farcaster wallets that should NOT show "manage on hypersub"
  const farcasterNativeWallets = useMemo(() => {
    const wallets: string[] = [];
    
    // From miniapp context
    if (context?.user) {
      const user = context.user as any;
      
      // Add custody address (the native Farcaster wallet)
      const custodyAddr = user.custody_address;
      if (custodyAddr) {
        wallets.push(custodyAddr.toLowerCase());
      }
      
      // Add primary verified address (fallback/alternative native wallet)
      const verifiedAddrs = user.verified_addresses;
      if (verifiedAddrs?.primary?.eth_address) {
        const primaryAddr = verifiedAddrs.primary.eth_address.toLowerCase();
        if (!wallets.includes(primaryAddr)) {
          wallets.push(primaryAddr);
        }
      }
      
      // Also check if primary is in eth_addresses array and add it
      if (verifiedAddrs?.eth_addresses && verifiedAddrs.primary?.eth_address) {
        const primaryAddr = verifiedAddrs.primary.eth_address.toLowerCase();
        // Check if primary is actually in the eth_addresses array
        const primaryInArray = verifiedAddrs.eth_addresses.some(
          (addr: string) => addr.toLowerCase() === primaryAddr
        );
        if (primaryInArray && !wallets.includes(primaryAddr)) {
          wallets.push(primaryAddr);
        }
      }
    }
    
    // From web auth profile
    if (farcasterProfile) {
      const profile = farcasterProfile as any;
      
      // Add custody address
      const custodyAddr = profile.custody_address;
      if (custodyAddr && !wallets.includes(custodyAddr.toLowerCase())) {
        wallets.push(custodyAddr.toLowerCase());
      }
      
      // Add primary verified address
      const verifiedAddrs = profile.verified_addresses;
      if (verifiedAddrs?.primary?.eth_address) {
        const primaryAddr = verifiedAddrs.primary.eth_address.toLowerCase();
        if (!wallets.includes(primaryAddr)) {
          wallets.push(primaryAddr);
        }
      }
    }
    
    // Log what we found (always log for debugging)
    console.log('[useMembershipStatus] Farcaster native wallets:', {
      fromMiniApp: !!context?.user,
      fromWebAuth: !!farcasterProfile,
      farcasterNativeWallets: wallets,
    });
    
    return wallets;
  }, [context?.user, farcasterProfile]);
  
  // For backward compatibility, keep farcasterWallet as the primary one
  const farcasterWallet = farcasterNativeWallets[0] || null;

  // Create contract read requests for all verified addresses
  const contractReads = useMemo(() => {
    if (verifiedAddresses.length === 0) return [];
    
    return verifiedAddresses.map((addr) => ({
      address: STP_V2_CONTRACT_ADDRESS as Address,
      abi: STP_V2_ABI,
      functionName: 'balanceOf' as const,
      args: [addr as Address],
    }));
  }, [verifiedAddresses]);

  const { data: results, isLoading } = useReadContracts({
    contracts: contractReads,
    query: {
      enabled: verifiedAddresses.length > 0,
    },
  });

  // Process results to find active membership
  // Note: balanceOf returns time remaining in seconds for STP v2 contract
  const membershipData = useMemo(() => {
    console.log('[useMembershipStatus] Processing membership results:', {
      resultsLength: results?.length,
      verifiedAddressesLength: verifiedAddresses.length,
      results: results?.map((r, i) => ({
        address: verifiedAddresses[i],
        status: r?.status,
        result: r?.result?.toString(),
        error: r?.error,
      })),
    });

    if (!results || results.length === 0) {
      console.log('[useMembershipStatus] No results, returning no membership');
      return { isPro: false, expirationDate: null, membershipAddress: null, timeRemainingSeconds: null };
    }

    // Process results - check balanceOf for each address
    for (let i = 0; i < verifiedAddresses.length; i++) {
      const addr = verifiedAddresses[i];
      const balanceResult = results[i];
      
      console.log(`[useMembershipStatus] Checking address ${i}:`, {
        address: addr,
        status: balanceResult?.status,
        result: balanceResult?.result?.toString(),
        error: balanceResult?.error,
      });
      
      if (balanceResult?.status === 'success' && balanceResult.result) {
        const timeRemainingSeconds = balanceResult.result as bigint;
        console.log(`[useMembershipStatus] Address ${addr} has balance:`, timeRemainingSeconds.toString());
        
        // If timeRemainingSeconds > 0, user has active subscription
        if (timeRemainingSeconds > 0n) {
          const seconds = Number(timeRemainingSeconds);
          const expirationTimestamp = Math.floor(Date.now() / 1000) + seconds;
          const expirationDate = new Date(expirationTimestamp * 1000);
          
          console.log('[useMembershipStatus] Found active membership:', {
            address: addr,
            timeRemainingSeconds: seconds,
            expirationDate: expirationDate.toISOString(),
          });
          
          return {
            isPro: true,
            expirationDate,
            membershipAddress: addr,
            timeRemainingSeconds: seconds,
          };
        }
      } else if (balanceResult?.status === 'failure') {
        console.error(`[useMembershipStatus] Error checking address ${addr}:`, balanceResult.error);
      }
    }
    
    console.log('[useMembershipStatus] No active membership found in any verified address');
    return { isPro: false, expirationDate: null, membershipAddress: null, timeRemainingSeconds: null };
  }, [results, verifiedAddresses]);

  // Check if membership is on a Farcaster native wallet (custody or primary)
  // If it's on any other verified address, it's considered "external" and should show "manage on hypersub"
  // Note: membershipAddress is already lowercased from verifiedAddresses array
  const membershipAddrLower = membershipData.membershipAddress?.toLowerCase() || null;
  
  // Determine if this is the Farcaster wallet:
  // 1. Check if it's in the farcasterNativeWallets array (custody or primary)
  // 2. Fallback: If miniapp context doesn't provide custody/primary, check if it's:
  //    - The connected address (from eth_requestAccounts in miniapp)
  //    - The first verified address (often the primary/custody)
  let isFarcasterWallet = false;
  if (membershipAddrLower) {
    // First check: Is it in the explicit Farcaster native wallets?
    isFarcasterWallet = farcasterNativeWallets.includes(membershipAddrLower);
    
    // Fallback: If we couldn't determine from custody/primary (miniapp might not provide these)
    // and the membership is on the connected address or first verified address, treat it as Farcaster wallet
    if (!isFarcasterWallet && farcasterNativeWallets.length === 0) {
      const connectedAddrLower = connectedAddress?.toLowerCase();
      const firstVerifiedAddr = verifiedAddresses[0]?.toLowerCase();
      
      // If membership is on connected address (miniapp wallet) or first verified address, it's likely the Farcaster wallet
      if (membershipAddrLower === connectedAddrLower || membershipAddrLower === firstVerifiedAddr) {
        isFarcasterWallet = true;
      }
    }
  }
  
  // Always log membership check results (not just in development)
  console.log('[useMembershipStatus] Final membership check result:', {
    isPro: membershipData.isPro,
    membershipAddress: membershipData.membershipAddress,
    membershipAddressLower: membershipAddrLower,
    connectedAddress: connectedAddress?.toLowerCase(),
    firstVerifiedAddress: verifiedAddresses[0],
    farcasterNativeWallets,
    isFarcasterWallet,
    allVerifiedAddresses: verifiedAddresses,
    comparison: farcasterNativeWallets.map(w => ({
      wallet: w,
      matches: w === membershipAddrLower,
    })),
    fallbackUsed: farcasterNativeWallets.length === 0 && isFarcasterWallet,
    timeRemainingSeconds: membershipData.timeRemainingSeconds,
    expirationDate: membershipData.expirationDate?.toISOString(),
  });

  return {
    isPro: membershipData.isPro,
    expirationDate: membershipData.expirationDate,
    membershipAddress: membershipData.membershipAddress,
    timeRemainingSeconds: membershipData.timeRemainingSeconds,
    isFarcasterWallet,
    loading: isLoading,
    error: null,
  };
}

