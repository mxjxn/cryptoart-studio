import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getCachedImage, cacheImage } from "~/lib/server/image-cache";
import { processMediaForImage } from "~/lib/server/media-processor";
import type { EnrichedAuctionData } from "~/lib/types";
import { getHiddenUserAddresses } from "~/lib/server/auction";
import { browseListings } from "~/lib/server/browse-listings";
import sharp from 'sharp';
import { OG_IMAGE_CACHE_CONTROL_SUCCESS, OG_IMAGE_CACHE_CONTROL_ERROR } from "~/lib/constants";
import { isDataURI } from "~/lib/media-utils";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Required for processMediaForImage (uses child_process, fs)

/**
 * Convert WebP data URL to PNG data URL
 * ImageResponse (Satori) doesn't support WebP, only PNG/JPEG
 */
async function convertWebPDataUrlToPNG(webpDataUrl: string): Promise<string> {
  try {
    const base64Data = webpDataUrl.split(',')[1];
    if (!base64Data) {
      throw new Error('Invalid data URL format');
    }
    
    const webpBuffer = Buffer.from(base64Data, 'base64');
    const pngBuffer = await sharp(webpBuffer)
      .png({ compressionLevel: 6 })
      .toBuffer();
    
    const pngBase64 = pngBuffer.toString('base64');
    return `data:image/png;base64,${pngBase64}`;
  } catch (error) {
    console.error(`[OG Image] Error converting WebP to PNG:`, error instanceof Error ? error.message : String(error));
    return webpDataUrl;
  }
}

/**
 * Truncate text to max length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Truncate address to 0x1234...5678 format
 */
