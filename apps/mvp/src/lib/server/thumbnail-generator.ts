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
    // Dynamic import to avoid bundling issues
    // Use try-catch to handle case where @vercel/blob is not installed
    try {
      // @ts-ignore - @vercel/blob is optional and may not be installed
      const { put } = await import('@vercel/blob');
      
      const blob = await put(key, buffer, {
        access: 'public',
        contentType,
      });
      
      return blob.url;
    } catch (error) {
      throw new Error('@vercel/blob is required for Vercel Blob Storage. Install it with: npm install @vercel/blob');
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
  // Check for Vercel Blob Storage
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return new VercelBlobBackend();
  }
  
  // Check for S3/R2
  if (process.env.S3_BUCKET || process.env.R2_BUCKET) {
    return new S3Backend();
  }
  
  // Fallback to local storage (development)
  if (process.env.NODE_ENV === 'development') {
    return new LocalStorageBackend();
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
 * Fetch and resize an image to create a thumbnail
 * Requires sharp library: npm install sharp
 */
async function resizeImage(
  imageUrl: string,
  dimensions: { width: number; height: number }
): Promise<{ buffer: Buffer; contentType: string; fileSize: number }> {
  // Try to import sharp
  let sharp: any;
  try {
    sharp = (await import('sharp')).default;
  } catch (error) {
    throw new Error('sharp library is required for image resizing. Install it with: npm install sharp');
  }

  // Fetch the original image
  const response = await fetch(imageUrl, {
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

  // Resize and optimize the image
  const resized = await sharp(buffer)
    .resize(dimensions.width, dimensions.height, {
      fit: 'inside', // Maintain aspect ratio, fit within dimensions
      withoutEnlargement: true, // Don't enlarge small images
    })
    .webp({ quality: 85 }) // WebP format with 85% quality
    .toBuffer();

  return {
    buffer: resized,
    contentType: 'image/webp',
    fileSize: resized.length,
  };
}

/**
 * Generate a thumbnail for an image URL
 * 
 * @param imageUrl - Original image URL
 * @param size - Thumbnail size ('small', 'medium', 'large', or 'WxH')
 * @returns URL to the cached thumbnail
 */
export async function generateThumbnail(
  imageUrl: string,
  size: ThumbnailSize = 'medium'
): Promise<string> {
  const storage = getStorageBackend();
  if (!storage) {
    throw new Error('No storage backend configured. Set BLOB_READ_WRITE_TOKEN, S3_BUCKET, or R2_BUCKET environment variable.');
  }

  const dimensions = getThumbnailDimensions(size);
  const key = generateThumbnailKey(imageUrl, size);

  // Resize the image
  const { buffer, contentType, fileSize } = await resizeImage(imageUrl, dimensions);

  // Upload to storage
  const thumbnailUrl = await storage.upload(buffer, key, contentType);

  // Cache the URL in database
  await cacheThumbnail(
    imageUrl,
    size,
    thumbnailUrl,
    dimensions,
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

