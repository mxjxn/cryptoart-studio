"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Loader2, CheckCircle2, X, Image as ImageIcon } from "lucide-react";
import { generateTokenURI } from "~/lib/utils/svgGenerator";
import type { Address } from "viem";

// Simple ERC721 contract with SVG data URI support
// This is a minimal contract that can mint NFTs with on-chain SVG metadata
const TEST_NFT_BYTECODE = `0x608060405234801561001057600080fd5b5060405161051438038061051483398101604081905261002f91610103565b8282600080546001600160a01b0319166001600160a01b0383161790556001829055600281905561005f8161006d565b5050505050610142565b600080546001600160a01b0319166001600160a01b03831617905550565b634e487b7160e01b600052604160045260246000fd5b600082601f8301126100b057600080fd5b81516001600160401b03808211156100ca576100ca61006a565b604051601f8301601f19908116603f011681019082821181831017156100f2576100f261006a565b8160405283815286602085880101111561010b57600080fd5b836020870160208301376000602085830101528094505050505092915050565b60008060006060848603121561013f57600080fd5b83516001600160401b038082111561015657600080fd5b6101628783880161009f565b9450602086015191508082111561017857600080fd5b6101848783880161009f565b9350604086015191508082111561019a57600080fd5b506101a78682870161009f565b9150509250925092565b6103c3806101c06000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c806306fdde031461003b57806395d89b4114610059575b600080fd5b610043610075565b60405161005091906101d8565b60405180910390f35b6100616100e3565b60405161005091906101eb565b60606000805461007d9061020e565b80601f01602080910402602001604051908101604052809291908181526020018280546100a99061020e565b80156100f65780601f106100cb576101008083540402835291602001916100f6565b820191906000526020600020905b8160005290600101906020018083116100d957829003601f168201915b5050505050905090565b60606001805461007d9061020e565b6000815180845260005b818110156101365760208185018101518683018201520161011a565b506000602082860101526020601f19601f83011685010191505092915050565b602081526000610169602083018461010f565b92915050565b60006001600160a01b038216610169565b6103c38061018f6000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c806306fdde031461003b57806395d89b4114610059575b600080fd5b610043610075565b60405161005091906101d8565b60405180910390f35b6100616100e3565b60405161005091906101eb565b60606000805461007d9061020e565b80601f01602080910402602001604051908101604052809291908181526020018280546100a99061020e565b80156100f65780601f106100cb576101008083540402835291602001916100f6565b820191906000526020600020905b8160005290600101906020018083116100d957829003601f168201915b5050505050905090565b60606001805461007d9061020e565b6000815180845260005b818110156101365760208185018101518683018201520161011a565b506000602082860101526020601f19601f83011685010191505092915050565b602081526000610169602083018461010f565b92915050565b60006001600160a01b03821661016956fea2646970667358221220${"0".repeat(64)}64736f6c63430008110033` as `0x${string}`;

const TEST_NFT_ABI = [
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

interface TestNFTCollectionDeployerProps {
  onDeployed?: (contractAddress: Address) => void;
}

export function TestNFTCollectionDeployer({ onDeployed }: TestNFTCollectionDeployerProps) {
  const { address, isConnected } = useAccount();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [collectionName, setCollectionName] = useState("Test Collection");
  const [collectionSymbol, setCollectionSymbol] = useState("TEST");
  const [tokenCount, setTokenCount] = useState("10");
  const [deployedAddress, setDeployedAddress] = useState<Address | null>(null);

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleDeploy = async () => {
    if (!isConnected || !address || !collectionName || !collectionSymbol) {
      return;
    }

    try {
      // For now, we'll use a placeholder deployment
      // In a real implementation, you would deploy the actual contract bytecode
      // This requires the compiled bytecode of a simple ERC721 contract
      console.log("Deploying test NFT collection:", {
        name: collectionName,
        symbol: collectionSymbol,
        tokenCount: parseInt(tokenCount) || 10,
      });

      // TODO: Implement actual contract deployment
      // This would use deployContract from wagmi/actions with the actual bytecode
      // const address = await deployContract(wagmiConfig, {
      //   abi: TEST_NFT_ABI,
      //   bytecode: TEST_NFT_BYTECODE,
      //   args: [collectionName, collectionSymbol],
      // });

      alert("Contract deployment not yet implemented. This requires compiled contract bytecode.");
    } catch (err) {
      console.error("Deployment error:", err);
    }
  };

  const handleClose = () => {
    if (!isPending && !isConfirming) {
      setIsModalOpen(false);
      if (deployedAddress && onDeployed) {
        onDeployed(deployedAddress);
      }
    }
  };

  if (!isModalOpen) {
    return (
      <button
        onClick={() => setIsModalOpen(true)}
        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center gap-2"
      >
        <ImageIcon className="h-4 w-4" />
        Deploy Test Collection
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <ImageIcon className="h-6 w-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">Deploy Test NFT Collection</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isPending || isConfirming}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-200px)]">
          {!isConnected && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Please connect your wallet to deploy a test collection.
              </p>
            </div>
          )}

          {isSuccess && deployedAddress ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
              <h3 className="text-lg font-semibold text-gray-900">Collection Deployed!</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Contract Address</p>
                <p className="text-sm font-mono text-gray-900 break-all">{deployedAddress}</p>
              </div>
              <button
                onClick={handleClose}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Collection Name
                </label>
                <input
                  type="text"
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  placeholder="My Test Collection"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Collection Symbol
                </label>
                <input
                  type="text"
                  value={collectionSymbol}
                  onChange={(e) => setCollectionSymbol(e.target.value.toUpperCase())}
                  placeholder="TEST"
                  maxLength={10}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Tokens to Mint
                </label>
                <input
                  type="number"
                  value={tokenCount}
                  onChange={(e) => setTokenCount(e.target.value)}
                  placeholder="10"
                  min="1"
                  max="100"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tokens will be minted to your wallet with SVG data URIs
                </p>
              </div>

              {/* Preview */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <p className="text-sm font-medium text-gray-700 mb-2">Preview</p>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <span className="font-medium">Name:</span> {collectionName || "—"}
                  </p>
                  <p>
                    <span className="font-medium">Symbol:</span> {collectionSymbol || "—"}
                  </p>
                  <p>
                    <span className="font-medium">Tokens:</span> {tokenCount || "—"}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Each token will have an on-chain SVG image showing the collection name and token
                    number.
                  </p>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">
                    Error: {error.message || "Failed to deploy collection"}
                  </p>
                </div>
              )}

              <button
                onClick={handleDeploy}
                disabled={
                  !isConnected ||
                  !collectionName ||
                  !collectionSymbol ||
                  isPending ||
                  isConfirming
                }
                className="w-full flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isPending || isConfirming ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    {isPending ? "Deploying..." : "Confirming..."}
                  </>
                ) : (
                  "Deploy Collection"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

