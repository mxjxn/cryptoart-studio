"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Image, Loader2, CheckCircle2, Upload } from "lucide-react";
import { SeriesUploader } from "./SeriesUploader";
import { EditionCreator } from "./EditionCreator";

type MintType = "1of1" | "series" | "edition";

interface NFTMinterProps {
  defaultCollection?: string;
  defaultMintType?: MintType;
}

interface Collection {
  id: string;
  address: string;
  name: string | null;
  symbol: string | null;
  contractType: string;
}

export function NFTMinter({ defaultCollection, defaultMintType }: NFTMinterProps) {
  const { address, isConnected } = useAccount();
  const [mintType, setMintType] = useState<MintType>(defaultMintType || "1of1");
  const [contractAddress, setContractAddress] = useState(defaultCollection || "");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [tokenId, setTokenId] = useState("");
  const [metadataURI, setMetadataURI] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [mintSuccess, setMintSuccess] = useState(false);

  useEffect(() => {
    if (defaultCollection) {
      setContractAddress(defaultCollection);
    }
  }, [defaultCollection]);

  useEffect(() => {
    if (defaultMintType) {
      setMintType(defaultMintType);
    }
  }, [defaultMintType]);

  useEffect(() => {
    async function fetchCollections() {
      if (defaultCollection) return; // Don't fetch if collection is pre-selected
      try {
        setLoadingCollections(true);
        const response = await fetch("/api/studio/contracts");
        if (response.ok) {
          const data = await response.json();
          setCollections(data.collections || []);
        }
      } catch (error) {
        console.error("Failed to fetch collections:", error);
      } finally {
        setLoadingCollections(false);
      }
    }
    fetchCollections();
  }, [defaultCollection]);

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleMint1of1 = async () => {
    if (!isConnected || !contractAddress || !metadataURI) {
      return;
    }

    // TODO: Implement actual minting
    // This would:
    // 1. Upload image to IPFS if provided
    // 2. Create metadata JSON
    // 3. Upload metadata to IPFS
    // 4. Call mint function on contract
    // 5. Save to database via API

    console.log("Minting 1/1 NFT:", {
      contractAddress,
      metadataURI,
      imageFile,
    });

    // Placeholder
    setMintSuccess(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      // TODO: Upload to IPFS and set metadataURI
    }
  };

  if (mintSuccess) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <p className="text-sm text-green-800">NFT minted successfully!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            Please connect your wallet to mint NFTs.
          </p>
        </div>
      )}

      {/* Mint Type Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Mint Type
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {(["1of1", "series", "edition"] as MintType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setMintType(type)}
              className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                mintType === type
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              {type === "1of1" ? "1/1" : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* 1/1 Minting */}
      {mintType === "1of1" && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Mint 1/1 NFT</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Collection
            </label>
            {defaultCollection ? (
              <input
                type="text"
                value={contractAddress}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              />
            ) : collections.length > 0 ? (
              <select
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a collection...</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.address}>
                    {collection.name || "Unnamed"} ({collection.contractType})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Image
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <Upload className="h-5 w-5 mr-2 text-gray-600" />
                <span className="text-sm text-gray-700">Upload Image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
              {imageFile && (
                <span className="text-sm text-gray-600">{imageFile.name}</span>
              )}
            </div>
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
                Error: {error.message || "Failed to mint NFT"}
              </p>
            </div>
          )}

          <button
            onClick={handleMint1of1}
            disabled={!isConnected || !contractAddress || !metadataURI || isPending || isConfirming}
            className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isPending || isConfirming ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                {isPending ? "Minting..." : "Confirming..."}
              </>
            ) : (
              <>
                <Image className="h-5 w-5 mr-2" />
                Mint 1/1 NFT
              </>
            )}
          </button>
        </div>
      )}

      {/* Series Minting */}
      {mintType === "series" && (
        <SeriesUploader defaultContractAddress={contractAddress} />
      )}

      {/* Edition Minting */}
      {mintType === "edition" && <EditionCreator />}
    </div>
  );
}

