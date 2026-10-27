/**
 * Thumbnail generation service
 *
 * Fetches, resizes, and stores thumbnails via shared object storage
 * (R2 preferred on VPS; Vercel Blob legacy; local in development).
 */

import { getThumbnailDimensions, ThumbnailSize, cacheThumbnail } from './thumbnail-cache';
import { createHash } from 'crypto';
import {
  createLocalObjectStorage,
  getObjectStorageBackend,
  type ObjectStorageBackend,
} from './object-storage';

type StorageBackend = ObjectStorageBackend;

/**
 * Generate a unique key for a thumbnail
 */
function generateThumbnailKey(imageUrl: string, size: ThumbnailSize): string {
  // Create a hash of the image URL + size
  const hash = createHash('sha256')
    .update(imageUrl + size)
    .digest('hex')
    .substring(0, 16);
  
  const ext = 'webp'; // Always use WebP for thumbnails
  return `thumbnails/${hash}.${ext}`;
}

/**
 * Calculate embed dimensions based on original image aspect ratio
 * Fits within 1200x630 with 10px margin (max 1180x610)
 */
function calculateEmbedDimensions(originalWidth: number, originalHeight: number): { width: number; height: number } {
  const maxWidth = 1180;  // 1200 - 20 (10px each side)
  const maxHeight = 610;  // 630 - 20 (10px each side)
  
  const aspectRatio = originalWidth / originalHeight;
  
  let width: number;
  let height: number;
  
  if (originalWidth > originalHeight) {
    // Landscape: fit to width first
    width = maxWidth;
    height = maxWidth / aspectRatio;
    if (height > maxHeight) {
      // If height exceeds, fit to height instead
      height = maxHeight;
      width = maxHeight * aspectRatio;
    }
  } else {
    // Portrait or square: fit to height first
    height = maxHeight;
    width = maxHeight * aspectRatio;
    if (width > maxWidth) {
      // If width exceeds, fit to width instead
      width = maxWidth;
      height = maxWidth / aspectRatio;
    }
  }
  
  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

/** WebP quality by preset: market/grid lighter; listing hero heavier */
function webpQualityForPreset(size: string | undefined): number {
  switch (size) {
    case 'small':
      return 88;
    case 'medium':
      return 90;
    case 'homepage':
      return 90;
    case 'embed':
      return 88;
    case 'large':
      return 93;
    case 'detail':
      return 95;
    default:
      return 90;
  }
}

/**
 * Fetch and resize an image to create a thumbnail
 * Requires sharp library: npm install sharp
 */
async function resizeImage(
  imageUrl: string,
  dimensions: { width: number; height: number },
  size?: string
): Promise<{ buffer: Buffer; contentType: string; fileSize: number; actualDimensions?: { width: number; height: number } }> {
  // Try to import sharp
  let sharp: any;
  try {
    sharp = (await import('sharp')).default;
  } catch (error) {
    throw new Error('sharp library is required for image resizing. Install it with: npm install sharp');
  }

  // Check if this is already a thumbnail URL - we shouldn't generate thumbnails of thumbnails
  if (imageUrl.includes('/api/thumbnails/thumbnails/') || imageUrl.startsWith('/api/thumbnails/')) {
    throw new Error(`Cannot generate thumbnail from thumbnail URL: ${imageUrl}`);
  }

  // Convert relative URLs to absolute URLs
  let finalImageUrl = imageUrl;
  if (imageUrl.startsWith('/')) {
    // Relative URL - convert to absolute using APP_URL
    const { APP_URL } = await import('~/lib/constants');
    finalImageUrl = `${APP_URL}${imageUrl}`;
  }
  if (imageUrl.startsWith('ipfs://') || imageUrl.includes('/ipfs/')) {
    try {
      const { getCachedIPFSImageUrl, cacheIPFSImage } = await import('./ipfs-cache');
      // First check if already cached (fast path)
      const cached = await getCachedIPFSImageUrl(imageUrl);
      if (cached) {
        finalImageUrl = cached;
      } else {
        // Not cached, try to cache it (with timeout to avoid blocking)
        try {
          const cachePromise = cacheIPFSImage(imageUrl);
          const timeoutPromise = new Promise<string>((resolve) => {
            setTimeout(() => resolve(imageUrl), 5000); // 5 second timeout
          });
          finalImageUrl = await Promise.race([cachePromise, timeoutPromise]);
        } catch (error) {
          // If caching fails, use original URL
          console.warn(`[Thumbnail] Failed to cache IPFS image ${imageUrl}, using original:`, error);
          finalImageUrl = imageUrl;
        }
      }
    } catch (error) {
      // If IPFS cache fails, use original URL
      console.warn(`[Thumbnail] IPFS cache error, using original URL:`, error);
      finalImageUrl = imageUrl;
    }
  }

  // Fetch the original image (now from cached URL if IPFS)
  const response = await fetch(finalImageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Thumbnail-Bot/1.0)',
    },
    signal: AbortSignal.timeout(30000), // 30 second timeout
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Check if the image format is supported by sharp
  let image: any;
  let metadata: any;
  try {
    image = sharp(buffer);
    metadata = await image.metadata();
    
    // Check if format is supported
    if (!metadata.format) {
      throw new Error(`Unsupported image format: unable to detect format for ${imageUrl}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Unsupported image format for ${imageUrl}: ${errorMessage}. Format: ${metadata?.format || 'unknown'}`);
  }

  // For embed size, calculate dimensions based on original image aspect ratio
  let finalDimensions = dimensions;
  if (size === 'embed') {
    if (metadata.width && metadata.height) {
      finalDimensions = calculateEmbedDimensions(metadata.width, metadata.height);
    }
  }

  // Resize and optimize the image
  let resized: Buffer;
  try {
    resized = await image
      .resize(finalDimensions.width, finalDimensions.height, {
        fit: 'inside', // Maintain aspect ratio, fit within dimensions
        withoutEnlargement: true, // Don't enlarge small images
      })
      .webp({ quality: webpQualityForPreset(size) })
      .toBuffer();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to process image ${imageUrl} (format: ${metadata.format}): ${errorMessage}`);
  }

  // Get actual output dimensions
  const outputMetadata = await sharp(resized).metadata();

  return {
    buffer: resized,
    contentType: 'image/webp',
    fileSize: resized.length,
    actualDimensions: outputMetadata.width && outputMetadata.height
      ? { width: outputMetadata.width, height: outputMetadata.height }
      : finalDimensions,
  };
}

/**
 * Generate a thumbnail for an image URL
 * 
 * @param imageUrl - Original image URL
 * @param size - Thumbnail size ('small', 'medium', 'large', 'detail', 'homepage', 'embed', or 'WxH')
 * @returns URL to the cached thumbnail
 */
export async function generateThumbnail(
  imageUrl: string,
  size: ThumbnailSize = 'medium'
): Promise<string> {
  const storage = getObjectStorageBackend();
  if (!storage) {
    if (process.env.NODE_ENV === 'development') {
      return await generateThumbnailWithStorage(createLocalObjectStorage(), imageUrl, size);
    }
    throw new Error(
      'No storage backend configured. Set R2_BUCKET (preferred on VPS), S3_BUCKET, or BLOB_READ_WRITE_TOKEN.',
    );
  }

  return await generateThumbnailWithStorage(storage, imageUrl, size);
}

/**
 * Internal function to generate thumbnail with a specific storage backend
 */
async function generateThumbnailWithStorage(
  storage: StorageBackend,
  imageUrl: string,
  size: ThumbnailSize
): Promise<string> {

  // For embed size, we need to get original dimensions first
  // For other sizes, use preset dimensions
  let dimensions: { width: number; height: number };
  if (size === 'embed') {
    // We'll calculate dimensions in resizeImage based on original image
    // Use max dimensions as placeholder
    dimensions = { width: 1180, height: 610 };
  } else {
    dimensions = getThumbnailDimensions(size);
  }

  const key = generateThumbnailKey(imageUrl, size);

  // Resize the image (pass size for embed calculation)
  const { buffer, contentType, fileSize, actualDimensions } = await resizeImage(imageUrl, dimensions, size);
  
  // Use actual dimensions for caching (important for embed size)
  const finalDimensions = actualDimensions || dimensions;

  // Upload to storage
  const thumbnailUrl = await storage.upload(buffer, key, contentType);

  // Cache the URL in database
  await cacheThumbnail(
    imageUrl,
    size,
    thumbnailUrl,
    finalDimensions,
    contentType,
    fileSize
  );

  return thumbnailUrl;
}

/**
 * Get or generate a thumbnail
 * Checks cache first, generates if not found
 */
export async function getOrGenerateThumbnail(
  imageUrl: string,
  size: ThumbnailSize = 'medium'
): Promise<string> {
  const { getCachedThumbnail } = await import('./thumbnail-cache');
  
  // Check cache first
  const cached = await getCachedThumbnail(imageUrl, size);
  if (cached) {
    return cached;
  }

  // Generate if not cached
  return await generateThumbnail(imageUrl, size);
}

