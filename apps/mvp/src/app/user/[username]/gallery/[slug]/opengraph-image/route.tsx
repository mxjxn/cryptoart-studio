import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { APP_URL } from "~/lib/constants";
import { getCachedImage, cacheImage } from "~/lib/server/image-cache";
import { isDataURI } from "~/lib/media-utils";
import { processMediaForImage } from "~/lib/server/media-processor";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Required for processMediaForImage (uses child_process, fs)

// Helper to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

/**
 * Fetch gallery data with listings
 */
async function getGalleryData(username: string, slug: string) {
  try {
    const response = await fetch(
      `${APP_URL}/api/curation/user/${encodeURIComponent(username)}/gallery/${encodeURIComponent(slug)}`,
      {
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`[Gallery OG Image] Error fetching gallery data:`, error);
    return null;
  }
}

/**
 * Process and cache artwork image for OG image
 */
async function processArtworkImage(imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null;
  
  // Handle data URIs directly
  if (isDataURI(imageUrl)) {
    return imageUrl;
  }
  
  // Check cache first
  const cached = await getCachedImage(imageUrl);
  if (cached) {
    return cached;
  }
  
  // Convert IPFS URLs to HTTP gateway URLs
  let url = imageUrl;
  if (url.startsWith('ipfs://')) {
    const hash = url.replace('ipfs://', '');
    const gateway = process.env.IPFS_GATEWAY_URL || process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://cloudflare-ipfs.com';
    url = `${gateway}/ipfs/${hash}`;
  } else if (url.includes('/ipfs/') && !url.startsWith('http')) {
    const hash = url.split('/ipfs/')[1]?.split('/')[0];
    if (hash) {
      const gateway = process.env.IPFS_GATEWAY_URL || process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://cloudflare-ipfs.com';
      url = `${gateway}/ipfs/${hash}`;
    }
  }
  
  // Fetch and process image
  try {
    const gateways = [
      process.env.IPFS_GATEWAY_URL || process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://cloudflare-ipfs.com",
      "https://ipfs.io",
      "https://gateway.pinata.cloud",
    ];
    
    let urlsToTry = [url];
    if (url.includes('/ipfs/')) {
      const ipfsHash = url.split('/ipfs/')[1]?.split('/')[0];
      if (ipfsHash) {
        const otherGateways = gateways.filter(gw => !url.startsWith(gw));
        urlsToTry = [url, ...otherGateways.map(gw => `${gw}/ipfs/${ipfsHash}`)];
      }
    }
    
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
    
    for (const tryUrl of urlsToTry) {
      try {
        const response = await fetch(tryUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; OG-Image-Bot/1.0)',
          },
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });
        
        if (!response.ok) continue;
        
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) continue;
        
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE) continue;
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        if (buffer.length > MAX_IMAGE_SIZE) continue;
        
        // Process media (handles images, videos, and GIFs)
        const processed = await processMediaForImage(buffer, contentType, tryUrl);
        if (!processed) continue;
        
        const dataUrl = processed.dataUrl;
        
        // Cache the processed image
        try {
          await cacheImage(imageUrl, dataUrl, 'image/png');
        } catch (cacheError) {
          // Don't fail if caching fails
          console.warn(`[Gallery OG Image] Failed to cache image (non-fatal):`, cacheError);
        }
        
        return dataUrl;
      } catch (error) {
        console.warn(`[Gallery OG Image] Error fetching from ${tryUrl}:`, error);
        continue;
      }
    }
  } catch (error) {
    console.error(`[Gallery OG Image] Error processing artwork image:`, error);
  }
  
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string; slug: string }> }
) {
  try {
    const { username, slug } = await params;
    const url = new URL(request.url);
    const baseUrl = `https://${url.host}`;
    const fontUrl = `${baseUrl}/MEK-Mono.otf`;
    
    // Load font
    let fontData: ArrayBuffer;
    try {
      const fontResponse = await fetch(fontUrl, {
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
      console.error(`[Gallery OG Image] Error loading font:`, error);
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
              Gallery
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 800,
        }
      );
    }
    
    // Fetch gallery data
    const galleryData = await withTimeout(
      getGalleryData(username, slug),
      5000,
      null
    );
    
    if (!galleryData || !galleryData.gallery) {
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
              Gallery Not Found
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 96,
                opacity: 0.7,
              }}
            >
              @{username}/{slug}
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
    
    const gallery = galleryData.gallery;
    const listings = gallery.listings || [];
    const itemCount = gallery.itemCount || 0;
    
    // Get up to 6 artworks for the grid (2x3 or 3x2)
    const artworksToShow = listings.slice(0, 6);
    
    // Process artwork images in parallel (with timeout)
    const artworkImages = await Promise.all(
      artworksToShow.map(async (listing: any) => {
        const imageUrl = listing.thumbnailUrl || listing.image || listing.metadata?.image;
        if (!imageUrl) return null;
        return await withTimeout(processArtworkImage(imageUrl), 8000, null);
      })
    );
    
    // Filter out nulls
    const validArtworkImages = artworkImages.filter(Boolean) as string[];
    
    // Layout: Show 2x3 grid if we have images, otherwise show title/description
    const hasImages = validArtworkImages.length > 0;
    const gridCols = 3;
    const gridRows = 2;
    const imageSize = 320; // Size for each grid cell
    const gap = 20;
    
    return new ImageResponse(
      (
        <div
          style={{
            background: 'linear-gradient(to bottom right, #000000, #1a1a1a)',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '80px 60px',
            color: 'white',
            fontFamily: 'MEK-Mono',
          }}
        >
          {/* Header: Gallery title and curator */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginBottom: '40px',
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
              {gallery.title || 'Untitled Gallery'}
            </div>
            {gallery.description && (
              <div
                style={{
                  display: 'flex',
                  fontSize: 48,
                  opacity: 0.8,
                  letterSpacing: '1px',
                  lineHeight: '1.2',
                  maxWidth: '800px',
                }}
              >
                {gallery.description.length > 100 
                  ? `${gallery.description.slice(0, 97)}...` 
                  : gallery.description}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                fontSize: 40,
                opacity: 0.7,
                letterSpacing: '1px',
                marginTop: '12px',
              }}
            >
              by @{username} • {itemCount} {itemCount === 1 ? 'artwork' : 'artworks'}
            </div>
          </div>
          
          {/* Artwork grid */}
          {hasImages && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: `${gap}px`,
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
              }}
            >
              {validArtworkImages.map((imageUrl, index) => (
                <img
                  key={index}
                  src={imageUrl}
                  alt={`Artwork ${index + 1}`}
                  width={imageSize}
                  height={imageSize}
                  style={{
                    width: `${imageSize}px`,
                    height: `${imageSize}px`,
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '2px solid #333333',
                  }}
                />
              ))}
            </div>
          )}
          
          {/* Fallback if no images */}
          {!hasImages && (
            <div
              style={{
                display: 'flex',
                fontSize: 64,
                opacity: 0.6,
                letterSpacing: '1px',
                marginTop: '40px',
              }}
            >
              {itemCount > 0 
                ? `${itemCount} ${itemCount === 1 ? 'artwork' : 'artworks'} in this gallery`
                : 'Empty gallery'}
            </div>
          )}
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
  } catch (error) {
    console.error(`[Gallery OG Image] Fatal error:`, error);
    if (error instanceof Error) {
      console.error(`[Gallery OG Image] Error stack:`, error.stack);
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
          }}
        >
          <div style={{ display: 'flex', fontSize: 192, fontWeight: 'bold' }}>
            cryptoart.social
          </div>
          <div style={{ display: 'flex', fontSize: 96, marginTop: '72px' }}>
            Error loading gallery
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
