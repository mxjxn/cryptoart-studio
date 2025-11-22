import { useReadContract } from "wagmi";
import { STPV2_ABI } from "@/lib/contracts/stpv2-abi";
import { ContractInfo } from "@/lib/types";

export function useContractDetail(contractAddress: string) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: STPV2_ABI,
    functionName: "contractDetail",
    query: {
      enabled: !!contractAddress,
    },
  });

  const contractInfo: ContractInfo | null = data
    ? {
        address: contractAddress,
        name: "", // Will be fetched separately
        symbol: "",
        tierCount: Number(data.tierCount),
        subCount: data.subCount,
        supplyCap: data.supplyCap,
        creatorBalance: data.creatorBalance,
        rewardBalance: data.rewardBalance,
      }
    : null;

  return {
    contractInfo,
    isLoading,
    error,
    refetch,
  };
}