function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const refresh = url.searchParams.get('refresh') === 'true';
    
    // Load logo
    let logoDataUrl: string | null = null;
    try {
      const logoResponse = await fetch(`${baseUrl}/cryptoart-logo-wgmeets-og-wide.png`, {
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (logoResponse.ok) {
        const buffer = Buffer.from(await logoResponse.arrayBuffer());
        const base64 = buffer.toString('base64');
        logoDataUrl = `data:image/png;base64,${base64}`;
        console.log(`[OG Image] [Market] Logo loaded successfully, size: ${buffer.length} bytes`);
      }
    } catch (error) {
      console.error(`[OG Image] [Market] Error fetching logo:`, error);
    }

    // Fetch recent listings from browse API
    let recentListings: EnrichedAuctionData[] = [];
    try {
      const hiddenAddresses = await getHiddenUserAddresses();
      const result = await browseListings({
        first: 5,
        skip: 0,
        orderBy: 'createdAt',
        orderDirection: 'desc',
        hiddenUserAddresses: hiddenAddresses,
        enrich: true,
      });
      recentListings = result.listings.slice(0, 5);
      console.log(`[OG Image] [Market] Fetched ${recentListings.length} recent listings`);
    } catch (error) {
      console.error(`[OG Image] [Market] Error fetching listings:`, error);
    }

    // Fetch and process images for listings
    const listingImages = await Promise.all(
      recentListings.map(async (listing) => {
        const imageUrl = listing.thumbnailUrl || listing.image || listing.metadata?.image;
        if (!imageUrl) {
          console.warn(`[OG Image] [Market] No image URL for listing ${listing.listingId}`);
          return null;
        }

        // Handle data URIs directly
        if (isDataURI(imageUrl)) {
          if (imageUrl.startsWith('data:image/webp;base64,')) {
            return await convertWebPDataUrlToPNG(imageUrl);
          }
          return imageUrl;
        }

        // Helper to detect if URL is a Vercel Blob thumbnail (already optimized)
        const isVercelBlobThumbnail = (url: string): boolean => {
          return url.includes('.public.blob.vercel-storage.com') || 
                 url.includes('vercel-storage.com') ||
                 (url.includes('/thumbnails/') && url.includes('.webp'));
        };

        // Check cache first (skip if refresh=true)
        if (!refresh) {
          const cached = await getCachedImage(imageUrl);
          if (cached) {
            if (cached.startsWith('data:image/webp;base64,')) {
              return await convertWebPDataUrlToPNG(cached);
            }
            return cached;
          }
        }

        // Convert IPFS URLs to HTTP gateway URLs
        let httpUrl = imageUrl;
        if (imageUrl.startsWith('ipfs://')) {
          const hash = imageUrl.replace('ipfs://', '');
          const gateway = process.env.IPFS_GATEWAY_URL || process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://cloudflare-ipfs.com';
          httpUrl = `${gateway}/ipfs/${hash}`;
        } else if (imageUrl.includes('/ipfs/') && !imageUrl.startsWith('http')) {
          const hash = imageUrl.split('/ipfs/')[1]?.split('/')[0];
          if (hash) {
            const gateway = process.env.IPFS_GATEWAY_URL || process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://cloudflare-ipfs.com';
            httpUrl = `${gateway}/ipfs/${hash}`;
          }
        }

        const isOptimizedThumbnail = isVercelBlobThumbnail(imageUrl);

        // Fetch image
        try {
          const gateways = [
            process.env.IPFS_GATEWAY_URL || process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://cloudflare-ipfs.com",
            "https://ipfs.io",
            "https://gateway.pinata.cloud",
          ];
          
          const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
          const MAX_MEDIA_SIZE = 10 * 1024 * 1024; // 10MB for videos/GIFs
          
          let urlsToTry = [httpUrl];
          if (httpUrl.includes('/ipfs/')) {
            const ipfsHash = httpUrl.split('/ipfs/')[1]?.split('/')[0];
            if (ipfsHash) {
              const otherGateways = gateways.filter(gw => !httpUrl.startsWith(gw));
              urlsToTry = [httpUrl, ...otherGateways.map(gw => `${gw}/ipfs/${ipfsHash}`)];
            }
          }

          for (const url of urlsToTry) {
            try {
              const response = await fetch(url, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; OG-Image-Bot/1.0)',
                },
                signal: AbortSignal.timeout(15000),
              });
              
              if (!response.ok) continue;
              
              const contentType = response.headers.get('content-type') || '';
              if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) continue;
              
              const urlIsOptimizedThumbnail = isVercelBlobThumbnail(url);
              const maxSize = urlIsOptimizedThumbnail 
                ? 5 * 1024 * 1024
                : (contentType.startsWith('video/') ? MAX_MEDIA_SIZE : MAX_IMAGE_SIZE);
              
              const contentLength = response.headers.get('content-length');
              if (contentLength) {
                const size = parseInt(contentLength, 10);
                if (size > maxSize) {
                  console.warn(`[OG Image] [Market] Media too large (${size} bytes > ${maxSize} bytes) for ${url}, skipping...`);
                  continue;
                }
              }
              
              const arrayBuffer = await response.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              
              if (buffer.length > maxSize) {
                console.warn(`[OG Image] [Market] Media too large after download (${buffer.length} bytes > ${maxSize} bytes) for ${url}, skipping...`);
                continue;
              }
              
              // For optimized Vercel Blob thumbnails (WebP), convert to PNG
              if (urlIsOptimizedThumbnail && contentType === 'image/webp') {
                try {
                  const pngBuffer = await sharp(buffer)
                    .png({ compressionLevel: 6 })
                    .toBuffer();
                  const base64 = pngBuffer.toString('base64');
                  const dataUrl = `data:image/png;base64,${base64}`;
                  
                  try {
                    await cacheImage(imageUrl, dataUrl, 'image/png');
                  } catch (cacheError) {
                    console.warn(`[OG Image] [Market] Failed to cache converted thumbnail (non-fatal):`, cacheError instanceof Error ? cacheError.message : String(cacheError));
                  }
                  
                  return dataUrl;
                } catch (conversionError) {
                  console.warn(`[OG Image] [Market] Failed to convert WebP thumbnail to PNG, will process normally:`, conversionError instanceof Error ? conversionError.message : String(conversionError));
                }
              }
              
              // Process media (scales down large images)
              const processed = await processMediaForImage(buffer, contentType, url);
              if (!processed) {
                console.warn(`[OG Image] [Market] Failed to process media for listing ${listing.listingId} from ${url}`);
                continue;
              }
              
              let finalDataUrl = processed.dataUrl;
              if (processed.dataUrl.startsWith('data:image/webp;base64,')) {
                finalDataUrl = await convertWebPDataUrlToPNG(processed.dataUrl);
              }
              
              try {
                await cacheImage(imageUrl, finalDataUrl, 'image/png');
              } catch (cacheError) {
                console.warn(`[OG Image] [Market] Failed to cache image (non-fatal):`, cacheError instanceof Error ? cacheError.message : String(cacheError));
              }
              
              return finalDataUrl;
            } catch (error) {
              console.warn(`[OG Image] [Market] Error fetching from ${url}:`, error instanceof Error ? error.message : String(error));
              continue;
            }
          }
          
          console.error(`[OG Image] [Market] All gateways failed for listing ${listing.listingId}`);
        } catch (error) {
          console.error(`[OG Image] [Market] Error fetching image for listing ${listing.listingId}:`, error);
        }

        return null;
      })
    );

    // Validate and convert WebP data URLs to PNG
    const MAX_DATA_URL_SIZE = 2 * 1024 * 1024; // 2MB limit for data URLs
    const validatedImages = await Promise.all(
      listingImages.map(async (imageUrl) => {
        if (!imageUrl) return null;
        
        if (!imageUrl.startsWith('data:image/')) {
          console.warn(`[OG Image] [Market] Invalid data URL format, skipping`);
          return null;
        }
        
        if (imageUrl.length > MAX_DATA_URL_SIZE) {
          console.warn(`[OG Image] [Market] Data URL too large (${imageUrl.length} bytes), skipping`);
          return null;
        }
        
        if (imageUrl.startsWith('data:image/webp;base64,')) {
          try {
            return await convertWebPDataUrlToPNG(imageUrl);
          } catch (error) {
            console.error(`[OG Image] [Market] Error converting WebP to PNG:`, error);
            return null;
          }
        }
        
        return imageUrl;
      })
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
        ? (artistName.startsWith("@") ? artistName : `@${artistName}`) 
        : (listing.tokenAddress ? truncateAddress(listing.tokenAddress) : "—");

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
            background: 'linear-gradient(to bottom right, #000000, #171717)',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            color: 'white',
            fontFamily: 'system-ui',
          }}
        >
          {/* Top: Logo section */}
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
                }}
              >
                CRYPTOART.SOCIAL
              </div>
            )}
            {/* Overlay text */}
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
              }}
            >
              Market — Browse All Listings
            </div>
          </div>

          {/* Bottom: Five listing cards */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: '10px',
              height: '252px',
              padding: '0 20px 20px 20px',
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
                {/* Artwork image */}
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
                  {card.image && (
                    <img
                      src={card.image}
                      alt={card.title}
                      width={220}
                      height={252}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': OG_IMAGE_CACHE_CONTROL_SUCCESS,
        },
      }
    );
  } catch (error) {
    console.error(`[OG Image] [Market] Fatal error:`, error);
    if (error instanceof Error) {
      console.error(`[OG Image] [Market] Error stack:`, error.stack);
    }
    
    // Return fallback image
    try {
      const url = new URL(request.url);
      const baseUrl = `${url.protocol}//${url.host}`;
      const logoResponse = await fetch(`${baseUrl}/cryptoart-logo-wgmeets-og-wide.png`).then(res => res.ok ? res.arrayBuffer() : null).catch(() => null);
      
      let fallbackLogoDataUrl: string | null = null;
      if (logoResponse) {
        const buffer = Buffer.from(logoResponse);
        const base64 = buffer.toString('base64');
        fallbackLogoDataUrl = `data:image/png;base64,${base64}`;
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
              justifyContent: 'center',
              alignItems: 'center',
              padding: '80px',
              color: 'white',
              fontFamily: 'system-ui',
            }}
          >
            {fallbackLogoDataUrl ? (
              <img
                src={fallbackLogoDataUrl}
                alt="Cryptoart"
                width={800}
                height={246}
                style={{
                  width: '800px',
                  height: '246px',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <div style={{ fontSize: 96, fontWeight: 'bold', letterSpacing: '4px' }}>
                CRYPTOART.SOCIAL
              </div>
            )}
            <div style={{ fontSize: 48, marginTop: '40px', opacity: 0.8 }}>
              Market
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 630,
          headers: {
            'Cache-Control': OG_IMAGE_CACHE_CONTROL_ERROR,
          },
        }
      );
    } catch (fallbackError) {
      console.error(`[OG Image] [Market] Even fallback failed:`, fallbackError);
      return new Response('OG Image generation failed', { status: 500 });
    }
  }
}
