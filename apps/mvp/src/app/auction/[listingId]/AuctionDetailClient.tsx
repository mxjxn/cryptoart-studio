"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther } from "viem";
import { useRouter } from "next/navigation";
import { useAuction } from "~/hooks/useAuction";
import { useArtistName } from "~/hooks/useArtistName";
import { useContractName } from "~/hooks/useContractName";
import { ShareButton } from "~/components/ShareButton";
import { LinkShareButton } from "~/components/LinkShareButton";
import { CopyButton } from "~/components/CopyButton";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { type Address } from "viem";
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI } from "~/lib/contracts/marketplace";

interface AuctionDetailClientProps {
  listingId: string;
}

export default function AuctionDetailClient({
  listingId,
}: AuctionDetailClientProps) {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const { isSDKLoaded } = useMiniApp();
  const { auction, loading } = useAuction(listingId);
  const [bidAmount, setBidAmount] = useState("");
  
  // Cancel listing transaction
  const { writeContract: cancelListing, data: cancelHash, isPending: isCancelling, error: cancelError } = useWriteContract();
  const { isLoading: isConfirmingCancel, isSuccess: isCancelConfirmed } = useWaitForTransactionReceipt({
    hash: cancelHash,
  });
  
  // Finalize auction transaction
  const { writeContract: finalizeAuction, data: finalizeHash, isPending: isFinalizing, error: finalizeError } = useWriteContract();
  const { isLoading: isConfirmingFinalize, isSuccess: isFinalizeConfirmed } = useWaitForTransactionReceipt({
    hash: finalizeHash,
  });

  // Resolve creator name from contract address (NFT creator, not auction seller)
  // Pass null for address so it only looks up contract creator, not seller
  const {
    artistName: creatorName,
    isLoading: creatorNameLoading,
    creatorAddress,
  } = useArtistName(
    null, // Don't pass seller address - we want the contract creator, not seller
    auction?.tokenAddress || undefined,
    auction?.tokenId ? BigInt(auction.tokenId) : undefined
  );

  // Resolve seller name separately (for display in auction details)
  const { artistName: sellerName, isLoading: sellerNameLoading } =
    useArtistName(
      auction?.seller || null,
      undefined, // No contract address for seller lookup
      undefined
    );

  // Resolve bidder name if there's a highest bid
  const { artistName: bidderName, isLoading: bidderNameLoading } =
    useArtistName(
      auction?.highestBid?.bidder || null,
      undefined, // No contract address for bidder lookup
      undefined
    );

  // Fetch contract name
  const { contractName, isLoading: contractNameLoading } = useContractName(
    auction?.tokenAddress as Address | undefined
  );

  const handleBid = async () => {
    if (!isConnected || !bidAmount) {
      return;
    }
    // TODO: Implement bid functionality
    console.log("Place bid:", bidAmount);
  };

  const handleCancel = async () => {
    if (!isConnected || !auction) {
      return;
    }
    
    try {
      const listingIdBigInt = BigInt(listingId);
      await cancelListing({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: 'cancel',
        args: [listingIdBigInt, 0] as readonly [bigint, number], // holdbackBPS = 0 as per requirements
      });
    } catch (err) {
      console.error("Error cancelling listing:", err);
    }
  };

  const handleFinalize = async () => {
    if (!isConnected || !auction) {
      return;
    }
    
    try {
      await finalizeAuction({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: 'finalize',
        args: [BigInt(listingId)],
      });
    } catch (err) {
      console.error("Error finalizing auction:", err);
    }
  };

  // Redirect after successful cancellation
  useEffect(() => {
    if (isCancelConfirmed) {
      router.push("/");
    }
  }, [isCancelConfirmed, router]);

  // Refetch auction data after successful finalization
  useEffect(() => {
    if (isFinalizeConfirmed && auction) {
      // Refetch auction data to update status
      window.location.reload();
    }
  }, [isFinalizeConfirmed, auction]);

  // Set up back navigation for Farcaster mini-app
  useEffect(() => {
    if (!isSDKLoaded) return;

    const setupBackNavigation = async () => {
      try {
        // Check if back navigation is supported
        const capabilities = await sdk.getCapabilities();
        if (capabilities.includes("back")) {
          // Enable web navigation integration (automatically handles browser history)
          await sdk.back.enableWebNavigation();

          // Also set up a custom handler for back navigation
          sdk.back.onback = () => {
            // Navigate back to home page
            router.push("/");
          };

          // Show the back button
          await sdk.back.show();
        }
      } catch (error) {
        console.error("Failed to set up back navigation:", error);
      }
    };

    setupBackNavigation();

    // Listen for back navigation events
    const handleBackNavigation = () => {
      router.push("/");
    };

    sdk.on("backNavigationTriggered", handleBackNavigation);

    return () => {
      sdk.off("backNavigationTriggered", handleBackNavigation);
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
  // Use metadata artist, then resolved creator name from contract
  const displayCreatorName = auction.artist || creatorName;
  // Use creator address if found, otherwise fall back to seller (shouldn't happen if contract exists)
  const displayCreatorAddress = creatorAddress || auction.seller;
  const bidCount = auction.bidCount || 0;
  
  // Check if the current user is the auction seller
  const isOwnAuction = isConnected && address && auction.seller && 
    address.toLowerCase() === auction.seller.toLowerCase();
  
  // Check if cancellation is allowed (seller can only cancel if no bids)
  const canCancel = isOwnAuction && bidCount === 0 && isActive;
  const isCancelLoading = isCancelling || isConfirmingCancel;
  
  // Check if finalization is allowed (auction has ended and not finalized)
  const canFinalize = isConnected && !isActive && auction.status !== "FINALIZED" && auction.status !== "CANCELLED";
  const isFinalizeLoading = isFinalizing || isConfirmingFinalize;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-5 py-4 max-w-4xl">
        {/* Full width artwork */}
        <div className="mb-4">
          {auction.image ? (
            <img
              src={auction.image}
              alt={title}
              className="w-full aspect-square object-cover rounded-lg"
            />
          ) : (
            <div className="w-full aspect-square bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-lg" />
          )}
        </div>

        {/* Title, Collection, Creator - each on own row */}
        <div className="mb-4">
          <div className="flex items-start justify-between gap-4 mb-1">
            <h1 className="text-2xl font-light">{title}</h1>
            <div className="flex gap-2 flex-shrink-0">
              <LinkShareButton
                url={typeof window !== "undefined" ? window.location.href : ""}
              />
              <ShareButton
                url={typeof window !== "undefined" ? window.location.href : ""}
                artworkUrl={auction.image || auction.metadata?.image || null}
                title={title}
                artistName={displayCreatorName || undefined}
                artistAddress={displayCreatorAddress || undefined}
                sellerAddress={auction.seller}
                sellerName={sellerName || undefined}
                reservePrice={auction.initialAmount}
                currentBid={auction.highestBid?.amount || undefined}
                bidderAddress={auction.highestBid?.bidder || undefined}
                bidderName={bidderName || undefined}
                hasBids={bidCount > 0}
              />
            </div>
          </div>
          {contractName && (
            <div className="text-xs text-[#999999] mb-1">{contractName}</div>
          )}
          {displayCreatorName ? (
            <div className="text-xs text-[#cccccc] mb-4">
              by {displayCreatorName}
            </div>
          ) : displayCreatorAddress && !creatorNameLoading ? (
            <div className="text-xs text-[#cccccc] mb-4 flex items-center gap-2">
              <span className="font-mono">{displayCreatorAddress}</span>
              <CopyButton text={displayCreatorAddress} />
            </div>
          ) : null}
          {/* Description */}
          {auction.description && (
            <div className="mb-4">
              <p className="text-xs text-[#cccccc] leading-relaxed">
                {auction.description}
              </p>
            </div>
          )}
        </div>

        {/* Cancel Listing Button (for seller with no bids) */}
        {canCancel && (
          <div className="mb-4">
            <button
              onClick={handleCancel}
              disabled={isCancelLoading}
              className="w-full px-4 py-2 bg-red-600 text-white text-sm font-medium tracking-[0.5px] hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCancelLoading
                ? isConfirmingCancel
                  ? "Confirming..."
                  : "Cancelling..."
                : "Cancel Auction"}
            </button>
            {cancelError && (
              <p className="text-xs text-red-400 mt-2">
                {cancelError.message || "Failed to cancel auction"}
              </p>
            )}
          </div>
        )}

        {/* Finalize Auction Button (for ended auctions) */}
        {canFinalize && (
          <div className="mb-4">
            <button
              onClick={handleFinalize}
              disabled={isFinalizeLoading}
              className="w-full px-4 py-2 bg-green-600 text-white text-sm font-medium tracking-[0.5px] hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFinalizeLoading
                ? isConfirmingFinalize
                  ? "Confirming..."
                  : "Finalizing..."
                : "Finalize Auction"}
            </button>
            {finalizeError && (
              <p className="text-xs text-red-400 mt-2">
                {finalizeError.message || "Failed to finalize auction"}
              </p>
            )}
          </div>
        )}

        {/* Place Bid */}
        {isActive && (
          <div className="mb-4">
            {!isConnected ? (
              <p className="text-xs text-[#cccccc]">
                Please connect your wallet to place a bid.
              </p>
            ) : isOwnAuction ? (
              <div className="space-y-3">
                <input
                  type="number"
                  step="0.001"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  disabled
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333333] text-white text-sm rounded-lg opacity-50 cursor-not-allowed placeholder:text-[#666666]"
                  placeholder={
                    auction.highestBid
                      ? `Min: ${formatEther(BigInt(currentPrice))} ETH`
                      : `Min: ${formatEther(BigInt(auction.initialAmount))} ETH`
                  }
                />
                <button
                  onClick={handleBid}
                  disabled
                  className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] opacity-50 cursor-not-allowed"
                >
                  Place Bid
                </button>
                <p className="text-xs text-[#cccccc]">
                  You cannot bid on your own auction.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="number"
                  step="0.001"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333333] text-white text-sm rounded-lg focus:ring-2 focus:ring-white focus:border-white placeholder:text-[#666666]"
                  placeholder={
                    auction.highestBid
                      ? `Min: ${formatEther(BigInt(currentPrice))} ETH`
                      : `Min: ${formatEther(BigInt(auction.initialAmount))} ETH`
                  }
                />
                <button
                  onClick={handleBid}
                  className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors"
                >
                  Place Bid
                </button>
              </div>
            )}
          </div>
        )}

        {/* Compact auction details - multiple items per row */}
        <div className="mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[#999999]">Reserve:</span>
              <span className="ml-2 font-medium">
                {formatEther(BigInt(auction.initialAmount))} ETH
              </span>
            </div>
            <div>
              <span className="text-[#999999]">Current:</span>
              <span className="ml-2 font-medium">
                {auction.highestBid
                  ? `${formatEther(BigInt(currentPrice))} ETH`
                  : "No bids"}
              </span>
            </div>
            <div>
              <span className="text-[#999999]">Bids:</span>
              <span className="ml-2 font-medium">{bidCount}</span>
            </div>
            <div>
              <span className="text-[#999999]">Status:</span>
              <span className="ml-2 font-medium">
                {isActive ? "Active" : "Ended"}
              </span>
            </div>
          </div>
          <div className="text-xs">
            <span className="text-[#999999]">Seller:</span>
            <span className="ml-2 font-medium">
              {sellerName ? (
                sellerName
              ) : (
                <span className="font-mono">{auction.seller}</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
