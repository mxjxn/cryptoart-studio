import { NextRequest, NextResponse } from 'next/server';
import { getOrGenerateThumbnail } from '~/lib/server/thumbnail-generator';
import { getCachedThumbnail } from '~/lib/server/thumbnail-cache';

/**
 * GET /api/thumbnails?imageUrl=...&size=medium
 * 
 * Returns a thumbnail URL for an image.
 * 
 * Query parameters:
 * - imageUrl: The original image URL (required)
 * - size: Thumbnail size - 'small' (200x200), 'medium' (500x500), 'large' (1000x1000), or custom 'WxH' (optional, default: 'medium')
 * 
 * Response:
 * {
 *   thumbnailUrl: string,
 *   cached: boolean
 * }
 * 
 * This endpoint:
 * 1. Checks if a thumbnail is already cached
 * 2. If not, generates one (resizes, optimizes, uploads to storage)
 * 3. Returns the thumbnail URL
 * 
 * The thumbnail URL can be used directly in <img> tags or Next.js Image components.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('imageUrl');
    const size = searchParams.get('size') || 'medium';

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Missing imageUrl parameter' },
        { status: 400 }
      );
    }

    // Validate size format
    const validSizes = ['small', 'medium', 'large', 'embed'];
    const customSizePattern = /^\d+x\d+$/;
    if (!validSizes.includes(size) && !customSizePattern.test(size)) {
      return NextResponse.json(
        { error: 'Invalid size. Use "small", "medium", "large", "embed", or "WxH" format' },
        { status: 400 }
      );
    }

    // Check cache first
    const cached = await getCachedThumbnail(imageUrl, size);
    if (cached) {
      return NextResponse.json({
        thumbnailUrl: cached,
        cached: true,
      }, {
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=86400', // Cache for 1 hour, CDN for 1 day
        },
      });
    }

    // Generate thumbnail if not cached
    const thumbnailUrl = await getOrGenerateThumbnail(imageUrl, size);

    return NextResponse.json({
      thumbnailUrl,
      cached: false,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  } catch (error) {
    console.error('[Thumbnail API] Error:', error);
    
    // Return original image URL as fallback
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('imageUrl');
    
    return NextResponse.json(
      {
        error: 'Failed to generate thumbnail',
        message: error instanceof Error ? error.message : String(error),
        fallbackUrl: imageUrl || null,
      },
      { status: 500 }
    );
  }
}

