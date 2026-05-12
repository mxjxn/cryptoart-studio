import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getAuctionServer } from "~/lib/server/auction";
import { getArtistNameServer } from "~/lib/server/artist-name";
import { getContractNameServer } from "~/lib/server/contract-name";
import { isAmbiguousListingError } from "~/lib/auction-errors";
import { CHAIN_ID } from "~/lib/contracts/marketplace";
import { getOgErc20TokenInfo } from "~/lib/server/og-chain-clients";
import { getOgSelfOrigin } from "~/lib/server/og-self-origin";
import { zeroAddress } from "viem";
import type { EnrichedAuctionData } from "~/lib/types";

export const dynamic = 'force-dynamic';

function isETH(tokenAddress: string | undefined | null): boolean {
  if (!tokenAddress) return true;
  return tokenAddress.toLowerCase() === zeroAddress.toLowerCase();
}

/**
 * Format price with proper decimals
 */
function formatPrice(amount: string, decimals: number = 18): string {
  const value = BigInt(amount || "0");
  const divisor = BigInt(10 ** decimals);
  const wholePart = value / divisor;
  const fractionalPart = value % divisor;

  if (fractionalPart === BigInt(0)) {
    return wholePart.toString();
  }

  let fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  fractionalStr = fractionalStr.replace(/0+$/, "");
  if (fractionalStr.length > 6) {
    fractionalStr = fractionalStr.slice(0, 6);
  }

  return `${wholePart}.${fractionalStr}`;
}

/**
 * Truncate address to 0x1234...5678 format
 */
