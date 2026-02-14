import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { request as graphqlRequest, gql } from "graphql-request";
import { getArtistNameServer } from "~/lib/server/artist-name";
import { getContractNameServer } from "~/lib/server/contract-name";
import { getCachedImage, cacheImage } from "~/lib/server/image-cache";
import { fetchNFTMetadata } from "~/lib/nft-metadata";
import { processMediaForImage } from "~/lib/server/media-processor";
import {
  createPublicClient,
  http,
  type Address,
  isAddress,
  zeroAddress,
} from "viem";
import { base } from "viem/chains";
import type { EnrichedAuctionData } from "~/lib/types";
import {
  normalizeListingType,
  getHiddenUserAddresses,
  getAuctionServer,
} from "~/lib/server/auction";
import { getDatabase, featuredListings, asc } from "@cryptoart/db";
import sharp from "sharp";
import {
  OG_IMAGE_CACHE_CONTROL_HOMEPAGE,
  OG_IMAGE_CACHE_CONTROL_ERROR,
} from "~/lib/constants";
import { isDataURI } from "~/lib/media-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // Required for processMediaForImage (uses child_process, fs)
export const maxDuration = 60; // Allow up to 60 seconds for image processing

/**
 * Convert WebP data URL to PNG data URL
 * ImageResponse (Satori) doesn't support WebP, only PNG/JPEG
 */
async function convertWebPDataUrlToPNG(webpDataUrl: string): Promise<string> {
  try {
    // Extract base64 data from data URL
    const base64Data = webpDataUrl.split(",")[1];
    if (!base64Data) {
      throw new Error("Invalid data URL format");
    }

    // Convert base64 to buffer
    const webpBuffer = Buffer.from(base64Data, "base64");

    // Convert WebP to PNG using sharp
    const pngBuffer = await sharp(webpBuffer)
      .png({ compressionLevel: 6 })
      .toBuffer();

    // Convert back to data URL
    const pngBase64 = pngBuffer.toString("base64");
    return `data:image/png;base64,${pngBase64}`;
  } catch (error) {
    console.error(
      `[OG Image] Error converting WebP to PNG:`,
      error instanceof Error ? error.message : String(error),
    );
    // Return original if conversion fails (better than crashing)
    return webpDataUrl;
  }
}

// In-memory cache for featured listings to reduce repeated database calls
type CachedListings = { data: EnrichedAuctionData[]; expiresAt: number };
const FEATURED_LISTINGS_CACHE: { value: CachedListings | null } = {
  value: null,
};
const FEATURED_LISTINGS_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCachedFeaturedListings(): EnrichedAuctionData[] | null {
  const now = Date.now();
  if (
    FEATURED_LISTINGS_CACHE.value &&
    FEATURED_LISTINGS_CACHE.value.expiresAt > now
  ) {
    return FEATURED_LISTINGS_CACHE.value.data;
  }
  return null;
}

function setCachedFeaturedListings(data: EnrichedAuctionData[]): void {
  FEATURED_LISTINGS_CACHE.value = {
    data,
    expiresAt: Date.now() + FEATURED_LISTINGS_TTL_MS,
  };
}

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
 * Get subgraph endpoint
 */
const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error(
    "Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL",
  );
};

/**
 * Get headers for subgraph requests
 */
const getSubgraphHeaders = (): Record<string, string> => {
  const apiKey = process.env.GRAPH_STUDIO_API_KEY;
  if (apiKey) {
    return {
      Authorization: `Bearer ${apiKey}`,
    };
  }
  return {};
};

// Note: We now use featured listings from the database instead of querying recent listings
// This ensures we show curated content and automatically filter banned users

/**
 * Fetch ERC20 token info server-side
 */
