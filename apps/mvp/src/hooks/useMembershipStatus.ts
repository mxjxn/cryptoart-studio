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
      // Add custody address (the native Farcaster wallet)
      const custodyAddr = (context.user as any).custody_address;
      if (custodyAddr) {
        wallets.push(custodyAddr.toLowerCase());
      }
      
      // Add primary verified address (fallback/alternative native wallet)
      const verifiedAddrs = (context.user as any).verified_addresses;
      if (verifiedAddrs?.primary?.eth_address) {
        const primaryAddr = verifiedAddrs.primary.eth_address.toLowerCase();
        if (!wallets.includes(primaryAddr)) {
          wallets.push(primaryAddr);
        }
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
  const membershipData = useMemo(() => {
    if (!results || results.length === 0) {
      return { isPro: false, expirationDate: null, membershipAddress: null };
    }

    // Process results - check balanceOf for each address
    for (let i = 0; i < verifiedAddresses.length; i++) {
      const addr = verifiedAddresses[i];
      const balanceResult = results[i];
      
      if (balanceResult?.status === 'success' && balanceResult.result) {
        const balance = balanceResult.result as bigint;
        // If balance > 0, user owns at least one subscription NFT
        if (balance > 0n) {
          return {
            isPro: true,
            expirationDate: null, // Cannot determine expiration from balanceOf alone
            membershipAddress: addr,
          };
        }
      }
    }
    
    return { isPro: false, expirationDate: null, membershipAddress: null };
  }, [results, verifiedAddresses]);

  // Check if membership is on a Farcaster native wallet (custody or primary)
  // If it's on any other verified address, it's considered "external" and should show "manage on hypersub"
  const isFarcasterWallet = membershipData.membershipAddress 
    ? farcasterNativeWallets.includes(membershipData.membershipAddress.toLowerCase())
    : false;
  
  // Debug logging in development
  if (process.env.NODE_ENV === 'development' && membershipData.membershipAddress) {
    console.log('[useMembershipStatus] Membership check:', {
      membershipAddress: membershipData.membershipAddress,
      farcasterNativeWallets,
      isFarcasterWallet,
      allVerifiedAddresses: verifiedAddresses,
    });
  }

  return {
    isPro: membershipData.isPro,
    expirationDate: membershipData.expirationDate,
    membershipAddress: membershipData.membershipAddress,
    isFarcasterWallet,
    loading: isLoading,
    error: null,
  };
}

