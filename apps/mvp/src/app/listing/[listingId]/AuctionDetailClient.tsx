"use client";

import { type Address } from "viem";
import { useAuctionDetail } from "~/hooks/useAuctionDetail";
import { useArtistName } from "~/hooks/useArtistName";
import { useUsername } from "~/hooks/useUsername";
import { ShareButton } from "~/components/ShareButton";
import { LinkShareButton } from "~/components/LinkShareButton";
import { CopyButton } from "~/components/CopyButton";
import { AddToGalleryButton } from "~/components/AddToGalleryButton";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { TransitionLink } from "~/components/TransitionLink";
import { Logo } from "~/components/Logo";
import { ImageOverlay } from "~/components/ImageOverlay";
import { ChainSwitchPrompt } from "~/components/ChainSwitchPrompt";
import { MediaDisplay } from "~/components/media";
import { getMediaType, getMediaTypeFromFormat } from "~/lib/media-utils";
import { UpdateListingForm } from "~/components/UpdateListingForm";
import { Fix180DayDurationForm } from "~/components/Fix180DayDurationForm";
import { TokenImage } from "~/components/TokenImage";
import { AdminContextMenu } from "~/components/AdminContextMenu";
import { MetadataViewer } from "~/components/MetadataViewer";
import { ContractDetails } from "~/components/ContractDetails";
import { BuyersList } from "~/components/BuyersList";
import { ListingThemeEditor } from "~/components/ListingThemeEditor";
import { AmbiguousListingPicker } from "~/components/AmbiguousListingPicker";
import { ETHEREUM_MAINNET_CHAIN_ID } from "~/lib/server/subgraph-endpoints";
import { getAuctionTimeStatus, getFixedPriceTimeStatus, isNeverExpiring } from "~/lib/time-utils";

interface AuctionDetailClientProps {
  listingId: string;
  listingApiChainId?: number;
}

