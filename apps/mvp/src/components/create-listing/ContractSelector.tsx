"use client";

import { useState, useEffect } from "react";
import { useEffectiveAddress } from "~/hooks/useEffectiveAddress";

interface Contract {
  address: string;
  name: string | null;
  tokenType: string;
}

interface ContractSelectorProps {
  selectedContract: string | null;
  onSelectContract: (contractAddress: string, tokenType: "ERC721" | "ERC1155") => void;
  onManualInput: (contractAddress: string) => void;
}

/**
 * ContractSelector component for page 1 of the create listing wizard
 * Displays cached contracts with instant loading
 */
export function ContractSelector({
  selectedContract,
  onSelectContract,
  onManualInput,
}: ContractSelectorProps) {
  const { address } = useEffectiveAddress();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [useManualInput, setUseManualInput] = useState(false);

  // Fetch cached contracts on mount
  useEffect(() => {
    if (!address) return;

    async function fetchContracts() {
      setLoading(true);
      try {
        // Fetch from cached endpoint (instant)
        const response = await fetch(`/api/contracts/cached/${encodeURIComponent(address!)}`);
        if (response.ok) {
          const data = await response.json();
          setContracts(data.contracts || []);
        }
        
        // Optionally trigger background refresh
        fetch(`/api/contracts/deployed/${encodeURIComponent(address!)}?refresh=true`).catch(() => {
          // Silently fail background refresh
        });
      } catch (error) {
        console.error("Error fetching contracts:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchContracts();
  }, [address]);

  const handleContractSelect = (contract: Contract) => {
    onSelectContract(contract.address, contract.tokenType as "ERC721" | "ERC1155");
    setUseManualInput(false);
    setManualAddress("");
  };

  const handleManualSubmit = () => {
    if (manualAddress && /^0x[a-fA-F0-9]{40}$/i.test(manualAddress)) {
      onManualInput(manualAddress);
      setUseManualInput(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-light mb-2">Select Contract</h2>
        <p className="text-sm text-[#999999] mb-4">
          Choose a contract you've deployed, or enter a contract address manually
        </p>
      </div>

      {loading && contracts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="h-8 w-8 border-2 border-[#666666] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-[#999999]">Loading your contracts...</p>
        </div>
      ) : contracts.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-6 text-center">
          <p className="text-[#999999] mb-4">No contracts found. Enter a contract address manually.</p>
          <button
            type="button"
            onClick={() => setUseManualInput(true)}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded hover:bg-[#cccccc] transition-colors"
          >
            Enter Contract Address
          </button>
        </div>
      ) : (
        <>
          {/* Contract Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {contracts.map((contract) => (
              <button
                key={contract.address}
                type="button"
                onClick={() => handleContractSelect(contract)}
                className={`p-4 rounded-lg border text-left transition-colors ${
                  selectedContract?.toLowerCase() === contract.address.toLowerCase()
                    ? "border-white bg-[#1a1a1a]"
                    : "border-[#333333] bg-[#0a0a0a] hover:border-[#555555]"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium truncate mb-1">
                      {contract.name || "Unnamed Contract"}
                    </h3>
                    <p className="text-xs text-[#999999] font-mono truncate">
                      {contract.address}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ml-2 flex-shrink-0 ${
                      contract.tokenType === "ERC721"
                        ? "bg-purple-900/30 text-purple-300 border border-purple-700/50"
                        : "bg-orange-900/30 text-orange-300 border border-orange-700/50"
                    }`}
                  >
                    {contract.tokenType}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Manual Input Option */}
          {!useManualInput ? (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setUseManualInput(true)}
                className="text-sm text-[#999999] hover:text-[#cccccc] transition-colors"
              >
                Or enter contract address manually
              </button>
            </div>
          ) : (
            <div className="space-y-2 p-4 bg-[#1a1a1a] border border-[#333333] rounded-lg">
              <label className="block text-sm font-medium text-[#cccccc] mb-2">
                Contract Address
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="0x..."
                  className="flex-1 px-4 py-2 border border-[#333333] rounded-lg focus:ring-2 focus:ring-white focus:border-white text-white bg-black font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={handleManualSubmit}
                  disabled={!manualAddress || !/^0x[a-fA-F0-9]{40}$/i.test(manualAddress)}
                  className="px-4 py-2 bg-white text-black text-sm font-medium rounded hover:bg-[#cccccc] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Use
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUseManualInput(false);
                    setManualAddress("");
                  }}
                  className="px-4 py-2 bg-[#333333] text-white text-sm font-medium rounded hover:bg-[#444444] transition-colors"
                >
                  Cancel
                </button>
              </div>
              {manualAddress && !/^0x[a-fA-F0-9]{40}$/i.test(manualAddress) && (
                <p className="text-xs text-red-400">Invalid address format</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

