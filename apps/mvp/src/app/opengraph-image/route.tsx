import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { request as graphqlRequest, gql } from "graphql-request";
import { getArtistNameServer } from "~/lib/server/artist-name";
import { getContractNameServer } from "~/lib/server/contract-name";
import { getCachedImage, cacheImage } from "~/lib/server/image-cache";
import { fetchNFTMetadata } from "~/lib/nft-metadata";
import { createPublicClient, http, type Address, isAddress, zeroAddress } from "viem";
import { base } from "viem/chains";
import type { EnrichedAuctionData } from "~/lib/types";
import { normalizeListingType } from "~/lib/server/auction";

export const dynamic = 'force-dynamic';

// In-memory cache for recent listings to reduce repeated GraphQL calls
type CachedListings = { data: EnrichedAuctionData[]; expiresAt: number };
const RECENT_LISTINGS_CACHE: { value: CachedListings | null } = { value: null };
const RECENT_LISTINGS_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCachedRecentListings(): EnrichedAuctionData[] | null {
  const now = Date.now();
  if (RECENT_LISTINGS_CACHE.value && RECENT_LISTINGS_CACHE.value.expiresAt > now) {
    return RECENT_LISTINGS_CACHE.value.data;
  }
  return null;
}

function setCachedRecentListings(data: EnrichedAuctionData[]): void {
  RECENT_LISTINGS_CACHE.value = {
    data,
    expiresAt: Date.now() + RECENT_LISTINGS_TTL_MS,
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
    "Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL"
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

/**
 * Query for most recent listings
 */
const RECENT_LISTINGS_QUERY = gql`
  query RecentListings($first: Int!) {
    listings(
      first: $first
      orderBy: listingId
      orderDirection: desc
    ) {
      id
      listingId
      marketplace
      seller
      tokenAddress
      tokenId
      tokenSpec
      listingType
      initialAmount
      totalAvailable
      totalPerSale
      startTime
      endTime
      lazy
      status
      totalSold
      hasBid
      finalized
      createdAt
      createdAtBlock
      updatedAt
      erc20
      bids(orderBy: amount, orderDirection: desc, first: 1) {
        id
        bidder
        amount
        timestamp
      }
    }
  }
`;

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

/**
 * Truncate text to max length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

// Helper to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    // Load all three fonts and logo
    const [mekMonoFont, medodicaFont, mekSansFont, logoResponse] = await Promise.all([
      fetch(`${baseUrl}/MEK-Mono.otf`).then((res) => res.arrayBuffer()).catch(() => null),
      fetch(`${baseUrl}/MedodicaRegular.otf`).then((res) => res.arrayBuffer()).catch(() => null),
      fetch(`${baseUrl}/MEKSans-Regular.otf`).then((res) => res.arrayBuffer()).catch(() => null),
      fetch(`${baseUrl}/cryptoart-logo-wgmeets-og-wide.png`, {
        headers: {
          'Cache-Control': 'no-cache',
        },
      }).then((res) => {
        if (!res.ok) {
          console.error(`[OG Image] Logo fetch failed with status: ${res.status}`);
          return null;
        }
        return res.arrayBuffer();
      }).catch((error) => {
        console.error(`[OG Image] Error fetching logo:`, error);
        return null;
      }),
    ]);
    
    // Convert logo to base64 data URL
    let logoDataUrl: string | null = null;
    if (logoResponse) {
      try {
        const buffer = Buffer.from(logoResponse);
        const base64 = buffer.toString('base64');
        logoDataUrl = `data:image/png;base64,${base64}`;
        console.log(`[OG Image] Logo loaded successfully, size: ${buffer.length} bytes`);
      } catch (error) {
        console.error(`[OG Image] Error processing logo:`, error);
      }
    } else {
      console.error(`[OG Image] Logo response was null, will retry with absolute path`);
      // Retry with absolute path if relative path failed
      try {
        const retryResponse = await fetch(`${baseUrl}/cryptoart-logo-wgmeets-og-wide.png`);
        if (retryResponse.ok) {
          const retryBuffer = Buffer.from(await retryResponse.arrayBuffer());
          const base64 = retryBuffer.toString('base64');
          logoDataUrl = `data:image/png;base64,${base64}`;
          console.log(`[OG Image] Logo loaded on retry, size: ${retryBuffer.length} bytes`);
        } else {
          console.error(`[OG Image] Retry failed with status: ${retryResponse.status}`);
        }
      } catch (retryError) {
        console.error(`[OG Image] Retry also failed:`, retryError);
      }
    }
    
    if (!logoDataUrl) {
      console.warn(`[OG Image] Logo data URL is null - will fall back to text`);
    }

    // Fetch 5 most recent listings with cache and fallback
    let recentListings: EnrichedAuctionData[] = getCachedRecentListings() || [];
    try {
      const endpoint = getSubgraphEndpoint();
      const data = await withTimeout(
        graphqlRequest<{ listings: any[] }>(
          endpoint,
          RECENT_LISTINGS_QUERY,
          { first: 5 },
          getSubgraphHeaders()
        ),
        5000,
        { listings: [] }
      );

      // Enrich listings with metadata
      const enrichedListings = await Promise.all(
        data.listings.slice(0, 5).map(async (listing) => {
          const bidCount = listing.bids?.length || 0;
          const highestBid = listing.bids && listing.bids.length > 0 
            ? listing.bids[0]
            : undefined;

          // Fetch NFT metadata
          let metadata = null;
          if (listing.tokenAddress && listing.tokenId) {
            try {
              metadata = await withTimeout(
                fetchNFTMetadata(
                  listing.tokenAddress as Address,
                  listing.tokenId,
                  listing.tokenSpec
                ),
                5000, // Increased timeout to 5 seconds
                null
              );
              if (!metadata) {
                console.warn(`[OG Image] Metadata fetch returned null for ${listing.tokenAddress}:${listing.tokenId}`);
              } else if (!metadata.image) {
                console.warn(`[OG Image] Metadata fetched but no image URL for ${listing.tokenAddress}:${listing.tokenId}`);
              }
            } catch (error) {
              console.error(`[OG Image] Error fetching metadata for ${listing.tokenAddress}:${listing.tokenId}:`, error);
            }
          } else {
            console.warn(`[OG Image] Missing tokenAddress or tokenId for listing ${listing.listingId}`);
          }

          // Fetch artist name and contract name
          const [artistResult, contractName] = await Promise.all([
            listing.tokenAddress && listing.tokenId
              ? withTimeout(
                  getArtistNameServer(listing.tokenAddress, listing.tokenId),
                  3000,
                  { name: null, source: null }
                )
              : Promise.resolve({ name: null, source: null }),
            listing.tokenAddress
              ? withTimeout(
                  getContractNameServer(listing.tokenAddress),
                  3000,
                  null
                )
              : Promise.resolve(null),
          ]);

          // Fetch ERC20 token info if applicable
          let tokenSymbol = "ETH";
          let tokenDecimals = 18;
          if (listing.erc20 && !isETH(listing.erc20)) {
            const tokenInfo = await withTimeout(
              getERC20TokenInfo(listing.erc20),
              3000,
              null
            );
            if (tokenInfo) {
              tokenSymbol = tokenInfo.symbol;
              tokenDecimals = tokenInfo.decimals;
            }
          }

          const enriched: EnrichedAuctionData = {
            ...listing,
            listingType: normalizeListingType(listing.listingType, listing),
            bidCount,
            highestBid: highestBid ? {
              amount: highestBid.amount,
              bidder: highestBid.bidder,
              timestamp: highestBid.timestamp,
            } : undefined,
            title: metadata?.title || metadata?.name || (listing.tokenId ? `Token #${listing.tokenId}` : "Untitled"),
            artist: metadata?.artist || metadata?.creator || artistResult.name,
            image: metadata?.image,
            description: metadata?.description,
            metadata,
          };

          return {
            ...enriched,
            tokenSymbol,
            tokenDecimals,
            contractName,
          } as EnrichedAuctionData & { tokenSymbol: string; tokenDecimals: number; contractName: string | null };
        })
      );

      recentListings = enrichedListings;
      setCachedRecentListings(enrichedListings);
    } catch (error) {
      console.error(`[OG Image] Error fetching recent listings:`, error);
      // Use cached data if available
      const cached = getCachedRecentListings();
      if (cached) {
        recentListings = cached;
        console.log(`[OG Image] Using cached recent listings after fetch error`);
      }
    }

    // Fetch and cache images for listings (OG-sized variant)
    const listingImages: (string | null)[] = await Promise.all(
      recentListings.map(async (listing) => {
        const imageUrl = listing.image || listing.metadata?.image;
        if (!imageUrl) {
          console.warn(`[OG Image] No image URL for listing ${listing.listingId}: image=${listing.image}, metadata.image=${listing.metadata?.image}`);
          return null;
        }

        console.log(`[OG Image] Processing image for listing ${listing.listingId}: ${imageUrl.substring(0, 100)}...`);

        // Check cache first using the original imageUrl (normalization happens inside getCachedImage)
        const cached = await getCachedImage(imageUrl);
        if (cached) {
          console.log(`[OG Image] Cache hit for listing ${listing.listingId}`);
          return cached;
        }
        
        console.log(`[OG Image] Cache miss for listing ${listing.listingId}, fetching...`);

        // Convert IPFS URLs to HTTP gateway URLs
        // Note: fetchNFTMetadata may already return gateway URLs, so we handle both cases
        let httpUrl = imageUrl;
        if (imageUrl.startsWith('ipfs://')) {
          const hash = imageUrl.replace('ipfs://', '');
          const gateway = process.env.IPFS_GATEWAY_URL || process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://cloudflare-ipfs.com';
          httpUrl = `${gateway}/ipfs/${hash}`;
        } else if (imageUrl.includes('/ipfs/') && !imageUrl.startsWith('http')) {
          // Handle relative IPFS paths
          const hash = imageUrl.split('/ipfs/')[1]?.split('/')[0];
          if (hash) {
            const gateway = process.env.IPFS_GATEWAY_URL || process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://cloudflare-ipfs.com';
            httpUrl = `${gateway}/ipfs/${hash}`;
          }
        } else if (!imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
          // If it's not HTTP, IPFS, or data URI, log a warning
          console.warn(`[OG Image] Unexpected image URL format for listing ${listing.listingId}: ${imageUrl.substring(0, 100)}`);
        }

        // Fetch image
        try {
          const gateways = [
            process.env.IPFS_GATEWAY_URL || process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://cloudflare-ipfs.com",
            "https://ipfs.io",
            "https://gateway.pinata.cloud",
          ];
          
          // Maximum image size: 2MB for OG-sized thumbnails (smaller than full images)
          const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB in bytes
          
          // Build list of URLs to try
          let urlsToTry = [httpUrl];
          if (httpUrl.includes('/ipfs/')) {
            // Extract IPFS hash and try multiple gateways
            const ipfsHash = httpUrl.split('/ipfs/')[1]?.split('/')[0];
            if (ipfsHash) {
              const otherGateways = gateways.filter(gw => !httpUrl.startsWith(gw));
              urlsToTry = [httpUrl, ...otherGateways.map(gw => `${gw}/ipfs/${ipfsHash}`)];
            }
          } else if (httpUrl.startsWith('http://') || httpUrl.startsWith('https://')) {
            // For non-IPFS HTTP URLs, just try the URL as-is
            urlsToTry = [httpUrl];
          } else {
            // For data URIs or other formats, we shouldn't reach here, but handle gracefully
            console.warn(`[OG Image] Unexpected URL format after conversion: ${httpUrl.substring(0, 100)}`);
            urlsToTry = [httpUrl];
          }

          for (const url of urlsToTry) {
            try {
              const response = await fetch(url, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; OG-Image-Bot/1.0)',
                },
                signal: AbortSignal.timeout(5000),
              });
              
              if (!response.ok) continue;
              
              const contentType = response.headers.get('content-type') || '';
              if (!contentType.startsWith('image/')) continue;
              
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
              
              // Validate image
              const magicBytes = buffer.subarray(0, 4);
              const isValidImage = 
                (magicBytes[0] === 0xFF && magicBytes[1] === 0xD8 && magicBytes[2] === 0xFF) || // JPEG
                (magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47) || // PNG
                (magicBytes[0] === 0x47 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46); // GIF
              
              if (!isValidImage) continue;
              
              const base64 = buffer.toString('base64');
              const dataUrl = `data:${contentType};base64,${base64}`;
              
              // Cache the image (only if under size limit) using the original imageUrl
              if (buffer.length <= MAX_IMAGE_SIZE) {
                try {
                  await cacheImage(imageUrl, dataUrl, contentType);
                  console.log(`[OG Image] Successfully cached image for listing ${listing.listingId}`);
                } catch (cacheError) {
                  // Don't fail the request if caching fails
                  console.warn(`[OG Image] Failed to cache image (non-fatal):`, cacheError instanceof Error ? cacheError.message : String(cacheError));
                }
              }
              
              console.log(`[OG Image] Successfully fetched image for listing ${listing.listingId} from ${url}`);
              return dataUrl;
            } catch (error) {
              console.warn(`[OG Image] Error fetching from ${url} for listing ${listing.listingId}:`, error instanceof Error ? error.message : String(error));
              continue;
            }
          }
          
          console.error(`[OG Image] All gateways failed for listing ${listing.listingId}. Tried: ${urlsToTry.join(', ')}`);
        } catch (error) {
          console.error(`[OG Image] Error fetching image for listing ${listing.listingId}:`, error);
        }

        console.warn(`[OG Image] Returning null for listing ${listing.listingId} - image fetch failed`);
        return null;
      })
    );

    // Build fonts array
    const fonts: Array<{ name: string; data: ArrayBuffer; style: 'normal' | 'italic' }> = [];
    if (mekMonoFont) {
      fonts.push({ name: 'MEK-Mono', data: mekMonoFont, style: 'normal' as const });
    }
    if (medodicaFont) {
      fonts.push({ name: 'MedodicaRegular', data: medodicaFont, style: 'normal' as const });
    }
    if (mekSansFont) {
      fonts.push({ name: 'MEKSans-Regular', data: mekSansFont, style: 'normal' as const });
    }

    // Determine listing details for each card
    const now = Math.floor(Date.now() / 1000);
    const cardData = recentListings.map((listing, index) => {
      const endTime = listing.endTime ? parseInt(listing.endTime) : 0;
      const isActive = endTime > now && listing.status === "ACTIVE";
      const listingType = listing.listingType || "INDIVIDUAL_AUCTION";

      const title = listing.title || "Untitled";
      const artistName = listing.artist || null;
      const artistDisplay = artistName ? (artistName.startsWith("@") ? artistName : `@${artistName}`) : (listing.tokenAddress ? truncateAddress(listing.tokenAddress) : "—");

      return {
        title: truncateText(title, 25),
        artist: artistDisplay,
        listingType,
        isActive,
        image: listingImages[index] || null,
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
            background: 'linear-gradient(to bottom right, #000000, #171717)',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            color: 'white',
            fontFamily: 'MEK-Mono',
          }}
        >
          {/* Top: Logo section with overlay text */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {logoDataUrl ? (
              <img
                src={logoDataUrl}
                alt="Cryptoart"
                width={1160}
                height={358}
                style={{
                  width: '1160px',
                  height: '358px',
                  objectFit: 'contain',
                  display: 'block',
                  marginTop: '-20px',
                }}
              />
            ) : (
              <div
                style={{
                  fontSize: 96,
                  fontWeight: 'bold',
                  letterSpacing: '4px',
                  lineHeight: '1.1',
                  fontFamily: 'MEKSans-Regular',
                  marginTop: '-20px',
                }}
              >
                CRYPTOART.SOCIAL
              </div>
            )}
            {/* Overlay text on top half of logo */}
            <div
              style={{
                position: 'absolute',
                top: '24px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: 48,
                fontWeight: 'bold',
                letterSpacing: '2px',
                opacity: 1,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              v1 — Auctionhouse & Marketplace
            </div>
            {/* Membership text overlapping bottom of logo */}
            <div
              style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: 32,
                opacity: 0.7,
                textAlign: 'center',
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              Membership: 0.0001 ETH/month
            </div>
          </div>



          {/* Middle: Recent listings section */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '0 0px',
              flex: 1,
              minHeight: 0,
              marginTop:'-60px'
            }}
          >

            {/* Five cards in a row - 40% of OG image height (252px) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '10px',
                height: '252px',
                minHeight: '252px',
              }}
            >
              {cardData.map((card, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '14px',
                  }}
                >
                  {/* Artwork image - full height */}
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                    }}
                  >
                    {card.image ? (
                      <img
                        src={card.image}
                        alt={card.title}
                        width={212}
                        height={280}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          fontSize: 20,
                          opacity: 0.5,
                        }}
                      >
                        No Image
                      </div>
                    )}
                  </div>

                  {/* Lower-third data pane overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '70px',
                      background: 'linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.7) 100%)',
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '8px',
                      gap: '4px',
                    }}
                  >
                    {/* Title */}
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 'bold',
                        lineHeight: '1.2',
                        marginBottom: '2px',
                      }}
                    >
                      {card.title}
                    </div>

                    {/* Artist and Listing type */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 14,
                        opacity: 0.9,
                      }}
                    >
                      <div>{card.artist}</div>
                      <div>
                        {card.listingType === "INDIVIDUAL_AUCTION" ? "Auction" :
                         card.listingType === "FIXED_PRICE" ? "Fixed Price" :
                         card.listingType === "OFFERS_ONLY" ? "Offers Only" :
                         card.listingType === "DYNAMIC_PRICE" ? "Dynamic Price" :
                         "Listing"}
                      </div>
                    </div>
                  </div>

                  {/* Green dot for active listings */}
                  {card.isActive && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        width: '12px',
                        height: '12px',
                        backgroundColor: '#00ff00',
                        borderRadius: '50%',
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
          // Cache for 6 hours (21600 seconds)
          'Cache-Control': 'public, max-age=21600, s-maxage=21600, immutable',
        },
      }
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
      fetch(`${baseUrl}/MEK-Mono.otf`).then((res) => res.arrayBuffer()).catch(() => null),
      fetch(`${baseUrl}/MEKSans-Regular.otf`).then((res) => res.arrayBuffer()).catch(() => null),
      fetch(`${baseUrl}/cryptoart-logo-wgmeets-og-wide.png`).then((res) => {
        if (!res.ok) {
          console.error(`[OG Image Fallback] Logo fetch failed with status: ${res.status}`);
          return null;
        }
        return res.arrayBuffer();
      }).catch((error) => {
        console.error(`[OG Image Fallback] Error fetching logo:`, error);
        return null;
      }),
    ]);
    
    // Convert logo to base64 data URL
    let fallbackLogoDataUrl: string | null = null;
    if (logoResponse) {
      try {
        const buffer = Buffer.from(logoResponse);
        const base64 = buffer.toString('base64');
        fallbackLogoDataUrl = `data:image/png;base64,${base64}`;
        console.log(`[OG Image Fallback] Logo loaded successfully, size: ${buffer.length} bytes`);
      } catch (error) {
        console.error(`[OG Image Fallback] Error processing logo:`, error);
      }
    } else {
      console.warn(`[OG Image Fallback] Logo response was null`);
    }
    
    const fallbackFonts: Array<{ name: string; data: ArrayBuffer; style: 'normal' | 'italic' }> = [];
    if (mekMonoFont) {
      fallbackFonts.push({ name: 'MEK-Mono', data: mekMonoFont, style: 'normal' as const });
    }
    if (mekSansFont) {
      fallbackFonts.push({ name: 'MEKSans-Regular', data: mekSansFont, style: 'normal' as const });
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
            justifyContent: 'flex-start',
            alignItems: 'center',
            padding: '20px',
            color: 'white',
            fontFamily: 'MEK-Mono',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {fallbackLogoDataUrl ? (
              <img
                src={fallbackLogoDataUrl}
                alt="Cryptoart"
                width={1160}
                height={358}
                style={{
                  width: '1160px',
                  height: '358px',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            ) : (
              <div
                style={{
                  fontSize: 96,
                  fontWeight: 'bold',
                  letterSpacing: '4px',
                  lineHeight: '1.1',
                  fontFamily: 'MEKSans-Regular',
                }}
              >
                CRYPTOART.SOCIAL
              </div>
            )}
            {/* Overlay text on top half of logo */}
            <div
              style={{
                position: 'absolute',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: 48,
                fontWeight: 'bold',
                letterSpacing: '2px',
                opacity: 1,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              v1 — Auctionhouse & Marketplace
            </div>
            {/* Membership text overlapping bottom of logo */}
            <div
              style={{
                position: 'absolute',
                bottom: '50px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: 32,
                opacity: 0.7,
                textAlign: 'center',
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              Membership: 0.0001 ETH/month to LIST and CAST ♦ Curate Culture ♥ Collect art
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: fallbackFonts.length > 0 ? fallbackFonts : undefined,
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=300',
        },
      }
    );
  }
}

