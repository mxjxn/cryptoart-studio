"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useRouter } from "next/navigation";
import { useAuction } from "~/hooks/useAuction";
import { useArtistName } from "~/hooks/useArtistName";
import { useContractName } from "~/hooks/useContractName";
import { ShareButton } from "~/components/ShareButton";
import { LinkShareButton } from "~/components/LinkShareButton";
import { CopyButton } from "~/components/CopyButton";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { useAuthMode } from "~/hooks/useAuthMode";
import { useOffers } from "~/hooks/useOffers";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { type Address, parseEther, formatEther } from "viem";
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
  const { isMiniApp } = useAuthMode();
  const { auction, loading } = useAuction(listingId);
  const { offers, activeOffers, isLoading: offersLoading, refetch: refetchOffers } = useOffers(listingId);
  const [bidAmount, setBidAmount] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  
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

  // Purchase transaction (for FIXED_PRICE)
  const { writeContract: purchaseListing, data: purchaseHash, isPending: isPurchasing, error: purchaseError } = useWriteContract();
  const { isLoading: isConfirmingPurchase, isSuccess: isPurchaseConfirmed } = useWaitForTransactionReceipt({
    hash: purchaseHash,
  });

  // Offer transaction (for OFFERS_ONLY)
  const { writeContract: makeOffer, data: offerHash, isPending: isOffering, error: offerError } = useWriteContract();
  const { isLoading: isConfirmingOffer, isSuccess: isOfferConfirmed } = useWaitForTransactionReceipt({
    hash: offerHash,
  });

  // Accept offer transaction (for sellers)
  const { writeContract: acceptOffer, data: acceptHash, isPending: isAccepting, error: acceptError } = useWriteContract();
  const { isLoading: isConfirmingAccept, isSuccess: isAcceptConfirmed } = useWaitForTransactionReceipt({
    hash: acceptHash,
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
    if (!isConnected || !bidAmount || !auction) {
      return;
    }
    // TODO: Implement bid functionality
    console.log("Place bid:", bidAmount);
  };

  const handlePurchase = async () => {
    if (!isConnected || !auction) {
      return;
    }

    try {
      const price = auction.currentPrice || auction.initialAmount;
      const totalPrice = BigInt(price) * BigInt(purchaseQuantity);
      
      await purchaseListing({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: 'purchase',
        args: [Number(listingId), purchaseQuantity],
        value: totalPrice,
      });
    } catch (err) {
      console.error("Error purchasing:", err);
    }
  };

  const handleMakeOffer = async () => {
    if (!isConnected || !offerAmount || !auction) {
      return;
    }

    try {
      const offerAmountWei = parseEther(offerAmount);
      
      await makeOffer({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: 'offer',
        args: [Number(listingId), false],
        value: offerAmountWei,
      });
    } catch (err) {
      console.error("Error making offer:", err);
    }
  };

  const handleAcceptOffer = async (offererAddress: string, offerAmount: string) => {
    if (!isConnected || !auction) {
      return;
    }

    try {
      const offerAmountBigInt = BigInt(offerAmount);
      
      await acceptOffer({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: 'accept',
        args: [
          Number(listingId),
          [offererAddress as Address],
          [offerAmountBigInt],
          offerAmountBigInt, // maxAmount
        ],
      });
    } catch (err) {
      console.error("Error accepting offer:", err);
    }
  };

  const handleCancel = async () => {
    if (!isConnected || !auction) {
      return;
    }
    
    try {
      await cancelListing({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: 'cancel',
        args: [Number(listingId), 0], // holdbackBPS = 0 as per requirements
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
        args: [Number(listingId)],
      });
    } catch (err) {
      console.error("Error finalizing auction:", err);
    }
  };

  // Redirect after successful cancellation
  useEffect(() => {
    if (isCancelConfirmed) {
      // Refresh router to get fresh data, then navigate to home
      router.refresh();
      setTimeout(() => {
        router.push("/");
      }, 100);
    }
  }, [isCancelConfirmed, router]);

  // Redirect after successful finalization
  useEffect(() => {
    if (isFinalizeConfirmed) {
      // Refresh router to get fresh data, then navigate to home
      router.refresh();
      setTimeout(() => {
        router.push("/");
      }, 100);
    }
  }, [isFinalizeConfirmed, router]);

  // Refetch offers after successful offer or accept
  useEffect(() => {
    if (isOfferConfirmed || isAcceptConfirmed) {
      refetchOffers();
      router.refresh();
    }
  }, [isOfferConfirmed, isAcceptConfirmed, refetchOffers, router]);

  // Redirect after successful purchase
  useEffect(() => {
    if (isPurchaseConfirmed) {
      router.refresh();
      setTimeout(() => {
        router.push("/");
      }, 100);
    }
  }, [isPurchaseConfirmed, router]);

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
  const isActive = endTime > now && auction.status === "ACTIVE";
  const isCancelled = auction.status === "CANCELLED";
  const title = auction.title || `Auction #${listingId}`;
  // Use metadata artist, then resolved creator name from contract
  const displayCreatorName = auction.artist || creatorName;
  // Use creator address if found, otherwise fall back to seller (shouldn't happen if contract exists)
  const displayCreatorAddress = creatorAddress || auction.seller;
  const bidCount = auction.bidCount || 0;
  
  // Check if the current user is the auction seller
  const isOwnAuction = isConnected && address && auction.seller && 
    address.toLowerCase() === auction.seller.toLowerCase();
  
  // Check if cancellation is allowed (seller can only cancel if no bids and active)
  const canCancel = isOwnAuction && bidCount === 0 && isActive && !isCancelled;
  const isCancelLoading = isCancelling || isConfirmingCancel;
  
  // Check if finalization is allowed (auction has ended and not finalized or cancelled)
  const canFinalize = isConnected && !isActive && !isCancelled && auction.status !== "FINALIZED";
  const isFinalizeLoading = isFinalizing || isConfirmingFinalize;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header - Only show when not in miniapp */}
      {!isMiniApp && (
        <header className="flex justify-between items-center px-5 py-4 border-b border-[#333333]">
          <div className="text-base font-normal tracking-[0.5px]">cryptoart.social</div>
          <div className="flex items-center gap-3">
            <ProfileDropdown />
          </div>
        </header>
      )}
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
            {/* Only show share buttons if auction is not cancelled */}
            {!isCancelled && (
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
            )}
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

        {/* Cancelled Auction Message */}
        {isCancelled && (
          <div className="mb-4 p-4 bg-[#1a1a1a] border border-[#333333] rounded-lg">
            <p className="text-sm text-white font-medium">Auction has been cancelled</p>
          </div>
        )}

        {/* Cancel Listing Button (for seller with no bids) - Hidden if cancelled */}
        {canCancel && !isCancelled && (
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

        {/* Finalize Auction Button (for ended auctions) - Hidden if cancelled */}
        {canFinalize && !isCancelled && (
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

        {/* Action Buttons - Conditional based on listing type */}
        {!isCancelled && (
          <>
            {/* INDIVIDUAL_AUCTION - Place Bid */}
            {auction.listingType === "INDIVIDUAL_AUCTION" && isActive && (
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

            {/* FIXED_PRICE - Purchase */}
            {auction.listingType === "FIXED_PRICE" && isActive && (
              <div className="mb-4 space-y-3">
                {auction.tokenSpec === "ERC1155" && (
                  <div>
                    <label className="block text-sm font-medium text-[#cccccc] mb-2">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={Math.max(1, parseInt(auction.totalAvailable) - parseInt(auction.totalSold || "0"))}
                      value={purchaseQuantity}
                      onChange={(e) => setPurchaseQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333333] text-white text-sm rounded-lg focus:ring-2 focus:ring-white focus:border-white"
                    />
                    <p className="text-xs text-[#999999] mt-1">
                      {parseInt(auction.totalAvailable) - parseInt(auction.totalSold || "0")} available
                    </p>
                  </div>
                )}
                {!isConnected ? (
                  <p className="text-xs text-[#cccccc]">
                    Please connect your wallet to purchase.
                  </p>
                ) : isOwnAuction ? (
                  <p className="text-xs text-[#cccccc]">
                    You cannot purchase your own listing.
                  </p>
                ) : (
                  <>
                    <div className="p-3 bg-[#1a1a1a] border border-[#333333] rounded-lg">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-[#cccccc]">Price</span>
                        <span className="text-lg font-medium text-white">
                          {formatEther(BigInt(auction.initialAmount))} ETH
                        </span>
                      </div>
                      {auction.tokenSpec === "ERC1155" && (
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm text-[#cccccc]">Total</span>
                          <span className="text-sm font-medium text-white">
                            {formatEther(BigInt(auction.initialAmount) * BigInt(purchaseQuantity))} ETH
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handlePurchase}
                      disabled={isPurchasing || isConfirmingPurchase}
                      className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPurchasing || isConfirmingPurchase
                        ? "Processing..."
                        : "Buy Now"}
                    </button>
                    {purchaseError && (
                      <p className="text-xs text-red-400">
                        {purchaseError.message || "Failed to purchase"}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* OFFERS_ONLY - Make Offer */}
            {auction.listingType === "OFFERS_ONLY" && isActive && (
              <div className="mb-4 space-y-4">
                {!isConnected ? (
                  <p className="text-xs text-[#cccccc]">
                    Please connect your wallet to make an offer.
                  </p>
                ) : isOwnAuction ? (
                  <p className="text-xs text-[#cccccc]">
                    You cannot make an offer on your own listing.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="number"
                      step="0.001"
                      value={offerAmount}
                      onChange={(e) => setOfferAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333333] text-white text-sm rounded-lg focus:ring-2 focus:ring-white focus:border-white placeholder:text-[#666666]"
                      placeholder="0.1"
                    />
                    <button
                      onClick={handleMakeOffer}
                      disabled={isOffering || isConfirmingOffer || !offerAmount}
                      className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isOffering || isConfirmingOffer
                        ? "Processing..."
                        : "Make Offer"}
                    </button>
                    {offerError && (
                      <p className="text-xs text-red-400">
                        {offerError.message || "Failed to make offer"}
                      </p>
                    )}
                  </div>
                )}

                {/* Offers List - Show for seller and buyers */}
                {activeOffers.length > 0 && (
                  <div className="mt-4 p-4 bg-[#1a1a1a] border border-[#333333] rounded-lg">
                    <h3 className="text-sm font-medium text-white mb-3">Active Offers</h3>
                    <div className="space-y-2">
                      {activeOffers.map((offer, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center p-2 bg-black rounded border border-[#333333]"
                        >
                          <div>
                            <p className="text-sm text-white font-medium">
                              {formatEther(BigInt(offer.amount))} ETH
                            </p>
                            <p className="text-xs text-[#999999] font-mono">
                              {offer.offerer.slice(0, 6)}...{offer.offerer.slice(-4)}
                            </p>
                          </div>
                          {isOwnAuction && (
                            <button
                              onClick={() => handleAcceptOffer(offer.offerer, offer.amount)}
                              disabled={isAccepting || isConfirmingAccept}
                              className="px-3 py-1 bg-white text-black text-xs font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isAccepting || isConfirmingAccept
                                ? "Processing..."
                                : "Accept"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {acceptError && (
                      <p className="text-xs text-red-400 mt-2">
                        {acceptError.message || "Failed to accept offer"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Listing details - Different display based on listing type - Hidden if cancelled */}
        {!isCancelled && (
          <div className="mb-4 space-y-3">
            {auction.listingType === "INDIVIDUAL_AUCTION" && (
              <>
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
              </>
            )}

            {auction.listingType === "FIXED_PRICE" && (
              <>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[#999999]">Price:</span>
                    <span className="ml-2 font-medium">
                      {formatEther(BigInt(auction.initialAmount))} ETH
                    </span>
                  </div>
                  <div>
                    <span className="text-[#999999]">For sale:</span>
                    <span className="ml-2 font-medium">
                      {parseInt(auction.totalAvailable)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#999999]">Remaining:</span>
                    <span className="ml-2 font-medium">
                      {parseInt(auction.totalAvailable) - parseInt(auction.totalSold || "0")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#999999]">Status:</span>
                    <span className="ml-2 font-medium">
                      {isActive ? "Active" : "Ended"}
                    </span>
                  </div>
                </div>
                {endTime > 0 && (
                  <div className="text-xs">
                    <span className="text-[#999999]">On sale until:</span>
                    <span className="ml-2 font-medium">
                      {new Date(endTime * 1000).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                )}
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
              </>
            )}

            {auction.listingType === "OFFERS_ONLY" && (
              <>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[#999999]">Type:</span>
                    <span className="ml-2 font-medium">Offers Only</span>
                  </div>
                  <div>
                    <span className="text-[#999999]">Status:</span>
                    <span className="ml-2 font-medium">
                      {isActive ? "Active" : "Ended"}
                    </span>
                  </div>
                </div>
                {endTime > 0 && (
                  <div className="text-xs">
                    <span className="text-[#999999]">Accepts offers until:</span>
                    <span className="ml-2 font-medium">
                      {new Date(endTime * 1000).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                )}
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
              </>
            )}

            {auction.listingType === "DYNAMIC_PRICE" && (
              <>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[#999999]">Type:</span>
                    <span className="ml-2 font-medium">Dynamic Price</span>
                  </div>
                  <div>
                    <span className="text-[#999999]">Status:</span>
                    <span className="ml-2 font-medium">
                      {isActive ? "Active" : "Ended"}
                    </span>
                  </div>
                </div>
                {endTime > 0 && (
                  <div className="text-xs">
                    <span className="text-[#999999]">On sale until:</span>
                    <span className="ml-2 font-medium">
                      {new Date(endTime * 1000).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                )}
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
