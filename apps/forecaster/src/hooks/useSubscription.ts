import { useReadContract } from "wagmi";
import { STPV2_ABI } from "@/lib/contracts/stpv2-abi";
import { SubscriptionInfo } from "@/lib/types";

export function useSubscription(
  contractAddress: string,
  userAddress?: string
) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: STPV2_ABI,
    functionName: "subscriptionOf",
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress && !!contractAddress,
    },
  });

  const subscription: SubscriptionInfo | null = data
    ? {
        tierId: Number(data.tierId),
        tokenId: data.tokenId,
        expiresAt: Number(data.expiresAt),
        purchaseExpiresAt: Number(data.purchaseExpiresAt),
        rewardShares: data.rewardShares,
        rewardBalance: data.rewardBalance,
        isActive: Number(data.expiresAt) > Math.floor(Date.now() / 1000),
        timeRemaining: Math.max(
          0,
          Number(data.expiresAt) - Math.floor(Date.now() / 1000)
        ),
      }
    : null;

  return {
    subscription,
    isLoading,
    error,
    refetch,
  };
}
