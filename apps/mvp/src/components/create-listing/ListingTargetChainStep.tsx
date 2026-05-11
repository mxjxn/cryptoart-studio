"use client";

import { BASE_CHAIN_ID, ETHEREUM_MAINNET_CHAIN_ID } from "~/lib/server/subgraph-endpoints";
import { getChainNetworkInfo } from "~/lib/chain-display";

export type ListingTargetChainOption = typeof BASE_CHAIN_ID | typeof ETHEREUM_MAINNET_CHAIN_ID;

interface ListingTargetChainStepProps {
  onContinue: (chainId: ListingTargetChainOption) => void;
}

const OPTIONS: ListingTargetChainOption[] = [
  BASE_CHAIN_ID,
  ETHEREUM_MAINNET_CHAIN_ID,
];

/**
 * Step 1 of create listing: pick which chain the NFT and marketplace listing use.
 * Contract selection is hidden until this step completes.
 */
export function ListingTargetChainStep({ onContinue }: ListingTargetChainStepProps) {
  return (
    <div className="space-y-6 font-space-grotesk">
      <div>
        <h2 className="mb-2 text-xl font-medium text-neutral-900">Choose network</h2>
        <p className="mb-1 text-sm text-neutral-600">
          Select where your NFT contract lives and where this listing will be created. Your wallet
          must match this network before you approve or submit.
        </p>
        <p className="text-xs text-neutral-500">
          You can change this only by going back from the next step.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OPTIONS.map((id) => {
          const info = getChainNetworkInfo(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onContinue(id)}
              className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 text-left transition-colors hover:border-neutral-400 hover:bg-white"
            >
              <div className="text-sm font-medium text-neutral-900">{info.displayName}</div>
              <div className="mt-1 font-mono text-xs text-neutral-500">chainId {id}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
