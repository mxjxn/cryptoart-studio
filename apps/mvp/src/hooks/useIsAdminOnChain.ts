import { useAccount, useReadContract } from 'wagmi';
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI, CHAIN_ID } from '~/lib/contracts/marketplace';
import { type Address } from 'viem';

interface UseIsAdminOnChainResult {
  isAdminOnChain: boolean;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to verify admin status on-chain via contract call.
 * This provides the authoritative check for admin permissions.
 * 
 * @returns Object with isAdminOnChain boolean, isLoading state, and error
 */
export function useIsAdminOnChain(): UseIsAdminOnChainResult {
  const { address } = useAccount();

  const { data: isAdmin, isLoading, error } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: 'isAdmin',
    args: address ? [address as Address] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: !!address, // Only query if address is available
    },
  });

  return {
    isAdminOnChain: isAdmin ?? false,
    isLoading,
    error: error as Error | null,
  };
}


