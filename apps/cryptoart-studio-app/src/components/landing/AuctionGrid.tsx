"use client";

import { useState, useEffect } from "react";
import { AuctionCard } from "./AuctionCard";
import { Button } from "~/components/ui/Button";
import type { AuctionData } from "@cryptoart/unified-indexer";

interface EnrichedAuction extends AuctionData {
  collectionName?: string;
  collectionAddress?: string;
  artistFid?: number;
  artistName?: string;
  artistPfp?: string;
  nftImage?: string;
  nftName?: string;
}

interface AuctionGridProps {
  title: string;
  type?: "featured" | "active" | "ending" | "community";
  limit?: number;
}

export function AuctionGrid({ title, type = "active", limit = 20 }: AuctionGridProps) {
  const [auctions, setAuctions] = useState<EnrichedAuction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"featured" | "active" | "ending">("active");

  useEffect(() => {
    async function fetchAuctions() {
      try {
        setLoading(true);
        const filterType = type === "community" ? "active" : type;
        const response = await fetch(
          `/api/landing/auctions?type=${filterType}&limit=${limit}`
        );
        const data = await response.json();
        setAuctions(data.auctions || []);
      } catch (error) {
        console.error("Error fetching auctions:", error);
        setAuctions([]);
      } finally {
        setLoading(false);
      }
    }

    fetchAuctions();
  }, [type, limit]);

  if (loading) {
    return (
      <div className="py-12">
        <div className="text-center text-gray-500">Loading auctions...</div>
      </div>
    );
  }

  if (auctions.length === 0) {
    return (
      <div className="py-12">
        <div className="text-center text-gray-500">No auctions found</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{title}</h2>
        {type === "active" && (
          <div className="flex gap-2">
            <button
              onClick={() => setActiveFilter("active")}
              className={`px-3 py-1 text-sm rounded ${
                activeFilter === "active"
                  ? "bg-primary text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              Active Now
            </button>
            <button
              onClick={() => setActiveFilter("ending")}
              className={`px-3 py-1 text-sm rounded ${
                activeFilter === "ending"
                  ? "bg-primary text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              Ending Soon
            </button>
            <button
              onClick={() => setActiveFilter("featured")}
              className={`px-3 py-1 text-sm rounded ${
                activeFilter === "featured"
                  ? "bg-primary text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              Featured
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {auctions.map((auction) => (
          <AuctionCard
            key={auction.id}
            auction={auction}
            onClick={() => {
              // TODO: Navigate to auction detail page
              window.location.href = `/auction/${auction.listingId}`;
            }}
          />
        ))}
      </div>
    </div>
  );
}

