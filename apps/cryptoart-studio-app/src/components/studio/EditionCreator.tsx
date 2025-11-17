"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Package, Loader2, Calendar } from "lucide-react";

type EditionType = "limited" | "open";

export function EditionCreator() {
  const { address, isConnected } = useAccount();
  const [contractAddress, setContractAddress] = useState("");
  const [editionType, setEditionType] = useState<EditionType>("limited");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxSupply, setMaxSupply] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [hasMintTimeframe, setHasMintTimeframe] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [price, setPrice] = useState("");

  const handleCreateEdition = async () => {
    if (!isConnected || !contractAddress || !name) {
      return;
    }

    // TODO: Implement edition creation
    // 1. Upload image to IPFS
    // 2. Create metadata JSON
    // 3. Upload metadata to IPFS
    // 4. Mint edition (ERC1155) with supply limit
    // 5. Optionally create marketplace listing

    console.log("Creating edition:", {
      contractAddress,
      editionType,
      name,
      description,
      maxSupply,
      hasMintTimeframe,
      startTime,
      endTime,
      price,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Create Edition</h2>

      {/* Contract Address */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Contract Address
        </label>
        <input
          type="text"
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value)}
          placeholder="0x..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
        />
      </div>

      {/* Edition Type */}
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
            Limited Edition
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
            Open Edition
          </button>
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Edition"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your edition..."
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Max Supply (Limited only) */}
      {editionType === "limited" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Supply *
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

      {/* Image Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Image *
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            className="hidden"
            id="edition-image-upload"
          />
          <label
            htmlFor="edition-image-upload"
            className="cursor-pointer flex flex-col items-center"
          >
            {imageFile ? (
              <img
                src={URL.createObjectURL(imageFile)}
                alt="Preview"
                className="max-h-32 rounded-lg mb-2"
              />
            ) : (
              <Package className="h-8 w-8 text-gray-400 mb-2" />
            )}
            <span className="text-sm text-gray-600">
              {imageFile ? imageFile.name : "Click to upload image"}
            </span>
          </label>
        </div>
      </div>

      {/* Mint Timeframe */}
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={hasMintTimeframe}
            onChange={(e) => setHasMintTimeframe(e.target.checked)}
            className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="text-sm font-medium text-gray-700">
            Set mint timeframe
          </span>
        </label>
      </div>

      {hasMintTimeframe && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Time
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
              End Time
            </label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      )}

      {/* Price (Optional) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Price (ETH) - Optional
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
        <p className="text-xs text-gray-500 mt-1">
          If set, will create a marketplace listing automatically
        </p>
      </div>

      <button
        onClick={handleCreateEdition}
        disabled={
          !isConnected ||
          !contractAddress ||
          !name ||
          !imageFile ||
          (editionType === "limited" && !maxSupply)
        }
        className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        <Package className="h-5 w-5 mr-2" />
        Create Edition
      </button>
    </div>
  );
}

