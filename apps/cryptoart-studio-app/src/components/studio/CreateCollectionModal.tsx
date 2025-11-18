"use client";

import { useState } from "react";
import { X, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

type ContractType = "ERC721" | "ERC1155" | "ERC6551";

interface CreateCollectionModalProps {
  onClose: () => void;
}

export function CreateCollectionModal({ onClose }: CreateCollectionModalProps) {
  const [contractType, setContractType] = useState<ContractType>("ERC721");
  const router = useRouter();

  const handleContinue = () => {
    router.push(`/studio/collections/new?type=${contractType}`);
    onClose();
  };

  const getContractTypeInfo = (type: ContractType) => {
    switch (type) {
      case "ERC721":
        return {
          title: "ERC721 - Non-Fungible Token",
          description:
            "Each token is unique and indivisible. Perfect for 1/1 artworks, collectibles, and unique digital assets. Each NFT has its own token ID and metadata.",
        };
      case "ERC1155":
        return {
          title: "ERC1155 - Multi Token Standard",
          description:
            "Supports multiple token types in a single contract. Ideal for editions, game items, and fungible/non-fungible hybrid tokens. More gas efficient for batch operations.",
        };
      case "ERC6551":
        return {
          title: "ERC6551 - Token Bound Accounts",
          description:
            "Each NFT can own its own smart contract wallet. Enables NFTs to hold assets, interact with dApps, and build on-chain identity. Advanced use case for composable NFTs.",
        };
      default:
        return { title: "", description: "" };
    }
  };

  const info = getContractTypeInfo(contractType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">
            Create a new collection
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contract Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(["ERC721", "ERC1155", "ERC6551"] as ContractType[]).map(
                (type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setContractType(type)}
                    className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                      contractType === type
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {type}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              {info.title}
            </h3>
            <p className="text-sm text-blue-800">{info.description}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleContinue}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

