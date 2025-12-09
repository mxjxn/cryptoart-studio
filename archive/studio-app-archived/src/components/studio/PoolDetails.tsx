"use client";

import { type PoolData } from "@cryptoart/unified-indexer";
import { formatEther } from "viem";

interface PoolDetailsProps {
  pool: PoolData;
}

export function PoolDetails({ pool }: PoolDetailsProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Pool</h3>
          <p className="text-sm text-gray-500 font-mono">{pool.address}</p>
        </div>
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
          {pool.poolType}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <p className="text-sm text-gray-500">Spot Price</p>
          <p className="text-lg font-semibold text-gray-900">
            {formatEther(BigInt(pool.spotPrice))} ETH
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-500">Delta</p>
          <p className="text-lg font-semibold text-gray-900">
            {formatEther(BigInt(pool.delta))} ETH
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-500">Fee</p>
          <p className="text-lg font-semibold text-gray-900">
            {(Number(pool.fee) / 100).toFixed(2)}%
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-500">Bonding Curve</p>
          <p className="text-lg font-semibold text-gray-900 truncate">
            {pool.bondingCurve}
          </p>
        </div>
      </div>

      {pool.nftIdRange && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">NFT ID Range</p>
          <p className="text-sm font-mono text-gray-900">
            {pool.nftIdRange.start} - {pool.nftIdRange.end}
          </p>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200">
        <a
          href={`https://basescan.org/address/${pool.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          View on Basescan →
        </a>
      </div>
    </div>
  );
}

