"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { Loader2, CheckCircle2 } from "lucide-react";
import { CONTRACT_ADDRESSES } from "@cryptoart/unified-indexer";
import { TestNFTCollectionDeployer } from "./TestNFTCollectionDeployer";
import { TestTokenDeployer } from "./TestTokenDeployer";

// TODO: Import LSSVM ABIs from @mxjxn/lssvm-abis once package is available
// For now, using placeholder ABI structure
const LSSVM_FACTORY_ABI = [
  {
    name: "createPairERC721",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_nft", type: "address" },
      { name: "_bondingCurve", type: "address" },
      { name: "_assetRecipient", type: "address" },
      { name: "_poolType", type: "uint8" },
      { name: "_delta", type: "uint128" },
      { name: "_fee", type: "uint96" },
      { name: "_spotPrice", type: "uint128" },
      { name: "_initialNFTIDs", type: "uint256[]" },
    ],
    outputs: [{ name: "pair", type: "address" }],
  },
] as const;

interface CreatePoolFormProps {
  nftContract: string;
  onSuccess?: (poolAddress: string) => void;
}

export function CreatePoolForm({ nftContract, onSuccess }: CreatePoolFormProps) {
  const { address, isConnected } = useAccount();
  const [bondingCurveType, setBondingCurveType] = useState<"linear" | "exponential">("linear");
  const [spotPrice, setSpotPrice] = useState("");
  const [delta, setDelta] = useState("");
  const [fee, setFee] = useState("");

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleCreatePool = async () => {
    if (!isConnected || !nftContract || !spotPrice || !delta || !fee) {
      return;
    }

    // TODO: Implement actual pool creation
    // This is a placeholder - actual implementation would:
    // 1. Get bonding curve address based on type
    // 2. Set asset recipient (could be the creator or a fee recipient)
    // 3. Encode parameters and call createPairERC721
    console.log("Creating pool:", {
      nftContract,
      bondingCurveType,
      spotPrice,
      delta,
      fee,
    });

    // Placeholder transaction
    // writeContract({
    //   address: CONTRACT_ADDRESSES.LSSVM_FACTORY,
    //   abi: LSSVM_FACTORY_ABI,
    //   functionName: "createPairERC721",
    //   args: [
    //     nftContract,
    //     bondingCurveAddress,
    //     assetRecipient,
    //     poolType,
    //     parseEther(delta),
    //     parseEther(fee),
    //     parseEther(spotPrice),
    //     [], // initialNFTIDs
    //   ],
    // });
  };

  if (isSuccess) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <p className="text-sm text-green-800">Pool created successfully!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Create LSSVM Pool</h3>
        <div className="flex gap-2">
          <TestNFTCollectionDeployer
            onDeployed={(address) => {
              // Optionally update the nftContract if it's editable
              console.log("Test collection deployed at:", address);
            }}
          />
          <TestTokenDeployer
            onDeployed={(address) => {
              console.log("Test token deployed at:", address);
            }}
          />
        </div>
      </div>
      
      {!isConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            Please connect your wallet to create a pool.
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            NFT Contract
          </label>
          <input
            type="text"
            value={nftContract}
            disabled
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bonding Curve Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setBondingCurveType("linear")}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                bondingCurveType === "linear"
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              Linear
            </button>
            <button
              type="button"
              onClick={() => setBondingCurveType("exponential")}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                bondingCurveType === "exponential"
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              Exponential
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Initial Spot Price (ETH)
          </label>
          <input
            type="number"
            value={spotPrice}
            onChange={(e) => setSpotPrice(e.target.value)}
            placeholder="0.01"
            step="0.001"
            min="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Delta (price change per NFT)
          </label>
          <input
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="0.001"
            step="0.0001"
            min="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fee (BPS, e.g., 100 = 1%)
          </label>
          <input
            type="number"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="100"
            step="1"
            min="0"
            max="10000"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">
            Error: {error.message || "Failed to create pool"}
          </p>
        </div>
      )}

      <button
        onClick={handleCreatePool}
        disabled={!isConnected || !spotPrice || !delta || !fee || isPending || isConfirming}
        className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isPending || isConfirming ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            {isPending ? "Creating..." : "Confirming..."}
          </>
        ) : (
          "Create Pool"
        )}
      </button>
    </div>
  );
}
