"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { FileCode, Loader2, CheckCircle2 } from "lucide-react";
import { type SalesMethod } from "@cryptoart/unified-indexer";
import { SalesMethodSelector } from "./SalesMethodSelector";

type ContractType = "ERC721" | "ERC1155" | "ERC6551";

export function ContractDeployer() {
  const { address, isConnected } = useAccount();
  const [contractType, setContractType] = useState<ContractType>("ERC721");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [isUpgradeable, setIsUpgradeable] = useState(false);
  const [salesMethod, setSalesMethod] = useState<SalesMethod>("both");
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);

  // TODO: Add actual contract ABIs and deployment logic
  // This is a placeholder structure
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleDeploy = async () => {
    if (!isConnected || !name || !symbol) {
      return;
    }

    // TODO: Implement actual contract deployment
    // This would use the contract factory and deploy
    console.log("Deploying contract:", { 
      contractType, 
      name, 
      symbol, 
      isUpgradeable,
      salesMethod 
    });
    
    // Placeholder - actual implementation would:
    // 1. Get contract bytecode and ABI
    // 2. Deploy via writeContract or direct deployment
    // 3. Wait for confirmation
    // 4. Save deployment info including salesMethod
  };

  if (isSuccess && deployedAddress) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Contract Deployed!
          </h2>
          <p className="text-gray-600 mb-4">
            Your {contractType} contract has been successfully deployed.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-600 mb-1">Contract Address</p>
            <p className="text-sm font-mono text-gray-900 break-all">
              {deployedAddress}
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <a
              href={`https://basescan.org/address/${deployedAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              View on Basescan
            </a>
            <a
              href={`/studio/contracts`}
              className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-300"
            >
              View All Contracts
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!isConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            Please connect your wallet to deploy a contract.
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Contract Configuration
          </h2>

          {/* Contract Type */}
          <div className="mb-4">
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

          {/* Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contract Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My NFT Collection"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Symbol */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Symbol
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="MNFT"
              maxLength={10}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Sales Method Selector */}
          <div className="mb-4">
            <SalesMethodSelector value={salesMethod} onChange={setSalesMethod} />
          </div>

          {/* Upgradeable Toggle */}
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isUpgradeable}
                onChange={(e) => setIsUpgradeable(e.target.checked)}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-700">
                Make upgradeable (allows future updates)
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              Upgradeable contracts use a proxy pattern and can be updated later.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              Error: {error.message || "Failed to deploy contract"}
            </p>
          </div>
        )}

        <button
          onClick={handleDeploy}
          disabled={!isConnected || !name || !symbol || isPending || isConfirming}
          className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isPending || isConfirming ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              {isPending ? "Deploying..." : "Confirming..."}
            </>
          ) : (
            <>
              <FileCode className="h-5 w-5 mr-2" />
              Deploy Contract
            </>
          )}
        </button>
      </div>
    </div>
  );
}

