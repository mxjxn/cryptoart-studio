"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useContractDetail } from "@/hooks/useContractDetail";
import { useTier } from "@/hooks/useTier";
import { useSubscription } from "@/hooks/useSubscription";
import { STPV2_ABI } from "@/lib/contracts/stpv2-abi";
import { formatEther, formatAddress, formatTimeRemaining } from "@/lib/utils";
import { ArrowLeft, Check, Clock, Users, Gift, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function SubscribeDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { address: userAddress, isConnected } = useAccount();
  const contractAddress = params.address as string;
  const initialTierId = parseInt(searchParams.get("tier") || "0");

  const [selectedTier, setSelectedTier] = useState(initialTierId);
  const [referralCode, setReferralCode] = useState("");
  const [referrerAddress, setReferrerAddress] = useState("");

  const { contractInfo, isLoading: contractLoading } = useContractDetail(contractAddress);
  const { tier, isLoading: tierLoading } = useTier(contractAddress, selectedTier);
  const { subscription, refetch: refetchSubscription } = useSubscription(
    contractAddress,
    userAddress
  );

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Refetch subscription after successful transaction
  useEffect(() => {
    if (isSuccess) {
      refetchSubscription();
    }
  }, [isSuccess, refetchSubscription]);

  const handleSubscribe = async () => {
    if (!isConnected || !tier) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      const price = tier.pricePerPeriod;

      if (referralCode || referrerAddress) {
        // Use advanced mint with referral
        writeContract({
          address: contractAddress as `0x${string}`,
          abi: STPV2_ABI,
          functionName: "mintAdvanced",
          args: [
            {
              tierId: selectedTier,
              recipient: userAddress!,
              referrer: (referrerAddress || "0x0000000000000000000000000000000000000000") as `0x${string}`,
              referralCode: BigInt(referralCode || "0"),
              purchaseValue: price,
            },
          ],
          value: price,
        });
      } else {
        // Use simple mint
        writeContract({
          address: contractAddress as `0x${string}`,
          abi: STPV2_ABI,
          functionName: "mint",
          args: [price],
          value: price,
        });
      }
    } catch (error) {
      console.error("Subscription error:", error);
      alert("Subscription failed. Please try again.");
    }
  };

  if (contractLoading || tierLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading subscription details...</p>
        </div>
      </div>
    );
  }

  if (!tier) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Subscription Not Found</CardTitle>
            <CardDescription>
              The subscription contract or tier could not be found.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/subscribe">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Browse
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const periodDays = Math.floor(tier.periodDurationSeconds / 86400);
  const rewardPercent = tier.rewardBasisPoints / 100;
  const availableSpots = tier.maxSupply - tier.currentSupply;
  const isAvailable = availableSpots > 0 && !tier.paused;
  const hasActiveSubscription = subscription?.isActive;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link
          href="/subscribe"
          className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Browse
        </Link>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Subscription Details */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Subscription Details</CardTitle>
                <CardDescription>
                  Contract: {formatAddress(contractAddress)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Tier Selection */}
                {contractInfo && contractInfo.tierCount > 1 && (
                  <div>
                    <Label>Select Tier</Label>
                    <div className="mt-2 space-y-2">
                      {Array.from({ length: contractInfo.tierCount }, (_, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedTier(i)}
                          className={`w-full p-3 rounded-lg border-2 transition-colors text-left ${
                            selectedTier === i
                              ? "border-primary bg-primary/10"
                              : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                          }`}
                        >
                          <div className="font-medium">Tier {i}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pricing */}
                <div>
                  <h3 className="font-semibold mb-3">Pricing</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Period:
                      </span>
                      <span className="font-medium">{periodDays} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Price:
                      </span>
                      <span className="font-medium">
                        {formatEther(tier.pricePerPeriod)} ETH
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Initial Mint:
                      </span>
                      <span className="font-medium">
                        {formatEther(tier.initialMintPrice)} ETH
                      </span>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div>
                  <h3 className="font-semibold mb-3">Features</h3>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <Clock className="w-4 h-4 mr-2 text-primary" />
                      <span>{periodDays} day subscription period</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Users className="w-4 h-4 mr-2 text-primary" />
                      <span>
                        {availableSpots} / {tier.maxSupply} spots available
                      </span>
                    </div>
                    {tier.rewardBasisPoints > 0 && (
                      <div className="flex items-center text-sm">
                        <Gift className="w-4 h-4 mr-2 text-primary" />
                        <span>{rewardPercent}% revenue share rewards</span>
                      </div>
                    )}
                    {tier.transferrable && (
                      <div className="flex items-center text-sm">
                        <Check className="w-4 h-4 mr-2 text-primary" />
                        <span>Transferable NFT</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Subscribe Form */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>
                  {hasActiveSubscription ? "Renew Subscription" : "Subscribe Now"}
                </CardTitle>
                {hasActiveSubscription && subscription && (
                  <CardDescription>
                    Active until{" "}
                    {new Date(subscription.expiresAt * 1000).toLocaleDateString()}
                    {" ("}
                    {formatTimeRemaining(subscription.timeRemaining)}
                    {" remaining)"}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {!isConnected ? (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Please connect your wallet to subscribe
                    </p>
                  </div>
                ) : !isAvailable ? (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="flex items-center text-red-800 dark:text-red-200">
                      <AlertCircle className="w-5 h-5 mr-2" />
                      <span className="text-sm">
                        {tier.paused
                          ? "This subscription is currently paused"
                          : "This tier is sold out"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Referral Code (Optional) */}
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="referralCode">
                          Referral Code (Optional)
                        </Label>
                        <Input
                          id="referralCode"
                          type="number"
                          placeholder="Enter code..."
                          value={referralCode}
                          onChange={(e) => setReferralCode(e.target.value)}
                        />
                      </div>

                      <div>
                        <Label htmlFor="referrerAddress">
                          Referrer Address (Optional)
                        </Label>
                        <Input
                          id="referrerAddress"
                          placeholder="0x..."
                          value={referrerAddress}
                          onChange={(e) => setReferrerAddress(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          If you have a referral code, enter the referrer&apos;s address
                        </p>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600 dark:text-gray-400">
                          Subscription
                        </span>
                        <span className="font-medium">
                          {formatEther(tier.pricePerPeriod)} ETH
                        </span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Total</span>
                        <span>{formatEther(tier.pricePerPeriod)} ETH</span>
                      </div>
                    </div>

                    {/* Subscribe Button */}
                    <Button
                      onClick={handleSubscribe}
                      disabled={!isConnected || isPending || isConfirming}
                      className="w-full"
                      size="lg"
                    >
                      {isPending || isConfirming ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          {isPending ? "Confirming..." : "Processing..."}
                        </>
                      ) : hasActiveSubscription ? (
                        "Renew Subscription"
                      ) : (
                        "Subscribe Now"
                      )}
                    </Button>

                    {isSuccess && (
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="flex items-center text-green-800 dark:text-green-200">
                          <Check className="w-5 h-5 mr-2" />
                          <span className="text-sm font-medium">
                            Subscription successful!
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Current Subscription Info */}
            {hasActiveSubscription && subscription && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-lg">Your Subscription</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Status:
                    </span>
                    <span className="font-medium text-green-600">Active</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Time Remaining:
                    </span>
                    <span className="font-medium">
                      {formatTimeRemaining(subscription.timeRemaining)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Reward Shares:
                    </span>
                    <span className="font-medium">
                      {subscription.rewardShares.toString()}
                    </span>
                  </div>
                  {subscription.rewardBalance > 0n && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Pending Rewards:
                      </span>
                      <span className="font-medium text-green-600">
                        {formatEther(subscription.rewardBalance)} ETH
                      </span>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Link href="/my-subscriptions" className="w-full">
                    <Button variant="outline" className="w-full">
                      Manage Subscriptions
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
