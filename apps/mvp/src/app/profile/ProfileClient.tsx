"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useMiniApp } from "@neynar/react";
import { useUserAuctions } from "~/hooks/useUserAuctions";
import { formatEther } from "viem";
import Link from "next/link";

type TabType = "created" | "collected" | "bids";

export default function ProfileClient() {
  const { address, isConnected } = useAccount();
  const { context } = useMiniApp();
  const [activeTab, setActiveTab] = useState<TabType>("created");
  const { createdAuctions, activeBids, loading } = useUserAuctions();
  // TODO: Implement collected auctions (won auctions)
  const collectedAuctions: any[] = [];

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please connect your wallet to view your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Profile</h1>
          
          {context?.user && (
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-gray-200" />
              <div>
                <p className="font-semibold text-gray-900">{context.user.username}</p>
                <p className="text-sm text-gray-600">@{context.user.username}</p>
              </div>
            </div>
          )}

          {address && (
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-1">Wallet Address</p>
              <p className="font-mono text-sm text-gray-900">{address}</p>
            </div>
          )}

          <div className="flex gap-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("created")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "created"
                  ? "text-primary border-b-2 border-primary"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Created ({createdAuctions.length})
            </button>
            <button
              onClick={() => setActiveTab("collected")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "collected"
                  ? "text-primary border-b-2 border-primary"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Collected ({collectedAuctions.length})
            </button>
            <button
              onClick={() => setActiveTab("bids")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "bids"
                  ? "text-primary border-b-2 border-primary"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Active Bids ({activeBids.length})
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {loading ? (
            <p className="text-gray-600">Loading...</p>
          ) : (
            <div>
              {activeTab === "created" && (
                <div>
                  {createdAuctions.length === 0 ? (
                    <p className="text-gray-600">No auctions created yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {createdAuctions.map((auction) => (
                        <Link
                          key={auction.id}
                          href={`/auction/${auction.listingId}`}
                          className="bg-gray-50 rounded-lg border border-gray-200 p-4 hover:bg-gray-100 transition-colors"
                        >
                          <h4 className="font-semibold text-gray-900 mb-2">
                            Auction #{auction.listingId}
                          </h4>
                          <p className="text-sm text-gray-600">
                            Reserve: {formatEther(BigInt(auction.initialAmount || "0"))} ETH
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === "collected" && (
                <div>
                  {collectedAuctions.length === 0 ? (
                    <p className="text-gray-600">No NFTs collected yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {collectedAuctions.map((auction) => (
                        <div key={auction.id} className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                          <h4 className="font-semibold text-gray-900 mb-2">
                            Auction #{auction.listingId}
                          </h4>
                          <p className="text-sm text-gray-600">Won</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === "bids" && (
                <div>
                  {activeBids.length === 0 ? (
                    <p className="text-gray-600">No active bids.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activeBids.map((auction) => (
                        <Link
                          key={auction.id}
                          href={`/auction/${auction.listingId}`}
                          className="bg-gray-50 rounded-lg border border-gray-200 p-4 hover:bg-gray-100 transition-colors"
                        >
                          <h4 className="font-semibold text-gray-900 mb-2">
                            Auction #{auction.listingId}
                          </h4>
                          <p className="text-sm text-gray-600">
                            Your bid: {auction.currentPrice ? formatEther(BigInt(auction.currentPrice)) : 'N/A'} ETH
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

