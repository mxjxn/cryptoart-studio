"use client";

import { useState, useEffect } from "react";
import { Address } from "viem";
import { useContractName } from "~/hooks/useContractName";
import { useArtistName } from "~/hooks/useArtistName";
import { fetchFloorPriceFromAlchemy, type FloorPriceInfo } from "~/lib/contract-info";

interface ContractDetailsProps {
  contractAddress: Address;
  imageUrl?: string | null;
}

export function ContractDetails({ contractAddress, imageUrl }: ContractDetailsProps) {
  const { contractName, isLoading: contractNameLoading } = useContractName(contractAddress);
  const [deploymentBlock, setDeploymentBlock] = useState<number | null>(null);
  const [deploymentLoading, setDeploymentLoading] = useState(false);
  const [floorPrice, setFloorPrice] = useState<FloorPriceInfo | null>(null);
  const [floorPriceLoading, setFloorPriceLoading] = useState(false);

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

  // Fetch floor price from Alchemy
  useEffect(() => {
    let isMounted = true;

    const fetchFloorPrice = async () => {
      setFloorPriceLoading(true);
      setFloorPrice(null);
      try {
        const floorPriceData = await fetchFloorPriceFromAlchemy(contractAddress);
        if (isMounted && floorPriceData) {
          setFloorPrice(floorPriceData);
        }
      } catch (error) {
        console.error("Error fetching floor price:", error);
      } finally {
        if (isMounted) {
          setFloorPriceLoading(false);
        }
      }
    };

    fetchFloorPrice();

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
    <div className="mb-4 space-y-2 border-t border-[#333333] pt-3" role="region" aria-label="Contract Details">
      <div className="text-[10px] text-[#666666] uppercase tracking-wider mb-2" role="heading" aria-level={3}>
        Contract Details
      </div>
      
      <dl className="space-y-1.5 text-xs">
        {/* Contract Address - Basescan link */}
        <div className="flex items-start gap-2">
          <dt className="text-[#999999] min-w-[100px]">address:</dt>
          <dd>
            <a
              href={`https://basescan.org/address/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#cccccc] hover:text-white hover:underline font-mono break-all"
              aria-label={`View contract ${contractAddress} on Basescan`}
            >
              {contractAddress}
            </a>
          </dd>
        </div>

        {/* Contract Name */}
        {contractNameLoading ? (
          <div className="flex items-center gap-2">
            <dt className="text-[#999999] min-w-[100px]">name:</dt>
            <dd>
              <div className="w-3 h-3 border border-[#666666] border-t-transparent rounded-full animate-spin" aria-label="Loading contract name" aria-busy="true"></div>
            </dd>
          </div>
        ) : contractName ? (
          <div className="flex items-start gap-2">
            <dt className="text-[#999999] min-w-[100px]">name:</dt>
            <dd>
              <span className="text-[#cccccc] font-mono">{contractName}</span>
            </dd>
          </div>
        ) : null}

        {/* Deployed By */}
        <div className="flex items-start gap-2">
          <dt className="text-[#999999] min-w-[100px]">deployed by:</dt>
          <dd>
            <span className="text-[#cccccc] font-mono break-all">{displayDeployer}</span>
          </dd>
        </div>

        {/* Deployment Block */}
        {deploymentLoading ? (
          <div className="flex items-center gap-2">
            <dt className="text-[#999999] min-w-[100px]">block:</dt>
            <dd>
              <div className="w-3 h-3 border border-[#666666] border-t-transparent rounded-full animate-spin" aria-label="Loading deployment block" aria-busy="true"></div>
            </dd>
          </div>
        ) : deploymentBlock ? (
          <div className="flex items-start gap-2">
            <dt className="text-[#999999] min-w-[100px]">block:</dt>
            <dd>
              <a
                href={`https://basescan.org/block/${deploymentBlock}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#cccccc] hover:text-white hover:underline font-mono"
                aria-label={`View deployment block ${deploymentBlock.toLocaleString()} on Basescan`}
              >
                {deploymentBlock.toLocaleString()}
              </a>
            </dd>
          </div>
        ) : null}

        {/* Image URL */}
        {imageUrl && (
          <div className="flex items-start gap-2">
            <dt className="text-[#999999] min-w-[100px]">imageUrl:</dt>
            <dd>
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#cccccc] hover:text-white hover:underline font-mono break-all"
                aria-label={`View image: ${imageUrl}`}
              >
                {imageUrl}
              </a>
            </dd>
          </div>
        )}

        {/* Floor Price */}
        {floorPriceLoading ? (
          <div className="flex items-center gap-2">
            <dt className="text-[#999999] min-w-[100px]">floor price:</dt>
            <dd>
              <div className="w-3 h-3 border border-[#666666] border-t-transparent rounded-full animate-spin" aria-label="Loading floor price" aria-busy="true"></div>
            </dd>
          </div>
        ) : floorPrice ? (
          <div className="flex items-start gap-2">
            <dt className="text-[#999999] min-w-[100px]">floor price:</dt>
            <dd>
              <span className="text-[#cccccc] font-mono">
                {floorPrice.floorPrice.toFixed(4)} {floorPrice.priceCurrency}
              </span>
              {floorPrice.collectionUrl && (
                <a
                  href={floorPrice.collectionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-[#999999] hover:text-[#cccccc] hover:underline text-xs"
                  aria-label="View collection on marketplace"
                >
                  (view)
                </a>
              )}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

