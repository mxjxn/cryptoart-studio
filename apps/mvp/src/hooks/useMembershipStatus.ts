import { useAccount, useReadContracts } from 'wagmi';
import { useMiniApp } from '@neynar/react';
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

  // Get all verified addresses from Farcaster SDK
  const verifiedAddresses = useMemo(() => {
    const addresses: string[] = [];
    
    // Get verified addresses from context
    if (context?.user) {
      // Debug: Log user object structure in development
      if (process.env.NODE_ENV === 'development') {
        console.log('[useMembershipStatus] User object structure:', {
          custody_address: (context.user as any).custody_address,
          verified_addresses: (context.user as any).verified_addresses,
          verifications: (context.user as any).verifications,
        });
      }
      
      // Check if there's a verified_addresses field
      const verifiedAddrs = (context.user as any).verified_addresses;
      if (verifiedAddrs?.eth_addresses) {
        addresses.push(...verifiedAddrs.eth_addresses.map((addr: string) => addr.toLowerCase()));
      }
      
      // Also check verifications array (legacy format)
      if ((context.user as any).verifications) {
        (context.user as any).verifications.forEach((addr: string) => {
          const lowerAddr = addr.toLowerCase();
          if (!addresses.includes(lowerAddr)) {
            addresses.push(lowerAddr);
          }
        });
      }
    }
    
    // Add connected wallet if not already in list
    if (connectedAddress && !addresses.includes(connectedAddress.toLowerCase())) {
      addresses.push(connectedAddress.toLowerCase());
    }
    
    return addresses;
  }, [context?.user, connectedAddress]);

  // Get Farcaster native wallet addresses (custody + primary)
  // These are the "native" Farcaster wallets that should NOT show "manage on hypersub"
  const farcasterNativeWallets = useMemo(() => {
    const wallets: string[] = [];
    
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
      
      // Debug: Log what we found
      if (process.env.NODE_ENV === 'development') {
        console.log('[useMembershipStatus] Farcaster native wallets:', {
          custody_address: custodyAddr,
          primary_eth_address: verifiedAddrs?.primary?.eth_address,
          all_eth_addresses: verifiedAddrs?.eth_addresses,
          farcasterNativeWallets: wallets,
        });
      }
    }
    
    return wallets;
  }, [context?.user]);
  
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
    if (!results || results.length === 0) {
      return { isPro: false, expirationDate: null, membershipAddress: null, timeRemainingSeconds: null };
    }

    // Process results - check balanceOf for each address
    for (let i = 0; i < verifiedAddresses.length; i++) {
      const addr = verifiedAddresses[i];
      const balanceResult = results[i];
      
      if (balanceResult?.status === 'success' && balanceResult.result) {
        const timeRemainingSeconds = balanceResult.result as bigint;
        // If timeRemainingSeconds > 0, user has active subscription
        if (timeRemainingSeconds > 0n) {
          const seconds = Number(timeRemainingSeconds);
          const expirationTimestamp = Math.floor(Date.now() / 1000) + seconds;
          const expirationDate = new Date(expirationTimestamp * 1000);
          
          return {
            isPro: true,
            expirationDate,
            membershipAddress: addr,
            timeRemainingSeconds: seconds,
          };
        }
      }
    }
    
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
  
  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    if (membershipData.membershipAddress) {
      console.log('[useMembershipStatus] Membership check:', {
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
      });
    }
  }

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

