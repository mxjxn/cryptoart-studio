"use client";

import { useReadContract } from "wagmi";
import { CONTRACT_INFO_ABI } from "~/lib/contract-info";
import { type Address } from "viem";

/**
 * Hook to fetch contract name using the name() function.
 * 
 * @param contractAddress - The contract address to query
 * @returns Contract name, loading state, and error
 */
export function useContractName(contractAddress: Address | string | null | undefined) {
  const { data: contractName, isLoading, error } = useReadContract({
    address: contractAddress as Address | undefined,
    abi: CONTRACT_INFO_ABI,
    functionName: "name",
    query: {
      enabled: !!contractAddress,
      retry: 1,
    },
  });

  return {
    contractName: contractName as string | undefined,
    isLoading,
    error,
  };
}

