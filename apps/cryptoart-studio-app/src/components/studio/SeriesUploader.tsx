"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Upload, Loader2, CheckCircle2, FileArchive } from "lucide-react";

interface SeriesUploaderProps {
  defaultContractAddress?: string;
}

export function SeriesUploader({ defaultContractAddress }: SeriesUploaderProps) {
  const { isConnected } = useAccount();
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [contractAddress, setContractAddress] = useState(defaultContractAddress || "");
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultContractAddress) {
      setContractAddress(defaultContractAddress);
    }
  }, [defaultContractAddress]);

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/zip") {
      setZipFile(file);
      setError(null);
    } else {
      setError("Please upload a valid ZIP file");
    }
  };

  const handleProcessSeries = async () => {
    if (!isConnected || !zipFile || !contractAddress) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // TODO: Implement zip processing
      // This would:
      // 1. Extract ZIP file
      // 2. Parse metadata.json
      // 3. Extract images, animations, thumbnails
      // 4. Upload each asset to IPFS
      // 5. Create metadata JSON for each NFT
      // 6. Upload metadata to IPFS
      // 7. Mint each NFT in the series
      // 8. Save to database via API

      console.log("Processing series:", {
        contractAddress,
        zipFile: zipFile.name,
      });

      // Placeholder - simulate processing
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setUploadSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process series");
    } finally {
      setUploading(false);
    }
  };

  if (uploadSuccess) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <p className="text-sm text-green-800">Series processed and minted successfully!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Mint Series</h2>
      <p className="text-sm text-gray-600">
        Upload a ZIP file containing:
      </p>
      <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 ml-4">
        <li>metadata.json - Array of NFT metadata objects</li>
        <li>images/ - Folder with image files</li>
        <li>animations/ - Folder with animation files (optional)</li>
        <li>thumbnails/ - Folder with thumbnail files (optional)</li>
      </ul>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Contract Address
        </label>
        {defaultContractAddress ? (
          <input
            type="text"
            value={contractAddress}
            readOnly
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
          />
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
          ZIP File
        </label>
        <label className="flex items-center justify-center px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50">
          <div className="text-center">
            <FileArchive className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <span className="text-sm text-gray-700">
              {zipFile ? zipFile.name : "Click to upload ZIP file"}
            </span>
          </div>
          <input
            type="file"
            accept=".zip"
            onChange={handleZipUpload}
            className="hidden"
          />
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <button
        onClick={handleProcessSeries}
        disabled={!isConnected || !zipFile || !contractAddress || uploading}
        className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {uploading ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 mr-2" />
            Process and Mint Series
          </>
        )}
      </button>
    </div>
  );
}

