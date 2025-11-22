"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { STPV2_ABI } from "@/lib/contracts/stpv2-abi";
import { formatEther, formatAddress, formatTimeRemaining } from "@/lib/utils";
import { ArrowLeft, Gift, Clock, TrendingUp, ExternalLink } from "lucide-react";
import Link from "next/link";

// TODO: In production, this would come from an indexer/API
// that tracks all subscriptions for a user across all contracts
const USER_SUBSCRIPTIONS = [
  "0x1234567890123456789012345678901234567890",
  "0x2345678901234567890123456789012345678901",
];

export default function MySubscriptionsPage() {
  const { address, isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Connect Your Wallet</CardTitle>
            <CardDescription>
              Please connect your wallet to view your subscriptions
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <Link
          href="/"
          className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            My Subscriptions
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Manage your subscriptions and claim rewards
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {USER_SUBSCRIPTIONS.map((contractAddress) => (
            <SubscriptionCard
              key={contractAddress}
              contractAddress={contractAddress}
              userAddress={address!}
            />
          ))}
        </div>

        {USER_SUBSCRIPTIONS.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              You don&apos;t have any subscriptions yet
            </p>
            <Link href="/subscribe">
              <Button>Browse Subscriptions</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function SubscriptionCard({
  contractAddress,
  userAddress,
}: {
  contractAddress: string;
  userAddress: string;
}) {
  const { subscription, refetch } = useSubscription(contractAddress, userAddress);
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleClaimRewards = async () => {
    try {
      writeContract({
        address: contractAddress as `0x${string}`,
        abi: STPV2_ABI,
        functionName: "transferRewardsFor",
        args: [userAddress as `0x${string}`],
      });
    } catch (error) {
      console.error("Claim rewards error:", error);
      alert("Failed to claim rewards. Please try again.");
    }
  };

  if (!subscription) {
    return null;
  }

  const hasRewards = subscription.rewardBalance > 0n;
  const isExpiringSoon = subscription.timeRemaining < 7 * 86400; // < 7 days
  const isExpired = !subscription.isActive;

  return (
    <Card className={isExpired ? "border-red-200 dark:border-red-800" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Subscription #{subscription.tokenId.toString()}</CardTitle>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              subscription.isActive
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
            }`}
          >
            {subscription.isActive ? "Active" : "Expired"}
          </span>
        </div>
        <CardDescription>{formatAddress(contractAddress)}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400 flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              Time Remaining:
            </span>
            <span
              className={`font-medium ${
                isExpiringSoon && !isExpired
                  ? "text-yellow-600 dark:text-yellow-400"
                  : ""
              }`}
            >
              {subscription.isActive
                ? formatTimeRemaining(subscription.timeRemaining)
                : "Expired"}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              Reward Shares:
            </span>
            <span className="font-medium">
              {subscription.rewardShares.toString()}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400 flex items-center">
              <Gift className="w-4 h-4 mr-2" />
              Pending Rewards:
            </span>
            <span className="font-medium text-green-600 dark:text-green-400">
              {formatEther(subscription.rewardBalance)} ETH
            </span>
          </div>
        </div>

        {/* Expiring Soon Warning */}
        {isExpiringSoon && !isExpired && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ Your subscription expires soon. Renew to keep access!
            </p>
          </div>
        )}

        {/* Expired Warning */}
        {isExpired && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">
              🔒 Your subscription has expired
            </p>
          </div>
        )}

        {/* Claim Rewards Success */}
        {isSuccess && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-200">
              ✅ Rewards claimed successfully!
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        <Link
          href={`/subscribe/${contractAddress}?tier=${subscription.tierId}`}
          className="flex-1"
        >
          <Button variant={isExpired ? "default" : "outline"} className="w-full">
            {isExpired ? "Renew" : "Extend"}
          </Button>
        </Link>

        {hasRewards && (
          <Button
            onClick={handleClaimRewards}
            disabled={isPending || isConfirming}
            className="flex-1"
          >
            {isPending || isConfirming ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Claiming...
              </>
            ) : (
              <>
                <Gift className="w-4 h-4 mr-2" />
                Claim Rewards
              </>
            )}
          </Button>
        )}

        <Link href={`/subscribe/${contractAddress}`}>
          <Button variant="ghost" size="icon">
            <ExternalLink className="w-4 h-4" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
