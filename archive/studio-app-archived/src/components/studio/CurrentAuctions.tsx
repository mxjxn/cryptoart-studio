"use client";

import { useEffect, useState } from "react";
import { useMiniApp } from "@neynar/react";
import { formatEther } from "viem";
import { LayoutGrid, Table2, Edit, ExternalLink, Loader2 } from "lucide-react";
import type { AuctionData } from "@cryptoart/unified-indexer";

interface EnrichedAuctionData extends AuctionData {
  collectionName?: string;
  collectionAddress?: string;
}

type ViewMode = "cards" | "table";

export function CurrentAuctions() {
  const { context } = useMiniApp();
  const [auctions, setAuctions] = useState<EnrichedAuctionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  useEffect(() => {
    async function fetchAuctions() {
      if (!context?.user?.fid) {
        setLoading(false);
        setAuctions([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/studio/auctions?creatorFid=${context.user.fid}`
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Response is not JSON");
        }
        
        const data = await response.json();
        if (data.success) {
          setAuctions(data.auctions || []);
        } else {
          // If API returns success:false, still show empty state
          setAuctions([]);
        }
      } catch (err) {
        // On error, show empty state instead of error message
        console.error("Error fetching auctions:", err);
        setAuctions([]);
      } finally {
        setLoading(false);
      }
    }

    fetchAuctions();
  }, [context?.user?.fid]);

  const formatDate = (timestamp: string | null | undefined) => {
    if (!timestamp || timestamp === "0" || timestamp === "null") return null;
    const date = new Date(parseInt(timestamp) * 1000);
    return date.toLocaleDateString();
  };

  const getTimeRemaining = (endTime: string) => {
    const end = parseInt(endTime) * 1000;
    const now = Date.now();
    if (end <= now) return "Ended";
    const diff = end - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const getBidCount = (auction: EnrichedAuctionData) => {
    // TODO: Fetch actual bid count from API
    return auction.currentPrice ? "1+" : "0";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (auctions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Current Auctions</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("cards")}
              className={`p-2 rounded ${
                viewMode === "cards"
                  ? "bg-blue-100 text-blue-600"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded ${
                viewMode === "table"
                  ? "bg-blue-100 text-blue-600"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              <Table2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-600 mb-2">No active auctions found</p>
          <p className="text-xs text-gray-500">
            Create a collection and list NFTs to see auctions here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Current Auctions</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("cards")}
            className={`p-2 rounded ${
              viewMode === "cards"
                ? "bg-blue-100 text-blue-600"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-2 rounded ${
              viewMode === "table"
                ? "bg-blue-100 text-blue-600"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            <Table2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {auctions.map((auction) => (
            <div
              key={auction.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    {auction.tokenId
                      ? `Token #${auction.tokenId}`
                      : "Listing #" + auction.listingId}
                  </h3>
                  {auction.collectionName && (
                    <p className="text-xs text-gray-500">{auction.collectionName}</p>
                  )}
                </div>
                <div className="w-8 h-8 bg-gray-100 rounded flex-shrink-0 ml-2" />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Reserve:</span>
                  <span className="font-medium">
                    {formatEther(BigInt(auction.initialAmount))} ETH
                  </span>
                </div>
                {auction.currentPrice && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Current Bid:</span>
                    <span className="font-medium">
                      {formatEther(BigInt(auction.currentPrice))} ETH
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Bids:</span>
                  <span className="font-medium">{getBidCount(auction)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Started:</span>
                  <span className="font-medium">{formatDate(auction.startTime) || "Not started"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ending:</span>
                  <span className="font-medium">
                    {formatDate(auction.endTime) || "No end date"}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                <button className="flex-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center justify-center gap-1">
                  <Edit className="h-3 w-3" />
                  Edit
                </button>
                <a
                  href={`/auction/${auction.listingId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center justify-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  View
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Thumbnail
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Reserve
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Current Bid
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Bids #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Started
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Ending
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {auctions.map((auction) => (
                <tr key={auction.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="w-8 h-8 bg-gray-100 rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {auction.tokenId
                          ? `Token #${auction.tokenId}`
                          : "Listing #" + auction.listingId}
                      </p>
                      {auction.collectionName && (
                        <p className="text-xs text-gray-500">{auction.collectionName}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {formatEther(BigInt(auction.initialAmount))} ETH
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {auction.currentPrice
                      ? `${formatEther(BigInt(auction.currentPrice))} ETH`
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {getBidCount(auction)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {formatDate(auction.startTime) || "Not started"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {formatDate(auction.endTime) || "No end date"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="p-1 text-gray-400 hover:text-gray-600">
                        <Edit className="h-4 w-4" />
                      </button>
                      <a
                        href={`/auction/${auction.listingId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

