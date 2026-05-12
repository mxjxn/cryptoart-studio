"use client";

import { useState, useEffect } from "react";
import { useEffectiveAddress } from "~/hooks/useEffectiveAddress";
import { getChainNetworkInfo } from "~/lib/chain-display";

interface Contract {
  address: string;
  name: string | null;
  tokenType: string;
}

interface ContractSelectorProps {
  /** Chain where contracts are resolved (1 = Ethereum, 8453 = Base). */
  listingChainId: number;
  selectedContract: string | null;
  onSelectContract: (contractAddress: string, tokenType: "ERC721" | "ERC1155") => void;
  onManualInput: (contractAddress: string) => void;
}

/**
 * ContractSelector — shown after the user picks Base or Ethereum in the create listing wizard.
 * Displays cached contracts with instant loading
 * Manual input is always available
 */
export function ContractSelector({
  listingChainId,
  selectedContract,
  onSelectContract,
  onManualInput,
}: ContractSelectorProps) {
  const { address } = useEffectiveAddress();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualAddress, setManualAddress] = useState("");

  const chainQuery = `chainId=${listingChainId}`;

  // Fetch cached contracts on mount (scoped to listing chain)
  useEffect(() => {
    if (!address) return;

    async function fetchContracts() {
      setLoading(true);
      try {
        const cachedResponse = await fetch(
          `/api/contracts/cached/${encodeURIComponent(address!)}?${chainQuery}`
        );
        if (cachedResponse.ok) {
          const cachedData = await cachedResponse.json();
          const cachedContracts = cachedData.contracts || [];
          setContracts(cachedContracts);

          if (cachedContracts.length === 0) {
            const deployedResponse = await fetch(
              `/api/contracts/deployed/${encodeURIComponent(address!)}?refresh=true&${chainQuery}`,
            );
            if (deployedResponse.ok) {
              const deployedData = await deployedResponse.json();
              setContracts(deployedData.contracts || []);
            }
          } else {
            fetch(
              `/api/contracts/deployed/${encodeURIComponent(address!)}?refresh=true&${chainQuery}`,
            ).catch(() => {});
          }
        } else {
          const deployedResponse = await fetch(
            `/api/contracts/deployed/${encodeURIComponent(address!)}?${chainQuery}`
          );
          if (deployedResponse.ok) {
            const deployedData = await deployedResponse.json();
            setContracts(deployedData.contracts || []);
          }
        }
      } catch (error) {
        console.error("Error fetching contracts:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchContracts();
  }, [address, listingChainId, chainQuery]);

  const handleContractSelect = (contract: Contract) => {
    onSelectContract(contract.address, contract.tokenType as "ERC721" | "ERC1155");
    setManualAddress("");
  };

  const handleManualSubmit = () => {
    if (manualAddress && /^0x[a-fA-F0-9]{40}$/i.test(manualAddress)) {
      onManualInput(manualAddress);
    }
  };

  const handleManualKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && manualAddress && /^0x[a-fA-F0-9]{40}$/i.test(manualAddress)) {
      handleManualSubmit();
    }
  };

  const isValidAddress = manualAddress && /^0x[a-fA-F0-9]{40}$/i.test(manualAddress);

  return (
    <div className="space-y-6 font-space-grotesk">
      <div>
        <h2 className="mb-2 text-xl font-medium text-neutral-900">Select contract</h2>
        <p className="mb-4 text-sm text-neutral-600">
          On <span className="font-medium">{getChainNetworkInfo(listingChainId).displayName}</span>, choose a
          contract you have deployed, or enter a contract address manually.
        </p>
      </div>

      {loading && contracts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-600" />
          <p className="text-neutral-600">Loading your contracts…</p>
        </div>
      ) : contracts.length > 0 ? (
        <div>
          <h3 className="mb-3 text-sm font-medium text-neutral-700">Your deployed contracts</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {contracts.map((contract) => (
              <button
                key={contract.address}
                type="button"
                onClick={() => handleContractSelect(contract)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  selectedContract?.toLowerCase() === contract.address.toLowerCase()
                    ? "border-neutral-900 bg-neutral-100"
                    : "border-neutral-200 bg-neutral-50 hover:border-neutral-400 hover:bg-white"
                }`}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-1 truncate font-medium text-neutral-900">
                      {contract.name || "Unnamed contract"}
                    </h3>
                    <p className="truncate font-mono text-xs text-neutral-600">{contract.address}</p>
                  </div>
                  <span
                    className={`ml-2 inline-flex flex-shrink-0 items-center rounded border px-2 py-1 text-xs font-medium ${
                      contract.tokenType === "ERC721"
                        ? "border-purple-200 bg-purple-50 text-purple-900"
                        : "border-orange-200 bg-orange-50 text-orange-900"
                    }`}
                  >
                    {contract.tokenType}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex-1 border-t border-neutral-200" />
          <span className="text-sm text-neutral-500">Or</span>
          <div className="flex-1 border-t border-neutral-200" />
        </div>
        <label className="mb-2 block text-sm font-medium text-neutral-700">Enter contract address manually</label>
        <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              onKeyDown={handleManualKeyDown}
              placeholder="0x..."
              className="flex-1 rounded-lg border border-neutral-200 bg-white px-4 py-2 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/20"
            />
            <button
              type="button"
              onClick={handleManualSubmit}
              disabled={!isValidAddress}
              className="whitespace-nowrap rounded-lg bg-neutral-900 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Use address
            </button>
          </div>
          {manualAddress && !isValidAddress && (
            <p className="text-xs text-red-600">Invalid address format. Enter a valid 0x address.</p>
          )}
          {isValidAddress && <p className="text-xs text-green-700">Valid address format</p>}
        </div>
      </div>
    </div>
  );
}
