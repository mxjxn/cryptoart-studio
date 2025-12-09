"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Package, Loader2, CheckCircle2 } from "lucide-react";

export function EditionCreator() {
  const { address, isConnected } = useAccount();
  const [contractAddress, setContractAddress] = useState("");
  const [editionType, setEditionType] = useState<"limited" | "open">("limited");
  const [maxSupply, setMaxSupply] = useState("");
  const [price, setPrice] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [metadataURI, setMetadataURI] = useState("");

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleCreateEdition = async () => {
    if (!isConnected || !contractAddress || !metadataURI) {
      return;
    }

    // TODO: Implement actual edition creation
    // This would:
    // 1. Upload image/metadata to IPFS if provided
    // 2. Call createEdition or similar function on contract
    // 3. Configure mint timeframe if provided
    // 4. Set price if provided
    // 5. Save to database via API

    console.log("Creating edition:", {
      contractAddress,
      editionType,
      maxSupply: editionType === "limited" ? maxSupply : "unlimited",
      price,
      startTime,
      endTime,
      metadataURI,
    });

    // Placeholder
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Create Edition</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Contract Address
        </label>
        <input
          type="text"
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value)}
          placeholder="0x..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Edition Type
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setEditionType("limited")}
            className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
              editionType === "limited"
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
            }`}
          >
            Limited
          </button>
          <button
            type="button"
            onClick={() => setEditionType("open")}
            className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
              editionType === "open"
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
            }`}
          >
            Open
          </button>
        </div>
      </div>

      {editionType === "limited" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Supply
          </label>
          <input
            type="number"
            value={maxSupply}
            onChange={(e) => setMaxSupply(e.target.value)}
            placeholder="100"
            min="1"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Price (ETH)
        </label>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0.1"
          step="0.001"
          min="0"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Start Time (optional)
        </label>
        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          End Time (optional)
        </label>
        <input
          type="datetime-local"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Metadata URI (IPFS)
        </label>
        <input
          type="text"
          value={metadataURI}
          onChange={(e) => setMetadataURI(e.target.value)}
          placeholder="ipfs://..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">
            Error: {error.message || "Failed to create edition"}
          </p>
        </div>
      )}

      {isSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="text-sm text-green-800">Edition created successfully!</p>
          </div>
        </div>
      )}

      <button
        onClick={handleCreateEdition}
        disabled={!isConnected || !contractAddress || !metadataURI || isPending || isConfirming}
        className="w-full flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isPending || isConfirming ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            {isPending ? "Creating..." : "Confirming..."}
          </>
        ) : (
          <>
            <Package className="h-5 w-5 mr-2" />
            Create Edition
          </>
        )}
      </button>
    </div>
  );
}