function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Helper to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const { listingId } = await params;
    const url = new URL(request.url);
    const chainIdParam = url.searchParams.get("chainId");
    const ogChainId =
      chainIdParam != null && chainIdParam.trim() !== ""
        ? (() => {
            const v = parseInt(chainIdParam, 10);
            return Number.isNaN(v) ? undefined : v;
          })()
        : undefined;
    const baseUrl = getOgSelfOrigin(request);
    const fontUrl = `${baseUrl}/MEK-Mono.otf`;
    
    // Load font from URL (edge runtime compatible)
    let fontData: ArrayBuffer;
    try {
      const fontResponse = await fetch(fontUrl);
      if (!fontResponse.ok) {
        throw new Error(`Failed to fetch font: ${fontResponse.statusText}`);
      }
      fontData = await fontResponse.arrayBuffer();
    } catch (error) {
      console.error(`[OG Image] Error loading font:`, error);
      // Return a simple error image if font can't be loaded
      return new ImageResponse(
        (
          <div
            style={{
              background: 'linear-gradient(to bottom right, #000000, #333333)',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '80px',
              color: 'white',
            }}
          >
            <div style={{ fontSize: 64, fontWeight: 'bold' }}>
              cryptoart.social
            </div>
            <div style={{ fontSize: 32, marginTop: '24px' }}>
              Listing #{listingId}
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 800,
        }
      );
    }

  // Fetch listing data with timeout to prevent hanging
  let auction: EnrichedAuctionData | null = null;
  let artistName: string | null = null;
  let contractName: string | null = null;
  let tokenSymbol = "ETH";
  let tokenDecimals = 18;

  try {
    try {
      auction = await withTimeout(
        getAuctionServer(listingId, { chainId: ogChainId }),
        10000,
        null
      );
    } catch (fetchErr) {
      if (isAmbiguousListingError(fetchErr)) {
        const ambiguousOptions: {
          width: number;
          height: number;
          fonts?: Array<{ name: string; data: ArrayBuffer; style: "normal" | "italic" }>;
          headers: Record<string, string>;
        } = {
          width: 1200,
          height: 800,
          headers: {
            "Cache-Control": "public, max-age=300, s-maxage=600",
          },
        };
        if (fontData) {
          ambiguousOptions.fonts = [
            { name: "MEK-Mono", data: fontData, style: "normal" as const },
          ];
        }
        return new ImageResponse(
          (
            <div
              style={{
                background: "linear-gradient(to bottom right, #000000, #333333)",
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                padding: "80px",
                color: "white",
                fontFamily: fontData ? "MEK-Mono" : "system-ui",
              }}
            >
              <div style={{ fontSize: 52, fontWeight: "bold", textAlign: "center" }}>
                Listing #{listingId}
              </div>
              <div
                style={{
                  fontSize: 28,
                  marginTop: "28px",
                  opacity: 0.85,
                  textAlign: "center",
                  maxWidth: "900px",
                }}
              >
                This listing exists on Base and Ethereum — open the app or use a chain-specific
                link to preview.
              </div>
            </div>
          ),
          ambiguousOptions
        );
      }
      console.error(`[OG Image] Auction fetch error:`, fetchErr);
      auction = null;
    }

    if (!auction) {
      // Return default image if listing not found
      return new ImageResponse(
        (
          <div
            style={{
              background: 'linear-gradient(to bottom right, #000000, #333333)',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '80px',
              color: 'white',
              fontFamily: 'MEK-Mono',
            }}
          >
            <div
              style={{
                fontSize: 64,
                fontWeight: 'bold',
                marginBottom: '24px',
              }}
            >
              Listing Not Found
            </div>
            <div
              style={{
                fontSize: 32,
                opacity: 0.7,
              }}
            >
              Listing #{listingId}
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 800,
          fonts: [
            {
              name: 'MEK-Mono',
              data: fontData,
              style: 'normal',
            },
          ],
          headers: {
            'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate',
          },
        }
      );
    }

    if (auction) {
      const parsedListingChain =
        typeof auction.chainId === "number"
          ? auction.chainId
          : parseInt(String(auction.chainId ?? ""), 10);
      const listingChainForRpc =
        ogChainId ?? (Number.isFinite(parsedListingChain) ? parsedListingChain : CHAIN_ID);

      // Fetch artist name and contract name in parallel with timeouts
      // Priority: metadata artist > contract creator name
      const [artistResult, contractNameResult] = await Promise.all([
        // Only fetch contract creator if metadata doesn't have artist
        !auction.artist && auction.tokenAddress && auction.tokenId
          ? withTimeout(
              getArtistNameServer(auction.tokenAddress, auction.tokenId, {
                chainId: listingChainForRpc,
              }),
              3000,
              { name: null, source: null }
            )
          : Promise.resolve({ name: null, source: null }),
        auction.tokenAddress
          ? withTimeout(
              getContractNameServer(auction.tokenAddress, {
                chainId: listingChainForRpc,
              }),
              3000,
              null
            )
          : Promise.resolve(null),
      ]);

      // Use metadata artist first, then fallback to contract creator
      artistName = auction.artist || artistResult.name;
      contractName = contractNameResult;

      // Fetch ERC20 token info if applicable (with timeout)
      if (auction.erc20 && !isETH(auction.erc20)) {
        const tokenInfo = await withTimeout(
          getOgErc20TokenInfo(auction.erc20, listingChainForRpc),
          3000,
          null
        );
        if (tokenInfo) {
          tokenSymbol = tokenInfo.symbol;
          tokenDecimals = tokenInfo.decimals;
        }
      }
    }
  } catch (error) {
    console.error(`[OG Image] Error fetching listing data:`, error);
    // Continue with partial data - we'll render what we have
  }

  // Prepare display data
  const title = auction?.title || auction?.metadata?.title || (auction?.tokenId ? `Token #${auction.tokenId}` : "Untitled");
  const collectionName = contractName || (auction?.tokenAddress ? truncateAddress(auction.tokenAddress) : null);
  
  // Format artist display
  let artistDisplay = "—";
  if (artistName) {
    artistDisplay = artistName.startsWith("@") ? artistName : `@${artistName}`;
  } else if (auction?.tokenAddress) {
    // Try to get creator address from auction data if available
    artistDisplay = truncateAddress(auction.tokenAddress);
  }

  // Determine listing type specific information
  const listingType = auction?.listingType || "INDIVIDUAL_AUCTION";
  const endTime = auction?.endTime ? parseInt(auction.endTime) : 0;
  const now = Math.floor(Date.now() / 1000);
  const isActive = endTime > now && auction?.status === "ACTIVE";

  // Build listing details based on type
  let listingDetails: Array<{ label: string; value: string }> = [];

  if (listingType === "INDIVIDUAL_AUCTION") {
    const reservePrice = auction?.initialAmount ? formatPrice(auction.initialAmount, tokenDecimals) : "0";
    const currentBid = auction?.highestBid?.amount
      ? formatPrice(auction.highestBid.amount, tokenDecimals)
      : null;
    const bidCount = auction?.bidCount || 0;

    listingDetails = [
      { label: "Reserve", value: `${reservePrice} ${tokenSymbol}` },
      {
        label: "Current Bid",
        value: currentBid ? `${currentBid} ${tokenSymbol}` : "No bids",
      },
      { label: "Bids", value: bidCount.toString() },
      { label: "Status", value: isActive ? "Active" : "Ended" },
    ];
  } else if (listingType === "FIXED_PRICE") {
    const price = auction?.initialAmount ? formatPrice(auction.initialAmount, tokenDecimals) : "0";
    const totalAvailable = auction?.totalAvailable ? parseInt(auction.totalAvailable) : 0;
    const totalSold = auction?.totalSold ? parseInt(auction.totalSold) : 0;
    const remaining = Math.max(0, totalAvailable - totalSold);
    const isSoldOut = remaining === 0;

    listingDetails = [
      { label: "Buy Now", value: `${price} ${tokenSymbol}` },
      {
        label: "Available",
        value: auction?.tokenSpec === "ERC1155" ? `${remaining} copies` : "1",
      },
      { label: "Status", value: isSoldOut ? "Sold Out" : isActive ? "Active" : "Ended" },
    ];
  } else if (listingType === "OFFERS_ONLY") {
    listingDetails = [
      { label: "Type", value: "Offers Only" },
      { label: "Status", value: isActive ? "Active" : "Ended" },
    ];
  } else if (listingType === "DYNAMIC_PRICE") {
    listingDetails = [
      { label: "Type", value: "Dynamic Price" },
      { label: "Status", value: isActive ? "Active" : "Ended" },
    ];
  }

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(to bottom right, #000000, #333333)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '100px 80px', // More vertical padding for 3:2 aspect ratio
          color: 'white',
          fontFamily: 'MEK-Mono',
        }}
      >
        {/* Top section: Title, Collection, Artist */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 'bold',
              lineHeight: '1.1',
              letterSpacing: '2px',
              marginBottom: '8px',
            }}
          >
            {title.length > 50 ? `${title.slice(0, 47)}...` : title}
          </div>
          
          {collectionName && (
            <div
              style={{
                fontSize: 32,
                opacity: 0.8,
                letterSpacing: '1px',
              }}
            >
              {collectionName}
            </div>
          )}
          
          <div
            style={{
              fontSize: 28,
              opacity: 0.7,
              letterSpacing: '1px',
            }}
          >
            by {artistDisplay}
          </div>
        </div>

        {/* Bottom section: Listing details */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginTop: 'auto',
          }}
        >
          {listingDetails.map((detail, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 24,
                letterSpacing: '0.5px',
              }}
            >
              <span style={{ opacity: 0.6 }}>{detail.label}:</span>
              <span style={{ fontWeight: 'bold', opacity: 0.9 }}>{detail.value}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 800, // 3:2 aspect ratio required by Farcaster Mini App spec
      fonts: [
        {
          name: 'MEK-Mono',
          data: fontData,
          style: 'normal',
        },
      ],
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate',
      },
    }
  );
  } catch (error) {
    console.error(`[OG Image] Fatal error in auction OG image route:`, error);
    if (error instanceof Error) {
      console.error(`[OG Image] Error stack:`, error.stack);
    }
    // Return a fallback image on any error
    return new ImageResponse(
      (
        <div
          style={{
            background: 'linear-gradient(to bottom right, #000000, #333333)',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '80px',
            color: 'white',
          }}
        >
          <div style={{ fontSize: 64, fontWeight: 'bold' }}>
            cryptoart.social
          </div>
          <div style={{ fontSize: 32, marginTop: '24px' }}>
            Error loading auction
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=300',
        },
      }
    );
  }
}

