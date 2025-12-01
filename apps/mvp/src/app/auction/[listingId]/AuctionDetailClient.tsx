"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { useRouter } from "next/navigation";
import { useAuction } from "~/hooks/useAuction";
import { ShareButton } from "~/components/ShareButton";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";

interface AuctionDetailClientProps {
  listingId: string;
}

export default function AuctionDetailClient({ listingId }: AuctionDetailClientProps) {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const { isSDKLoaded } = useMiniApp();
  const { auction, loading } = useAuction(listingId);
  const [bidAmount, setBidAmount] = useState("");

  const handleBid = async () => {
    if (!isConnected || !bidAmount) {
      return;
    }
    // TODO: Implement bid functionality
    console.log("Place bid:", bidAmount);
  };

  // Set up back navigation for Farcaster mini-app
  useEffect(() => {
    if (!isSDKLoaded) return;

    const setupBackNavigation = async () => {
      try {
        // Check if back navigation is supported
        const capabilities = await sdk.getCapabilities();
        if (capabilities.includes('back')) {
          // Enable web navigation integration (automatically handles browser history)
          await sdk.back.enableWebNavigation();
          
          // Also set up a custom handler for back navigation
          sdk.back.onback = () => {
            // Navigate back to home page
            router.push('/');
          };

          // Show the back button
          await sdk.back.show();
        }
      } catch (error) {
        console.error('Failed to set up back navigation:', error);
      }
    };

    setupBackNavigation();

    // Listen for back navigation events
    const handleBackNavigation = () => {
      router.push('/');
    };

    sdk.on('backNavigationTriggered', handleBackNavigation);

    return () => {
      sdk.off('backNavigationTriggered', handleBackNavigation);
      // Clear the back handler
      sdk.back.onback = null;
    };
  }, [isSDKLoaded, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading auction...</p>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Auction not found</p>
      </div>
    );
  }

  const currentPrice = auction.highestBid?.amount || auction.initialAmount;
  const endTime = parseInt(auction.endTime);
  const now = Math.floor(Date.now() / 1000);
  const isActive = endTime > now;
  const title = auction.title || `Auction #${listingId}`;
  const artist = auction.artist || 'Unknown Artist';
  const bidCount = auction.bidCount || 0;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-5 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-[32px] font-light mb-2">
            {title}
          </h1>
          <div className="text-sm text-[#cccccc] mb-6">
            by {artist}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Image */}
          <div className="relative">
            {auction.image ? (
              <img
                src={auction.image}
                alt={title}
                className="w-full aspect-square object-cover rounded-lg"
              />
            ) : (
              <div className="w-full aspect-square bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-lg" />
            )}
            <div className="absolute top-4 right-4">
              <ShareButton
                url={typeof window !== 'undefined' ? window.location.href : ''}
                text={`Check out this auction: ${title}`}
              />
            </div>
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <h2 className="text-[11px] uppercase tracking-[2px] text-[#999999] mb-4">
                Auction Details
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#cccccc]">Reserve Price:</span>
                  <span className="font-medium">{formatEther(BigInt(auction.initialAmount))} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#cccccc]">Current Bid:</span>
                  <span className="font-medium">
                    {auction.highestBid 
                      ? `${formatEther(BigInt(currentPrice))} ETH`
                      : 'No bids yet'
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#cccccc]">Bid Count:</span>
                  <span className="font-medium">{bidCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#cccccc]">Status:</span>
                  <span className="font-medium">{isActive ? "Active" : "Ended"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#cccccc]">Seller:</span>
                  <span className="font-medium font-mono text-xs">{auction.seller}</span>
                </div>
              </div>
            </div>

            {auction.description && (
              <div>
                <h2 className="text-[11px] uppercase tracking-[2px] text-[#999999] mb-4">
                  Description
                </h2>
                <p className="text-sm text-[#cccccc] leading-relaxed">
                  {auction.description}
                </p>
              </div>
            )}

            {isActive && (
              <div className="border-t border-[#333333] pt-6">
                <h3 className="text-[11px] uppercase tracking-[2px] text-[#999999] mb-4">
                  Place Bid
                </h3>
                {!isConnected ? (
                  <p className="text-sm text-[#cccccc]">Please connect your wallet to place a bid.</p>
                ) : (
                  <div className="space-y-4">
                    <input
                      type="number"
                      step="0.001"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg focus:ring-2 focus:ring-white focus:border-white placeholder:text-[#666666]"
                      placeholder={auction.highestBid 
                        ? `Min: ${formatEther(BigInt(currentPrice))} ETH`
                        : `Min: ${formatEther(BigInt(auction.initialAmount))} ETH`
                      }
                    />
                    <button
                      onClick={handleBid}
                      className="w-full px-6 py-3 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors"
                    >
                      Place Bid
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

