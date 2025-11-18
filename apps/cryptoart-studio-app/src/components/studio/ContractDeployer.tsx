"use client";

import { useState, useMemo } from "react";
import { useAccount, useChainId } from "wagmi";
import { deployContract } from "wagmi/actions";
import { config } from "~/components/providers/WagmiProvider";
import { baseSepolia } from "wagmi/chains";
import { FileCode, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { type SalesMethod } from "@cryptoart/unified-indexer";
import { SalesMethodSelector } from "./SalesMethodSelector";
import { useMiniApp } from "@neynar/react";

type ContractType = "ERC721" | "ERC1155" | "ERC6551";

export function ContractDeployer() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { context } = useMiniApp();
  const [contractType, setContractType] = useState<ContractType>("ERC721");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [isUpgradeable, setIsUpgradeable] = useState(false);
  const [salesMethod, setSalesMethod] = useState<SalesMethod>("both");
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);

  // Get explorer URL based on chain
  const explorerUrl = useMemo(() => {
    if (!deployedAddress) return '';
    if (chainId === baseSepolia.id) {
      return `https://sepolia.basescan.org/address/${deployedAddress}`;
    }
    // Base Mainnet or other chains
    return `https://basescan.org/address/${deployedAddress}`;
  }, [chainId, deployedAddress]);

  const isTestnet = chainId === baseSepolia.id;

  const handleDeploy = async () => {
    if (!isConnected || !name || !symbol || !address) {
      return;
    }

    setIsDeploying(true);
    setDeploymentError(null);

    try {
      // Skip ERC6551 for now (not implemented)
      if (contractType === "ERC6551") {
        throw new Error("ERC6551 deployment not yet implemented");
      }

      // Get contract bytecode and ABI from API
      const response = await fetch(
        `/api/studio/deploy?type=${contractType}&upgradeable=${isUpgradeable}`
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
      // For non-upgradeable: constructor takes (name, symbol)
      // For upgradeable: we'd need to deploy implementation + proxy (more complex)
      if (isUpgradeable) {
        throw new Error("Upgradeable deployment not yet implemented. Please use non-upgradeable for now.");
      }

      const contractAddress = await deployContract(config, {
        abi,
        bytecode: bytecode as `0x${string}`,
        args: [name, symbol],
      });

      setDeployedAddress(contractAddress);

      // Save to database
      const creatorFid = context?.user?.fid || 0;
      const saveResponse = await fetch("/api/studio/contracts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: contractAddress,
          name,
          symbol,
          contractType,
          chainId,
          creatorFid,
          salesMethod,
          metadata: {
            salesMethod,
            isUpgradeable,
          },
        }),
      });

      if (!saveResponse.ok) {
        console.error("Failed to save contract to database:", await saveResponse.text());
        // Don't throw - contract is deployed, just failed to save metadata
      }
    } catch (err) {
      console.error("Deployment error:", err);
      setDeploymentError(
        err instanceof Error ? err.message : "Failed to deploy contract"
      );
    } finally {
      setIsDeploying(false);
    }
  };

  if (deployedAddress) {
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
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              View on {isTestnet ? "Sepolia Basescan" : "Basescan"}
            </a>
            <a
              href={`/studio`}
              className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-300"
            >
              Back to Studio
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

      {isConnected && (
        <div className={`border rounded-lg p-4 ${
          isTestnet 
            ? "bg-blue-50 border-blue-200" 
            : "bg-orange-50 border-orange-200"
        }`}>
          <div className="flex items-start">
            <AlertTriangle className={`h-5 w-5 mr-2 mt-0.5 ${
              isTestnet ? "text-blue-600" : "text-orange-600"
            }`} />
            <div>
              <p className={`text-sm font-medium ${
                isTestnet ? "text-blue-800" : "text-orange-800"
              }`}>
                {isTestnet 
                  ? "Deploying on Base Sepolia Testnet" 
                  : "⚠️ You are on Mainnet - Deploying costs real ETH"}
              </p>
              <p className={`text-xs mt-1 ${
                isTestnet ? "text-blue-600" : "text-orange-600"
              }`}>
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

        {deploymentError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              Error: {deploymentError}
            </p>
          </div>
        )}

        <button
          onClick={handleDeploy}
          disabled={!isConnected || !name || !symbol || isDeploying}
          className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isDeploying ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Deploying...
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

