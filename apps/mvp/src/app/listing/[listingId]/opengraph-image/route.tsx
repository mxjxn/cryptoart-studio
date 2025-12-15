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
import sharp from 'sharp';
import { OG_IMAGE_CACHE_CONTROL_SUCCESS, OG_IMAGE_CACHE_CONTROL_ERROR } from "~/lib/constants";

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

/**
 * Convert WebP data URL to PNG data URL
 * ImageResponse (Satori) doesn't support WebP, only PNG/JPEG
 */
async function convertWebPDataUrlToPNG(webpDataUrl: string): Promise<string> {
  try {
    // Extract base64 data from data URL
    const base64Data = webpDataUrl.split(',')[1];
    if (!base64Data) {
      throw new Error('Invalid data URL format');
    }
    
    // Convert base64 to buffer
    const webpBuffer = Buffer.from(base64Data, 'base64');
    
    // Convert WebP to PNG using sharp
    const pngBuffer = await sharp(webpBuffer)
      .png({ compressionLevel: 6 })
      .toBuffer();
    
    // Convert back to data URL
    const pngBase64 = pngBuffer.toString('base64');
    return `data:image/png;base64,${pngBase64}`;
  } catch (error) {
    console.error(`[OG Image] Error converting WebP to PNG:`, error instanceof Error ? error.message : String(error));
    // Return original if conversion fails (better than crashing)
    return webpDataUrl;
  }
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
          'Cache-Control': OG_IMAGE_CACHE_CONTROL_ERROR,
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
              fontFamily: 'system-ui', // Temporarily using system font to debug streaming issue
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
          'Cache-Control': OG_IMAGE_CACHE_CONTROL_SUCCESS,
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
              fontFamily: 'system-ui', // Temporarily using system font to debug streaming issue
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
    
    // Helper to detect if URL is a Vercel Blob thumbnail (already optimized)
    const isVercelBlobThumbnail = (url: string): boolean => {
      return url.includes('.public.blob.vercel-storage.com') || 
             url.includes('vercel-storage.com') ||
             (url.includes('/thumbnails/') && url.includes('.webp'));
    };
    
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
        const isOptimizedThumbnail = isVercelBlobThumbnail(imageUrlToUse);
        
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
              
              // For optimized Vercel Blob thumbnails, use more lenient size limits
              // They're already optimized WebP files, so they should be small
              // Check if this specific URL is an optimized thumbnail
              const urlIsOptimizedThumbnail = isVercelBlobThumbnail(url);
              const maxSize = urlIsOptimizedThumbnail 
                ? 5 * 1024 * 1024 // 5MB for optimized thumbnails (should be much smaller)
                : (contentType.startsWith('video/') ? MAX_MEDIA_SIZE : MAX_IMAGE_SIZE);
              
              // Check Content-Length header before downloading
              const contentLength = response.headers.get('content-length');
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
              
              // For optimized thumbnails, validate they're actually small (should be < 500KB typically)
              if (urlIsOptimizedThumbnail && buffer.length > 1024 * 1024) {
                console.warn(`[OG Image] Optimized thumbnail unexpectedly large (${buffer.length} bytes), will process anyway but this is unusual`);
              }
              
              // For optimized Vercel Blob thumbnails (WebP, already resized), skip processing
              // Convert to PNG data URL since ImageResponse doesn't support WebP
              if (urlIsOptimizedThumbnail && contentType === 'image/webp') {
                // Convert WebP buffer to PNG using sharp
                try {
                  const pngBuffer = await sharp(buffer)
                    .png({ compressionLevel: 6 })
                    .toBuffer();
                  const base64 = pngBuffer.toString('base64');
                  artworkImageDataUrl = `data:image/png;base64,${base64}`;
                  fetchedContentType = 'image/png';
                  console.log(`[OG Image] Converted optimized Vercel Blob WebP thumbnail to PNG, original: ${buffer.length} bytes, PNG: ${pngBuffer.length} bytes`);
                } catch (conversionError) {
                  console.warn(`[OG Image] Failed to convert WebP thumbnail to PNG, using WebP (may fail in ImageResponse):`, conversionError instanceof Error ? conversionError.message : String(conversionError));
                  // Fallback to WebP - will be converted later if needed
                  const base64 = buffer.toString('base64');
                  artworkImageDataUrl = `data:image/webp;base64,${base64}`;
                  fetchedContentType = 'image/webp';
                }
              } else {
                // Process media (handles images, videos, and GIFs)
                // This will scale down large images to appropriate size for OG images
                const processed = await processMediaForImage(buffer, contentType, url);
                if (!processed) {
                  console.warn(`[OG Image] Failed to process media for listing ${listingId} from ${url}`);
                  continue;
                }
                
                fetchedContentType = 'image/png'; // Processed images are always PNG
                artworkImageDataUrl = processed.dataUrl;
                
                console.log(`[OG Image] Media processed successfully from ${url}, size: ${buffer.length} bytes, original type: ${processed.originalType}, processed type: ${processed.processedType}`);
              }
              
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
  const startTime = auction?.startTime ? parseInt(auction.startTime) : 0;
  const endTime = auction?.endTime ? parseInt(auction.endTime) : 0;
  const now = Math.floor(Date.now() / 1000);
  const hasBid = (auction?.bidCount && auction.bidCount > 0) || !!auction?.highestBid;
  
  // Calculate if auction has started and actual end time
  // For auctions with startTime = 0, they start on first bid
  // When startTime = 0, endTime is a DURATION (in seconds), not a timestamp
  // When the auction starts (first bid), the contract converts it: endTime += block.timestamp
  let auctionHasStarted = false;
  let actualEndTime = endTime;
  
  if (listingType === "INDIVIDUAL_AUCTION") {
    if (startTime === 0) {
      // Auction starts on first bid
      auctionHasStarted = hasBid;
      
      if (auctionHasStarted) {
        // Auction has started - check if endTime is already converted to timestamp
        // If endTime > now, it's likely already converted to a timestamp (use it directly)
        // If endTime <= now or is a small number, it's still a duration (need to calculate)
        if (endTime > now) {
          // Already converted to timestamp by contract
          actualEndTime = endTime;
        } else if (endTime > 0 && auction?.highestBid?.timestamp) {
          // Still a duration - calculate end time from when auction started (first bid timestamp)
          const auctionStartTimestamp = parseInt(auction.highestBid.timestamp);
          actualEndTime = auctionStartTimestamp + endTime;
        } else {
          // Can't determine actual end time, default to treating as active if status is ACTIVE
          actualEndTime = 0;
        }
      } else {
        // Auction hasn't started yet, endTime is still a duration
        // We can't calculate actual end time until auction starts
        actualEndTime = 0;
      }
    } else {
      // Has fixed start time, endTime is already a timestamp
      auctionHasStarted = now >= startTime;
      actualEndTime = endTime;
    }
  } else {
    // For FIXED_PRICE, OFFERS_ONLY, DYNAMIC_PRICE
    // If startTime = 0, listing starts immediately, endTime is a duration
    // For fixed startTime, endTime is a timestamp
    if (startTime === 0) {
      auctionHasStarted = true; // Fixed price listings are active immediately
      // For startTime=0, endTime is a duration - we'd need creation timestamp to calculate
      // For OG images, we'll assume it's still active if status is ACTIVE
      // This is a limitation but better than showing "Ended" incorrectly
      actualEndTime = endTime > now ? endTime : 0;
    } else {
      auctionHasStarted = now >= startTime;
      actualEndTime = endTime;
    }
  }
  
  // Determine if auction is active
  // For auctions with startTime=0 that haven't started yet (no bid), they're active (waiting for first bid)
  // For auctions that have started, check if endTime has passed
  let isActive = false;
  if (auction?.status === "ACTIVE") {
    if (listingType === "INDIVIDUAL_AUCTION" && startTime === 0 && !auctionHasStarted) {
      // Auction with startTime=0 that hasn't started yet is active (waiting for first bid)
      isActive = true;
    } else {
      // Auction has started (or has fixed startTime), check if endTime has passed
      isActive = auctionHasStarted && (actualEndTime === 0 || actualEndTime > now);
    }
  }

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
      'Cache-Control': OG_IMAGE_CACHE_CONTROL_SUCCESS,
    },
  };
  
  // Only add fonts property if we have font data (don't include it at all if no font)
  // NOTE: Fonts are disabled because they cause "u2 is not iterable" error in nodejs runtime
  // This appears to be a Next.js/ImageResponse issue with ArrayBuffer fonts in nodejs runtime
  // Using system-ui font instead - fonts can be re-enabled if Next.js fixes this or we find a workaround
  // For now, system-ui provides good fallback typography
  console.log(`[OG Image] [Listing ${listingId}] Using system-ui font (custom fonts disabled due to nodejs runtime compatibility)`);

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

  // Convert WebP data URLs to PNG - ImageResponse (Satori) doesn't support WebP
  if (artworkImageDataUrl && artworkImageDataUrl.startsWith('data:image/webp;base64,')) {
    console.log(`[OG Image] [Listing ${listingId}] Converting WebP data URL to PNG for ImageResponse compatibility...`);
    try {
      artworkImageDataUrl = await convertWebPDataUrlToPNG(artworkImageDataUrl);
      console.log(`[OG Image] [Listing ${listingId}] Successfully converted WebP to PNG, new size: ${artworkImageDataUrl.length} bytes`);
    } catch (error) {
      console.error(`[OG Image] [Listing ${listingId}] Failed to convert WebP to PNG:`, error instanceof Error ? error.message : String(error));
      // Continue with WebP - might work or might fail, but better than crashing
    }
  }

  // Log before creating ImageResponse to help debug
  console.log(`[OG Image] [Listing ${listingId}] Creating ImageResponse with:`, {
    hasArtworkImage: !!artworkImageDataUrl,
    artworkImageLength: artworkImageDataUrl ? artworkImageDataUrl.length : 0,
    artworkImagePrefix: artworkImageDataUrl ? artworkImageDataUrl.substring(0, 50) : null,
    artworkImageIsValid: artworkImageDataUrl ? artworkImageDataUrl.startsWith('data:image/') : false,
    hasFont: false, // Fonts disabled
    listingType,
    titleLength: title.length,
    listingDetailsCount: listingDetails.length,
  });

  try {
    const imageResponse = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          backgroundColor: '#000000',
        }}
      >
        {/* Full-width background image - centered vertically, cropped top/bottom if needed */}
        {artworkImageDataUrl ? (
          <img
            src={artworkImageDataUrl}
            alt={title || "Artwork"}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#0a0a0a',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          />
        )}

        {/* Full-image 30% black overlay for better text readability */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.3)',
          }}
        />

        {/* Top gradient overlay - darker, extends further into middle */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '50%',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 30%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.3) 100%)',
          }}
        />

        {/* Bottom gradient overlay - darker, extends further into middle */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '50%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 30%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.3) 100%)',
          }}
        />

        {/* Top section: Title and Collection Name */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '33.33%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            padding: '60px 80px',
            color: 'white',
            fontFamily: 'system-ui',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 96,
              fontWeight: 'bold',
              lineHeight: '1.1',
              letterSpacing: '2px',
              marginBottom: '16px',
            }}
          >
            {title && title.length > 60 ? `${String(title).slice(0, 57)}...` : String(title || 'Untitled')}
          </div>
          
          {collectionName ? (
            <div
              style={{
                display: 'flex',
                fontSize: 64,
                opacity: 0.9,
                letterSpacing: '1.5px',
                lineHeight: '1.1',
              }}
            >
              {String(collectionName)}
            </div>
          ) : null}
        </div>

        {/* Bottom section: Listing details - two columns if needed */}
        {listingDetails && listingDetails.length > 0 ? (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: '33.33%',
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              padding: '60px 80px',
              color: 'white',
              fontFamily: 'system-ui',
            }}
          >
            {/* Left column */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                flex: 1,
                paddingRight: '40px',
              }}
            >
              {listingDetails.slice(0, Math.ceil(listingDetails.length / 2)).map((detail, index) => {
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
                      fontSize: 48,
                      letterSpacing: '1px',
                    }}
                  >
                    <span style={{ display: 'flex', opacity: 0.7 }}>{String(detail.label)}:</span>
                    <span style={{ display: 'flex', fontWeight: 'bold', opacity: 1 }}>{String(detail.value)}</span>
                  </div>
                );
              })}
            </div>

            {/* Right column (if more than 2 details) */}
            {listingDetails.length > 2 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  flex: 1,
                  paddingLeft: '40px',
                }}
              >
                {listingDetails.slice(Math.ceil(listingDetails.length / 2)).map((detail, index) => {
                  if (!detail || !detail.label || !detail.value) {
                    return null;
                  }
                  const actualIndex = Math.ceil(listingDetails.length / 2) + index;
                  return (
                    <div
                      key={actualIndex}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 48,
                        letterSpacing: '1px',
                      }}
                    >
                      <span style={{ display: 'flex', opacity: 0.7 }}>{String(detail.label)}:</span>
                      <span style={{ display: 'flex', fontWeight: 'bold', opacity: 1 }}>{String(detail.value)}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
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
          'Cache-Control': OG_IMAGE_CACHE_CONTROL_ERROR,
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

