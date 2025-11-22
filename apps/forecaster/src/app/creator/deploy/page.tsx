"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Check, Rocket } from "lucide-react";
import Link from "next/link";
import { STPV2_FACTORY_ADDRESS } from "@/lib/constants";
import { STPV2_FACTORY_ABI } from "@/lib/contracts/stpv2-abi";

type Step = "basic" | "tier" | "rewards" | "review" | "deploying" | "success";

export default function CreatorDeployPage() {
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const [currentStep, setCurrentStep] = useState<Step>("basic");
  const [deployedAddress, setDeployedAddress] = useState<string>("");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    contractUri: "",
    globalSupplyCap: "10000",
    periodDurationDays: "30",
    maxSupply: "1000",
    pricePerPeriod: "0.01",
    initialMintPrice: "0.01",
    rewardBasisPoints: "2000",
    transferrable: true,
    slashable: true,
    slashGracePeriodDays: "7",
    curveNumPeriods: "12",
  });

  const updateFormData = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleDeploy = async () => {
    if (!isConnected || !address) {
      alert("Please connect your wallet first");
      return;
    }

    setCurrentStep("deploying");

    try {
      // Prepare deployment parameters
      const deployParams = {
        deployKey: new TextEncoder().encode(`forecaster-${Date.now()}`),
        initParams: {
          name: formData.name,
          symbol: formData.symbol,
          contractUri: formData.contractUri,
          owner: address,
          currencyAddress: "0x0000000000000000000000000000000000000000", // ETH
          globalSupplyCap: BigInt(formData.globalSupplyCap),
        },
        tierParams: {
          periodDurationSeconds: BigInt(
            parseInt(formData.periodDurationDays) * 86400
          ),
          maxSupply: BigInt(formData.maxSupply),
          maxCommitmentSeconds: BigInt(365 * 86400), // 1 year
          startTimestamp: BigInt(0),
          endTimestamp: BigInt(0),
          rewardCurveId: 0,
          rewardBasisPoints: BigInt(formData.rewardBasisPoints),
          paused: false,
          transferrable: formData.transferrable,
          initialMintPrice: parseEther(formData.initialMintPrice),
          pricePerPeriod: parseEther(formData.pricePerPeriod),
          gate: {
            gateType: 0, // NONE
            contractAddress: "0x0000000000000000000000000000000000000000",
            componentId: BigInt(0),
            balanceMin: BigInt(0),
          },
        },
        rewardParams: {
          slashable: formData.slashable,
          slashGracePeriod: BigInt(
            parseInt(formData.slashGracePeriodDays) * 86400
          ),
        },
        curveParams: {
          numPeriods: BigInt(formData.curveNumPeriods),
          formulaBase: BigInt(1000000), // 1x base
          periodSeconds: BigInt(
            parseInt(formData.periodDurationDays) * 86400
          ),
        },
        clientFeeBps: 250, // 2.5%
        clientReferralShareBps: 100, // 1%
        clientFeeRecipient: address,
      };

      writeContract({
        address: STPV2_FACTORY_ADDRESS as `0x${string}`,
        abi: STPV2_FACTORY_ABI,
        functionName: "deploySubscription",
        args: [deployParams],
      });
    } catch (error) {
      console.error("Deployment error:", error);
      alert("Deployment failed. Please try again.");
      setCurrentStep("review");
    }
  };

  // Watch for successful deployment
  if (isSuccess && currentStep === "deploying") {
    setCurrentStep("success");
    // TODO: Get deployed address from event logs
    setDeployedAddress("0x..."); // Placeholder
  }

  const renderStep = () => {
    switch (currentStep) {
      case "basic":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Basic Information
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Set up your subscription collection details
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Collection Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Premium Membership"
                  value={formData.name}
                  onChange={(e) => updateFormData("name", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="symbol">Symbol</Label>
                <Input
                  id="symbol"
                  placeholder="e.g., PREM"
                  value={formData.symbol}
                  onChange={(e) => updateFormData("symbol", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="contractUri">Metadata URI</Label>
                <Input
                  id="contractUri"
                  placeholder="ipfs://..."
                  value={formData.contractUri}
                  onChange={(e) => updateFormData("contractUri", e.target.value)}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Upload your metadata to IPFS and paste the URI here
                </p>
              </div>

              <div>
                <Label htmlFor="globalSupplyCap">Global Supply Cap</Label>
                <Input
                  id="globalSupplyCap"
                  type="number"
                  placeholder="10000"
                  value={formData.globalSupplyCap}
                  onChange={(e) =>
                    updateFormData("globalSupplyCap", e.target.value)
                  }
                />
                <p className="text-sm text-gray-500 mt-1">
                  Maximum total subscriptions across all tiers
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setCurrentStep("tier")}
                disabled={
                  !formData.name || !formData.symbol || !formData.contractUri
                }
              >
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case "tier":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Tier Configuration
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Configure your first subscription tier
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="periodDurationDays">
                    Period Duration (days)
                  </Label>
                  <Input
                    id="periodDurationDays"
                    type="number"
                    placeholder="30"
                    value={formData.periodDurationDays}
                    onChange={(e) =>
                      updateFormData("periodDurationDays", e.target.value)
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="maxSupply">Tier Max Supply</Label>
                  <Input
                    id="maxSupply"
                    type="number"
                    placeholder="1000"
                    value={formData.maxSupply}
                    onChange={(e) => updateFormData("maxSupply", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="initialMintPrice">
                    Initial Mint Price (ETH)
                  </Label>
                  <Input
                    id="initialMintPrice"
                    type="number"
                    step="0.001"
                    placeholder="0.01"
                    value={formData.initialMintPrice}
                    onChange={(e) =>
                      updateFormData("initialMintPrice", e.target.value)
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="pricePerPeriod">
                    Price Per Period (ETH)
                  </Label>
                  <Input
                    id="pricePerPeriod"
                    type="number"
                    step="0.001"
                    placeholder="0.01"
                    value={formData.pricePerPeriod}
                    onChange={(e) =>
                      updateFormData("pricePerPeriod", e.target.value)
                    }
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="rewardBasisPoints">
                  Reward Share (basis points)
                </Label>
                <Input
                  id="rewardBasisPoints"
                  type="number"
                  placeholder="2000"
                  value={formData.rewardBasisPoints}
                  onChange={(e) =>
                    updateFormData("rewardBasisPoints", e.target.value)
                  }
                />
                <p className="text-sm text-gray-500 mt-1">
                  {(parseInt(formData.rewardBasisPoints) / 100).toFixed(1)}% of
                  payments go to reward pool
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="transferrable"
                  checked={formData.transferrable}
                  onChange={(e) =>
                    updateFormData("transferrable", e.target.checked)
                  }
                  className="w-4 h-4 rounded border-gray-300"
                />
                <Label htmlFor="transferrable">Allow NFT transfers</Label>
              </div>
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentStep("basic")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={() => setCurrentStep("rewards")}>
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case "rewards":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Reward Configuration
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Set up your reward system parameters
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="curveNumPeriods">Curve Periods</Label>
                <Input
                  id="curveNumPeriods"
                  type="number"
                  placeholder="12"
                  value={formData.curveNumPeriods}
                  onChange={(e) =>
                    updateFormData("curveNumPeriods", e.target.value)
                  }
                />
                <p className="text-sm text-gray-500 mt-1">
                  Number of periods to reach maximum reward multiplier
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="slashable"
                  checked={formData.slashable}
                  onChange={(e) =>
                    updateFormData("slashable", e.target.checked)
                  }
                  className="w-4 h-4 rounded border-gray-300"
                />
                <Label htmlFor="slashable">Enable reward slashing</Label>
              </div>

              {formData.slashable && (
                <div>
                  <Label htmlFor="slashGracePeriodDays">
                    Slash Grace Period (days)
                  </Label>
                  <Input
                    id="slashGracePeriodDays"
                    type="number"
                    placeholder="7"
                    value={formData.slashGracePeriodDays}
                    onChange={(e) =>
                      updateFormData("slashGracePeriodDays", e.target.value)
                    }
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Days after expiration before rewards can be slashed
                  </p>
                </div>
              )}

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  About Rewards
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Subscribers earn reward shares based on their subscription payments.
                  The reward curve determines how share multipliers increase over time.
                  After {formData.curveNumPeriods} periods, subscribers reach the maximum
                  multiplier.
                </p>
              </div>
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentStep("tier")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={() => setCurrentStep("review")}>
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case "review":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Review & Deploy
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Review your subscription configuration before deploying
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h3 className="font-semibold mb-2">Basic Information</h3>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-gray-600 dark:text-gray-400">
                      Name:
                    </span>{" "}
                    {formData.name}
                  </p>
                  <p>
                    <span className="text-gray-600 dark:text-gray-400">
                      Symbol:
                    </span>{" "}
                    {formData.symbol}
                  </p>
                  <p>
                    <span className="text-gray-600 dark:text-gray-400">
                      Supply Cap:
                    </span>{" "}
                    {formData.globalSupplyCap}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h3 className="font-semibold mb-2">Tier Configuration</h3>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-gray-600 dark:text-gray-400">
                      Period:
                    </span>{" "}
                    {formData.periodDurationDays} days
                  </p>
                  <p>
                    <span className="text-gray-600 dark:text-gray-400">
                      Price:
                    </span>{" "}
                    {formData.pricePerPeriod} ETH/{formData.periodDurationDays}d
                  </p>
                  <p>
                    <span className="text-gray-600 dark:text-gray-400">
                      Rewards:
                    </span>{" "}
                    {(parseInt(formData.rewardBasisPoints) / 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Once deployed, some settings cannot be changed. Make sure
                  everything is correct before proceeding.
                </p>
              </div>
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentStep("rewards")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button
                onClick={handleDeploy}
                disabled={!isConnected || isPending}
              >
                <Rocket className="w-4 h-4 mr-2" />
                {isPending ? "Deploying..." : "Deploy Contract"}
              </Button>
            </div>
          </div>
        );

      case "deploying":
        return (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Deploying Your Contract
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              {isConfirming
                ? "Waiting for confirmation..."
                : "Please confirm the transaction in your wallet"}
            </p>
          </div>
        );

      case "success":
        return (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Deployment Successful!
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Your subscription contract has been deployed
            </p>
            {deployedAddress && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Contract Address
                </p>
                <code className="text-sm font-mono">{deployedAddress}</code>
              </div>
            )}
            <div className="flex gap-4 justify-center">
              <Link href={`/creator/dashboard?contract=${deployedAddress}`}>
                <Button>
                  Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline">Back to Home</Button>
              </Link>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
          {/* Progress Indicator */}
          {currentStep !== "deploying" && currentStep !== "success" && (
            <div className="mb-8">
              <div className="flex justify-between">
                {[
                  { id: "basic", label: "Basic" },
                  { id: "tier", label: "Tier" },
                  { id: "rewards", label: "Rewards" },
                  { id: "review", label: "Review" },
                ].map((step, index) => {
                  const steps = ["basic", "tier", "rewards", "review"];
                  const currentIndex = steps.indexOf(currentStep);
                  const stepIndex = steps.indexOf(step.id);
                  const isActive = stepIndex === currentIndex;
                  const isComplete = stepIndex < currentIndex;

                  return (
                    <div key={step.id} className="flex-1">
                      <div className="flex items-center">
                        <div
                          className={`flex items-center justify-center w-8 h-8 rounded-full ${
                            isActive
                              ? "bg-primary text-white"
                              : isComplete
                              ? "bg-green-500 text-white"
                              : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                          }`}
                        >
                          {isComplete ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <span className="text-sm">{index + 1}</span>
                          )}
                        </div>
                        <div className="ml-2">
                          <p className="text-xs font-medium">{step.label}</p>
                        </div>
                        {index < 3 && (
                          <div
                            className={`flex-1 h-1 mx-2 ${
                              stepIndex < currentIndex
                                ? "bg-green-500"
                                : "bg-gray-200 dark:bg-gray-700"
                            }`}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {renderStep()}
        </div>
      </div>
    </div>
  );
}
