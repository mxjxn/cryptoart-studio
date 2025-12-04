"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useContractDetail } from "@/hooks/useContractDetail";
import { useTier } from "@/hooks/useTier";
import { STPV2_ABI } from "@/lib/contracts/stpv2-abi";
import { formatEther, formatAddress } from "@/lib/utils";
import {
  ArrowLeft,
  Users,
  DollarSign,
  TrendingUp,
  Plus,
  Download,
  Settings,
  Gift,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

export default function CreatorDashboardPage() {
  const searchParams = useSearchParams();
  const { address: userAddress, isConnected } = useAccount();
  const contractAddress = searchParams.get("contract") || "";

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showGrantTime, setShowGrantTime] = useState(false);
  const [grantAddress, setGrantAddress] = useState("");
  const [grantDays, setGrantDays] = useState("");

  const { contractInfo, isLoading: contractLoading, refetch } = useContractDetail(contractAddress);
  const { tier: tier0 } = useTier(contractAddress, 0);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleWithdraw = async () => {
    if (!isConnected || !userAddress) return;

    try {
      const amount = parseEther(withdrawAmount);
      writeContract({
        address: contractAddress as `0x${string}`,
        abi: STPV2_ABI,
        functionName: "transferFunds",
        args: [userAddress, amount],
      });
      setShowWithdraw(false);
      setWithdrawAmount("");
    } catch (error) {
      console.error("Withdraw error:", error);
      alert("Failed to withdraw. Please try again.");
    }
  };

  const handleGrantTime = async () => {
    if (!isConnected) return;

    try {
      const seconds = BigInt(parseInt(grantDays) * 86400);
      writeContract({
        address: contractAddress as `0x${string}`,
        abi: STPV2_ABI,
        functionName: "grantTime",
        args: [grantAddress as `0x${string}`, seconds, 0],
      });
      setShowGrantTime(false);
      setGrantAddress("");
      setGrantDays("");
    } catch (error) {
      console.error("Grant time error:", error);
      alert("Failed to grant time. Please try again.");
    }
  };

  if (!contractAddress) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No Contract Selected</CardTitle>
            <CardDescription>
              Please provide a contract address in the URL
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/creator/deploy">
              <Button>Deploy New Contract</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (contractLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!contractInfo) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Contract Not Found</CardTitle>
            <CardDescription>
              The contract could not be loaded. Please check the address.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="container mx-auto px-4 max-w-7xl">
        <Link
          href="/"
          className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Creator Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Contract: {formatAddress(contractAddress)}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Total Subscribers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {contractInfo.subCount.toString()}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                of {contractInfo.supplyCap.toString()} cap
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center">
                <BarChart3 className="w-4 h-4 mr-2" />
                Active Tiers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{contractInfo.tierCount}</div>
              <p className="text-sm text-gray-500 mt-1">subscription tiers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center">
                <DollarSign className="w-4 h-4 mr-2" />
                Creator Balance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatEther(contractInfo.creatorBalance)}
              </div>
              <p className="text-sm text-gray-500 mt-1">ETH available</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center">
                <Gift className="w-4 h-4 mr-2" />
                Reward Pool
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatEther(contractInfo.rewardBalance)}
              </div>
              <p className="text-sm text-gray-500 mt-1">ETH in rewards</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Withdraw Funds</CardTitle>
              <CardDescription>
                Transfer creator balance to your wallet
              </CardDescription>
            </CardHeader>
            <CardContent>
              {showWithdraw ? (
                <div className="space-y-4">
                  <div>
                    <Label>Amount (ETH)</Label>
                    <Input
                      type="number"
                      step="0.001"
                      placeholder="0.0"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Available: {formatEther(contractInfo.creatorBalance)} ETH
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleWithdraw}
                      disabled={!withdrawAmount || isPending || isConfirming}
                      className="flex-1"
                    >
                      {isPending || isConfirming ? "Processing..." : "Withdraw"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowWithdraw(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => setShowWithdraw(true)}
                  disabled={contractInfo.creatorBalance === 0n}
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Withdraw
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Grant Time</CardTitle>
              <CardDescription>
                Give free subscription time to users
              </CardDescription>
            </CardHeader>
            <CardContent>
              {showGrantTime ? (
                <div className="space-y-4">
                  <div>
                    <Label>User Address</Label>
                    <Input
                      placeholder="0x..."
                      value={grantAddress}
                      onChange={(e) => setGrantAddress(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Days</Label>
                    <Input
                      type="number"
                      placeholder="30"
                      value={grantDays}
                      onChange={(e) => setGrantDays(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleGrantTime}
                      disabled={
                        !grantAddress || !grantDays || isPending || isConfirming
                      }
                      className="flex-1"
                    >
                      {isPending || isConfirming ? "Processing..." : "Grant"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowGrantTime(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => setShowGrantTime(true)}
                  className="w-full"
                  variant="outline"
                >
                  <Gift className="w-4 h-4 mr-2" />
                  Grant Time
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Create New Tier</CardTitle>
              <CardDescription>
                Add another subscription tier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/creator/tier/create?contract=${contractAddress}`}>
                <Button className="w-full" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  New Tier
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Tiers Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Tiers</CardTitle>
            <CardDescription>
              Manage your subscription offerings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: contractInfo.tierCount }, (_, i) => (
                <TierRow key={i} contractAddress={contractAddress} tierId={i} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Success Message */}
        {isSuccess && (
          <div className="fixed bottom-4 right-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg shadow-lg">
            <p className="text-green-800 dark:text-green-200">
              ✅ Transaction successful!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function TierRow({
  contractAddress,
  tierId,
}: {
  contractAddress: string;
  tierId: number;
}) {
  const { tier, isLoading } = useTier(contractAddress, tierId);

  if (isLoading || !tier) {
    return (
      <div className="p-4 border rounded-lg animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
      </div>
    );
  }

  const periodDays = Math.floor(tier.periodDurationSeconds / 86400);
  const rewardPercent = tier.rewardBasisPoints / 100;
  const utilizationPercent = (tier.currentSupply / tier.maxSupply) * 100;

  return (
    <div className="p-4 border rounded-lg hover:border-primary transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-lg">
            Tier {tierId}
            {tier.paused && (
              <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded">
                Paused
              </span>
            )}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {formatEther(tier.pricePerPeriod)} ETH / {periodDays} days
          </p>
        </div>
        <Button variant="ghost" size="sm">
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-gray-600 dark:text-gray-400">Subscribers</p>
          <p className="font-medium">
            {tier.currentSupply} / {tier.maxSupply}
          </p>
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-400">Utilization</p>
          <p className="font-medium">{utilizationPercent.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-400">Rewards</p>
          <p className="font-medium">{rewardPercent}%</p>
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-400">Transferable</p>
          <p className="font-medium">{tier.transferrable ? "Yes" : "No"}</p>
        </div>
      </div>
    </div>
  );
}
