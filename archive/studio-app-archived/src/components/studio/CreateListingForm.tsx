"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { Loader2, CheckCircle2 } from "lucide-react";
import { CONTRACT_ADDRESSES } from "@cryptoart/unified-indexer";

// TODO: Import Marketplace ABI from auctionhouse-contracts or create ABI package
// Using placeholder ABI structure based on MarketplaceLib events
const MARKETPLACE_ABI = [
  {
    name: "createListing",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "listingDetails", type: "tuple", components: [
        { name: "initialAmount", type: "uint256" },
        { name: "type_", type: "uint8" },
        { name: "totalAvailable", type: "uint24" },
        { name: "totalPerSale", type: "uint24" },
        { name: "extensionInterval", type: "uint16" },
        { name: "minIncrementBPS", type: "uint16" },
        { name: "erc20", type: "address" },
        { name: "identityVerifier", type: "address" },
        { name: "startTime", type: "uint48" },
        { name: "endTime", type: "uint48" },
      ]},
      { name: "tokenDetails", type: "tuple", components: [
        { name: "id", type: "uint256" },
        { name: "address_", type: "address" },
        { name: "spec", type: "uint8" },
        { name: "lazy", type: "bool" },
      ]},
    ],
    outputs: [{ name: "listingId", type: "uint40" }],
  },
] as const;

interface CreateListingFormProps {
  nftContract: string;
  onSuccess?: (listingId: string) => void;
}

export function CreateListingForm({ nftContract, onSuccess }: CreateListingFormProps) {
  const { address, isConnected } = useAccount();
  const [listingType, setListingType] = useState<"FIXED_PRICE" | "INDIVIDUAL_AUCTION">("FIXED_PRICE");
  const [tokenId, setTokenId] = useState("");
  const [initialAmount, setInitialAmount] = useState("");
  const [totalAvailable, setTotalAvailable] = useState("1");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleCreateListing = async () => {
    if (!isConnected || !nftContract || !initialAmount) {
      return;
    }

    // TODO: Implement actual listing creation
    // This is a placeholder - actual implementation would:
    // 1. Prepare listing details struct
    // 2. Prepare token details struct
    // 3. Call createListing on marketplace contract
    console.log("Creating listing:", {
      nftContract,
      listingType,
      tokenId,
      initialAmount,
      totalAvailable,
    });

    // Placeholder transaction
    // writeContract({
    //   address: CONTRACT_ADDRESSES.MARKETPLACE,
    //   abi: MARKETPLACE_ABI,
    //   functionName: "createListing",
    //   args: [listingDetails, tokenDetails],
    // });
  };

  if (isSuccess) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <p className="text-sm text-green-800">Listing created successfully!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Create Auction Listing</h3>
      
      {!isConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            Please connect your wallet to create a listing.
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
            Listing Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setListingType("FIXED_PRICE")}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                listingType === "FIXED_PRICE"
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              Fixed Price
            </button>
            <button
              type="button"
              onClick={() => setListingType("INDIVIDUAL_AUCTION")}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                listingType === "INDIVIDUAL_AUCTION"
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              Auction
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Token ID (optional for ERC1155)
          </label>
          <input
            type="text"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="Leave empty for all tokens"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Initial Price (ETH)
          </label>
          <input
            type="number"
            value={initialAmount}
            onChange={(e) => setInitialAmount(e.target.value)}
            placeholder="0.1"
            step="0.001"
            min="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Total Available
          </label>
          <input
            type="number"
            value={totalAvailable}
            onChange={(e) => setTotalAvailable(e.target.value)}
            placeholder="1"
            step="1"
            min="1"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {listingType === "INDIVIDUAL_AUCTION" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time (Unix timestamp, optional)
              </label>
              <input
                type="number"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="Leave empty for immediate start"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time (Unix timestamp)
              </label>
              <input
                type="number"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="Required for auctions"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">
            Error: {error.message || "Failed to create listing"}
          </p>
        </div>
      )}

      <button
        onClick={handleCreateListing}
        disabled={!isConnected || !initialAmount || isPending || isConfirming}
        className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isPending || isConfirming ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            {isPending ? "Creating..." : "Confirming..."}
          </>
        ) : (
          "Create Listing"
        )}
      </button>
    </div>
  );
}

