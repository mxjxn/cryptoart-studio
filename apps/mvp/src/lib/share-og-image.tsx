import { ImageResponse } from "next/og";
import type { EnrichedAuctionData } from "~/lib/types";
import { prepareAuctionOGImageData } from "./og-image-generator";
import { formatPriceForShare } from "./share-moments";
import { getERC20TokenInfoServer } from "./server/erc20-token";
import { lookupNeynarByAddress } from "./artist-name-resolution";
import type { ShareMomentType } from "./share-moments";

interface ShareOGImageOptions {
  momentType: ShareMomentType;
  auction: EnrichedAuctionData;
  bidAmount?: string;
  salePrice?: string;
  currentBid?: string;
  topBidAmount?: string;
  topBidderAddress?: string;
}

/**
 * Generate OG image for share moments
 */
export async function generateShareOGImage(
  options: ShareOGImageOptions
): Promise<ImageResponse> {
  const { momentType, auction, bidAmount, salePrice, currentBid, topBidAmount, topBidderAddress } = options;

  // Prepare base auction data
  const ogData = await prepareAuctionOGImageData(auction);
  const tokenInfo = await getERC20TokenInfoServer(auction.erc20);

  // Look up top bidder name if needed
  let topBidderName: string | null = null;
  if ((momentType === "top-bid" || momentType === "being-outbid") && topBidderAddress) {
    try {
      const neynarResult = await lookupNeynarByAddress(topBidderAddress);
      topBidderName = neynarResult?.name || null;
    } catch (error) {
      console.error("Error looking up top bidder name:", error);
    }
  }

  // Determine what to display based on moment type
  let badge: string | null = null;
  let priceLabel: string | null = ogData.priceLabel;
  let price: string | null = ogData.price;
  let priceSymbol = ogData.priceSymbol;

  switch (momentType) {
    case "auction-created":
      priceLabel = "Reserve";
      price = formatPriceForShare(
        auction.initialAmount || "0",
        tokenInfo.decimals
      );
      break;

    case "bid-placed":
      if (bidAmount) {
        price = formatPriceForShare(bidAmount, tokenInfo.decimals);
        priceLabel = "Your Bid";
      } else {
        price = ogData.price;
        priceLabel = "Current Bid";
      }
      break;

    case "auction-won":
      badge = "COLLECTED";
      if (salePrice) {
        price = formatPriceForShare(salePrice, tokenInfo.decimals);
        priceLabel = "Sale Price";
      } else if (auction.highestBid?.amount) {
        price = formatPriceForShare(
          auction.highestBid.amount,
          tokenInfo.decimals
        );
        priceLabel = "Sale Price";
      }
      break;

    case "outbid":
      badge = "BID WAR";
      if (currentBid) {
        price = formatPriceForShare(currentBid, tokenInfo.decimals);
      } else {
        price = ogData.price;
      }
      priceLabel = "Current Bid";
      break;

    case "referral":
      // No price for referral shares
      priceLabel = null;
      price = null;
      break;

    case "top-bid":
      badge = "TOP BID";
      if (topBidAmount) {
        price = formatPriceForShare(topBidAmount, tokenInfo.decimals);
      } else if (auction.highestBid?.amount) {
        price = formatPriceForShare(auction.highestBid.amount, tokenInfo.decimals);
      } else {
        price = ogData.price;
      }
      priceLabel = "Winning Bid";
      break;

    case "being-outbid":
      badge = "OUTBID";
      if (topBidAmount) {
        price = formatPriceForShare(topBidAmount, tokenInfo.decimals);
      } else if (auction.highestBid?.amount) {
        price = formatPriceForShare(auction.highestBid.amount, tokenInfo.decimals);
      } else {
        price = ogData.price;
      }
      priceLabel = "Current Bid";
      break;
  }

  // Render the OG image
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "black",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Artwork Image - Left side (60%) */}
        {ogData.imageUrl && (
          <div
            style={{
              width: "60%",
              height: "100%",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#0a0a0a",
            }}
          >
            <img
              src={ogData.imageUrl}
              alt={ogData.title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            {/* Badge overlay */}
            {badge && (
              <div
                style={{
                  position: "absolute",
                  top: "40px",
                  right: "40px",
                  background: "rgba(0, 0, 0, 0.8)",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  border: "2px solid white",
                  fontSize: "32px",
                  fontWeight: "bold",
                  color: "white",
                  fontFamily: "system-ui",
                }}
              >
                {badge}
              </div>
            )}
          </div>
        )}

        {/* Info Panel - Right side (40%) */}
        <div
          style={{
            width: ogData.imageUrl ? "40%" : "100%",
            height: "100%",
            padding: "80px 60px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background: "linear-gradient(to bottom, #000000, #1a1a1a)",
          }}
        >
          {/* Title */}
          <div
            style={{
              fontSize: "56px",
              fontWeight: "bold",
              lineHeight: "1.2",
              marginBottom: "30px",
              color: "white",
            }}
          >
            {ogData.title}
          </div>

          {/* Artist Name */}
          {ogData.artistName && (
            <div
              style={{
                fontSize: "36px",
                color: "rgba(255, 255, 255, 0.9)",
                marginBottom: "40px",
              }}
            >
              by {ogData.artistName}
            </div>
          )}

          {/* Price (if applicable) */}
          {priceLabel && price && (
            <div
              style={{
                fontSize: "42px",
                fontWeight: "600",
                marginBottom: "30px",
                color: "white",
              }}
            >
              {priceLabel}: {price} {priceSymbol}
            </div>
          )}

          {/* Time remaining (for active auctions) */}
          {momentType !== "auction-won" && momentType !== "referral" && (
            <div
              style={{
                fontSize: "28px",
                color: "rgba(255, 255, 255, 0.85)",
                marginBottom: "40px",
              }}
            >
              {ogData.timeText}
            </div>
          )}

          {/* Top bidder info for top-bid and being-outbid */}
          {(momentType === "top-bid" || momentType === "being-outbid") && topBidderAddress && (
            <div
              style={{
                fontSize: "32px",
                color: "rgba(255, 255, 255, 0.9)",
                marginBottom: "20px",
              }}
            >
              {momentType === "top-bid" ? "Winning bidder: " : "Outbid by: "}
              {topBidderName || `${topBidderAddress.slice(0, 6)}...${topBidderAddress.slice(-4)}`}
            </div>
          )}

          {/* Branding */}
          <div
            style={{
              fontSize: "24px",
              color: "rgba(255, 255, 255, 0.6)",
              marginTop: "auto",
            }}
          >
            cryptoart.social
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      },
    }
  );
}

