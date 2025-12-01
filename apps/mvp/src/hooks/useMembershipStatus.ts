import { useAccount, useReadContracts } from 'wagmi';
import { useMiniApp } from '@neynar/react';
import { STP_V2_CONTRACT_ADDRESS } from '~/lib/constants';
import { type Address } from 'viem';
import { useMemo } from 'react';

// STP v2 ABI for subscription status
const STP_V2_ABI = [
  {
    type: 'function',
    name: 'subscriptionOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'start', type: 'uint256' },
          { name: 'expiration', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isActive',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
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

  // Get Farcaster custody address (primary wallet)
  const farcasterWallet = useMemo(() => {
    if (context?.user) {
      const custodyAddr = (context.user as any).custody_address;
      if (custodyAddr) {
        return custodyAddr.toLowerCase();
      }
      // Fallback to primary verified address
      const verifiedAddrs = (context.user as any).verified_addresses;
      if (verifiedAddrs?.primary?.eth_address) {
        return verifiedAddrs.primary.eth_address.toLowerCase();
      }
    }
    return null;
  }, [context?.user]);

  // Create contract read requests for all verified addresses
  const contractReads = useMemo(() => {
    if (verifiedAddresses.length === 0) return [];
    
    return verifiedAddresses.flatMap((addr) => [
      {
        address: STP_V2_CONTRACT_ADDRESS as Address,
        abi: STP_V2_ABI,
        functionName: 'isActive' as const,
        args: [addr as Address],
      },
      {
        address: STP_V2_CONTRACT_ADDRESS as Address,
        abi: STP_V2_ABI,
        functionName: 'subscriptionOf' as const,
        args: [addr as Address],
      },
    ]);
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

    // Process results in pairs (isActive, subscriptionOf) for each address
    for (let i = 0; i < verifiedAddresses.length; i++) {
      const addr = verifiedAddresses[i];
      const isActiveIndex = i * 2;
      const subscriptionIndex = i * 2 + 1;
      
      const isActiveResult = results[isActiveIndex];
      const subscriptionResult = results[subscriptionIndex];
      
      if (isActiveResult?.status === 'success' && isActiveResult.result === true) {
        // Found active membership
        let expirationDate: Date | null = null;
        if (subscriptionResult?.status === 'success' && subscriptionResult.result) {
          const subscription = subscriptionResult.result as [bigint, bigint];
          if (subscription && subscription.length >= 2) {
            const expirationTimestamp = Number(subscription[1]);
            if (expirationTimestamp > 0) {
              expirationDate = new Date(expirationTimestamp * 1000);
            }
          }
        }
        
        return {
          isPro: true,
          expirationDate,
          membershipAddress: addr,
        };
      }
    }
    
    return { isPro: false, expirationDate: null, membershipAddress: null };
  }, [results, verifiedAddresses]);

  const isFarcasterWallet = membershipData.membershipAddress === farcasterWallet;

  return {
    isPro: membershipData.isPro,
    expirationDate: membershipData.expirationDate,
    membershipAddress: membershipData.membershipAddress,
    isFarcasterWallet,
    loading: isLoading,
    error: null,
  };
}

