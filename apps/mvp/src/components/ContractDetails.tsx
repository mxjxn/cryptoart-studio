"use client";

import { useState, useEffect } from "react";
import { Address } from "viem";
import { useContractName } from "~/hooks/useContractName";
import { useArtistName } from "~/hooks/useArtistName";

interface ContractDetailsProps {
  contractAddress: Address;
  imageUrl?: string | null;
}

export function ContractDetails({ contractAddress, imageUrl }: ContractDetailsProps) {
  const { contractName, isLoading: contractNameLoading } = useContractName(contractAddress);
  const [deploymentBlock, setDeploymentBlock] = useState<number | null>(null);
  const [deploymentLoading, setDeploymentLoading] = useState(false);

  // Fetch deployment block from API
  useEffect(() => {
    let isMounted = true;

    const fetchDeploymentBlock = async () => {
      setDeploymentLoading(true);
      try {
        // Try to get deployment info from contract cache or API
        const response = await fetch(`/api/contracts/${contractAddress}/deployment`);
        if (response.ok) {
          const data = await response.json();
          if (isMounted && data.blockNumber) {
            setDeploymentBlock(data.blockNumber);
          }
        }
      } catch (error) {
        console.error("Error fetching deployment block:", error);
      } finally {
        if (isMounted) {
          setDeploymentLoading(false);
        }
      }
    };

    fetchDeploymentBlock();

    return () => {
      isMounted = false;
    };
  }, [contractAddress]);

  // Get creator/deployer from contract cache
  const { artistName: deployerName, creatorAddress: deployerAddress } = useArtistName(
    null,
    contractAddress,
    undefined
  );

  const displayDeployer = deployerName || deployerAddress || "Unknown";

  return (
    <div className="mb-4 space-y-2 border-t border-[#333333] pt-3">
      <div className="text-[10px] text-[#666666] uppercase tracking-wider mb-2">
        Contract Details
      </div>
      
      <div className="space-y-1.5 text-xs">
        {/* Contract Address - Basescan link */}
        <div className="flex items-start gap-2">
          <span className="text-[#999999] min-w-[100px]">address:</span>
          <a
            href={`https://basescan.org/address/${contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#cccccc] hover:text-white hover:underline font-mono break-all"
          >
            {contractAddress}
          </a>
        </div>

        {/* Contract Name */}
        {contractNameLoading ? (
          <div className="flex items-center gap-2">
            <span className="text-[#999999] min-w-[100px]">name:</span>
            <div className="w-3 h-3 border border-[#666666] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : contractName ? (
          <div className="flex items-start gap-2">
            <span className="text-[#999999] min-w-[100px]">name:</span>
            <span className="text-[#cccccc] font-mono">{contractName}</span>
          </div>
        ) : null}

        {/* Deployed By */}
        <div className="flex items-start gap-2">
          <span className="text-[#999999] min-w-[100px]">deployed by:</span>
          <span className="text-[#cccccc] font-mono break-all">{displayDeployer}</span>
        </div>

        {/* Deployment Block */}
        {deploymentLoading ? (
          <div className="flex items-center gap-2">
            <span className="text-[#999999] min-w-[100px]">block:</span>
            <div className="w-3 h-3 border border-[#666666] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : deploymentBlock ? (
          <div className="flex items-start gap-2">
            <span className="text-[#999999] min-w-[100px]">block:</span>
            <a
              href={`https://basescan.org/block/${deploymentBlock}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#cccccc] hover:text-white hover:underline font-mono"
            >
              {deploymentBlock.toLocaleString()}
            </a>
          </div>
        ) : null}

        {/* Image URL */}
        {imageUrl && (
          <div className="flex items-start gap-2">
            <span className="text-[#999999] min-w-[100px]">imageUrl:</span>
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#cccccc] hover:text-white hover:underline font-mono break-all"
            >
              {imageUrl}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

