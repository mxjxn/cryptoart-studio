"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Image, Layers, Package, Upload, Loader2 } from "lucide-react";
import { SeriesUploader } from "./SeriesUploader";
import { EditionCreator } from "./EditionCreator";

type NFTType = "1of1" | "series" | "edition";

interface NFTMinterProps {
  initialType?: NFTType;
}

export function NFTMinter({ initialType = "1of1" }: NFTMinterProps) {
  const { address, isConnected } = useAccount();
  const [type, setType] = useState<NFTType>(initialType);
  const [contractAddress, setContractAddress] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [animationFile, setAnimationFile] = useState<File | null>(null);
  const [tokenURI, setTokenURI] = useState("");

  const handleMint1of1 = async () => {
    if (!isConnected || !contractAddress || !name) {
      return;
    }

    // TODO: Implement 1/1 minting
    // 1. Upload image/animation to IPFS
    // 2. Create metadata JSON
    // 3. Upload metadata to IPFS
    // 4. Mint token with metadata URI
    console.log("Minting 1/1:", {
      contractAddress,
      name,
      description,
      imageFile,
      animationFile,
    });
  };

  return (
    <div className="space-y-4">
      {!isConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            Please connect your wallet to create NFTs.
          </p>
        </div>
      )}

      {/* Type Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          NFT Type
        </label>
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setType("1of1")}
            className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors flex flex-col items-center ${
              type === "1of1"
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
            }`}
          >
            <Image className="h-5 w-5 mb-1" />
            1/1
          </button>
          <button
            type="button"
            onClick={() => setType("series")}
            className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors flex flex-col items-center ${
              type === "series"
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
            }`}
          >
            <Layers className="h-5 w-5 mb-1" />
            Series
          </button>
          <button
            type="button"
            onClick={() => setType("edition")}
            className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors flex flex-col items-center ${
              type === "edition"
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
            }`}
          >
            <Package className="h-5 w-5 mb-1" />
            Edition
          </button>
        </div>
      </div>

      {/* Render appropriate form based on type */}
      {type === "1of1" && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Create 1/1 NFT</h2>

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

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Unique NFT"
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
              placeholder="Describe your NFT..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

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
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">
                  {imageFile ? imageFile.name : "Click to upload image"}
                </span>
              </label>
            </div>
          </div>

          {/* Animation Upload (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Animation (Optional)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept="video/*,image/gif"
                onChange={(e) =>
                  setAnimationFile(e.target.files?.[0] || null)
                }
                className="hidden"
                id="animation-upload"
              />
              <label
                htmlFor="animation-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">
                  {animationFile
                    ? animationFile.name
                    : "Click to upload animation"}
                </span>
              </label>
            </div>
          </div>

          {/* Or Token URI */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Or Token URI (if metadata already uploaded)
            </label>
            <input
              type="text"
              value={tokenURI}
              onChange={(e) => setTokenURI(e.target.value)}
              placeholder="ipfs://..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            />
          </div>

          <button
            onClick={handleMint1of1}
            disabled={!isConnected || !contractAddress || !name || !imageFile}
            className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Image className="h-5 w-5 mr-2" />
            Mint 1/1 NFT
          </button>
        </div>
      )}

      {type === "series" && <SeriesUploader />}
      {type === "edition" && <EditionCreator />}
    </div>
  );
}

