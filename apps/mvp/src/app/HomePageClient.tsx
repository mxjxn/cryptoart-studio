"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useActiveAuctions } from "~/hooks/useActiveAuctions";
import { formatEther } from "viem";

export default function HomePageClient() {
  const { auctions, loading } = useActiveAuctions();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Active Auctions</h1>
          <Link
            href="/create"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <Plus className="h-5 w-5" />
            Create Auction
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading auctions...</p>
          </div>
        ) : auctions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No active auctions found</p>
            <Link
              href="/create"
              className="text-primary hover:underline"
            >
              Create your first auction
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {auctions.map((auction) => (
              <Link
                key={auction.id}
                href={`/auction/${auction.listingId}`}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="aspect-square bg-gray-200 rounded-lg mb-4" />
                <h3 className="font-semibold text-gray-900 mb-2">
                  Auction #{auction.listingId}
                </h3>
                <p className="text-sm text-gray-600 mb-1">
                  Reserve: {formatEther(BigInt(auction.initialAmount || "0"))} ETH
                </p>
                {auction.currentPrice && (
                  <p className="text-sm font-medium text-primary">
                    Current: {formatEther(BigInt(auction.currentPrice))} ETH
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

