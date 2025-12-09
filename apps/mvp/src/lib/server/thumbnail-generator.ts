/**
 * Thumbnail generation service
 * 
 * This service handles:
 * 1. Fetching original images
 * 2. Resizing/optimizing them
 * 3. Storing thumbnails (to object storage, CDN, or local filesystem)
 * 4. Returning URLs to the cached thumbnails
 * 
 * Storage backends supported:
 * - Local filesystem (for development)
 * - Vercel Blob Storage (if on Vercel)
 * - Cloudflare R2 (S3-compatible)
 * - AWS S3
 * 
 * For 500 users/month, this is very affordable:
 * - Storage: ~$0.015/GB/month (Cloudflare R2)
 * - Processing: Minimal (only on cache miss)
 * - Bandwidth: Free on R2, or minimal on other providers
 */

import { getThumbnailDimensions, ThumbnailSize, cacheThumbnail } from './thumbnail-cache';

/**
 * Storage backend interface
 */
interface StorageBackend {
  upload(buffer: Buffer, key: string, contentType: string): Promise<string>;
  getUrl(key: string): string;
}

/**
 * Local filesystem storage (for development)
 */
class LocalStorageBackend implements StorageBackend {
  private basePath: string;
  private baseUrl: string;

  constructor(basePath: string = '/tmp/thumbnails', baseUrl: string = '/api/thumbnails') {
    this.basePath = basePath;
    this.baseUrl = baseUrl;
  }

  async upload(buffer: Buffer, key: string, contentType: string): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const filePath = path.join(this.basePath, key);
    const dir = path.dirname(filePath);
    
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, buffer);
    
    return `${this.baseUrl}/${key}`;
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }
}

/**
 * Vercel Blob Storage backend
 */
class VercelBlobBackend implements StorageBackend {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.BLOB_READ_URL || '';
  }

  async upload(buffer: Buffer, key: string, contentType: string): Promise<string> {
    // Check if token is set before trying to use Vercel Blob
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN environment variable is required for Vercel Blob Storage');
    }
    
    // Dynamic import to avoid bundling issues
    // Use try-catch to handle case where @vercel/blob is not installed
    try {
      // @ts-ignore - @vercel/blob is optional and may not be installed
      const { put } = await import('@vercel/blob');
      
      // Vercel Blob reads token from BLOB_READ_WRITE_TOKEN env var automatically
      const blob = await put(key, buffer, {
        access: 'public',
        contentType,
      });
      
      return blob.url;
    } catch (error) {
      // Provide more helpful error message
      if (error instanceof Error) {
        if (error.message.includes('Cannot find module') || error.message.includes("Can't resolve")) {
          throw new Error('@vercel/blob package is not installed. Run: npm install @vercel/blob');
        }
        throw new Error(`Vercel Blob upload failed: ${error.message}`);
      }
      throw new Error('Vercel Blob upload failed: Unknown error');
    }
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }
}

/**
 * S3-compatible storage backend (R2, S3, etc.)
 */
class S3Backend implements StorageBackend {
  private bucket: string;
  private region: string;
  private endpoint?: string;
  private baseUrl: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || process.env.R2_BUCKET || '';
    this.region = process.env.S3_REGION || process.env.R2_REGION || 'auto';
    this.endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT;
    
    // Construct base URL
    if (this.endpoint) {
      this.baseUrl = this.endpoint.replace(/\/$/, '');
    } else if (this.bucket) {
      this.baseUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com`;
    } else {
      this.baseUrl = '';
    }
  }

  async upload(buffer: Buffer, key: string, contentType: string): Promise<string> {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    
    const client = new S3Client({
      region: this.region,
      endpoint: this.endpoint,
      credentials: process.env.S3_ACCESS_KEY_ID ? {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      } : undefined,
    });

    await client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=2592000', // 30 days
    }));

    return `${this.baseUrl}/${key}`;
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }
}

/**
 * Get the appropriate storage backend based on environment
 */
function getStorageBackend(): StorageBackend | null {
  // In development, prioritize local storage unless explicitly configured
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Check for S3/R2 (highest priority if configured)
  if (process.env.S3_BUCKET || process.env.R2_BUCKET) {
    return new S3Backend();
  }
  
  // Check for Vercel Blob Storage (only if token is set)
  // In development, skip this unless explicitly needed
  if (process.env.BLOB_READ_WRITE_TOKEN && (!isDevelopment || process.env.FORCE_VERCEL_BLOB === 'true')) {
    return new VercelBlobBackend();
  }
  
  // Fallback to local storage (development default)
  if (isDevelopment) {
    return new LocalStorageBackend();
  }
  
  // Production: require some storage backend
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.S3_BUCKET && !process.env.R2_BUCKET) {
    console.warn('[Thumbnail] No storage backend configured. Thumbnails will not be cached.');
  }
  
  return null;
}

/**
 * Generate a unique key for a thumbnail
 */
function generateThumbnailKey(imageUrl: string, size: ThumbnailSize): string {
  // Create a hash of the image URL + size
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256')
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

  // Check if imageUrl is IPFS and get cached version if available
  let finalImageUrl = imageUrl;
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

  // For embed size, calculate dimensions based on original image aspect ratio
  let finalDimensions = dimensions;
  if (size === 'embed') {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    if (metadata.width && metadata.height) {
      finalDimensions = calculateEmbedDimensions(metadata.width, metadata.height);
    }
  }

  // Resize and optimize the image
  const resized = await sharp(buffer)
    .resize(finalDimensions.width, finalDimensions.height, {
      fit: 'inside', // Maintain aspect ratio, fit within dimensions
      withoutEnlargement: true, // Don't enlarge small images
    })
    .webp({ quality: 85 }) // WebP format with 85% quality
    .toBuffer();

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
 * @param size - Thumbnail size ('small', 'medium', 'large', 'embed', or 'WxH')
 * @returns URL to the cached thumbnail
 */
export async function generateThumbnail(
  imageUrl: string,
  size: ThumbnailSize = 'medium'
): Promise<string> {
  const storage = getStorageBackend();
  if (!storage) {
    // In development, this shouldn't happen as we fall back to local storage
    // In production, provide helpful error message
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
      // Force local storage as last resort
      return await generateThumbnailWithStorage(new LocalStorageBackend(), imageUrl, size);
    }
    throw new Error('No storage backend configured. Set BLOB_READ_WRITE_TOKEN, S3_BUCKET, or R2_BUCKET environment variable.');
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

