"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Loader2, CheckCircle2, X, Coins } from "lucide-react";
import type { Address } from "viem";

interface TestTokenDeployerProps {
  onDeployed?: (contractAddress: Address) => void;
}

export function TestTokenDeployer({ onDeployed }: TestTokenDeployerProps) {
  const { address, isConnected } = useAccount();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tokenName, setTokenName] = useState("Test Token");
  const [tokenSymbol, setTokenSymbol] = useState("TEST");
  const [initialSupply, setInitialSupply] = useState("1000000");
  const [decimals, setDecimals] = useState("18");
  const [deployedAddress, setDeployedAddress] = useState<Address | null>(null);

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleDeploy = async () => {
    if (!isConnected || !address || !tokenName || !tokenSymbol) {
      return;
    }

    try {
      // For now, we'll use a placeholder deployment
      // In a real implementation, you would deploy the actual contract bytecode
      console.log("Deploying test token:", {
        name: tokenName,
        symbol: tokenSymbol,
        initialSupply,
        decimals,
      });

      // TODO: Implement actual contract deployment
      // This would use deployContract from wagmi/actions with the actual bytecode
      // const address = await deployContract(wagmiConfig, {
      //   abi: TEST_TOKEN_ABI,
      //   bytecode: TEST_TOKEN_BYTECODE,
      //   args: [tokenName, tokenSymbol, parseUnits(initialSupply, parseInt(decimals))],
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
        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2"
      >
        <Coins className="h-4 w-4" />
        Deploy Test Token
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Coins className="h-6 w-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">Deploy Test ERC20 Token</h2>
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
                Please connect your wallet to deploy a test token.
              </p>
            </div>
          )}

          {isSuccess && deployedAddress ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
              <h3 className="text-lg font-semibold text-gray-900">Token Deployed!</h3>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Token Name</label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="My Test Token"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Token Symbol
                </label>
                <input
                  type="text"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                  placeholder="TEST"
                  maxLength={10}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Supply
                </label>
                <input
                  type="number"
                  value={initialSupply}
                  onChange={(e) => setInitialSupply(e.target.value)}
                  placeholder="1000000"
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Total supply will be minted to your wallet
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Decimals</label>
                <input
                  type="number"
                  value={decimals}
                  onChange={(e) => setDecimals(e.target.value)}
                  placeholder="18"
                  min="0"
                  max="18"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">Standard is 18 decimals</p>
              </div>

              {/* Preview */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <p className="text-sm font-medium text-gray-700 mb-2">Preview</p>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <span className="font-medium">Name:</span> {tokenName || "—"}
                  </p>
                  <p>
                    <span className="font-medium">Symbol:</span> {tokenSymbol || "—"}
                  </p>
                  <p>
                    <span className="font-medium">Supply:</span>{" "}
                    {initialSupply
                      ? `${parseInt(initialSupply).toLocaleString()} ${tokenSymbol || ""}`
                      : "—"}
                  </p>
                  <p>
                    <span className="font-medium">Decimals:</span> {decimals || "—"}
                  </p>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">
                    Error: {error.message || "Failed to deploy token"}
                  </p>
                </div>
              )}

              <button
                onClick={handleDeploy}
                disabled={
                  !isConnected || !tokenName || !tokenSymbol || isPending || isConfirming
                }
                className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isPending || isConfirming ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    {isPending ? "Deploying..." : "Confirming..."}
                  </>
                ) : (
                  "Deploy Token"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

