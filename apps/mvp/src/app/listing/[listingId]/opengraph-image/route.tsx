import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getAuctionServer } from "~/lib/server/auction";
import { getArtistNameServer } from "~/lib/server/artist-name";
import { getContractNameServer } from "~/lib/server/contract-name";
import { getCachedImage, cacheImage } from "~/lib/server/image-cache";
import { isDataURI } from "~/lib/media-utils";
import { processMediaForImage } from "~/lib/server/media-processor";
import { createPublicClient, http, type Address, isAddress, zeroAddress } from "viem";
import { base } from "viem/chains";
import type { EnrichedAuctionData } from "~/lib/types";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Required for processMediaForImage (uses child_process, fs)

// ERC20 ABI for fetching token info
const ERC20_ABI = [
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
] as const;

function isETH(tokenAddress: string | undefined | null): boolean {
  if (!tokenAddress) return true;
  return tokenAddress.toLowerCase() === zeroAddress.toLowerCase();
}

/**
 * Fetch ERC20 token info server-side
 */
async function getERC20TokenInfo(tokenAddress: string): Promise<{ symbol: string; decimals: number } | null> {
  if (isETH(tokenAddress) || !isAddress(tokenAddress)) {
    return null;
  }

  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(
        process.env.NEXT_PUBLIC_RPC_URL || 
        process.env.RPC_URL || 
        process.env.NEXT_PUBLIC_BASE_RPC_URL || 
        "https://mainnet.base.org"
      ),
    });

    const [symbol, decimals] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: "symbol",
      }),
      publicClient.readContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: "decimals",
      }),
    ]);

    return {
      symbol: symbol as string,
      decimals: decimals as number,
    };
  } catch (error) {
    console.error(`[OG Image] Error fetching ERC20 token info:`, error);
    return null;
  }
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
  let fontData: ArrayBuffer | null = null;
  let listingId: string = '';
  
  // Wrap entire function in try-catch to catch any errors during response streaming
  try {
    // Parse params first
    const resolvedParams = await params;
    listingId = resolvedParams.listingId;
    
    if (!listingId) {
      throw new Error('Missing listingId parameter');
    }
    
    const url = new URL(request.url);
    // Force HTTPS for font URL to avoid SSL errors
    const baseUrl = `https://${url.host}`;
    const fontUrl = `${baseUrl}/MEK-Mono.otf`;
    
    // Load font from URL (edge runtime compatible)
    try {
      const fontResponse = await fetch(fontUrl, {
        // Add timeout and proper headers
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OG-Image-Bot/1.0)',
        },
      });
      if (!fontResponse.ok) {
        throw new Error(`Failed to fetch font: ${fontResponse.statusText}`);
      }
      fontData = await fontResponse.arrayBuffer();
    } catch (error) {
      console.error(`[OG Image] Error loading font:`, error);
      // Continue without font - we'll render without custom font
      fontData = null;
    }

  // Fetch listing data with timeout to prevent hanging
  let auction: EnrichedAuctionData | null = null;
  let artistName: string | null = null;
  let contractName: string | null = null;
  let tokenSymbol = "ETH";
  let tokenDecimals = 18;
  let auctionFetchError: Error | null = null;

  try {
    // Add timeout to auction fetch (10 seconds max - subgraph can be slow)
    // Wrap in try-catch to handle any errors from getAuctionServer
    try {
      auction = await withTimeout(
        getAuctionServer(listingId),
        10000, // Increased to 10 seconds
        null
      );
    } catch (error) {
      // If getAuctionServer throws an error, log it and store the error
      auctionFetchError = error instanceof Error ? error : new Error(String(error));
      console.error(`[OG Image] Error fetching auction ${listingId}:`, auctionFetchError.message);
      auction = null;
    }

    // If there was an error fetching (not just not found), show error image instead of "not found"
    if (auctionFetchError) {
      console.error(`[OG Image] [Listing ${listingId}] Auction fetch error - returning error image`);
      const errorOptions: {
        width: number;
        height: number;
        fonts?: Array<{ name: string; data: ArrayBuffer; style: 'normal' | 'italic' }>;
        headers: { 'Cache-Control': string };
      } = {
        width: 1200,
        height: 800,
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=300', // Shorter cache for errors
        },
      };
      
      // Only add fonts property if we have font data
      if (fontData) {
        errorOptions.fonts = [
          {
            name: 'MEK-Mono',
            data: fontData,
            style: 'normal' as const,
          },
        ];
      }
      
      return new ImageResponse(
        (
          <div
            style={{
              background: 'linear-gradient(to bottom right, #000000, #1a1a1a)',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '80px',
              color: 'white',
              fontFamily: fontData ? 'MEK-Mono' : 'system-ui',
            }}
          >
            <div style={{ display: 'flex', fontSize: 192, fontWeight: 'bold', marginBottom: '72px' }}>
              Error Loading Listing
            </div>
            <div style={{ display: 'flex', fontSize: 96, opacity: 0.7 }}>
              Listing #{listingId}
            </div>
          </div>
        ),
        errorOptions
      );
    }

    if (!auction) {
      console.warn(`[OG Image] [Listing ${listingId}] Auction not found - returning 'Listing Not Found' image`);
      // Return default image if listing not found
      const notFoundOptions: {
        width: number;
        height: number;
        fonts?: Array<{ name: string; data: ArrayBuffer; style: 'normal' | 'italic' }>;
        headers: { 'Cache-Control': string };
      } = {
        width: 1200,
        height: 800,
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate',
        },
      };
      
      // Only add fonts property if we have font data
      if (fontData) {
        notFoundOptions.fonts = [
          {
            name: 'MEK-Mono',
            data: fontData,
            style: 'normal' as const,
          },
        ];
      }
      
      return new ImageResponse(
        (
          <div
            style={{
              background: 'linear-gradient(to bottom right, #000000, #1a1a1a)',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '80px',
              color: 'white',
              fontFamily: fontData ? 'MEK-Mono' : 'system-ui',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 192,
                fontWeight: 'bold',
                marginBottom: '72px',
              }}
            >
              Listing Not Found
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 96,
                opacity: 0.7,
              }}
            >
              Listing #{listingId}
            </div>
          </div>
        ),
        notFoundOptions
      );
    }

    if (auction) {
      // Fetch artist name and contract name in parallel with timeouts
      // Priority: metadata artist > contract creator name
      const [artistResult, contractNameResult] = await Promise.all([
        // Only fetch contract creator if metadata doesn't have artist
        !auction.artist && auction.tokenAddress && auction.tokenId
          ? withTimeout(
              getArtistNameServer(auction.tokenAddress, auction.tokenId),
              3000,
              { name: null, source: null }
            )
          : Promise.resolve({ name: null, source: null }),
        auction.tokenAddress
          ? withTimeout(
              getContractNameServer(auction.tokenAddress),
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
          getERC20TokenInfo(auction.erc20),
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

  // Get artwork image URL and convert to data URL for ImageResponse
  // Prefer thumbnailUrl if available (smaller, more reliable for embeds)
  // Skip image caching for cancelled listings
  let artworkImageDataUrl: string | null = null;
  const imageUrlToUse = auction?.thumbnailUrl || auction?.image || auction?.metadata?.image;
  if (imageUrlToUse && auction?.status !== "CANCELLED") {
    console.log(`[OG Image] [Listing ${listingId}] Using ${auction?.thumbnailUrl ? 'thumbnail' : 'original'} image URL: ${imageUrlToUse.substring(0, 100)}...`);
    
    // Handle data URIs directly - no need to cache or fetch
    if (isDataURI(imageUrlToUse)) {
      artworkImageDataUrl = imageUrlToUse;
      console.log(`[OG Image] [Listing ${listingId}] Using data URI directly (no cache/fetch needed)`);
    } else {
      // Check cache first (normalization happens inside getCachedImage)
      const cached = await getCachedImage(imageUrlToUse);
      if (cached) {
        artworkImageDataUrl = cached;
        console.log(`[OG Image] [Listing ${listingId}] Using cached image`);
      } else {
        console.log(`[OG Image] [Listing ${listingId}] Cache miss, fetching image...`);
        // Not in cache, fetch and cache it
        let imageUrl = imageUrlToUse;
        
        // Convert IPFS URLs to HTTP gateway URLs
        // Note: If the URL is already a gateway URL (from fetchNFTMetadata), use it as-is
        if (imageUrl.startsWith('ipfs://')) {
          const hash = imageUrl.replace('ipfs://', '');
          const gateway = process.env.IPFS_GATEWAY_URL || process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://cloudflare-ipfs.com';
          imageUrl = `${gateway}/ipfs/${hash}`;
        } else if (imageUrl.includes('/ipfs/') && !imageUrl.startsWith('http')) {
          // Only convert if it's not already an HTTP URL
          const hash = imageUrl.split('/ipfs/')[1]?.split('/')[0];
          if (hash) {
            const gateway = process.env.IPFS_GATEWAY_URL || process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://cloudflare-ipfs.com';
            imageUrl = `${gateway}/ipfs/${hash}`;
          }
        }

        // Fetch image and convert to data URL for ImageResponse
        try {
          console.log(`[OG Image] Fetching artwork image from: ${imageUrl}`);
          const gateways = [
            process.env.IPFS_GATEWAY_URL || process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://cloudflare-ipfs.com",
            "https://ipfs.io",
            "https://gateway.pinata.cloud",
          ];
          
          // Check if it's an IPFS URL and try multiple gateways
          // If it's already a full HTTP URL, try it first, then try other gateways
          let urlsToTry = [imageUrl];
          if (imageUrl.includes('/ipfs/')) {
            const ipfsHash = imageUrl.split('/ipfs/')[1]?.split('/')[0];
            if (ipfsHash) {
              // If the original URL is already a gateway URL, try it first
              // Then try other gateways as fallbacks
              const otherGateways = gateways.filter(gw => !imageUrl.startsWith(gw));
              urlsToTry = [imageUrl, ...otherGateways.map(gw => `${gw}/ipfs/${ipfsHash}`)];
            }
          }
          
          let fetchedContentType: string | null = null;
          
          // Maximum media size: 10MB for videos/GIFs, 5MB for images
          const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
          const MAX_MEDIA_SIZE = 10 * 1024 * 1024; // 10MB for videos/GIFs
          
          for (const url of urlsToTry) {
            try {
              const response = await fetch(url, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; OG-Image-Bot/1.0)',
                },
                signal: AbortSignal.timeout(15000), // 15 second timeout for videos/large files
              });
              
              if (!response.ok) {
                console.warn(`[OG Image] Gateway returned ${response.status} ${response.statusText} for ${url}, trying next...`);
                continue;
              }
              
              // Check content-type - accept images and videos (we'll process them)
              const contentType = response.headers.get('content-type') || '';
              if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
                console.warn(`[OG Image] Response is not an image or video (content-type: ${contentType}) for ${url}, trying next gateway...`);
                continue;
              }
              
              // Check Content-Length header before downloading
              const contentLength = response.headers.get('content-length');
              const maxSize = contentType.startsWith('video/') ? MAX_MEDIA_SIZE : MAX_IMAGE_SIZE;
              if (contentLength) {
                const size = parseInt(contentLength, 10);
                if (size > maxSize) {
                  console.warn(`[OG Image] Media too large (${size} bytes > ${maxSize} bytes) for ${url}, skipping...`);
                  continue;
                }
              }
              
              const arrayBuffer = await response.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              
              // Check actual buffer size after download
              if (buffer.length > maxSize) {
                console.warn(`[OG Image] Media too large after download (${buffer.length} bytes > ${maxSize} bytes) for ${url}, skipping...`);
                continue;
              }
              
              // Process media (handles images, videos, and GIFs)
              const processed = await processMediaForImage(buffer, contentType, url);
              if (!processed) {
                console.warn(`[OG Image] Failed to process media for listing ${listingId} from ${url}`);
                continue;
              }
              
              fetchedContentType = 'image/png'; // Processed images are always PNG
              artworkImageDataUrl = processed.dataUrl;
              
              console.log(`[OG Image] Media processed successfully from ${url}, size: ${buffer.length} bytes, original type: ${processed.originalType}, processed type: ${processed.processedType}`);
              
              // Cache the processed image for future use
              try {
                await cacheImage(imageUrlToUse, artworkImageDataUrl, fetchedContentType);
              } catch (cacheError) {
                // Don't fail the request if caching fails
                console.warn(`[OG Image] Failed to cache image (non-fatal):`, cacheError instanceof Error ? cacheError.message : String(cacheError));
              }
              
              break; // Success, exit loop
            } catch (error) {
              console.warn(`[OG Image] Error fetching from ${url}:`, error instanceof Error ? error.message : String(error));
              continue;
            }
          }
          
          if (!artworkImageDataUrl) {
            console.error(`[OG Image] [Listing ${listingId}] All gateways failed for image. Tried: ${urlsToTry.map(u => u.substring(0, 80)).join(', ')}`);
            console.error(`[OG Image] [Listing ${listingId}] Original URL was: ${imageUrlToUse.substring(0, 100)}`);
          } else {
            console.log(`[OG Image] [Listing ${listingId}] Successfully fetched and cached image`);
          }
        } catch (error) {
          console.error(`[OG Image] Error processing artwork image:`, error);
          if (error instanceof Error) {
            console.error(`[OG Image] Error details: ${error.message}`);
            console.error(`[OG Image] Error stack: ${error.stack}`);
          }
        }
      }
    }
  } else {
    console.warn(`[OG Image] [Listing ${listingId}] No image URL found in auction data. auction.image=${auction?.image}, auction.metadata?.image=${auction?.metadata?.image}, auction.thumbnailUrl=${auction?.thumbnailUrl}`);
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

  // Build ImageResponse options - conditionally include fonts only if we have font data
  const imageResponseOptions: {
    width: number;
    height: number;
    fonts?: Array<{ name: string; data: ArrayBuffer; style: 'normal' | 'italic' }>;
    headers: { 'Cache-Control': string };
  } = {
    width: 1200,
    height: 800, // 3:2 aspect ratio required by Farcaster Mini App spec
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate',
    },
  };
  
  // Only add fonts property if we have font data (don't include it at all if no font)
  if (fontData) {
    imageResponseOptions.fonts = [
      {
        name: 'MEK-Mono',
        data: fontData,
        style: 'normal' as const,
      },
    ];
  }

  // Validate artworkImageDataUrl before using it
  // ImageResponse has limits on data URL size - if too large, skip the image
  const MAX_DATA_URL_SIZE = 2 * 1024 * 1024; // 2MB limit for data URLs in ImageResponse
  if (artworkImageDataUrl && artworkImageDataUrl.length > MAX_DATA_URL_SIZE) {
    console.warn(`[OG Image] [Listing ${listingId}] Artwork image data URL too large (${artworkImageDataUrl.length} bytes), skipping image in OG`);
    artworkImageDataUrl = null;
  }

  // Validate data URL format - must start with data:image/
  if (artworkImageDataUrl && !artworkImageDataUrl.startsWith('data:image/')) {
    console.warn(`[OG Image] [Listing ${listingId}] Invalid data URL format, skipping image. URL starts with: ${artworkImageDataUrl.substring(0, 20)}`);
    artworkImageDataUrl = null;
  }

  // Log before creating ImageResponse to help debug
  console.log(`[OG Image] [Listing ${listingId}] Creating ImageResponse with:`, {
    hasArtworkImage: !!artworkImageDataUrl,
    artworkImageLength: artworkImageDataUrl ? artworkImageDataUrl.length : 0,
    artworkImagePrefix: artworkImageDataUrl ? artworkImageDataUrl.substring(0, 30) : null,
    hasFont: !!fontData,
    listingType,
    titleLength: title.length,
    listingDetailsCount: listingDetails.length,
  });

  try {
    const imageResponse = new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(to bottom right, #000000, #1a1a1a)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          padding: '80px 40px',
          color: 'white',
          fontFamily: fontData ? 'MEK-Mono' : 'system-ui',
        }}
      >
        {/* Left half: Text content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '50%',
            paddingRight: '20px',
            justifyContent: 'space-between',
          }}
        >
          {/* Top section: Title, Collection, Artist */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 85, // 2/3 of 128
                fontWeight: 'bold',
                lineHeight: '1.1',
                letterSpacing: '3px',
              }}
            >
              {title && title.length > 50 ? `${String(title).slice(0, 47)}...` : String(title || 'Untitled')}
            </div>
            
            {collectionName ? (
              <div
                style={{
                  display: 'flex',
                  fontSize: 64, // 2/3 of 96
                  opacity: 0.8,
                  letterSpacing: '2px',
                  lineHeight: '1.1',
                }}
              >
                {String(collectionName)}
              </div>
            ) : null}
            
            <div
              style={{
                display: 'flex',
                fontSize: 56, // 2/3 of 84
                opacity: 0.7,
                letterSpacing: '2px',
                lineHeight: '1.1',
              }}
            >
              by {String(artistDisplay || '—')}
            </div>
          </div>

          {/* Bottom section: Listing details */}
          {listingDetails && listingDetails.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '24px', // 2/3 of 36px
                marginTop: 'auto',
              }}
            >
              {listingDetails.map((detail, index) => {
                if (!detail || !detail.label || !detail.value) {
                  return null;
                }
                return (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 48, // 2/3 of 72
                      letterSpacing: '1px',
                    }}
                  >
                    <span style={{ display: 'flex', opacity: 0.6 }}>{String(detail.label)}:</span>
                    <span style={{ display: 'flex', fontWeight: 'bold', opacity: 0.9 }}>{String(detail.value)}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Right half: Artwork image */}
        <div
          style={{
            display: 'flex',
            width: '50%',
            paddingLeft: '20px',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {artworkImageDataUrl ? (
            <img
              src={artworkImageDataUrl}
              alt={title || "Artwork"}
              width={520}
              height={640}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                borderRadius: '8px',
              }}
            />
          ) : null}
        </div>
      </div>
    ),
    imageResponseOptions
    );
    console.log(`[OG Image] [Listing ${listingId}] ImageResponse created successfully, returning response...`);
    
    // Return the response - Next.js will handle the rendering/streaming
    return imageResponse;
  } catch (imageResponseError) {
    // Log the specific error from ImageResponse creation
    console.error(`[OG Image] [Listing ${listingId}] Error creating ImageResponse:`, imageResponseError);
    if (imageResponseError instanceof Error) {
      console.error(`[OG Image] [Listing ${listingId}] ImageResponse error message:`, imageResponseError.message);
      console.error(`[OG Image] [Listing ${listingId}] ImageResponse error stack:`, imageResponseError.stack);
    }
    // Re-throw to be caught by outer catch block
    throw imageResponseError;
  }
  } catch (error) {
    // This catch should catch ALL errors, including streaming errors
    console.error(`[OG Image] [Listing ${listingId || 'unknown'}] Fatal error in listing OG image route:`, error);
    if (error instanceof Error) {
      console.error(`[OG Image] [Listing ${listingId || 'unknown'}] Fatal error message:`, error.message);
      console.error(`[OG Image] [Listing ${listingId || 'unknown'}] Fatal error stack:`, error.stack);
      console.error(`[OG Image] [Listing ${listingId || 'unknown'}] Fatal error name:`, error.name);
    }
    // Return a fallback image on any error
    const errorListingId = listingId || 'unknown';
    try {
      return new ImageResponse(
      (
        <div
          style={{
            background: 'linear-gradient(to bottom right, #000000, #1a1a1a)',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '80px',
            color: 'white',
            fontFamily: 'system-ui',
          }}
        >
          <div style={{ display: 'flex', fontSize: 192, fontWeight: 'bold' }}>
            cryptoart.social
          </div>
          <div style={{ display: 'flex', fontSize: 96, marginTop: '72px' }}>
            {errorListingId !== 'unknown' ? `Listing #${errorListingId}` : 'Error loading listing'}
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
    } catch (fallbackError) {
      // If even the fallback fails, log it but we can't return anything else
      console.error(`[OG Image] [Listing ${errorListingId}] Even fallback ImageResponse failed:`, fallbackError);
      // Return a simple text response as last resort
      return new Response('OG Image generation failed', { status: 500 });
    }
  }
}

