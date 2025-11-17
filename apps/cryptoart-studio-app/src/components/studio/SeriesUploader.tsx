"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export function SeriesUploader() {
  const { address, isConnected } = useAccount();
  const [contractAddress, setContractAddress] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<
    "idle" | "parsing" | "uploading" | "minting" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<{
    metadata: Array<{
      name: string;
      description?: string;
      image?: string;
      animation_url?: string;
      attributes?: Array<{ trait_type: string; value: string }>;
    }>;
    images: Map<string, File>;
    animations: Map<string, File>;
  } | null>(null);

  const handleZipUpload = async (file: File) => {
    setStatus("parsing");
    setError(null);

    try {
      // TODO: Implement zip parsing
      // 1. Extract zip file
      // 2. Find metadata.json
      // 3. Parse metadata array
      // 4. Extract images, animations, thumbnails from folders
      // 5. Validate structure

      // Placeholder structure
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(file);

      // Find metadata.json
      const metadataFile = zip.file("metadata.json");
      if (!metadataFile) {
        throw new Error("metadata.json not found in zip file");
      }

      const metadataContent = await metadataFile.async("string");
      const metadata = JSON.parse(metadataContent);

      if (!Array.isArray(metadata)) {
        throw new Error("metadata.json must contain an array");
      }

      // Extract files
      const images = new Map<string, File>();
      const animations = new Map<string, File>();

      // Process each metadata entry
      for (const item of metadata) {
        if (item.image) {
          const imageFile = zip.file(`images/${item.image}`);
          if (imageFile) {
            const blob = await imageFile.async("blob");
            images.set(item.image, new File([blob], item.image));
          }
        }
        if (item.animation_url) {
          const animFile = zip.file(`animations/${item.animation_url}`);
          if (animFile) {
            const blob = await animFile.async("blob");
            animations.set(
              item.animation_url,
              new File([blob], item.animation_url)
            );
          }
        }
      }

      setParsedData({ metadata, images, animations });
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse zip file");
      setStatus("error");
    }
  };

  const handleMintSeries = async () => {
    if (!parsedData || !contractAddress) {
      return;
    }

    setStatus("uploading");

    try {
      // TODO: Implement series minting
      // 1. Upload images/animations to IPFS
      // 2. Create metadata JSON for each item
      // 3. Upload metadata to IPFS
      // 4. Batch mint tokens with URIs

      setStatus("minting");
      // Mint tokens...
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mint series");
      setStatus("error");
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Create Series</h2>

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

      {/* Zip Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload Series Zip File
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <input
            type="file"
            accept=".zip"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setZipFile(file);
                handleZipUpload(file);
              }
            }}
            className="hidden"
            id="zip-upload"
          />
          <label
            htmlFor="zip-upload"
            className="cursor-pointer flex flex-col items-center"
          >
            <Upload className="h-8 w-8 text-gray-400 mb-2" />
            <span className="text-sm text-gray-600">
              {zipFile ? zipFile.name : "Click to upload zip file"}
            </span>
            <p className="text-xs text-gray-500 mt-2">
              Zip should contain: metadata.json, images/, animations/
            </p>
          </label>
        </div>
      </div>

      {/* Status Messages */}
      {status === "parsing" && (
        <div className="flex items-center text-blue-600">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          <span className="text-sm">Parsing zip file...</span>
        </div>
      )}

      {status === "error" && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {parsedData && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start">
            <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-800">
                Zip file parsed successfully
              </p>
              <p className="text-sm text-green-700 mt-1">
                Found {parsedData.metadata.length} items, {parsedData.images.size}{" "}
                images, {parsedData.animations.size} animations
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mint Button */}
      <button
        onClick={handleMintSeries}
        disabled={
          !isConnected ||
          !contractAddress ||
          !parsedData ||
          status === "uploading" ||
          status === "minting"
        }
        className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {status === "uploading" || status === "minting" ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            {status === "uploading" ? "Uploading..." : "Minting..."}
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 mr-2" />
            Mint Series
          </>
        )}
      </button>
    </div>
  );
}

