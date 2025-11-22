import { useReadContract } from "wagmi";
import { STPV2_ABI } from "@/lib/contracts/stpv2-abi";
import { TierInfo } from "@/lib/types";

export function useTier(contractAddress: string, tierId: number) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: STPV2_ABI,
    functionName: "tierDetail",
    args: [tierId],
    query: {
      enabled: !!contractAddress,
    },
  });

  const tier: TierInfo | null = data
    ? {
        tierId,
        periodDurationSeconds: Number(data.params.periodDurationSeconds),
        maxSupply: Number(data.params.maxSupply),
        currentSupply: Number(data.subCount),
        pricePerPeriod: data.params.pricePerPeriod,
        initialMintPrice: data.params.initialMintPrice,
        rewardBasisPoints: Number(data.params.rewardBasisPoints),
        paused: data.params.paused,
        transferrable: data.params.transferrable,
      }
    : null;

  return {
    tier,
    isLoading,
    error,
    refetch,
  };
}
