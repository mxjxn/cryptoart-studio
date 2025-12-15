import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { APP_URL, OG_IMAGE_CACHE_CONTROL_SUCCESS, OG_IMAGE_CACHE_CONTROL_ERROR } from "~/lib/constants";
import { getCachedImage, cacheImage } from "~/lib/server/image-cache";
import { isDataURI } from "~/lib/media-utils";
import { processMediaForImage } from "~/lib/server/media-processor";
import sharp from 'sharp';

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
    console.error(`[Gallery OG Image] Error converting WebP to PNG:`, error instanceof Error ? error.message : String(error));
    return webpDataUrl;
  }
}

/**
 * Helper to detect if URL is a Vercel Blob thumbnail (already optimized)
 */
function isVercelBlobThumbnail(url: string): boolean {
  return url.includes('.public.blob.vercel-storage.com') || 
         url.includes('vercel-storage.com') ||
         (url.includes('/thumbnails/') && url.includes('.webp'));
}

/**
 * Process and cache artwork image for OG image
 * Applies lessons learned from listing page OG image generation
 */
async function processArtworkImage(imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null;
  
  // Handle data URIs directly - convert WebP to PNG if needed
  if (isDataURI(imageUrl)) {
    if (imageUrl.startsWith('data:image/webp;base64,')) {
      return await convertWebPDataUrlToPNG(imageUrl);
    }
    return imageUrl;
  }
  
  // Check cache first
  const cached = await getCachedImage(imageUrl);
  if (cached) {
    // Convert WebP to PNG if cached image is WebP
    if (cached.startsWith('data:image/webp;base64,')) {
      return await convertWebPDataUrlToPNG(cached);
    }
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
  
  const urlIsOptimizedThumbnail = isVercelBlobThumbnail(url);
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
  const MAX_MEDIA_SIZE = 10 * 1024 * 1024; // 10MB for videos/GIFs
  
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
    
    let fetchedContentType: string | null = null;
    
    for (const tryUrl of urlsToTry) {
      try {
        const response = await fetch(tryUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; OG-Image-Bot/1.0)',
          },
          signal: AbortSignal.timeout(15000), // 15 second timeout
        });
        
        if (!response.ok) continue;
        
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) continue;
        
        const maxSize = urlIsOptimizedThumbnail 
          ? 5 * 1024 * 1024 // 5MB for optimized thumbnails
          : (contentType.startsWith('video/') ? MAX_MEDIA_SIZE : MAX_IMAGE_SIZE);
        
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > maxSize) continue;
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        if (buffer.length > maxSize) continue;
        
        // For optimized Vercel Blob thumbnails (WebP), convert to PNG directly
        if (urlIsOptimizedThumbnail && contentType === 'image/webp') {
          try {
            const pngBuffer = await sharp(buffer)
              .png({ compressionLevel: 6 })
              .toBuffer();
            const base64 = pngBuffer.toString('base64');
            const dataUrl = `data:image/png;base64,${base64}`;
            fetchedContentType = 'image/png';
            
            await cacheImage(imageUrl, dataUrl, fetchedContentType);
            return dataUrl;
          } catch (conversionError) {
            console.warn(`[Gallery OG Image] Failed to convert WebP thumbnail to PNG, using normal processing:`, conversionError);
            // Fall through to normal processing
          }
        }
        
        // Process media (handles images, videos, and GIFs)
        const processed = await processMediaForImage(buffer, contentType, tryUrl);
        if (!processed) continue;
        
        fetchedContentType = 'image/png'; // Processed images are always PNG
        const dataUrl = processed.dataUrl;
        
        // Convert WebP data URLs to PNG if needed
        let finalDataUrl = dataUrl;
        if (dataUrl.startsWith('data:image/webp;base64,')) {
          finalDataUrl = await convertWebPDataUrlToPNG(dataUrl);
        }
        
        // Cache the processed image
        try {
          await cacheImage(imageUrl, finalDataUrl, fetchedContentType);
        } catch (cacheError) {
          console.warn(`[Gallery OG Image] Failed to cache image (non-fatal):`, cacheError);
        }
        
        return finalDataUrl;
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
    
    // Get up to 3 artworks for the closeup view
    const artworksToShow = listings.slice(0, 3);
    
    // Process artwork images in parallel (with timeout)
    const artworkImages = await Promise.all(
      artworksToShow.map(async (listing: any) => {
        const imageUrl = listing.thumbnailUrl || listing.image || listing.metadata?.image;
        if (!imageUrl) return null;
        return await withTimeout(processArtworkImage(imageUrl), 8000, null);
      })
    );
    
    // Filter out nulls and validate data URLs
    const MAX_DATA_URL_SIZE = 2 * 1024 * 1024; // 2MB limit for data URLs in ImageResponse
    const validArtworkImages = artworkImages
      .filter((img): img is string => {
        if (!img) return false;
        // Validate data URL format and size
        if (!img.startsWith('data:image/')) return false;
        if (img.length > MAX_DATA_URL_SIZE) {
          console.warn(`[Gallery OG Image] Image data URL too large (${img.length} bytes), skipping`);
          return false;
        }
        return true;
      })
      .map(img => {
        // Convert WebP to PNG if needed
        if (img.startsWith('data:image/webp;base64,')) {
          // This will be handled synchronously - we'll convert before rendering
          return img;
        }
        return img;
      });
    
    const hasImages = validArtworkImages.length > 0;
    
    // Convert WebP data URLs to PNG before rendering
    const validatedImages = await Promise.all(
      validArtworkImages.map(async (img) => {
        if (img.startsWith('data:image/webp;base64,')) {
          return await convertWebPDataUrlToPNG(img);
        }
        return img;
      })
    );
    
    // Calculate layout: 3 images side by side, each taking 1/3 width minus margins
    // Each image is 100% height, width is calculated to fit 3 images with 2px margins
    const imageCount = Math.min(validatedImages.length, 3);
    const marginWidth = 2; // 2px black margin between images
    const totalMargins = imageCount > 1 ? (imageCount - 1) * marginWidth : 0;
    const imageWidth = imageCount > 0 ? Math.floor((1200 - totalMargins) / imageCount) : 0;
    
    return new ImageResponse(
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
          {/* Background: 3 images side by side, full height, 2px black margins */}
          {hasImages && imageCount > 0 && (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'row',
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            >
              {validatedImages.slice(0, 3).map((imageUrl, index) => (
                <div
                  key={index}
                  style={{
                    width: `${imageWidth}px`,
                    height: '100%',
                    marginRight: index < imageCount - 1 ? `${marginWidth}px` : '0',
                    backgroundColor: '#000000', // Black margin/background
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={imageUrl}
                    alt={`Artwork ${index + 1}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center',
                      display: 'flex',
                    }}
                  />
                </div>
              ))}
            </div>
          )}
          
          {/* Fallback background if no images */}
          {!hasImages && (
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

          {/* Top section: Gallery title and curator */}
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
                fontSize: 72,
                fontWeight: 'bold',
                lineHeight: '1.1',
                letterSpacing: '2px',
                marginBottom: '12px',
              }}
            >
              {gallery.title || 'Untitled Gallery'}
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 40,
                opacity: 0.9,
                letterSpacing: '1px',
              }}
            >
              by @{username} • {itemCount} {itemCount === 1 ? 'artwork' : 'artworks'}
            </div>
          </div>

          {/* Bottom section: Description if available */}
          {gallery.description && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: '100%',
                height: '33.33%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                padding: '60px 80px',
                color: 'white',
                fontFamily: 'system-ui',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 40,
                  opacity: 0.9,
                  letterSpacing: '1px',
                  lineHeight: '1.2',
                }}
              >
                {gallery.description.length > 120 
                  ? `${gallery.description.slice(0, 117)}...` 
                  : gallery.description}
              </div>
            </div>
          )}
        </div>
      ),
      {
        width: 1200,
        height: 800,
        headers: {
          'Cache-Control': OG_IMAGE_CACHE_CONTROL_SUCCESS,
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
