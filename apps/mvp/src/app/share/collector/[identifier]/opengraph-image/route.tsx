import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { formatEther } from "viem";
import { getCachedImage, cacheImage } from "~/lib/server/image-cache";
import { isDataURI } from "~/lib/media-utils";
import { processMediaForImage } from "~/lib/server/media-processor";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Required for processMediaForImage (uses child_process, fs)

/**
 * Format price with proper decimals
 */
function formatPrice(amount: string): string {
  try {
    const value = BigInt(amount || "0");
    const divisor = BigInt(10 ** 18);
    const wholePart = value / divisor;
    const fractionalPart = value % divisor;

    if (fractionalPart === BigInt(0)) {
      return wholePart.toString();
    }

    let fractionalStr = fractionalPart.toString().padStart(18, "0");
    fractionalStr = fractionalStr.replace(/0+$/, "");
    if (fractionalStr.length > 4) {
      fractionalStr = fractionalStr.slice(0, 4);
    }

    return `${wholePart}.${fractionalStr}`;
  } catch {
    return "0";
  }
}

/**
 * Format artist list: "artist1, artist2, artist3, and X more"
 */
function formatArtists(artists: Array<{ displayName?: string | null; username?: string | null; seller: string }>, maxShown: number = 3): string {
  if (artists.length === 0) return "No artists yet";
  
  const shown = artists.slice(0, maxShown);
  const remaining = artists.length - maxShown;
  
  const names = shown.map(a => a.displayName || a.username || `${a.seller.slice(0, 6)}...${a.seller.slice(-4)}`);
  
  if (remaining > 0) {
    return `${names.join(", ")}, and ${remaining} more`;
  }
  
  if (names.length === 1) {
    return names[0];
  }
  
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  
  // 3 or more
  const last = names.pop();
  return `${names.join(", ")}, and ${last}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params;
    const url = new URL(request.url);
    const baseUrl = `https://${url.host}`;
    
    // Fetch user data
    const userResponse = await fetch(`${baseUrl}/api/user/${encodeURIComponent(identifier)}`, {
      headers: {
        'User-Agent': 'OG-Image-Bot/1.0',
      },
    });
    
    if (!userResponse.ok) {
      // Return default image if user not found
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
              Collector Profile
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 800,
        }
      );
    }
    
    const userData = await userResponse.json();
    
    if (!userData.success || !userData.purchases || userData.purchases.length === 0) {
      // No purchases - show empty state
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
            <div style={{ display: 'flex', fontSize: 120, fontWeight: 'bold', marginBottom: '40px' }}>
              {userData.user?.displayName || userData.user?.username || `${identifier.slice(0, 6)}...${identifier.slice(-4)}`}
            </div>
            <div style={{ display: 'flex', fontSize: 64, opacity: 0.7 }}>
              No artworks collected yet
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 800,
        }
      );
    }
    
    // Calculate stats
    const purchases = userData.purchases || [];
    const itemsPurchased = purchases.length;
    const totalSpent = purchases.reduce((sum: bigint, p: any) => {
      try {
        return sum + BigInt(p.amount || "0");
      } catch {
        return sum;
      }
    }, BigInt(0));
    
    const totalSpentFormatted = formatPrice(totalSpent.toString());
    const artistsSupported = userData.collectedFrom || [];
    const artistsText = formatArtists(artistsSupported);
    
    // Get up to 3 images from purchases (only ones that resolve)
    const imageUrls: string[] = [];
    for (const purchase of purchases.slice(0, 10)) {
      const imageUrl = purchase.metadata?.image || purchase.listing?.metadata?.image;
      if (imageUrl && imageUrls.length < 3) {
        // Check if it's a valid URL
        if (imageUrl.startsWith('http') || imageUrl.startsWith('ipfs://') || isDataURI(imageUrl)) {
          imageUrls.push(imageUrl);
        }
      }
    }
    
    // Process images to data URLs (with timeout) - limit to 3
    const processedImages: string[] = [];
    for (const imageUrl of imageUrls.slice(0, 3)) {
      if (processedImages.length >= 3) break;
      
      try {
        let processedUrl = imageUrl;
        
        if (isDataURI(imageUrl)) {
          processedUrl = imageUrl;
        } else {
          // Check cache first
          const cached = await getCachedImage(imageUrl);
          if (cached) {
            processedUrl = cached;
          } else {
            // Fetch and process
            const response = await fetch(imageUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; OG-Image-Bot/1.0)',
              },
              signal: AbortSignal.timeout(5000),
            });
            
            if (response.ok) {
              const contentType = response.headers.get('content-type') || '';
              if (contentType.startsWith('image/')) {
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                
                if (buffer.length < 5 * 1024 * 1024) { // 5MB limit
                  const processed = await processMediaForImage(buffer, contentType, imageUrl);
                  if (processed) {
                    processedUrl = processed.dataUrl;
                    await cacheImage(imageUrl, processedUrl, 'image/png');
                  }
                }
              }
            }
          }
        }
        
        processedImages.push(processedUrl);
      } catch (error) {
        console.error(`Error processing image ${imageUrl}:`, error);
        // Skip this image
      }
    }
    
    const displayName = userData.user?.displayName || 
                       userData.user?.username || 
                       `${identifier.slice(0, 6)}...${identifier.slice(-4)}`;
    
    return new ImageResponse(
      (
        <div
          style={{
            background: 'linear-gradient(to bottom right, #000000, #1a1a1a)',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '80px',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background images (up to 3) */}
          {processedImages.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                opacity: 0.15,
                zIndex: 0,
              }}
            >
              {processedImages.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt=""
                  style={{
                    width: `${100 / processedImages.length}%`,
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ))}
            </div>
          )}
          
          {/* Content overlay */}
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              justifyContent: 'space-between',
            }}
          >
            {/* Top section: Collector name */}
            <div>
              <div
                style={{
                  fontSize: 120,
                  fontWeight: 'bold',
                  marginBottom: '20px',
                  lineHeight: '1.1',
                }}
              >
                {displayName}
              </div>
              <div
                style={{
                  fontSize: 48,
                  opacity: 0.8,
                  marginBottom: '60px',
                }}
              >
                Collector Profile
              </div>
            </div>
            
            {/* Middle section: Stats */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '40px',
              }}
            >
              <div
                style={{
                  fontSize: 64,
                  fontWeight: 'bold',
                }}
              >
                {itemsPurchased} {itemsPurchased === 1 ? 'item' : 'items'} purchased
              </div>
              
              <div
                style={{
                  fontSize: 64,
                  fontWeight: 'bold',
                }}
              >
                {totalSpentFormatted} ETH total spent
              </div>
              
              <div
                style={{
                  fontSize: 48,
                  lineHeight: '1.3',
                  maxWidth: '90%',
                }}
              >
                Artists supported: {artistsText}
              </div>
            </div>
            
            {/* Bottom: Branding */}
            <div
              style={{
                fontSize: 32,
                opacity: 0.6,
                marginTop: 'auto',
              }}
            >
              cryptoart.social
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate',
        },
      }
    );
  } catch (error) {
    console.error(`[OG Image] Fatal error in collector OG image route:`, error);
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
            Collector Profile
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

