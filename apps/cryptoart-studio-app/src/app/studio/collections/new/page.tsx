"use client";

import { useEffect, useState } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useSearchParams, useRouter } from "next/navigation";
import { useAccount, useChainId } from "wagmi";
import { deployContract } from "wagmi/actions";
import { config } from "~/components/providers/WagmiProvider";
import { baseSepolia } from "wagmi/chains";
import { MobileLayout } from "~/components/ui/mobile/MobileLayout";
import { AuthWrapper } from "~/components/AuthWrapper";
import { Loader2, AlertTriangle, Upload } from "lucide-react";

type ContractType = "ERC721" | "ERC1155" | "ERC6551";

export default function NewCollectionPage() {
  const { isSDKLoaded, context } = useMiniApp();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const router = useRouter();
  const searchParams = useSearchParams();
  const contractType = (searchParams.get("type") || "ERC721") as ContractType;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSDKLoaded) {
      sdk.actions.ready();
    }
  }, [isSDKLoaded]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !name || !address) {
      setError("Please connect your wallet and fill in required fields");
      return;
    }

    setIsDeploying(true);
    setError(null);

    try {
      // Skip ERC6551 for now (not implemented)
      if (contractType === "ERC6551") {
        throw new Error("ERC6551 deployment not yet implemented");
      }

      // TODO: Upload image to IPFS if provided
      let imageURI = null;
      if (imageFile) {
        // Placeholder - implement IPFS upload
        console.log("Image upload to IPFS not yet implemented");
      }

      // Get contract bytecode and ABI from API
      const response = await fetch(
        `/api/studio/deploy?type=${contractType}&upgradeable=false`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get contract bytecode");
      }

      const { bytecode, abi } = await response.json();

      if (!bytecode || !abi) {
        throw new Error("Invalid contract artifact: missing bytecode or ABI");
      }

      // Deploy the contract
      const contractAddress = await deployContract(config, {
        abi,
        bytecode: bytecode as `0x${string}`,
        args: [name, name.substring(0, 10).toUpperCase()], // Use name for symbol, truncated
      });

      // Save to database with metadata
      const creatorFid = context?.user?.fid || 0;
      const metadata = {
        description,
        defaultImage: imageURI,
        image: imageURI,
      };

      const saveResponse = await fetch("/api/studio/contracts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: contractAddress,
          name,
          symbol: name.substring(0, 10).toUpperCase(),
          contractType,
          chainId,
          creatorFid,
          metadata,
        }),
      });

      if (!saveResponse.ok) {
        console.error("Failed to save collection to database:", await saveResponse.text());
        throw new Error("Contract deployed but failed to save metadata");
      }

      // Redirect to collection detail page
      router.push(`/studio/collections/${contractAddress}`);
    } catch (err) {
      console.error("Deployment error:", err);
      setError(err instanceof Error ? err.message : "Failed to create collection");
      setIsDeploying(false);
    }
  };

  const isTestnet = chainId === baseSepolia.id;

  return (
    <AuthWrapper>
      <MobileLayout 
        title="Create Collection" 
        showBackButton 
        backHref="/studio"
        breadcrumbs={[
          { label: "Studio", href: "/studio" },
          { label: "Collections", href: "/studio" },
          { label: "New Collection" }
        ]}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {!isConnected && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Please connect your wallet to create a collection.
              </p>
            </div>
          )}

          {isConnected && (
            <div
              className={`border rounded-lg p-4 ${
                isTestnet
                  ? "bg-blue-50 border-blue-200"
                  : "bg-orange-50 border-orange-200"
              }`}
            >
              <div className="flex items-start">
                <AlertTriangle
                  className={`h-5 w-5 mr-2 mt-0.5 ${
                    isTestnet ? "text-blue-600" : "text-orange-600"
                  }`}
                />
                <div>
                  <p
                    className={`text-sm font-medium ${
                      isTestnet ? "text-blue-800" : "text-orange-800"
                    }`}
                  >
                    {isTestnet
                      ? "Deploying on Base Sepolia Testnet"
                      : "⚠️ You are on Mainnet - Deploying costs real ETH"}
                  </p>
                  <p
                    className={`text-xs mt-1 ${
                      isTestnet ? "text-blue-600" : "text-orange-600"
                    }`}
                  >
                    {isTestnet
                      ? "Chain ID: 84532 - Safe for testing"
                      : "Chain ID: " + chainId + " - Real funds at risk"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Collection Details
              </h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contract Type
                </label>
                <div className="px-4 py-2 bg-gray-50 rounded-lg text-sm text-gray-700">
                  {contractType}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Collection Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My NFT Collection"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your collection..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Collection Image
                </label>
                <div className="space-y-3">
                  {imagePreview && (
                    <div className="w-32 h-32 rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <label className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <Upload className="h-5 w-5 mr-2 text-gray-600" />
                    <span className="text-sm text-gray-700">Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">Error: {error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!isConnected || !name || isDeploying}
              className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isDeploying ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Deploying...
                </>
              ) : (
                "Create Collection"
              )}
            </button>
          </div>
        </form>
      </MobileLayout>
    </AuthWrapper>
  );
}

