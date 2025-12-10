import { useAccount, useReadContracts } from 'wagmi';
import { useMiniApp } from '@neynar/react';
import { type Address } from 'viem';
import { useMemo } from 'react';

// Standard ERC721/ERC1155 ABI for balanceOf
const NFT_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export interface HasNFTAccessResult {
  hasAccess: boolean;
  loading: boolean;
  error: Error | null;
  addressesWithNFT: string[];
  // Address that has the NFT (first one found, or null)
  addressWithNFT: string | null;
}

/**
 * Hook to check if the user has access to a special feature based on NFT ownership.
 * Checks ALL verified addresses associated with the user's Farcaster account.
 * 
 * This works across associated wallets: if wallet B has the NFT, and wallet A is
 * the user's Farcaster wallet (with B verified to the Farcaster account), when they
 * sign in with A, they will still have access.
 * 
 * @param nftContractAddress - The NFT contract address to check balance for
 * @returns Object with hasAccess boolean, loading state, error, and addresses that have the NFT
 */
export function useHasNFTAccess(nftContractAddress: Address | undefined): HasNFTAccessResult {
  const { address: connectedAddress, isConnected } = useAccount();
  const { context } = useMiniApp();

  // Get all verified addresses from Farcaster SDK (miniapp) and wagmi (web)
  const verifiedAddresses = useMemo(() => {
    const addresses: string[] = [];
    
    // Get verified addresses from miniapp context
    if (context?.user) {
      const user = context.user as any;
      
      // Check if there's a verified_addresses field
      const verifiedAddrs = user.verified_addresses;
      if (verifiedAddrs?.eth_addresses) {
        const ethAddrs = verifiedAddrs.eth_addresses.map((addr: string) => addr.toLowerCase());
        addresses.push(...ethAddrs);
      }
      
      // Check primary address
      if (verifiedAddrs?.primary?.eth_address) {
        const primaryAddr = verifiedAddrs.primary.eth_address.toLowerCase();
        if (!addresses.includes(primaryAddr)) {
          addresses.push(primaryAddr);
        }
      }
      
      // Also check verifications array (legacy format)
      if (user.verifications) {
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
        if (!addresses.includes(custodyAddr)) {
          addresses.push(custodyAddr);
        }
      }
    }
    
    // Add connected wallet (from wagmi - works for both mini-app and web)
    if (connectedAddress) {
      const connectedAddrLower = connectedAddress.toLowerCase();
      if (!addresses.includes(connectedAddrLower)) {
        addresses.push(connectedAddrLower);
      }
    }
    
    return addresses;
  }, [context?.user, connectedAddress]);

  // Create contract read requests for all verified addresses
  const contractReads = useMemo(() => {
    if (!nftContractAddress || verifiedAddresses.length === 0) return [];
    
    return verifiedAddresses.map((addr) => ({
      address: nftContractAddress,
      abi: NFT_BALANCE_ABI,
      functionName: 'balanceOf' as const,
      args: [addr as Address],
    }));
  }, [verifiedAddresses, nftContractAddress]);

  const { data: results, isLoading } = useReadContracts({
    contracts: contractReads,
    query: {
      enabled: verifiedAddresses.length > 0 && !!nftContractAddress,
    },
  });

  // Process results to find addresses with balance > 0
  const accessData = useMemo(() => {
    if (!results || results.length === 0 || !nftContractAddress) {
      return {
        hasAccess: false,
        addressesWithNFT: [],
        addressWithNFT: null,
      };
    }

    const addressesWithNFT: string[] = [];
    
    for (let i = 0; i < verifiedAddresses.length; i++) {
      const addr = verifiedAddresses[i];
      const balanceResult = results[i];
      
      if (balanceResult?.status === 'success' && balanceResult.result) {
        const balance = balanceResult.result as bigint;
        
        // If balance > 0, user has access via this address
        if (balance > 0n) {
          addressesWithNFT.push(addr);
        }
      }
    }
    
    return {
      hasAccess: addressesWithNFT.length > 0,
      addressesWithNFT,
      addressWithNFT: addressesWithNFT[0] || null,
    };
  }, [results, verifiedAddresses, nftContractAddress]);

  return {
    hasAccess: accessData.hasAccess,
    loading: isLoading,
    error: null,
    addressesWithNFT: accessData.addressesWithNFT,
    addressWithNFT: accessData.addressWithNFT,
  };
}