async function getERC20TokenInfo(
  tokenAddress: string,
): Promise<{ symbol: string; decimals: number } | null> {
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
          "https://mainnet.base.org",
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

/**
 * Truncate text to max length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

// Helper to add timeout to promises
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const refresh = url.searchParams.get("refresh") === "true";

    // Clear in-memory cache if refresh requested
    if (refresh) {
      FEATURED_LISTINGS_CACHE.value = null;
      console.log(
        "[OG Image] Refresh requested - cleared in-memory featured listings cache",
      );
    }

    // Load all three fonts and logo
    const [mekMonoFont, medodicaFont, mekSansFont, logoResponse] =
      await Promise.all([
        fetch(`${baseUrl}/MEK-Mono.otf`)
          .then((res) => res.arrayBuffer())
          .catch(() => null),
        fetch(`${baseUrl}/MedodicaRegular.otf`)
          .then((res) => res.arrayBuffer())
          .catch(() => null),
        fetch(`${baseUrl}/MEKSans-Regular.otf`)
          .then((res) => res.arrayBuffer())
          .catch(() => null),
        fetch(`${baseUrl}/cryptoart-logo-wgmeets-og-wide.png`, {
          headers: {
            "Cache-Control": "no-cache",
          },
        })
          .then((res) => {
            if (!res.ok) {
              console.error(
                `[OG Image] Logo fetch failed with status: ${res.status}`,
              );
              return null;
            }
            return res.arrayBuffer();
          })
          .catch((error) => {
            console.error(`[OG Image] Error fetching logo:`, error);
            return null;
          }),
      ]);

    // Convert logo to base64 data URL
    let logoDataUrl: string | null = null;
    if (logoResponse) {
      try {
        const buffer = Buffer.from(logoResponse);
        const base64 = buffer.toString("base64");
        logoDataUrl = `data:image/png;base64,${base64}`;
        console.log(
          `[OG Image] Logo loaded successfully, size: ${buffer.length} bytes`,
        );
      } catch (error) {
        console.error(`[OG Image] Error processing logo:`, error);
      }
    } else {
      console.error(
        `[OG Image] Logo response was null, will retry with absolute path`,
      );
      // Retry with absolute path if relative path failed
      try {
        const retryResponse = await fetch(
          `${baseUrl}/cryptoart-logo-wgmeets-og-wide.png`,
        );
        if (retryResponse.ok) {
          const retryBuffer = Buffer.from(await retryResponse.arrayBuffer());
          const base64 = retryBuffer.toString("base64");
          logoDataUrl = `data:image/png;base64,${base64}`;
          console.log(
            `[OG Image] Logo loaded on retry, size: ${retryBuffer.length} bytes`,
          );
        } else {
          console.error(
            `[OG Image] Retry failed with status: ${retryResponse.status}`,
          );
        }
      } catch (retryError) {
        console.error(`[OG Image] Retry also failed:`, retryError);
      }
    }

    if (!logoDataUrl) {
      console.warn(`[OG Image] Logo data URL is null - will fall back to text`);
    }

    // Fetch featured listings from database (curated, not just recent)
    let featuredListingsData: EnrichedAuctionData[] =
      getCachedFeaturedListings() || [];
    try {
      const db = getDatabase();

      // Get featured listing IDs from database
      const featured = await db
        .select()
        .from(featuredListings)
        .orderBy(asc(featuredListings.displayOrder))
        .limit(5); // Get up to 5 featured listings

      if (featured.length > 0) {
        // Get hidden user addresses for filtering
        const hiddenAddresses = await getHiddenUserAddresses();

        // Fetch full listing data for each featured listing
        const listings = await Promise.all(
          featured.map(async (f) => {
            const listing = await getAuctionServer(f.listingId);
            if (!listing) {
              return null;
            }

            // Filter out banned/hidden users
            if (
              listing.seller &&
              hiddenAddresses.has(listing.seller.toLowerCase())
            ) {
              console.log(
                `[OG Image] Filtering out featured listing ${f.listingId}: seller ${listing.seller} is hidden`,
              );
              return null;
            }

            // Filter out cancelled, finalized, or sold-out listings
            if (
              listing.status === "CANCELLED" ||
              listing.status === "FINALIZED"
            ) {
              return null;
            }

            const totalAvailable = parseInt(listing.totalAvailable || "0");
            const totalSold = parseInt(listing.totalSold || "0");
            const isFullySold =
              totalAvailable > 0 && totalSold >= totalAvailable;
            if (isFullySold) {
              return null;
            }

            return listing;
          }),
        );

        // Filter out null listings and take up to 5
        featuredListingsData = listings
          .filter(Boolean)
          .slice(0, 5) as EnrichedAuctionData[];

        // If we don't have enough featured listings, we could fall back to recent
        // but for now, we'll just use what we have
        if (featuredListingsData.length === 0) {
          console.warn(
            `[OG Image] No valid featured listings found after filtering`,
          );
        }

        setCachedFeaturedListings(featuredListingsData);
      } else {
        console.warn(`[OG Image] No featured listings in database`);
      }
    } catch (error) {
      console.error(`[OG Image] Error fetching featured listings:`, error);
      // Use cached data if available
      const cached = getCachedFeaturedListings();
      if (cached) {
        featuredListingsData = cached;
        console.log(
          `[OG Image] Using cached featured listings after fetch error`,
        );
      }
    }

    // Use featured listings (rename for consistency with rest of code)
    const recentListings = featuredListingsData;

    // Fetch and cache images for listings (OG-sized variant)
    // Use Promise.allSettled to allow partial completion - some images may fail/timeout
    // but we'll render the OG image with whatever images we successfully fetched
    const listingImageResults = await Promise.allSettled(
      recentListings.map(async (listing) => {
        const imageUrl = listing.image || listing.metadata?.image;
        if (!imageUrl) {
          console.warn(
            `[OG Image] No image URL for listing ${listing.listingId}: image=${listing.image}, metadata.image=${listing.metadata?.image}`,
          );
          return null;
        }

        console.log(
          `[OG Image] Processing image for listing ${listing.listingId}: ${imageUrl.substring(0, 100)}...`,
        );
        console.log(
          `[OG Image] Full image URL for listing ${listing.listingId}: ${imageUrl}`,
        );

        // Handle data URIs directly - no need to cache or fetch
        if (isDataURI(imageUrl)) {
          console.log(
            `[OG Image] Using data URI directly for listing ${listing.listingId}`,
          );
          // Convert WebP to PNG if needed
          if (imageUrl.startsWith("data:image/webp;base64,")) {
            return await convertWebPDataUrlToPNG(imageUrl);
          }
          return imageUrl;
        }

        // Helper to detect if URL is a Vercel Blob thumbnail (already optimized)
        const isVercelBlobThumbnail = (url: string): boolean => {
          return (
            url.includes(".public.blob.vercel-storage.com") ||
            url.includes("vercel-storage.com") ||
            (url.includes("/thumbnails/") && url.includes(".webp"))
          );
        };

        // Check cache first (skip if refresh=true)
        if (!refresh) {
          const cached = await getCachedImage(imageUrl);
          if (cached) {
            console.log(
              `[OG Image] Cache hit for listing ${listing.listingId}`,
            );
            // Convert WebP to PNG if cached image is WebP
            if (cached.startsWith("data:image/webp;base64,")) {
              return await convertWebPDataUrlToPNG(cached);
            }
            return cached;
          }
        }

        console.log(
          `[OG Image] Cache miss for listing ${listing.listingId}${refresh ? " (refresh requested)" : ""}, fetching...`,
        );

        // Convert IPFS URLs to HTTP gateway URLs
        // Note: fetchNFTMetadata may already return gateway URLs, so we handle both cases
        let httpUrl = imageUrl;
        const isOptimizedThumbnail = isVercelBlobThumbnail(imageUrl);
        if (imageUrl.startsWith("ipfs://")) {
          const hash = imageUrl.replace("ipfs://", "");
          const gateway =
            process.env.IPFS_GATEWAY_URL ||
            process.env.NEXT_PUBLIC_IPFS_GATEWAY ||
            "https://cloudflare-ipfs.com";
          httpUrl = `${gateway}/ipfs/${hash}`;
        } else if (
          imageUrl.includes("/ipfs/") &&
          !imageUrl.startsWith("http")
        ) {
          // Handle relative IPFS paths
          const hash = imageUrl.split("/ipfs/")[1]?.split("/")[0];
          if (hash) {
            const gateway =
              process.env.IPFS_GATEWAY_URL ||
              process.env.NEXT_PUBLIC_IPFS_GATEWAY ||
              "https://cloudflare-ipfs.com";
            httpUrl = `${gateway}/ipfs/${hash}`;
          }
        } else if (
          !imageUrl.startsWith("http") &&
          !imageUrl.startsWith("data:")
        ) {
          // If it's not HTTP, IPFS, or data URI, log a warning
          console.warn(
            `[OG Image] Unexpected image URL format for listing ${listing.listingId}: ${imageUrl.substring(0, 100)}`,
          );
        }

        // Fetch image
        try {
          const gateways = [
            process.env.IPFS_GATEWAY_URL ||
              process.env.NEXT_PUBLIC_IPFS_GATEWAY ||
              "https://cloudflare-ipfs.com",
            "https://ipfs.io",
            "https://gateway.pinata.cloud",
          ];

          // Maximum media size: 10MB for videos/GIFs, 5MB for images
          const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
          const MAX_MEDIA_SIZE = 10 * 1024 * 1024; // 10MB for videos/GIFs

          // Build list of URLs to try
          let urlsToTry = [httpUrl];
          if (httpUrl.includes("/ipfs/")) {
            // Extract IPFS hash and try multiple gateways
            const ipfsHash = httpUrl.split("/ipfs/")[1]?.split("/")[0];
            if (ipfsHash) {
              const otherGateways = gateways.filter(
                (gw) => !httpUrl.startsWith(gw),
              );
              urlsToTry = [
                httpUrl,
                ...otherGateways.map((gw) => `${gw}/ipfs/${ipfsHash}`),
              ];
            }
          } else if (
            httpUrl.startsWith("http://") ||
            httpUrl.startsWith("https://")
          ) {
            // For non-IPFS HTTP URLs, just try the URL as-is
            urlsToTry = [httpUrl];
          } else {
            // For data URIs or other formats, we shouldn't reach here, but handle gracefully
            console.warn(
              `[OG Image] Unexpected URL format after conversion: ${httpUrl.substring(0, 100)}`,
            );
            urlsToTry = [httpUrl];
          }

          console.log(
            `[OG Image] Will try ${urlsToTry.length} URL(s) for listing ${listing.listingId}: ${urlsToTry.map((u) => u.substring(0, 80)).join(", ")}`,
          );

          for (const url of urlsToTry) {
            try {
              const response = await fetch(url, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (compatible; OG-Image-Bot/1.0)",
                },
                signal: AbortSignal.timeout(15000), // 15 second timeout for videos/large files
              });

              if (!response.ok) continue;

              const contentType = response.headers.get("content-type") || "";
              // Accept images, videos, and GIFs (we'll process them)
              if (
                !contentType.startsWith("image/") &&
                !contentType.startsWith("video/")
              )
                continue;

              // For optimized Vercel Blob thumbnails, use more lenient size limits
              // They're already optimized WebP files, so they should be small
              const urlIsOptimizedThumbnail = isVercelBlobThumbnail(url);
              const maxSize = urlIsOptimizedThumbnail
                ? 5 * 1024 * 1024 // 5MB for optimized thumbnails (should be much smaller)
                : contentType.startsWith("video/")
                  ? MAX_MEDIA_SIZE
                  : MAX_IMAGE_SIZE;

              // Check Content-Length header before downloading
              const contentLength = response.headers.get("content-length");
              if (contentLength) {
                const size = parseInt(contentLength, 10);
                if (size > maxSize) {
                  console.warn(
                    `[OG Image] Media too large (${size} bytes > ${maxSize} bytes) for ${url}, skipping...`,
                  );
                  continue;
                }
              }

              const arrayBuffer = await response.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);

              // Check actual buffer size after download
              if (buffer.length > maxSize) {
                console.warn(
                  `[OG Image] Media too large after download (${buffer.length} bytes > ${maxSize} bytes) for ${url}, skipping...`,
                );
                continue;
              }

              // For optimized Vercel Blob thumbnails (WebP, already resized), convert to PNG
              // ImageResponse doesn't support WebP, so we need to convert
              if (urlIsOptimizedThumbnail && contentType === "image/webp") {
                // Convert WebP buffer to PNG using sharp
                try {
                  const pngBuffer = await sharp(buffer)
                    .png({ compressionLevel: 6 })
                    .toBuffer();
                  const base64 = pngBuffer.toString("base64");
                  const dataUrl = `data:image/png;base64,${base64}`;

                  // Cache the converted image
                  try {
                    await cacheImage(imageUrl, dataUrl, "image/png");
                  } catch (cacheError) {
                    console.warn(
                      `[OG Image] Failed to cache converted thumbnail (non-fatal):`,
                      cacheError instanceof Error
                        ? cacheError.message
                        : String(cacheError),
                    );
                  }

                  console.log(
                    `[OG Image] Converted optimized Vercel Blob WebP thumbnail to PNG for listing ${listing.listingId}, original: ${buffer.length} bytes, PNG: ${pngBuffer.length} bytes`,
                  );
                  return dataUrl;
                } catch (conversionError) {
                  console.warn(
                    `[OG Image] Failed to convert WebP thumbnail to PNG, will process normally:`,
                    conversionError instanceof Error
                      ? conversionError.message
                      : String(conversionError),
                  );
                  // Fall through to normal processing
                }
              }

              // Process media (handles images, videos, and GIFs)
              // This will scale down large images to appropriate size for OG images
              const processed = await processMediaForImage(
                buffer,
                contentType,
                url,
              );
              if (!processed) {
                console.warn(
                  `[OG Image] Failed to process media for listing ${listing.listingId} from ${url}`,
                );
                continue;
              }

              // Convert WebP data URL to PNG if needed (processMediaForImage might return WebP for optimized thumbnails)
              let finalDataUrl = processed.dataUrl;
              if (processed.dataUrl.startsWith("data:image/webp;base64,")) {
                finalDataUrl = await convertWebPDataUrlToPNG(processed.dataUrl);
              }

              // Cache the processed image using the original imageUrl
              try {
                await cacheImage(imageUrl, finalDataUrl, "image/png"); // All cached images should be PNG
                console.log(
                  `[OG Image] Successfully cached processed image for listing ${listing.listingId} (original type: ${processed.originalType})`,
                );
              } catch (cacheError) {
                // Don't fail the request if caching fails
                console.warn(
                  `[OG Image] Failed to cache image (non-fatal):`,
                  cacheError instanceof Error
                    ? cacheError.message
                    : String(cacheError),
                );
              }

              console.log(
                `[OG Image] Successfully processed media for listing ${listing.listingId} from ${url} (${processed.originalType} -> ${processed.processedType})`,
              );
              return finalDataUrl;
            } catch (error) {
              console.warn(
                `[OG Image] Error fetching from ${url} for listing ${listing.listingId}:`,
                error instanceof Error ? error.message : String(error),
              );
              continue;
            }
          }

          console.error(
            `[OG Image] All gateways failed for listing ${listing.listingId}. Tried: ${urlsToTry.join(", ")}`,
          );
        } catch (error) {
          console.error(
            `[OG Image] Error fetching image for listing ${listing.listingId}:`,
            error,
          );
        }

        console.warn(
          `[OG Image] Returning null for listing ${listing.listingId} - image fetch failed`,
        );
        return null;
      }),
    );

    // Extract results from Promise.allSettled - fulfilled values or null for rejected/timed out
    const listingImages: (string | null)[] = listingImageResults.map(
      (result) => (result.status === "fulfilled" ? result.value : null),
    );

    // Build fonts array
    const fonts: Array<{
      name: string;
      data: ArrayBuffer;
      style: "normal" | "italic";
    }> = [];
    if (mekMonoFont) {
      fonts.push({
        name: "MEK-Mono",
        data: mekMonoFont,
        style: "normal" as const,
      });
    }
    if (medodicaFont) {
      fonts.push({
        name: "MedodicaRegular",
        data: medodicaFont,
        style: "normal" as const,
      });
    }
    if (mekSansFont) {
      fonts.push({
        name: "MEKSans-Regular",
        data: mekSansFont,
        style: "normal" as const,
      });
    }

    // Validate and convert WebP data URLs to PNG before using in ImageResponse
    const MAX_DATA_URL_SIZE = 2 * 1024 * 1024; // 2MB limit for data URLs in ImageResponse
    const validatedImages = await Promise.all(
      listingImages.map(async (imageUrl) => {
        if (!imageUrl) return null;

        // Validate data URL format - must start with data:image/
        if (!imageUrl.startsWith("data:image/")) {
          console.warn(
            `[OG Image] Invalid data URL format, skipping. URL starts with: ${imageUrl.substring(0, 20)}`,
          );
          return null;
        }

        // Check size limit
        if (imageUrl.length > MAX_DATA_URL_SIZE) {
          console.warn(
            `[OG Image] Data URL too large (${imageUrl.length} bytes), skipping`,
          );
          return null;
        }

        // Convert WebP to PNG if needed
        if (imageUrl.startsWith("data:image/webp;base64,")) {
          try {
            return await convertWebPDataUrlToPNG(imageUrl);
          } catch (error) {
            console.error(`[OG Image] Error converting WebP to PNG:`, error);
            return null;
          }
        }

        return imageUrl;
      }),
    );

    // Determine listing details for each card
    const now = Math.floor(Date.now() / 1000);
    const cardData = recentListings.map((listing, index) => {
      const endTime = listing.endTime ? parseInt(listing.endTime) : 0;
      const isActive = endTime > now && listing.status === "ACTIVE";
      const listingType = listing.listingType || "INDIVIDUAL_AUCTION";

      const title = listing.title || "Untitled";
      const artistName = listing.artist || null;
      const artistDisplay = artistName
        ? artistName.startsWith("@")
          ? artistName
          : `@${artistName}`
        : listing.tokenAddress
          ? truncateAddress(listing.tokenAddress)
          : "—";

      return {
        title: truncateText(title, 25),
        artist: artistDisplay,
        listingType,
        isActive,
        image: validatedImages[index] || null,
      };
    });

    // Fill empty slots if we have fewer than 5 listings
    while (cardData.length < 5) {
      cardData.push({
        title: "—",
        artist: "—",
        listingType: "INDIVIDUAL_AUCTION",
        isActive: false,
        image: null,
      });
    }

    return new ImageResponse(
      (
        <div
          style={{
            background: "linear-gradient(to bottom right, #000000, #171717)",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            color: "white",
            fontFamily: "MEK-Mono",
          }}
        >
          {/* Top: Logo section with overlay text */}
          <div
            style={{
              position: "relative",
              width: "100%",
              padding: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {logoDataUrl ? (
              <img
                src={logoDataUrl}
                alt="Cryptoart"
                width={1160}
                height={358}
                style={{
                  width: "1160px",
                  height: "358px",
                  objectFit: "contain",
                  display: "block",
                  marginTop: "-20px",
                }}
              />
            ) : (
              <div
                style={{
                  fontSize: 96,
                  fontWeight: "bold",
                  letterSpacing: "4px",
                  lineHeight: "1.1",
                  fontFamily: "MEKSans-Regular",
                  marginTop: "-20px",
                }}
              >
                CRYPTOART.SOCIAL
              </div>
            )}
            {/* Overlay text on top half of logo */}
            <div
              style={{
                position: "absolute",
                top: "24px",
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 48,
                fontWeight: "bold",
                letterSpacing: "2px",
                opacity: 1,
                textAlign: "center",
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              v1 — Auctionhouse & Marketplace
            </div>
            {/* Membership text overlapping bottom of logo */}
            <div
              style={{
                position: "absolute",
                bottom: "20px",
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 32,
                opacity: 0.7,
                textAlign: "center",
                letterSpacing: "0.5px",
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              Membership: 0.0001 ETH/month
            </div>
          </div>

          {/* Middle: Recent listings section */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "0 0px",
              flex: 1,
              minHeight: 0,
              marginTop: "-60px",
            }}
          >
            {/* Five cards in a row - 40% of OG image height (252px) */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: "10px",
                height: "252px",
                minHeight: "252px",
              }}
            >
              {cardData.map((card, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    position: "relative",
                    overflow: "hidden",
                    borderRadius: "14px",
                  }}
                >
                  {/* Artwork image - full height */}
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      position: "absolute",
                      top: 0,
                      left: 0,
                    }}
                  >
                    {card.image && (
                      <img
                        src={card.image}
                        alt={card.title}
                        width={212}
                        height={280}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    )}
                  </div>

                  {/* Lower-third data pane overlay */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: "70px",
                      background:
                        "linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.7) 100%)",
                      display: "flex",
                      flexDirection: "column",
                      padding: "8px",
                      gap: "4px",
                    }}
                  >
                    {/* Title */}
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: "bold",
                        lineHeight: "1.2",
                        marginBottom: "2px",
                      }}
                    >
                      {card.title}
                    </div>

                    {/* Artist and Listing type */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 14,
                        opacity: 0.9,
                      }}
                    >
                      <div>{card.artist}</div>
                      <div>
                        {card.listingType === "INDIVIDUAL_AUCTION"
                          ? "Auction"
                          : card.listingType === "FIXED_PRICE"
                            ? "Fixed Price"
                            : card.listingType === "OFFERS_ONLY"
                              ? "Offers Only"
                              : card.listingType === "DYNAMIC_PRICE"
                                ? "Dynamic Price"
                                : "Listing"}
                      </div>
                    </div>
                  </div>

                  {/* Green dot for active listings */}
                  {card.isActive && (
                    <div
                      style={{
                        position: "absolute",
                        top: "6px",
                        right: "6px",
                        width: "12px",
                        height: "12px",
                        backgroundColor: "#00ff00",
                        borderRadius: "50%",
                        zIndex: 10,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: fonts.length > 0 ? fonts : undefined,
        headers: {
          // Use no-cache when refresh=true to prevent CDN caching of refreshed images
          // Otherwise cache for 1 day (homepage featured listings are curated)
          "Cache-Control": refresh
            ? "public, no-cache, no-transform, max-age=0, s-maxage=0"
            : OG_IMAGE_CACHE_CONTROL_HOMEPAGE,
        },
      },
    );
  } catch (error) {
    console.error(`[OG Image] Fatal error in homepage OG image route:`, error);
    if (error instanceof Error) {
      console.error(`[OG Image] Error stack:`, error.stack);
    }

    // Return a fallback image on any error
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const [mekMonoFont, mekSansFont, logoResponse] = await Promise.all([
      fetch(`${baseUrl}/MEK-Mono.otf`)
        .then((res) => res.arrayBuffer())
        .catch(() => null),
      fetch(`${baseUrl}/MEKSans-Regular.otf`)
        .then((res) => res.arrayBuffer())
        .catch(() => null),
      fetch(`${baseUrl}/cryptoart-logo-wgmeets-og-wide.png`)
        .then((res) => {
          if (!res.ok) {
            console.error(
              `[OG Image Fallback] Logo fetch failed with status: ${res.status}`,
            );
            return null;
          }
          return res.arrayBuffer();
        })
        .catch((error) => {
          console.error(`[OG Image Fallback] Error fetching logo:`, error);
          return null;
        }),
    ]);

    // Convert logo to base64 data URL
    let fallbackLogoDataUrl: string | null = null;
    if (logoResponse) {
      try {
        const buffer = Buffer.from(logoResponse);
        const base64 = buffer.toString("base64");
        fallbackLogoDataUrl = `data:image/png;base64,${base64}`;
        console.log(
          `[OG Image Fallback] Logo loaded successfully, size: ${buffer.length} bytes`,
        );
      } catch (error) {
        console.error(`[OG Image Fallback] Error processing logo:`, error);
      }
    } else {
      console.warn(`[OG Image Fallback] Logo response was null`);
    }

    const fallbackFonts: Array<{
      name: string;
      data: ArrayBuffer;
      style: "normal" | "italic";
    }> = [];
    if (mekMonoFont) {
      fallbackFonts.push({
        name: "MEK-Mono",
        data: mekMonoFont,
        style: "normal" as const,
      });
    }
    if (mekSansFont) {
      fallbackFonts.push({
        name: "MEKSans-Regular",
        data: mekSansFont,
        style: "normal" as const,
      });
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
            justifyContent: "flex-start",
            alignItems: "center",
            padding: "20px",
            color: "white",
            fontFamily: "MEK-Mono",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              padding: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {fallbackLogoDataUrl ? (
              <img
                src={fallbackLogoDataUrl}
                alt="Cryptoart"
                width={1160}
                height={358}
                style={{
                  width: "1160px",
                  height: "358px",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  fontSize: 96,
                  fontWeight: "bold",
                  letterSpacing: "4px",
                  lineHeight: "1.1",
                  fontFamily: "MEKSans-Regular",
                }}
              >
                CRYPTOART.SOCIAL
              </div>
            )}
            {/* Overlay text on top half of logo */}
            <div
              style={{
                position: "absolute",
                top: "20px",
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 48,
                fontWeight: "bold",
                letterSpacing: "2px",
                opacity: 1,
                textAlign: "center",
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              v1 — Auctionhouse & Marketplace
            </div>
            {/* Membership text overlapping bottom of logo */}
            <div
              style={{
                position: "absolute",
                bottom: "50px",
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 32,
                opacity: 0.7,
                textAlign: "center",
                letterSpacing: "0.5px",
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              Membership: 0.0001 ETH/month to LIST and CAST ♦ Curate Culture ♥
              Collect art
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: fallbackFonts.length > 0 ? fallbackFonts : undefined,
        headers: {
          "Cache-Control": OG_IMAGE_CACHE_CONTROL_ERROR,
        },
      },
    );
  }
}
