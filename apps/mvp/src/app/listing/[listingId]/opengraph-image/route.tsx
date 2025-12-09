import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getAuctionServer } from "~/lib/server/auction";
import { getArtistNameServer } from "~/lib/server/artist-name";
import { getContractNameServer } from "~/lib/server/contract-name";
import { getCachedImage, cacheImage } from "~/lib/server/image-cache";
import { isDataURI } from "~/lib/media-utils";
import { extractFirstFrame, needsFrameExtraction } from "~/lib/server/frame-extractor";
import { createPublicClient, http, type Address, isAddress, zeroAddress } from "viem";
import { base } from "viem/chains";
import type { EnrichedAuctionData } from "~/lib/types";

export const dynamic = 'force-dynamic';

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
  try {
    const { listingId } = await params;
    const url = new URL(request.url);
    // Force HTTPS for font URL to avoid SSL errors
    const baseUrl = `https://${url.host}`;
    const fontUrl = `${baseUrl}/MEK-Mono.otf`;
    
    // Load font from URL (edge runtime compatible)
    let fontData: ArrayBuffer;
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
      // Return a simple error image if font can't be loaded
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
            }}
          >
            <div style={{ display: 'flex', fontSize: 192, fontWeight: 'bold' }}>
              cryptoart.social
            </div>
            <div style={{ display: 'flex', fontSize: 96, marginTop: '72px' }}>
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
    // Add timeout to auction fetch (5 seconds max)
    auction = await withTimeout(
      getAuctionServer(listingId),
      5000,
      null
    );

    if (!auction) {
      // Return default image if listing not found
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
              fontFamily: 'MEK-Mono',
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
  // Check image field first, then animation_url as fallback
  let artworkImageDataUrl: string | null = null;
  let originalImageUrl = auction?.image || auction?.metadata?.image || null;
  const animationUrl = auction?.metadata?.animation_url || auction?.metadata?.animationUrl;
  
  // If no image but we have animation_url, use it
  if (!originalImageUrl && animationUrl) {
    originalImageUrl = animationUrl;
    console.log(`[OG Image] [Listing ${listingId}] Using animation_url as image source`);
  }
  
  if (originalImageUrl) {
    if (originalImageUrl) {
      console.log(`[OG Image] [Listing ${listingId}] Original image URL: ${originalImageUrl.substring(0, 100)}...`);
      
      // Handle data URIs directly - no need to cache or fetch
      if (isDataURI(originalImageUrl)) {
        artworkImageDataUrl = originalImageUrl;
        console.log(`[OG Image] [Listing ${listingId}] Using data URI directly (no cache/fetch needed)`);
      } else {
        // Check cache first - try both regular cache and frame cache
        const frameCacheKey = `frame-${originalImageUrl}`;
        let cached = await getCachedImage(frameCacheKey);
        if (!cached) {
          cached = await getCachedImage(originalImageUrl);
        }
        if (cached) {
          artworkImageDataUrl = cached;
          console.log(`[OG Image] [Listing ${listingId}] Using cached image`);
        } else {
          console.log(`[OG Image] [Listing ${listingId}] Cache miss, fetching image...`);
          // Not in cache, fetch and cache it
          let imageUrl = originalImageUrl;
        
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
          
          // Maximum image size: 5MB (to prevent memory issues and database timeouts)
          const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
          
          for (const url of urlsToTry) {
            try {
              const response = await fetch(url, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; OG-Image-Bot/1.0)',
                },
                signal: AbortSignal.timeout(5000), // 5 second timeout
              });
              
              if (!response.ok) {
                console.warn(`[OG Image] Gateway returned ${response.status} ${response.statusText} for ${url}, trying next...`);
                continue;
              }
              
              // Check content-type - accept image/, video/, and application/octet-stream
              const contentType = response.headers.get('content-type') || '';
              const isMediaType = contentType.startsWith('image/') || 
                                  contentType.startsWith('video/') || 
                                  contentType === 'application/octet-stream' ||
                                  !contentType;
              
              if (!isMediaType && contentType) {
                console.warn(`[OG Image] Unsupported content-type for listing ${listingId}: ${contentType}`);
                continue;
              }
              
              // Check Content-Length header before downloading
              const contentLength = response.headers.get('content-length');
              if (contentLength) {
                const size = parseInt(contentLength, 10);
                if (size > MAX_IMAGE_SIZE) {
                  console.warn(`[OG Image] Image too large (${size} bytes > ${MAX_IMAGE_SIZE} bytes) for ${url}, skipping...`);
                  continue;
                }
              }
              
              const arrayBuffer = await response.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              
              // Check actual buffer size after download
              if (buffer.length > MAX_IMAGE_SIZE) {
                console.warn(`[OG Image] Image too large after download (${buffer.length} bytes > ${MAX_IMAGE_SIZE} bytes) for ${url}, skipping...`);
                continue;
              }
              
              // Validate media format (check magic bytes) - accept images, GIFs, and videos
              const magicBytes = buffer.subarray(0, 12);
              const isImage = 
                // JPEG: FF D8 FF
                (magicBytes[0] === 0xFF && magicBytes[1] === 0xD8 && magicBytes[2] === 0xFF) ||
                // PNG: 89 50 4E 47
                (magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47) ||
                // GIF: 47 49 46 38 (GIF8)
                (magicBytes[0] === 0x47 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46 && magicBytes[3] === 0x38) ||
                // WebP: RIFF....WEBP (52 49 46 46 ... 57 45 42 50)
                (magicBytes[0] === 0x52 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46 && magicBytes[3] === 0x46 &&
                 buffer.length >= 12 && 
                 magicBytes[8] === 0x57 && magicBytes[9] === 0x45 && magicBytes[10] === 0x42 && magicBytes[11] === 0x50);
              
              // Video formats: MP4, WebM, QuickTime
              const isVideo = 
                // MP4: 00 00 00 ?? 66 74 79 70 (ftyp)
                (magicBytes[0] === 0x00 && magicBytes[1] === 0x00 && magicBytes[2] === 0x00 && 
                 (magicBytes[3] === 0x18 || magicBytes[3] === 0x20 || magicBytes[3] === 0x1C) &&
                 magicBytes[4] === 0x66 && magicBytes[5] === 0x74 && magicBytes[6] === 0x79 && magicBytes[7] === 0x70) ||
                // WebM: 1A 45 DF A3
                (magicBytes[0] === 0x1A && magicBytes[1] === 0x45 && magicBytes[2] === 0xDF && magicBytes[3] === 0xA3);
              
              const isValidMedia = isImage || isVideo;
              
              if (!isValidMedia) {
                const hexBytes = Array.from(magicBytes.slice(0, 12))
                  .map(b => '0x' + b.toString(16).padStart(2, '0'))
                  .join(' ');
                console.warn(`[OG Image] Invalid media format for listing ${listingId} from ${url}. Magic bytes: ${hexBytes}, Content-Type: ${contentType}, Size: ${buffer.length} bytes`);
                continue;
              }
              
              // Check if we need to extract a frame (GIF or video)
              const needsExtraction = needsFrameExtraction(url, contentType, buffer);
              let finalBuffer = buffer;
              let finalContentType = contentType || 'image/png';
              
              if (needsExtraction) {
                console.log(`[OG Image] [Listing ${listingId}] Extracting first frame from ${isVideo ? 'video' : 'GIF'}`);
                const extractionResult = await extractFirstFrame(url, buffer, contentType);
                
                if (extractionResult.success) {
                  finalBuffer = Buffer.from(extractionResult.buffer);
                  finalContentType = extractionResult.contentType;
                  console.log(`[OG Image] [Listing ${listingId}] Successfully extracted frame, size: ${finalBuffer.length} bytes`);
                } else {
                  console.warn(`[OG Image] [Listing ${listingId}] Failed to extract frame: ${extractionResult.error}`);
                  // Continue with original buffer - might work for some cases
                }
              }
              
              const base64 = finalBuffer.toString('base64');
              fetchedContentType = finalContentType;
              artworkImageDataUrl = `data:${finalContentType};base64,${base64}`;
              
              console.log(`[OG Image] [Listing ${listingId}] Image fetched successfully from ${url}, size: ${finalBuffer.length} bytes, type: ${finalContentType}`);
              
              // Cache the extracted frame (only if under size limit) using the original imageUrl
              // Use a special cache key prefix for extracted frames to distinguish from full media
              const cacheKey = needsExtraction ? `frame-${originalImageUrl}` : originalImageUrl;
              if (fetchedContentType && finalBuffer.length <= MAX_IMAGE_SIZE) {
                try {
                  await cacheImage(cacheKey, artworkImageDataUrl, fetchedContentType);
                  console.log(`[OG Image] [Listing ${listingId}] Successfully cached ${needsExtraction ? 'extracted frame' : 'image'}`);
                } catch (cacheError) {
                  // Don't fail the request if caching fails
                  console.warn(`[OG Image] Failed to cache image (non-fatal):`, cacheError instanceof Error ? cacheError.message : String(cacheError));
                }
              }
              
              break; // Success, exit loop
            } catch (error) {
              console.warn(`[OG Image] Error fetching from ${url}:`, error instanceof Error ? error.message : String(error));
              continue;
            }
          }
          
          if (!artworkImageDataUrl) {
            console.error(`[OG Image] [Listing ${listingId}] All gateways failed for image. Tried: ${urlsToTry.map(u => u.substring(0, 80)).join(', ')}`);
            console.error(`[OG Image] [Listing ${listingId}] Original URL was: ${originalImageUrl.substring(0, 100)}`);
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
      console.warn(`[OG Image] [Listing ${listingId}] No image URL found in auction data. auction.image=${auction?.image}, auction.metadata?.image=${auction?.metadata?.image}`);
    }
  } else {
    console.warn(`[OG Image] [Listing ${listingId}] No auction image or metadata available`);
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
          background: 'linear-gradient(to bottom right, #000000, #1a1a1a)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          padding: '80px 40px',
          color: 'white',
          fontFamily: 'MEK-Mono',
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
              {title.length > 50 ? `${title.slice(0, 47)}...` : title}
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
                {collectionName}
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
              by {artistDisplay}
            </div>
          </div>

          {/* Bottom section: Listing details */}
          {listingDetails.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '24px', // 2/3 of 36px
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
                    fontSize: 48, // 2/3 of 72
                    letterSpacing: '1px',
                  }}
                >
                  <span style={{ display: 'flex', opacity: 0.6 }}>{detail.label}:</span>
                  <span style={{ display: 'flex', fontWeight: 'bold', opacity: 0.9 }}>{detail.value}</span>
                </div>
              ))}
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
              alt={title}
              width={520}
              height={640}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                borderRadius: '8px',
              }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 48,
                opacity: 0.5,
              }}
            >
              No Image
            </div>
          )}
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
    console.error(`[OG Image] Fatal error in listing OG image route:`, error);
    if (error instanceof Error) {
      console.error(`[OG Image] Error stack:`, error.stack);
    }
    // Return a fallback image on any error
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
          }}
        >
          <div style={{ display: 'flex', fontSize: 192, fontWeight: 'bold' }}>
            cryptoart.social
          </div>
          <div style={{ display: 'flex', fontSize: 96, marginTop: '72px' }}>
            Error loading listing
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

