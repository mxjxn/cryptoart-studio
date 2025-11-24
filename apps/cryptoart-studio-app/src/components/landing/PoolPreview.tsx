"use client";

import { useState, useEffect } from "react";
import { formatEther } from "viem";
import { Card, CardContent } from "~/components/ui/card";
import type { PoolData } from "@cryptoart/unified-indexer";

interface EnrichedPool extends PoolData {
  collectionName?: string;
  artistFid?: number;
  collectorCount?: number;
  volumeThisWeek?: string;
}

export function PoolPreview() {
  const [pools, setPools] = useState<EnrichedPool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPools() {
      try {
        setLoading(true);
        const response = await fetch("/api/landing/pools?limit=5");
        const data = await response.json();
        setPools(data.pools || []);
      } catch (error) {
        console.error("Error fetching pools:", error);
        setPools([]);
      } finally {
        setLoading(false);
      }
    }

    fetchPools();
  }, []);

  if (loading) {
    return (
      <div className="h-[25vh] flex items-center justify-center">
        <div className="text-gray-500">Loading pools...</div>
      </div>
    );
  }

  if (pools.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Featured NFT Liquidity Pools</h2>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
        {pools.map((pool) => (
          <Card
            key={pool.id}
            className="min-w-[240px] flex-shrink-0 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => {
              // TODO: Navigate to Such.Market pool page
              window.open(`https://such.market/pool/${pool.address}`, "_blank");
            }}
          >
            <CardContent className="p-4">
              <div className="aspect-square bg-gray-100 rounded mb-3 flex items-center justify-center">
                <span className="text-gray-400 text-xs">Pool Image</span>
              </div>
              
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500">Bonding curve pool</p>
                  <h3 className="font-semibold text-sm truncate">
                    {pool.collectionName || "Collection"}
                  </h3>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Floor Price</span>
                    <span className="font-semibold">
                      {formatEther(BigInt(pool.spotPrice))} ETH
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Collectors</span>
                    <span className="font-semibold">
                      {pool.collectorCount || 0}
                    </span>
                  </div>
                  {pool.volumeThisWeek && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Volume (week)</span>
                      <span className="font-semibold">
                        {formatEther(BigInt(pool.volumeThisWeek))} ETH
                      </span>
                    </div>
                  )}
                </div>

                <button
                  className="mt-3 w-full text-sm bg-primary text-white py-2 rounded hover:bg-primary/90 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`https://such.market/pool/${pool.address}`, "_blank");
                  }}
                >
                  View on Such.Market
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

