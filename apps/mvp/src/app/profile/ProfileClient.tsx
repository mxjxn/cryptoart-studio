"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useMiniApp } from "@neynar/react";
import { useUserAuctions } from "~/hooks/useUserAuctions";
import { useEnsNameForAddress } from "~/hooks/useEnsName";
import { useEnsAvatarForAddress } from "~/hooks/useEnsAvatar";
import { formatEther } from "viem";
import Link from "next/link";
import { AuctionCard } from "~/components/AuctionCard";

type TabType = "created" | "collected" | "bids" | "offers";

export default function ProfileClient() {
  const { address, isConnected } = useAccount();
  const { context } = useMiniApp();
  const [activeTab, setActiveTab] = useState<TabType>("created");
  
  // Get verified addresses from Farcaster if available
  const farcasterAddress = context?.user
    ? (context.user as any).verified_addresses?.primary?.eth_address ||
      (context.user as any).custody_address ||
      ((context.user as any).verifications?.[0] as string)
    : null;
  
  // Use connected wallet address, or fall back to Farcaster verified address
  const userAddress = address || farcasterAddress;
  const hasAddress = !!userAddress;
  
  // Resolve ENS name and avatar for address when not logged in via Farcaster mini-app
  const isMiniApp = !!context?.user;
  const shouldResolveEns = !isMiniApp && isConnected && !!address;
  const ensName = useEnsNameForAddress(address, shouldResolveEns);
  const ensAvatar = useEnsAvatarForAddress(address, shouldResolveEns);
  
  // Determine avatar URL: Farcaster pfp > ENS avatar > undefined
  const avatarUrl = context?.user?.pfpUrl || ensAvatar || undefined;
  
  const { createdAuctions, activeBids, activeOffers, loading } = useUserAuctions();
  // TODO: Implement collected auctions (won auctions)
  const collectedAuctions: any[] = [];

  if (!hasAddress) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please connect your wallet or sign in with Farcaster to view your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="mb-6">
          <Link
            href="/"
            className="text-gray-600 hover:text-gray-900 transition-colors inline-flex items-center gap-2 mb-4"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Profile</h1>
          
          {(context?.user || avatarUrl) && (
            <div className="flex items-center gap-4 mb-6">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                  </svg>
                </div>
              )}
              <div>
                {context?.user ? (
                  <>
                    <p className="font-semibold text-gray-900">{context.user.username}</p>
                    <p className="text-sm text-gray-600">@{context.user.username}</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-gray-900">{ensName || `${userAddress?.slice(0, 6)}...${userAddress?.slice(-4)}`}</p>
                    {ensName && <p className="text-sm text-gray-600">{userAddress}</p>}
                  </>
                )}
              </div>
            </div>
          )}

          {userAddress && (
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-1">
                {isConnected ? "Wallet Address" : "Farcaster Verified Address"}
              </p>
              <p className="font-mono text-sm text-gray-900">
                {ensName || userAddress}
              </p>
              {ensName && (
                <p className="text-xs text-gray-500 mt-1">{userAddress}</p>
              )}
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
            <button
              onClick={() => setActiveTab("offers")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "offers"
                  ? "text-primary border-b-2 border-primary"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Offers ({activeOffers.length})
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {createdAuctions.map((auction, index) => {
                        // Use a simple gradient for profile view
                        const gradients = [
                          "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                          "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                        ];
                        return (
                          <AuctionCard
                            key={auction.id}
                            auction={auction as any}
                            gradient={gradients[index % gradients.length]}
                            index={index}
                          />
                        );
                      })}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeBids.map((auction, index) => {
                        // Use a simple gradient for profile view
                        const gradients = [
                          "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                          "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                        ];
                        return (
                          <AuctionCard
                            key={auction.id}
                            auction={auction as any}
                            gradient={gradients[index % gradients.length]}
                            index={index}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {activeTab === "offers" && (
                <div>
                  {activeOffers.length === 0 ? (
                    <p className="text-gray-600">No active offers.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeOffers.map((auction, index) => {
                        // Use a simple gradient for profile view
                        const gradients = [
                          "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                          "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                        ];
                        return (
                          <AuctionCard
                            key={auction.id}
                            auction={auction as any}
                            gradient={gradients[index % gradients.length]}
                            index={index}
                          />
                        );
                      })}
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

