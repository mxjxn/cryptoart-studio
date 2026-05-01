"use client";

import { useState, useEffect } from "react";
import { Address } from "viem";
import { useContractName } from "~/hooks/useContractName";
import { useArtistName } from "~/hooks/useArtistName";
import { fetchFloorPriceFromAlchemy, type FloorPriceInfo } from "~/lib/contract-info";
import { cn } from "~/lib/utils";

interface ContractDetailsProps {
  contractAddress: Address;
  imageUrl?: string | null;
  /** `light`: black text on white listing panel. `dark`: original minimal theme. */
  variant?: "dark" | "light";
}

export function ContractDetails({
  contractAddress,
  imageUrl,
  variant = "dark",
}: ContractDetailsProps) {
  const { contractName, isLoading: contractNameLoading } = useContractName(contractAddress);
  const [deploymentBlock, setDeploymentBlock] = useState<number | null>(null);
  const [deploymentLoading, setDeploymentLoading] = useState(false);
  const [floorPrice, setFloorPrice] = useState<FloorPriceInfo | null>(null);
  const [floorPriceLoading, setFloorPriceLoading] = useState(false);

  // Disable deployment block lookup for now; the old endpoint was removed and
  // caused noisy 404s in the browser console.
  useEffect(() => {
    setDeploymentLoading(false);
    setDeploymentBlock(null);
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
  const light = variant === "light";

  return (
    <div
      className={cn(
        "space-y-2 border-t",
        light ? "mb-0 border-neutral-200 pt-4" : "mb-4 border-[#333333] pt-3",
      )}
      role="region"
      aria-label="Contract Details"
    >
      <div
        className={cn(
          "mb-2 text-[10px] uppercase tracking-wider",
          light ? "text-neutral-500" : "text-[#666666]",
        )}
        role="heading"
        aria-level={3}
      >
        Contract Details
      </div>

      <dl className="space-y-1.5 text-xs">
        {/* Contract Address - Basescan link */}
        <div className="flex items-start gap-2">
          <dt className={cn("min-w-[100px]", light ? "text-neutral-500" : "text-[#999999]")}>address:</dt>
          <dd>
            <a
              href={`https://basescan.org/address/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "font-mono break-all hover:underline",
                light ? "text-neutral-800 hover:text-neutral-950" : "text-[#cccccc] hover:text-white",
              )}
              aria-label={`View contract ${contractAddress} on Basescan`}
            >
              {contractAddress}
            </a>
          </dd>
        </div>

        {/* Contract Name */}
        {contractNameLoading ? (
          <div className="flex items-center gap-2">
            <dt className={cn("min-w-[100px]", light ? "text-neutral-500" : "text-[#999999]")}>name:</dt>
            <dd>
              <div
                className={cn(
                  "h-3 w-3 animate-spin rounded-full border border-t-transparent",
                  light ? "border-neutral-300 border-t-neutral-700" : "border-[#666666] border-t-transparent",
                )}
                aria-label="Loading contract name"
                aria-busy="true"
              />
            </dd>
          </div>
        ) : contractName ? (
          <div className="flex items-start gap-2">
            <dt className={cn("min-w-[100px]", light ? "text-neutral-500" : "text-[#999999]")}>name:</dt>
            <dd>
              <span className={cn("font-mono", light ? "text-neutral-800" : "text-[#cccccc]")}>{contractName}</span>
            </dd>
          </div>
        ) : null}

        {/* Deployed By */}
        <div className="flex items-start gap-2">
          <dt className={cn("min-w-[100px]", light ? "text-neutral-500" : "text-[#999999]")}>deployed by:</dt>
          <dd>
            <span className={cn("break-all font-mono", light ? "text-neutral-800" : "text-[#cccccc]")}>
              {displayDeployer}
            </span>
          </dd>
        </div>

        {/* Deployment Block */}
        {deploymentLoading ? (
          <div className="flex items-center gap-2">
            <dt className={cn("min-w-[100px]", light ? "text-neutral-500" : "text-[#999999]")}>block:</dt>
            <dd>
              <div
                className={cn(
                  "h-3 w-3 animate-spin rounded-full border border-t-transparent",
                  light ? "border-neutral-300 border-t-neutral-700" : "border-[#666666] border-t-transparent",
                )}
                aria-label="Loading deployment block"
                aria-busy="true"
              />
            </dd>
          </div>
        ) : deploymentBlock ? (
          <div className="flex items-start gap-2">
            <dt className={cn("min-w-[100px]", light ? "text-neutral-500" : "text-[#999999]")}>block:</dt>
            <dd>
              <a
                href={`https://basescan.org/block/${deploymentBlock}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "font-mono hover:underline",
                  light ? "text-neutral-800 hover:text-neutral-950" : "text-[#cccccc] hover:text-white",
                )}
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
            <dt className={cn("min-w-[100px]", light ? "text-neutral-500" : "text-[#999999]")}>imageUrl:</dt>
            <dd>
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "break-all font-mono hover:underline",
                  light ? "text-neutral-800 hover:text-neutral-950" : "text-[#cccccc] hover:text-white",
                )}
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
            <dt className={cn("min-w-[100px]", light ? "text-neutral-500" : "text-[#999999]")}>floor price:</dt>
            <dd>
              <div
                className={cn(
                  "h-3 w-3 animate-spin rounded-full border border-t-transparent",
                  light ? "border-neutral-300 border-t-neutral-700" : "border-[#666666] border-t-transparent",
                )}
                aria-label="Loading floor price"
                aria-busy="true"
              />
            </dd>
          </div>
        ) : floorPrice ? (
          <div className="flex items-start gap-2">
            <dt className={cn("min-w-[100px]", light ? "text-neutral-500" : "text-[#999999]")}>floor price:</dt>
            <dd>
              <span className={cn("font-mono", light ? "text-neutral-800" : "text-[#cccccc]")}>
                {floorPrice.floorPrice.toFixed(4)} {floorPrice.priceCurrency}
              </span>
              {floorPrice.collectionUrl && (
                <a
                  href={floorPrice.collectionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "ml-2 text-xs hover:underline",
                    light ? "text-neutral-500 hover:text-neutral-800" : "text-[#999999] hover:text-[#cccccc]",
                  )}
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