export default function AuctionDetailClient({
  listingId,
  listingApiChainId,
}: AuctionDetailClientProps) {
  const {
    pageState,
    auction,
    mergedAmbiguousChains,
    listingBgGradient,
    listingPageTheme,
    listingTypo,
    listingShellStyle,
    address,
    isConnected,
    isMiniApp,
    isMiniAppInstalled,
    isSDKLoaded,
    canEditListingTheme,
    verifiedWalletAddresses,
    isListingSeller,
    marketplaceReadChainId,
    title,
    currentPrice,
    listingHeroImageUrl,
    listingFullscreenImageUrl,
    listingHeroImageFallbackSrcs,
    listingImageOverlayFallbackSrcs,
    listingChainInfo,
    chainScopeMismatch,
    shareText,
    displayCreatorName,
    displayCreatorAddress,
    creatorUsername,
    sellerUsername,
    bidderUsername,
    sellerName,
    bidderName,
    contractName,
    now,
    startTime,
    endTime,
    actualEndTime,
    effectiveEndTime,
    hasBid,
    hasStarted,
    auctionHasStarted,
    isEnded,
    isActive,
    effectiveEnded,
    isCancelled,
    showControls,
    isOwnAuction,
    isWinner,
    canCancel,
    canFinalize,
    canUpdate,
    canUpdateAtRisk,
    canFix180DayIssue,
    isAtRiskListing,
    has180DayIssue,
    isCancelling,
    isConfirmingCancel,
    isCancelLoading,
    isFinalizing,
    isConfirmingFinalize,
    isFinalizeLoading,
    isModifying,
    isConfirmingModify,
    isModifyLoading,
    isPurchasing,
    isConfirmingPurchase,
    isBidding,
    isConfirmingBid,
    isOffering,
    isConfirmingOffer,
    isAccepting,
    isConfirmingAccept,
    isApproving,
    isConfirmingApprove,
    bidAmount,
    setBidAmount,
    offerAmount,
    setOfferAmount,
    purchaseQuantity,
    setPurchaseQuantity,
    isImageOverlayOpen,
    setIsImageOverlayOpen,
    showUpdateForm,
    setShowUpdateForm,
    showChainSwitchPrompt,
    setShowChainSwitchPrompt,
    isPaymentETH,
    paymentSymbol,
    paymentDecimals,
    userBalance,
    activeOffers,
    handleBid,
    handlePurchase,
    handleMakeOffer,
    handleAcceptOffer,
    handleCancel,
    handleFinalize,
    handleFix180DayDuration,
    handleUpdateListing,
    handleSwapBuyToken,
    formatPrice,
    calculateMinBid,
    refetchAuction,
    actions,
    modifyError,
    isExplicitEthereumListing,
    pendingPurchaseAfterApproval,
    bidCount,
    nowTimestamp,
    listingData,
    erc20Allowance,
    cancelError,
    finalizeError,
    purchaseError,
    offerError,
    acceptError,
    bidError,
    approveError,
    setBuildingTimedOut,
    setPageStatus,
    loading,
  } = useAuctionDetail({ listingId, listingApiChainId });

  if (pageState === "ambiguous") {
    return (
      <AmbiguousListingPicker
        listingId={listingId}
        chains={mergedAmbiguousChains!}
        variant="light"
      />
    );
  }

  if (pageState === "loading") {
    const isBuilding = !loading && !auction;
    return (
      <div
        className="listing-detail-page min-h-screen flex flex-col items-center justify-center animate-in fade-in duration-100 gap-4"
        style={{ background: listingBgGradient }}
      >
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-neutral-600">
            {isBuilding ? 'Loading listing…' : 'Loading auction...'}
          </p>
        </div>
        {isBuilding && (
          <p className="text-sm text-neutral-500 max-w-md text-center px-4">
            Loading listing data. If this listing was just created, it can take a few seconds to appear.
          </p>
        )}
      </div>
    );
  }

  if (pageState === "fetchTimeout") {
    return (
      <div
        className="listing-detail-page min-h-screen flex flex-col items-center justify-center gap-4 px-4"
        style={{ background: listingBgGradient }}
      >
        <p className="max-w-md text-center text-neutral-600">
          This listing took too long to load (slow metadata or network). It may still exist — try again.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => refetchAuction(true)}
            className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-100"
          >
            Retry
          </button>
          <TransitionLink
            href="/"
            className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-100"
          >
            Home
          </TransitionLink>
        </div>
      </div>
    );
  }

  if (pageState === "timeout") {
    return (
      <div
        className="listing-detail-page min-h-screen flex flex-col items-center justify-center gap-4 px-4"
        style={{ background: listingBgGradient }}
      >
        <p className="text-neutral-600 text-center">
          This listing is taking longer than expected to build.
        </p>
        <p className="text-sm text-neutral-500 text-center max-w-md">
          You can retry now. If it still fails, return to the homepage and open another lot while this one finishes.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setBuildingTimedOut(false);
              setPageStatus(null);
              refetchAuction();
            }}
            className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-100"
          >
            Retry
          </button>
          <TransitionLink
            href="/"
            className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-100"
          >
            Back to homepage
          </TransitionLink>
        </div>
      </div>
    );
  }

  if (pageState === "notFound") {
    return (
      <div
        className="listing-detail-page min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: listingBgGradient }}
      >
        <p className="text-neutral-600">Auction not found</p>
        <TransitionLink
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors underline"
        >
          Return to homepage
        </TransitionLink>
      </div>
    );
  }

  if (pageState === "indexedButMissing") {
    return (
      <div
        className="listing-detail-page min-h-screen flex flex-col items-center justify-center gap-4 px-4"
        style={{ background: listingBgGradient }}
      >
        <p className="text-neutral-600 text-center max-w-md">
          Listing is indexed but details could not be loaded. Try again, or go home and open this lot from the feed.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => refetchAuction(true)}
            className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-100"
          >
            Retry
          </button>
          <TransitionLink
            href="/"
            className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-100"
          >
            Home
          </TransitionLink>
        </div>
      </div>
    );
  }

  if (!auction) {
    return null;
  }

  return (
    <div
      className="listing-detail-page min-h-screen w-full overflow-x-hidden animate-in fade-in duration-100"
      style={listingShellStyle}
    >
      {!isMiniApp && (
        <section className="border-b border-neutral-200 bg-white">
          <div className="container mx-auto flex max-w-4xl justify-center px-5 py-3">
            <TransitionLink
              href="/create"
              prefetch={false}
              className="font-mek-mono text-sm tracking-[0.5px] text-neutral-600 transition-colors hover:text-neutral-950"
            >
              + Create listing
            </TransitionLink>
          </div>
        </section>
      )}

      <div
        className="listing-light-surface listing-page-chrome border-b border-neutral-200 bg-white text-neutral-900"
        style={{ backgroundColor: "#ffffff" }}
      >
        {!isMiniApp && (
          <div className="container mx-auto flex max-w-4xl items-center justify-between border-b border-neutral-200 px-4 py-3 sm:px-5">
            <Logo compact />
            <ProfileDropdown topBarVariant="light" />
          </div>
        )}
        <div className="container mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-3 font-space-grotesk text-sm font-medium">
          <TransitionLink
            href="/"
            className="inline-flex shrink-0 items-center gap-2 text-neutral-900 underline-offset-2 hover:underline"
          >
            <span aria-hidden>←</span> back
          </TransitionLink>
          {isMiniApp ? (
            <div className="flex min-w-0 shrink-0 items-center justify-end">
              <ProfileDropdown />
            </div>
          ) : (
            <div className="min-w-0 truncate text-right text-neutral-700">
              {sellerUsername ? (
                <TransitionLink
                  href={`/user/${sellerUsername}`}
                  className="hover:text-neutral-950 hover:underline"
                >
                  @{sellerUsername}
                </TransitionLink>
              ) : auction.seller ? (
                <TransitionLink
                  href={`/user/${auction.seller}`}
                  className="font-mono text-xs hover:underline sm:text-sm"
                >
                  {auction.seller.slice(0, 6)}…{auction.seller.slice(-4)}
                </TransitionLink>
              ) : null}
            </div>
          )}
        </div>
      </div>
      <div className="mx-auto max-w-4xl py-4">
        {isMiniApp && !isMiniAppInstalled && actions && (
          <div className="mb-4 flex justify-end px-5">
            <button
              onClick={actions.addMiniApp}
              className="text-xs text-neutral-500 hover:text-neutral-600 transition-colors underline"
            >
              Add to Farcaster
            </button>
          </div>
        )}
        {canEditListingTheme && isListingSeller && address && (
          <div className="mb-4">
            <ListingThemeEditor
              mode="listing"
              listingId={listingId}
              userAddress={address}
              verifiedAddresses={verifiedWalletAddresses}
              surface="light"
              onThemeResolved={() => {}}
            />
          </div>
        )}
        <div className="mb-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <MediaDisplay
            imageUrl={listingHeroImageUrl}
            fallbackSrcs={listingHeroImageFallbackSrcs}
            animationUrl={auction.metadata?.animation_url}
            animationFormat={auction.metadata?.animation_details?.format}
            alt={title}
            placeholderGradientCss={listingBgGradient}
            onImageClick={
              (() => {
                const animUrl = auction.metadata?.animation_url;
                const animFormat = auction.metadata?.animation_details?.format;
                if (!animUrl)
                  return listingHeroImageUrl ? () => setIsImageOverlayOpen(true) : undefined;
                let mediaType = getMediaType(animUrl);
                if (mediaType === 'image' && animFormat) {
                  mediaType = getMediaTypeFromFormat(animFormat);
                }
                return mediaType === 'image' ? () => setIsImageOverlayOpen(true) : undefined;
              })()
            }
            viewTransitionName={`artwork-${listingId}`}
          />
        </div>

        {(() => {
          const animUrl = auction.metadata?.animation_url;
          const animFormat = auction.metadata?.animation_details?.format;
          let mediaType = animUrl ? getMediaType(animUrl) : 'image';
          if (mediaType === 'image' && animFormat) {
            mediaType = getMediaTypeFromFormat(animFormat);
          }
          return (
            !!listingFullscreenImageUrl && (!animUrl || mediaType === "image")
          );
        })() && (
          <ImageOverlay
            src={listingFullscreenImageUrl!}
            fallbackSrcs={listingImageOverlayFallbackSrcs}
            alt={title}
            isOpen={isImageOverlayOpen}
            onClose={() => setIsImageOverlayOpen(false)}
          />
        )}

        <div
          className={`listing-light-surface mb-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white px-5 py-5 text-neutral-900 shadow-sm ${listingTypo.sectionFontClass}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h1 className={`mb-1 ${listingTypo.titleClass}`}>{title}</h1>
              <div
                className="mt-2 flex flex-wrap items-center gap-2"
                role="status"
                aria-label={`Listing on ${listingChainInfo.displayName}, chain ID ${listingChainInfo.chainId}`}
              >
                <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-semibold tracking-wide text-neutral-900">
                  {listingChainInfo.displayName}
                </span>
                <span className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-neutral-700">
                  chain ID {listingChainInfo.chainId}
                </span>
              </div>
              {chainScopeMismatch ? (
                <p className="mt-2 text-xs text-amber-800">
                  This page was opened for chain ID {listingApiChainId}, but indexer data is for chain ID{" "}
                  {auction.chainId}. Verify you are viewing the correct network.
                </p>
              ) : null}
              {auction.tokenSpec === "ERC1155" && auction.erc1155TotalSupply && (
                <p className="mt-2 text-sm text-neutral-600">edition of {auction.erc1155TotalSupply}</p>
              )}
            </div>
            <AdminContextMenu
              listingId={listingId}
              sellerAddress={auction.seller}
              chainId={
                typeof auction.chainId === "number" && Number.isFinite(auction.chainId)
                  ? auction.chainId
                  : undefined
              }
            />
          </div>

          {auction.description ? (
            <p
              className={`mt-3 w-full max-w-none whitespace-pre-wrap ${listingTypo.bodyClass}`}
            >
              {auction.description}
            </p>
          ) : null}

          {auction.tokenAddress && auction.tokenId && (
            <div className={auction.description ? "mt-4" : "mt-3"}>
              <MetadataViewer
                contractAddress={auction.tokenAddress as Address}
                tokenId={auction.tokenId}
                tokenSpec={auction.tokenSpec || "ERC721"}
                collectionName={contractName || undefined}
                totalSupply={auction.erc721TotalSupply}
              />
            </div>
          )}
          {displayCreatorName ? (
            <div className="mt-3 text-sm text-neutral-600">
              <div className="mb-2">
                <span>
                  by{" "}
                  {creatorUsername ? (
                    <TransitionLink
                      href={`/user/${creatorUsername}`}
                      className="text-neutral-800 underline-offset-2 hover:underline"
                    >
                      {displayCreatorName}
                    </TransitionLink>
                  ) : displayCreatorAddress ? (
                    <TransitionLink
                      href={`/user/${displayCreatorAddress}`}
                      className="text-neutral-800 underline-offset-2 hover:underline"
                    >
                      {displayCreatorName}
                    </TransitionLink>
                  ) : (
                    displayCreatorName
                  )}
                </span>
              </div>
              {!isCancelled && (
                <div className="flex items-center gap-2">
                  <AddToGalleryButton listingId={listingId} />
                  <LinkShareButton
                    url={typeof window !== "undefined" ? window.location.href : ""}
                  />
                  <ShareButton
                    url={typeof window !== "undefined" ? window.location.href : ""}
                    artworkUrl={auction.image || auction.metadata?.image || null}
                    text={shareText}
                  />
                </div>
              )}
            </div>
          ) : displayCreatorAddress ? (
            <div className="mt-3 text-sm text-neutral-600">
              <div className="mb-2 flex items-center gap-2">
                <TransitionLink
                  href={creatorUsername ? `/user/${creatorUsername}` : `/user/${displayCreatorAddress}`}
                  className="font-mono text-neutral-800 underline-offset-2 hover:underline"
                >
                  {displayCreatorAddress}
                </TransitionLink>
                <CopyButton text={displayCreatorAddress} />
              </div>
              {!isCancelled && (
                <div className="flex items-center gap-2">
                  <AddToGalleryButton listingId={listingId} />
                  <LinkShareButton
                    url={typeof window !== "undefined" ? window.location.href : ""}
                  />
                  <ShareButton
                    url={typeof window !== "undefined" ? window.location.href : ""}
                    artworkUrl={auction.image || auction.metadata?.image || null}
                    text={shareText}
                  />
                </div>
              )}
            </div>
          ) : !isCancelled ? (
            <div className="mt-3 text-sm">
              <div className="flex items-center gap-2">
                <AddToGalleryButton listingId={listingId} />
                <LinkShareButton
                  url={typeof window !== "undefined" ? window.location.href : ""}
                />
                <ShareButton
                  url={typeof window !== "undefined" ? window.location.href : ""}
                  artworkUrl={auction.image || auction.metadata?.image || null}
                  text={`Check out ${title}!`}
                />
              </div>
            </div>
          ) : null}

          {auction.tokenAddress && (
            <ContractDetails
              contractAddress={auction.tokenAddress as Address}
              chainId={typeof auction.chainId === "number" ? auction.chainId : undefined}
              imageUrl={auction.image || auction.metadata?.image || null}
              variant="light"
            />
          )}

          {(auction.tokenAddress || auction.tokenId) && (
            <div className="mt-4 flex items-center gap-3 text-xs">
              {auction.tokenSpec && (
                <span className="rounded border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700">
                  {auction.tokenSpec === "ERC1155" || String(auction.tokenSpec) === "2" ? "ERC-1155" : "ERC-721"}
                </span>
              )}
              {auction.tokenAddress && auction.tokenId && (
                <a
                  href={`https://opensea.io/item/${
                    auction.chainId === ETHEREUM_MAINNET_CHAIN_ID ? "ethereum" : "base"
                  }/${auction.tokenAddress}/${auction.tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
                  aria-label={`View NFT on OpenSea: ${contractName || "Collection"} #${auction.tokenId}`}
                >
                  OpenSea
                </a>
              )}
            </div>
          )}
        </div>

        {isCancelled && (
          <div className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-neutral-900 font-medium">Auction has been cancelled</p>
          </div>
        )}

        {isAtRiskListing && !isCancelled && (
          <div className="mb-4 rounded-2xl border border-yellow-600/30 bg-yellow-900/20 p-4">
            <p className="text-yellow-400 font-medium mb-2">⚠️ Auction Configuration Issue</p>
            <p className="text-yellow-300 text-sm mb-3">
              This auction has a configuration issue that would prevent proper finalization. 
              Bidding has been disabled until the auction is updated. Please use the form below to set 
              a valid auction duration (limited to 6 months maximum).
            </p>
          </div>
        )}

        {showUpdateForm && (canUpdate || canUpdateAtRisk) && !isCancelled && (
          <div className="mb-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            {isAtRiskListing && (
              <p className="text-sm text-neutral-600 mb-3">
                Update your auction configuration. Set a start time and end time, or use duration mode.
                Maximum duration is 6 months.
              </p>
            )}
            <UpdateListingForm
              currentStartTime={startTime || null}
              currentEndTime={endTime || null}
              onSubmit={handleUpdateListing}
              onCancel={() => setShowUpdateForm(false)}
              isLoading={isModifyLoading}
              listingType={auction.listingType}
              hideCancel={isAtRiskListing}
            />
            {modifyError && (
              <p className="text-xs text-red-400 mt-2">
                {modifyError.message || "Failed to update listing"}
              </p>
            )}
          </div>
        )}

        {canUpdate && !isCancelled && !showUpdateForm && (
          <div className="mb-4 overflow-hidden rounded-2xl shadow-sm">
            <button
              onClick={() => setShowUpdateForm(true)}
              disabled={isModifyLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium tracking-[0.5px] hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Update listing details"
            >
              Update Listing
            </button>
          </div>
        )}

        {canCancel && !isCancelled && (
          <div className="mb-4 overflow-hidden rounded-2xl shadow-sm">
            <button
              onClick={handleCancel}
              disabled={isCancelLoading}
              className="w-full px-4 py-2 bg-red-600 text-white text-sm font-medium tracking-[0.5px] hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={isCancelLoading ? "Cancelling listing" : "Cancel this listing"}
              aria-busy={isCancelLoading}
            >
              {isCancelLoading
                ? isConfirmingCancel
                  ? "Confirming..."
                  : "Cancelling..."
                : "Cancel Listing"}
            </button>
            {cancelError && (
              <p className="text-xs text-red-400 mt-2">
                {cancelError.message || "Failed to cancel auction"}
              </p>
            )}
          </div>
        )}

        {isEnded && !isCancelled && auction.listingType === "INDIVIDUAL_AUCTION" && (
          <div className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-neutral-900 font-medium mb-2">Auction Ended</p>
            {auction.highestBid && hasBid ? (
              <div className="space-y-2">
                <p className="text-xs text-neutral-600">
                  Winner: {bidderName ? (
                    bidderUsername ? (
                      <TransitionLink href={`/user/${bidderUsername}`} className="text-neutral-900 hover:underline">
                        {bidderName}
                      </TransitionLink>
                    ) : (
                      <TransitionLink href={`/user/${auction.highestBid.bidder}`} className="text-neutral-900 hover:underline">
                        {bidderName}
                      </TransitionLink>
                    )
                  ) : (
                    <TransitionLink href={bidderUsername ? `/user/${bidderUsername}` : `/user/${auction.highestBid.bidder}`} className="font-mono text-neutral-900 hover:underline">
                      {auction.highestBid.bidder.slice(0, 6)}...{auction.highestBid.bidder.slice(-4)}
                    </TransitionLink>
                  )}
                </p>
                <p className="text-xs text-neutral-600">
                  Winning Bid: <span className="text-neutral-900 font-medium">
                    <span className="flex items-center gap-1.5">
                      {formatPrice(auction.highestBid.amount)} 
                      <TokenImage tokenAddress={auction.erc20} size={14} />
                      <span>{paymentSymbol}</span>
                    </span>
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-xs text-neutral-600">No bids were placed on this auction.</p>
            )}
          </div>
        )}

        {effectiveEnded && !isCancelled && auction.status !== "FINALIZED" && (
          (auction.listingType === "INDIVIDUAL_AUCTION" && (isOwnAuction || isWinner)) ||
          (auction.listingType === "FIXED_PRICE" && isOwnAuction)
        ) && (
          <div className="mb-4 overflow-hidden rounded-2xl shadow-sm">
            <button
              onClick={handleFinalize}
              disabled={isFinalizeLoading || !canFinalize}
              className="w-full px-4 py-2 bg-green-600 text-white text-sm font-medium tracking-[0.5px] hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={isFinalizeLoading ? "Finalizing auction" : "Finalize this auction"}
              aria-busy={isFinalizeLoading}
            >
              {isFinalizeLoading
                ? isConfirmingFinalize
                  ? "Confirming..."
                  : "Finalizing..."
                : auction.listingType === "INDIVIDUAL_AUCTION" && isWinner
                ? "Finalize & Claim NFT"
                : auction.listingType === "FIXED_PRICE"
                ? "Finalize Listing"
                : "Finalize Auction"}
            </button>
            {finalizeError && (() => {
              const errorMessage = finalizeError.message || String(finalizeError);
              
              let displayMessage = errorMessage;
              
              if (errorMessage.includes('already finalized') || errorMessage.includes('finalized')) {
                displayMessage = "This auction has already been finalized.";
              }
              
              return (
                <p className="text-xs text-red-400 mt-2">
                  {displayMessage}
                </p>
              );
            })()}
          </div>
        )}

        {effectiveEnded && !isCancelled && auction.status !== "FINALIZED" && !canFinalize && (
          <div className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-neutral-900">
              Finalization is available to the authorized wallet.
            </p>
            {auction.listingType === "INDIVIDUAL_AUCTION" ? (
              <p className="mt-1 text-xs text-neutral-600">
                Seller or winning bidder can finalize this auction.
                {auction.seller ? ` Seller: ${auction.seller.slice(0, 6)}...${auction.seller.slice(-4)}.` : ""}
                {auction.highestBid?.bidder
                  ? ` Winner: ${auction.highestBid.bidder.slice(0, 6)}...${auction.highestBid.bidder.slice(-4)}.`
                  : ""}
              </p>
            ) : (
              <p className="mt-1 text-xs text-neutral-600">
                Seller can finalize this listing.
                {auction.seller ? ` Seller: ${auction.seller.slice(0, 6)}...${auction.seller.slice(-4)}.` : ""}
              </p>
            )}
          </div>
        )}

        {!isCancelled && canFix180DayIssue && (
          <div className="mb-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <Fix180DayDurationForm
              listingId={listingId}
              onSubmit={handleFix180DayDuration}
              isLoading={isModifyLoading}
            />
            {modifyError && (
              <p className="text-xs text-red-400 mt-2">
                {modifyError.message || "Failed to fix duration"}
              </p>
            )}
          </div>
        )}

        {!isCancelled && has180DayIssue && !isOwnAuction && (
          <div className="mb-4 rounded-2xl border border-red-700/50 bg-red-900/20 p-4">
            <p className="text-sm text-red-400 font-medium mb-1">
              Bidding Temporarily Disabled
            </p>
            <p className="text-xs text-red-300">
              This auction has a configuration issue that needs to be fixed by the seller before bidding can begin.
            </p>
          </div>
        )}

        {!isCancelled && (
          <>
            {auction.listingType === "INDIVIDUAL_AUCTION" && showControls && !isAtRiskListing && !has180DayIssue && (
              <div className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                {!isConnected ? (
                  <p className="text-xs text-neutral-600">
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
                      className="w-full px-3 py-2 bg-white border border-neutral-200 shadow-sm text-neutral-900 text-sm rounded-lg opacity-50 cursor-not-allowed placeholder:text-neutral-500"
                      placeholder={
                        auction.highestBid
                          ? `Min: ${formatPrice(currentPrice)} ${paymentSymbol}`
                          : `Min: ${formatPrice(auction.initialAmount)} ${paymentSymbol}`
                      }
                    />
                    <button
                      onClick={handleBid}
                      disabled
                      className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] opacity-50 cursor-not-allowed"
                    >
                      Place Bid
                    </button>
                    <p className="text-xs text-neutral-600">
                      You cannot bid on your own auction.
                    </p>
                  </div>
                ) : (() => {
                  const hasFutureStartTime = startTime > 0 && now < startTime;
                  
                  if (hasFutureStartTime) {
                    return (
                      <div className="space-y-3">
                        <input
                          type="number"
                          step="0.001"
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          disabled
                          className="w-full px-3 py-2 bg-white border border-neutral-200 shadow-sm text-neutral-900 text-sm rounded-lg opacity-50 cursor-not-allowed placeholder:text-neutral-500"
                          placeholder={
                            auction.highestBid
                              ? `Min: ${formatPrice(currentPrice)} ${paymentSymbol}`
                              : `Min: ${formatPrice(auction.initialAmount)} ${paymentSymbol}`
                          }
                        />
                        <button
                          onClick={handleBid}
                          disabled
                          className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] opacity-50 cursor-not-allowed"
                        >
                          Place Bid
                        </button>
                        <p className="text-xs text-neutral-600">
                          Auction starts {new Date(startTime * 1000).toLocaleString()}.
                        </p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="bid-amount-input" className="sr-only">
                          Bid amount in {paymentSymbol}
                        </label>
                        <input
                          id="bid-amount-input"
                          type="number"
                          step="0.001"
                          min={formatPrice(calculateMinBid.toString())}
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-neutral-200 shadow-sm text-neutral-900 text-sm rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-neutral-400 placeholder:text-neutral-500"
                          placeholder={`Min: ${formatPrice(calculateMinBid.toString())} ${paymentSymbol}`}
                          aria-label={`Bid amount in ${paymentSymbol}. Minimum: ${formatPrice(calculateMinBid.toString())} ${paymentSymbol}`}
                          aria-describedby="bid-balance-info"
                        />
                        {!userBalance.isLoading && (
                          <p id="bid-balance-info" className="text-xs text-neutral-500 mt-1" aria-live="polite">
                            Your balance: {userBalance.formatted} {paymentSymbol}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={handleBid}
                        disabled={isBidding || isConfirmingBid}
                        className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={`Place bid of ${bidAmount || formatPrice(calculateMinBid.toString())} ${paymentSymbol}`}
                      >
                        {isBidding || isConfirmingBid ? "Processing..." : "Place Bid"}
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            {auction.listingType === "FIXED_PRICE" && showControls && (() => {
              const isERC721SoldOut = auction.tokenSpec === "ERC721" && 
                parseInt(auction.totalSold || "0") >= parseInt(auction.totalAvailable || "1");
              
              if (isERC721SoldOut) {
                return (
                  <div className="mb-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                    <p className="text-center text-lg font-medium text-neutral-500 py-4">
                      Sold Out
                    </p>
                  </div>
                );
              }
              
              return (
                <div className="mb-4 space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                  {auction.tokenSpec === "ERC1155" && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-600 mb-2">
                      Number of Purchases
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={Math.floor((parseInt(auction.totalAvailable) - parseInt(auction.totalSold || "0")) / parseInt(auction.totalPerSale || "1"))}
                      value={purchaseQuantity}
                      onChange={(e) => setPurchaseQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-white border border-neutral-200 shadow-sm text-neutral-900 text-sm rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-neutral-400"
                      aria-label="Number of purchases"
                      aria-describedby="purchase-quantity-info"
                    />
                    <div id="purchase-quantity-info" className="sr-only">
                      You will receive {purchaseQuantity * parseInt(auction.totalPerSale || "1")} copies
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      You will receive {purchaseQuantity * parseInt(auction.totalPerSale || "1")} copies ({purchaseQuantity} purchase{purchaseQuantity !== 1 ? 's' : ''} × {auction.totalPerSale} copies per purchase)
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {parseInt(auction.totalAvailable) - parseInt(auction.totalSold || "0")} copies remaining ({Math.floor((parseInt(auction.totalAvailable) - parseInt(auction.totalSold || "0")) / parseInt(auction.totalPerSale || "1"))} purchase{Math.floor((parseInt(auction.totalAvailable) - parseInt(auction.totalSold || "0")) / parseInt(auction.totalPerSale || "1")) !== 1 ? 's' : ''} available)
                      {auction.erc1155TotalSupply && (
                        <span className="ml-1 text-neutral-500">
                          (of {auction.erc1155TotalSupply} total)
                        </span>
                      )}
                    </p>
                  </div>
                )}
                {!isConnected ? (
                  <p className="text-xs text-neutral-600">
                    Please connect your wallet to purchase.
                  </p>
                ) : isOwnAuction ? (
                  <p className="text-xs text-neutral-600">
                    You cannot purchase your own listing.
                  </p>
                ) : (() => {
                  const hasNotStartedForFixedPrice = startTime > 0 && now < startTime;
                  
                  if (hasNotStartedForFixedPrice) {
                    return (
                      <div className="space-y-3">
                        <div className="p-3 bg-white border border-neutral-200 shadow-sm rounded-lg opacity-50">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-neutral-600">Price Per Copy</span>
                            <span className="text-lg font-medium text-neutral-900 flex items-center gap-1.5">
                              {formatPrice(auction.initialAmount)} 
                              <TokenImage tokenAddress={auction.erc20} size={20} className="ml-0.5" />
                              <span>{paymentSymbol}</span>
                            </span>
                          </div>
                        </div>
                        <button
                          disabled
                          className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] opacity-50 cursor-not-allowed"
                        >
                          Buy Now
                        </button>
                        <p className="text-xs text-neutral-600">
                          {startTime === 0 
                            ? "Listing will start when the first purchase is made."
                            : `Listing starts ${new Date(startTime * 1000).toLocaleString()}.`}
                        </p>
                      </div>
                    );
                  }
                  
                  return (
                  <>
                    <div className="p-3 bg-white border border-neutral-200 shadow-sm rounded-lg">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-neutral-600">Price Per Copy</span>
                        <span className="text-lg font-medium text-neutral-900 flex items-center gap-1.5">
                          {formatPrice(auction.initialAmount)} 
                          <TokenImage tokenAddress={auction.erc20} size={20} className="ml-0.5" />
                          <span>{paymentSymbol}</span>
                        </span>
                      </div>
                      {auction.tokenSpec === "ERC1155" && (
                        <>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-sm text-neutral-600">Copies Purchased</span>
                            <span className="text-sm font-medium text-neutral-900">
                              {purchaseQuantity * parseInt(auction.totalPerSale || "1")} ({purchaseQuantity} × {auction.totalPerSale})
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-sm text-neutral-600">Total Price</span>
                            <span className="text-sm font-medium text-neutral-900 flex items-center gap-1.5">
                              {auction.initialAmount ? formatPrice((BigInt(auction.initialAmount) * BigInt(purchaseQuantity)).toString()) : '—'} 
                              {auction.initialAmount && (
                                <>
                                  <TokenImage tokenAddress={auction.erc20} size={16} />
                                  <span>{paymentSymbol}</span>
                                </>
                              )}
                            </span>
                          </div>
                        </>
                      )}
                      {!userBalance.isLoading && (
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-neutral-200">
                          <span className="text-xs text-neutral-500">Your balance</span>
                          <span className="text-xs text-neutral-500">
                            {userBalance.formatted} {paymentSymbol}
                          </span>
                        </div>
                      )}
                    </div>
                    {!isPaymentETH && auction.erc20 && address && (() => {
                      const price = auction.currentPrice || auction.initialAmount;
                      const totalPrice = BigInt(price) * BigInt(purchaseQuantity);
                      const currentAllowance = erc20Allowance as bigint | undefined;
                      const needsApproval = !currentAllowance || currentAllowance < totalPrice;
                      
                      if (needsApproval && !isApproving && !isConfirmingApprove) {
                        return (
                          <p className="text-xs text-yellow-400 mb-2">
                            You need to approve {paymentSymbol} spending first. Click "Buy Now" to approve.
                          </p>
                        );
                      }
                      return null;
                    })()}
                    <button
                      onClick={handlePurchase}
                      disabled={isPurchasing || isConfirmingPurchase || isApproving || isConfirmingApprove || pendingPurchaseAfterApproval}
                      className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={
                        isApproving || isConfirmingApprove
                          ? "Approving token spending"
                          : pendingPurchaseAfterApproval
                          ? "Completing purchase"
                          : isPurchasing || isConfirmingPurchase
                          ? "Processing purchase"
                          : `Buy now for ${formatPrice(auction.initialAmount)} ${paymentSymbol}${auction.tokenSpec === "ERC1155" ? ` (${purchaseQuantity} purchase${purchaseQuantity !== 1 ? 's' : ''})` : ''}`
                      }
                      aria-busy={isPurchasing || isConfirmingPurchase || isApproving || isConfirmingApprove || pendingPurchaseAfterApproval}
                    >
                      {isApproving || isConfirmingApprove
                        ? "Approving..."
                        : pendingPurchaseAfterApproval
                        ? "Completing purchase..."
                        : isPurchasing || isConfirmingPurchase
                        ? "Processing..."
                        : "Buy Now"}
                    </button>
                    {approveError && (
                      <p className="text-xs text-red-400">
                        {approveError.message || "Failed to approve token"}
                      </p>
                    )}
                    {purchaseError && (
                      <p className="text-xs text-red-400">
                        {purchaseError.message || "Failed to purchase"}
                      </p>
                    )}
                  </>
                  );
                })()}
                </div>
              );
            })()}

            {auction.listingType === "OFFERS_ONLY" && showControls && (
              <div className="mb-4 space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                {!isConnected ? (
                  <p className="text-xs text-neutral-600">
                    Please connect your wallet to make an offer.
                  </p>
                ) : !auctionHasStarted ? (
                  <div className="space-y-3">
                    <input
                      type="number"
                      step="0.001"
                      value={offerAmount}
                      onChange={(e) => setOfferAmount(e.target.value)}
                      disabled
                      className="w-full px-3 py-2 bg-white border border-neutral-200 shadow-sm text-neutral-900 text-sm rounded-lg opacity-50 cursor-not-allowed placeholder:text-neutral-500"
                      placeholder={`Min: ${formatPrice(auction.initialAmount)} ${paymentSymbol}`}
                    />
                    <button
                      onClick={handleMakeOffer}
                      disabled
                      className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] opacity-50 cursor-not-allowed"
                    >
                      Make Offer
                    </button>
                    <p className="text-xs text-neutral-600">
                      {startTime === 0 
                        ? "Listing will start when the first offer is made."
                        : `Listing starts ${new Date(startTime * 1000).toLocaleString()}.`}
                    </p>
                  </div>
                ) : isOwnAuction ? (
                  <p className="text-xs text-neutral-600">
                    You cannot make an offer on your own listing.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="offer-amount-input" className="sr-only">
                        Offer amount in {paymentSymbol}
                      </label>
                      <input
                        id="offer-amount-input"
                        type="number"
                        step="0.001"
                        value={offerAmount}
                        onChange={(e) => setOfferAmount(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-neutral-200 shadow-sm text-neutral-900 text-sm rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-neutral-400 placeholder:text-neutral-500"
                        placeholder={`Enter offer in ${paymentSymbol}`}
                        aria-label={`Offer amount in ${paymentSymbol}`}
                        aria-describedby="offer-balance-info"
                      />
                      {!userBalance.isLoading && (
                        <p id="offer-balance-info" className="text-xs text-neutral-500 mt-1" aria-live="polite">
                          Your balance: {userBalance.formatted} {paymentSymbol}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleMakeOffer}
                      disabled={isOffering || isConfirmingOffer || !offerAmount}
                      className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={offerAmount ? `Make offer of ${offerAmount} ${paymentSymbol}` : "Enter offer amount to make an offer"}
                      aria-busy={isOffering || isConfirmingOffer}
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

                {activeOffers.length > 0 && (
                  <div className="mt-4 p-4 bg-white border border-neutral-200 shadow-sm rounded-lg" role="region" aria-label="Active offers">
                    <h3 className="text-sm font-medium text-neutral-900 mb-3">Active Offers</h3>
                    <ul className="space-y-2" role="list" aria-label={`${activeOffers.length} active offer${activeOffers.length !== 1 ? 's' : ''}`}>
                      {activeOffers.map((offer, index) => (
                        <li
                          key={index}
                          className="flex justify-between items-center p-2 rounded border border-neutral-200 bg-neutral-100"
                          role="listitem"
                        >
                          <div>
                            <p className="text-sm text-neutral-900 font-medium">
                              <span className="flex items-center gap-1.5">
                                {formatPrice(offer.amount)} 
                                <TokenImage tokenAddress={auction.erc20} size={14} />
                                <span>{paymentSymbol}</span>
                              </span>
                            </p>
                            <p className="text-xs text-neutral-500 font-mono">
                              {offer.offerer.slice(0, 6)}...{offer.offerer.slice(-4)}
                            </p>
                          </div>
                          {isOwnAuction && (
                            <button
                              onClick={() => handleAcceptOffer(offer.offerer, offer.amount)}
                              disabled={isAccepting || isConfirmingAccept}
                              className="px-3 py-1 bg-white text-black text-xs font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label={`Accept offer of ${formatPrice(offer.amount)} ${paymentSymbol} from ${offer.offerer.slice(0, 6)}...${offer.offerer.slice(-4)}`}
                              aria-busy={isAccepting || isConfirmingAccept}
                            >
                              {isAccepting || isConfirmingAccept
                                ? "Processing..."
                                : "Accept"}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
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

        {!isCancelled && (
          <div className="listing-light-surface mb-4 space-y-4 rounded-2xl border border-neutral-200 bg-white px-5 py-5 shadow-sm">
            {auction.listingType === "INDIVIDUAL_AUCTION" && (() => {
              const timeStatusEndTime = (startTime === 0 && auctionHasStarted && actualEndTime > 0) 
                ? actualEndTime 
                : endTime;
              const timeStatus = getAuctionTimeStatus(startTime, timeStatusEndTime, hasBid, now);
              return (
                <>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                    <span className="flex items-center gap-1.5">
                      {formatPrice(auction.initialAmount)} 
                      <TokenImage tokenAddress={auction.erc20} size={14} />
                      <span>{paymentSymbol} reserve</span>
                    </span>
                    <span className="text-neutral-400">•</span>
                    <span className="flex items-center gap-1.5">
                      {auction.highestBid ? (
                        <>
                          {formatPrice(currentPrice)} 
                          <TokenImage tokenAddress={auction.erc20} size={14} />
                          <span>{paymentSymbol} high</span>
                        </>
                      ) : (
                        "No bids"
                      )}
                    </span>
                    <span className="text-neutral-400">•</span>
                    <span>{bidCount} bid{bidCount !== 1 ? "s" : ""}</span>
                    <span className="text-neutral-400">•</span>
                    <span>{timeStatus.status === "Not started" ? "Not started" : isEnded ? "Ended" : isActive ? "Active" : "Ended"}</span>
                    {!timeStatus.neverExpires && timeStatus.timeRemaining && !isEnded && (
                      <>
                        <span className="text-neutral-400">•</span>
                        <span>{timeStatus.timeRemaining}</span>
                      </>
                    )}
                  </div>
                  
                  <div className="text-xs text-neutral-500">
                    Listed by{" "}
                    {sellerName ? (
                      sellerUsername ? (
                        <TransitionLink href={`/user/${sellerUsername}`} className="text-neutral-900 hover:underline">
                          {sellerName}
                        </TransitionLink>
                      ) : auction.seller ? (
                        <TransitionLink href={`/user/${auction.seller}`} className="text-neutral-900 hover:underline">
                          {sellerName}
                        </TransitionLink>
                      ) : (
                        <span className="text-neutral-900">{sellerName}</span>
                      )
                    ) : auction.seller ? (
                      <TransitionLink href={sellerUsername ? `/user/${sellerUsername}` : `/user/${auction.seller}`} className="font-mono text-neutral-900 hover:underline">
                        {auction.seller.slice(0, 6)}...{auction.seller.slice(-4)}
                      </TransitionLink>
                    ) : null}
                  </div>

                  {auction.bids && auction.bids.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wider">Bid History</h3>
                      <div className="space-y-1">
                        {auction.bids.map((bid, index) => (
                          <BidHistoryRow
                            key={bid.id}
                            bid={bid}
                            isHighest={index === 0}
                            paymentSymbol={paymentSymbol}
                            formatPrice={formatPrice}
                            tokenAddress={auction.erc20}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {auction.listingType === "FIXED_PRICE" && (() => {
              let actualEndTimeForFixed: number;
              const YEAR_2000_TIMESTAMP = 946684800;
              
              if (startTime === 0) {
                if (endTime > YEAR_2000_TIMESTAMP) {
                  actualEndTimeForFixed = endTime;
                } else {
                  actualEndTimeForFixed = 0;
                }
              } else {
                actualEndTimeForFixed = endTime;
              }
              
              const timeStatus = getFixedPriceTimeStatus(actualEndTimeForFixed, now);
              const totalAvailable = parseInt(auction.totalAvailable || "0");
              const totalSold = parseInt(auction.totalSold || "0");
              const remaining = Math.max(0, totalAvailable - totalSold);
              const isSoldOut = remaining === 0 && totalAvailable > 0;
              const isEnded = actualEndTimeForFixed > 0 && actualEndTimeForFixed <= now && !isNeverExpiring(actualEndTimeForFixed);
              const isFinalized = auction.status === "FINALIZED";
              const totalSupply = auction.erc1155TotalSupply ? parseInt(auction.erc1155TotalSupply) : null;
              
              let statusText = "Active";
              if (isSoldOut) {
                statusText = "Sold Out";
              } else if (isFinalized) {
                statusText = "Finalized";
              } else if (isEnded) {
                statusText = "Sale Ended";
              }
              
              return (
                <>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                    <span className="flex items-center gap-1.5">
                      {formatPrice(auction.initialAmount)} 
                      <TokenImage tokenAddress={auction.erc20} size={16} />
                      <span>{paymentSymbol}</span>
                    </span>
                    {auction.tokenSpec === "ERC1155" && (
                      <>
                        <span className="text-neutral-400">•</span>
                        <span>
                          {remaining} left out of {totalAvailable}
                          {totalSupply !== null && totalSupply !== totalAvailable && (
                            <span className="text-neutral-500"> ({totalSupply} in total)</span>
                          )}
                        </span>
                      </>
                    )}
                    <span className="text-neutral-400">•</span>
                    <span>{statusText}</span>
                    {!timeStatus.neverExpires && timeStatus.timeRemaining && !isSoldOut && !isEnded && (
                      <>
                        <span className="text-neutral-400">•</span>
                        <span>{timeStatus.timeRemaining}</span>
                      </>
                    )}
                  </div>
                  
                  <div className="text-xs text-neutral-500">
                    Listed by{" "}
                    {sellerName ? (
                      sellerUsername ? (
                        <TransitionLink href={`/user/${sellerUsername}`} className="text-neutral-900 hover:underline">
                          {sellerName}
                        </TransitionLink>
                      ) : auction.seller ? (
                        <TransitionLink href={`/user/${auction.seller}`} className="text-neutral-900 hover:underline">
                          {sellerName}
                        </TransitionLink>
                      ) : (
                        <span className="text-neutral-900">{sellerName}</span>
                      )
                    ) : auction.seller ? (
                      <TransitionLink href={sellerUsername ? `/user/${sellerUsername}` : `/user/${auction.seller}`} className="font-mono text-neutral-900 hover:underline">
                        {auction.seller.slice(0, 6)}...{auction.seller.slice(-4)}
                      </TransitionLink>
                    ) : null}
                  </div>

                  <BuyersList listingId={listingId} />
                </>
              );
            })()}

            {auction.listingType === "OFFERS_ONLY" && (() => {
              let actualEndTimeForOffers: number;
              const YEAR_2000_TIMESTAMP = 946684800;
              
              if (startTime === 0) {
                if (endTime > YEAR_2000_TIMESTAMP) {
                  actualEndTimeForOffers = endTime;
                } else {
                  actualEndTimeForOffers = 0;
                }
              } else {
                actualEndTimeForOffers = endTime;
              }
              
              const timeStatus = getFixedPriceTimeStatus(actualEndTimeForOffers, now);
              const isEndedForOffers = actualEndTimeForOffers > 0 && actualEndTimeForOffers <= now && !isNeverExpiring(actualEndTimeForOffers);
              
              const totalAvailable = parseInt(auction.totalAvailable || "0");
              const totalSold = parseInt(auction.totalSold || "0");
              const remaining = Math.max(0, totalAvailable - totalSold);
              const isSoldOut = remaining === 0 && totalAvailable > 0;
              const isFinalized = auction.status === "FINALIZED";
              const totalSupply = auction.erc1155TotalSupply ? parseInt(auction.erc1155TotalSupply) : null;
              
              let statusText = "Active";
              if (isSoldOut) {
                statusText = "Sold Out";
              } else if (isFinalized) {
                statusText = "Finalized";
              } else if (isEndedForOffers) {
                statusText = "Sale Ended";
              }
              
              return (
                <>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                    <span>Offers Only</span>
                    {auction.tokenSpec === "ERC1155" && (
                      <>
                        <span className="text-neutral-400">•</span>
                        <span>
                          {remaining} left out of {totalAvailable}
                          {totalSupply !== null && totalSupply !== totalAvailable && (
                            <span className="text-neutral-500"> ({totalSupply} in total)</span>
                          )}
                        </span>
                      </>
                    )}
                    <span className="text-neutral-400">•</span>
                    <span>{statusText}</span>
                    {!timeStatus.neverExpires && timeStatus.timeRemaining && !isSoldOut && !isEndedForOffers && (
                      <>
                        <span className="text-neutral-400">•</span>
                        <span>{timeStatus.timeRemaining}</span>
                      </>
                    )}
                  </div>
                  
                  <div className="text-xs text-neutral-500">
                    Listed by{" "}
                    {sellerName ? (
                      sellerUsername ? (
                        <TransitionLink href={`/user/${sellerUsername}`} className="text-neutral-900 hover:underline">
                          {sellerName}
                        </TransitionLink>
                      ) : auction.seller ? (
                        <TransitionLink href={`/user/${auction.seller}`} className="text-neutral-900 hover:underline">
                          {sellerName}
                        </TransitionLink>
                      ) : (
                        <span className="text-neutral-900">{sellerName}</span>
                      )
                    ) : auction.seller ? (
                      <TransitionLink href={sellerUsername ? `/user/${sellerUsername}` : `/user/${auction.seller}`} className="font-mono text-neutral-900 hover:underline">
                        {auction.seller.slice(0, 6)}...{auction.seller.slice(-4)}
                      </TransitionLink>
                    ) : null}
                  </div>
                </>
              );
            })()}

            {auction.listingType === "DYNAMIC_PRICE" && (() => {
              let actualEndTimeForDynamic: number;
              const YEAR_2000_TIMESTAMP = 946684800;
              
              if (startTime === 0) {
                if (endTime > YEAR_2000_TIMESTAMP) {
                  actualEndTimeForDynamic = endTime;
                } else {
                  actualEndTimeForDynamic = 0;
                }
              } else {
                actualEndTimeForDynamic = endTime;
              }
              
              const timeStatus = getFixedPriceTimeStatus(actualEndTimeForDynamic, now);
              const isEndedForDynamic = actualEndTimeForDynamic > 0 && actualEndTimeForDynamic <= now && !isNeverExpiring(actualEndTimeForDynamic);
              
              const totalAvailable = parseInt(auction.totalAvailable || "0");
              const totalSold = parseInt(auction.totalSold || "0");
              const remaining = Math.max(0, totalAvailable - totalSold);
              const isSoldOut = remaining === 0 && totalAvailable > 0;
              const isFinalized = auction.status === "FINALIZED";
              const totalSupply = auction.erc1155TotalSupply ? parseInt(auction.erc1155TotalSupply) : null;
              
              let statusText = "Active";
              if (isSoldOut) {
                statusText = "Sold Out";
              } else if (isFinalized) {
                statusText = "Finalized";
              } else if (isEndedForDynamic) {
                statusText = "Sale Ended";
              }
              
              return (
                <>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                    <span>Dynamic Price</span>
                    {auction.tokenSpec === "ERC1155" && (
                      <>
                        <span className="text-neutral-400">•</span>
                        <span>
                          {remaining} left out of {totalAvailable}
                          {totalSupply !== null && totalSupply !== totalAvailable && (
                            <span className="text-neutral-500"> ({totalSupply} in total)</span>
                          )}
                        </span>
                      </>
                    )}
                    <span className="text-neutral-400">•</span>
                    <span>{statusText}</span>
                    {!timeStatus.neverExpires && timeStatus.timeRemaining && !isSoldOut && !isEndedForDynamic && (
                      <>
                        <span className="text-neutral-400">•</span>
                        <span>{timeStatus.timeRemaining}</span>
                      </>
                    )}
                  </div>
                  
                  <div className="text-xs text-neutral-500">
                    Listed by{" "}
                    {sellerName ? (
                      sellerUsername ? (
                        <TransitionLink href={`/user/${sellerUsername}`} className="text-neutral-900 hover:underline">
                          {sellerName}
                        </TransitionLink>
                      ) : auction.seller ? (
                        <TransitionLink href={`/user/${auction.seller}`} className="text-neutral-900 hover:underline">
                          {sellerName}
                        </TransitionLink>
                      ) : (
                        <span className="text-neutral-900">{sellerName}</span>
                      )
                    ) : auction.seller ? (
                      <TransitionLink href={sellerUsername ? `/user/${sellerUsername}` : `/user/${auction.seller}`} className="font-mono text-neutral-900 hover:underline">
                        {auction.seller.slice(0, 6)}...{auction.seller.slice(-4)}
                      </TransitionLink>
                    ) : null}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {!isCancelled && !isPaymentETH && !isOwnAuction && isConnected && (
          <div className="mb-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            {isMiniApp ? (
              <button
                type="button"
                onClick={handleSwapBuyToken}
                disabled={!isSDKLoaded}
                className="block w-full px-4 py-2 bg-white text-neutral-900 text-sm font-medium tracking-[0.5px] transition-colors hover:bg-neutral-100 text-center disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label={`Swap for ${paymentSymbol}`}
              >
                Swap for {paymentSymbol}
              </button>
            ) : (
              <a
                href={`https://app.uniswap.org/swap?outputCurrency=${auction.erc20}&chain=base`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-4 py-2 bg-white text-neutral-900 text-sm font-medium tracking-[0.5px] transition-colors hover:bg-neutral-100 text-center"
                aria-label={`Buy ${paymentSymbol} on Uniswap`}
              >
                Buy {paymentSymbol}
              </a>
            )}
          </div>
        )}
      </div>
      
      <ChainSwitchPrompt
        show={showChainSwitchPrompt}
        onDismiss={() => setShowChainSwitchPrompt(false)}
        requiredChainId={marketplaceReadChainId}
        targetNetworkLabel={isExplicitEthereumListing ? "Ethereum" : "Base"}
      />
    </div>
  );
}

function BidHistoryRow({
  bid,
  isHighest,
  paymentSymbol,
  formatPrice,
  tokenAddress,
}: {
  bid: { id: string; bidder: string; amount: string; timestamp: string };
  isHighest: boolean;
  paymentSymbol: string;
  formatPrice: (amount: string) => string;
  tokenAddress: string | undefined;
}) {
  const { artistName } = useArtistName(bid.bidder, undefined, undefined);
  const { username } = useUsername(bid.bidder);
  const bidDate = new Date(parseInt(bid.timestamp) * 1000);
  const timeAgo = getTimeAgo(bidDate);

  return (
    <div className="flex items-center justify-between py-1.5 text-xs border-b border-neutral-200">
      <div className="flex items-center gap-2">
        {isHighest && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-medium">HIGH</span>
        )}
        <span className="text-neutral-900 font-medium">
          <span className="flex items-center gap-1.5">
            {formatPrice(bid.amount)} 
            <TokenImage tokenAddress={tokenAddress} size={14} />
            <span>{paymentSymbol}</span>
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2 text-neutral-500">
        {username ? (
          <TransitionLink href={`/user/${username}`} className="hover:text-neutral-900 hover:underline">
            {artistName || username}
          </TransitionLink>
        ) : (
          <TransitionLink href={`/user/${bid.bidder}`} className="font-mono hover:text-neutral-900 hover:underline">
            {bid.bidder.slice(0, 6)}...{bid.bidder.slice(-4)}
          </TransitionLink>
        )}
        <span className="text-neutral-400">•</span>
        <span>{timeAgo}</span>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHr > 0) return `${diffHr}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return "just now";
}
