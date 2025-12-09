/**
 * IPFS Image Caching Service
 * 
 * Caches IPFS images to Vercel Blob to avoid repeated gateway calls
 * and serve images from CDN for better performance and reliability.
 * 
 * This service:
 * 1. Normalizes IPFS URLs (ipfs://, /ipfs/, gateway URLs)
 * 2. Checks if image is already cached in Vercel Blob
 * 3. If not cached, fetches from free IPFS gateway and uploads to Vercel Blob
 * 4. Stores mapping in database for fast lookups
 */

import { getDatabase, ipfsImageCache, eq, and, gte } from '@cryptoart/db';
import type { IPFSImageCacheData } from '@cryptoart/db';

/**
 * Normalize IPFS URL to a consistent format
 * Handles: ipfs://, /ipfs/, and gateway URLs
 */
function normalizeIPFSUrl(url: string): string {
  // Remove protocol if present
  let normalized = url.replace(/^ipfs:\/\//, '');
  
  // Extract IPFS hash from various formats
  let hash: string | null = null;
  
  if (normalized.startsWith('Qm') || normalized.startsWith('baf')) {
    // Direct hash (ipfs://Qm... or ipfs://baf...)
    hash = normalized.split('/')[0];
  } else if (normalized.includes('/ipfs/')) {
    // Gateway URL format: https://gateway.com/ipfs/Qm...
    const match = normalized.match(/\/ipfs\/([^\/]+)/);
    if (match) {
      hash = match[1];
    }
  }
  
  if (!hash) {
    // Not a valid IPFS URL, return as-is
    return url.toLowerCase();
  }
  
  // Return normalized format: ipfs://hash
  return `ipfs://${hash}`;
}

/**
 * Check if a URL is an IPFS URL
 */
function isIPFSUrl(url: string): boolean {
  return url.startsWith('ipfs://') || 
         url.includes('/ipfs/') ||
         (url.startsWith('Qm') || url.startsWith('baf')) && url.length > 20;
}

/**
 * Convert IPFS URL to gateway URL
 * Uses free public gateways
 */
function ipfsToGatewayUrl(ipfsUrl: string): string {
  const normalized = normalizeIPFSUrl(ipfsUrl);
  const hash = normalized.replace('ipfs://', '');
  
  // Use Cloudflare IPFS gateway (free, reliable)
  const gateway = process.env.IPFS_GATEWAY_URL || 
                  process.env.NEXT_PUBLIC_IPFS_GATEWAY || 
                  'https://cloudflare-ipfs.com';
  
  return `${gateway}/ipfs/${hash}`;
}

/**
 * Get cached IPFS image from database
 */
async function getCachedIPFSImage(ipfsUrl: string): Promise<string | null> {
  const normalized = normalizeIPFSUrl(ipfsUrl);
  
  try {
    const db = getDatabase();
    const [cached] = await db
      .select()
      .from(ipfsImageCache)
      .where(
        and(
          eq(ipfsImageCache.ipfsUrl, normalized),
          // Check if expired (if expiresAt is set)
          // If expiresAt is null, it never expires
          // If expiresAt is set and in the future, it's valid
          // If expiresAt is set and in the past, it's expired
          // We use OR to handle null expiresAt
          // This is a bit complex, so we'll check expiration after fetching
        )
      )
      .limit(1);
    
    if (!cached) {
      return null;
    }
    
    // Check expiration
    if (cached.expiresAt && cached.expiresAt < new Date()) {
      // Expired, return null to trigger re-cache
      return null;
    }
    
    return cached.blobUrl;
  } catch (error) {
    // Database error - log but don't throw (graceful degradation)
    console.warn(`[IPFS Cache] Error checking cache for ${ipfsUrl}:`, error);
    return null;
  }
}

/**
 * Cache IPFS image URL in database
 */
async function cacheIPFSImageUrl(
  ipfsUrl: string,
  blobUrl: string,
  expiresAt?: Date | null
): Promise<void> {
  const normalized = normalizeIPFSUrl(ipfsUrl);
  
  try {
    const db = getDatabase();
    await db
      .insert(ipfsImageCache)
      .values({
        ipfsUrl: normalized,
        blobUrl,
        cachedAt: new Date(),
        expiresAt: expiresAt || null,
      })
      .onConflictDoUpdate({
        target: ipfsImageCache.ipfsUrl,
        set: {
          blobUrl,
          cachedAt: new Date(),
          expiresAt: expiresAt || null,
        },
      });
  } catch (error) {
    // Database error - log but don't throw (graceful degradation)
    console.warn(`[IPFS Cache] Error caching URL for ${ipfsUrl}:`, error);
  }
}

/**
 * Upload image to Vercel Blob
 */
async function uploadToVercelBlob(
  imageBuffer: Buffer,
  contentType: string,
  key: string
): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN environment variable is required for Vercel Blob Storage');
  }
  
  try {
    const { put } = await import('@vercel/blob');
    
    const blob = await put(key, imageBuffer, {
      access: 'public',
      contentType,
      addRandomSuffix: false, // Use deterministic key
    });
    
    return blob.url;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Cannot find module') || error.message.includes("Can't resolve")) {
        throw new Error('@vercel/blob package is not installed. Run: npm install @vercel/blob');
      }
      throw new Error(`Vercel Blob upload failed: ${error.message}`);
    }
    throw new Error('Vercel Blob upload failed: Unknown error');
  }
}

/**
 * Fetch image from IPFS gateway
 */
async function fetchFromIPFSGateway(gatewayUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB max
  
  const response = await fetch(gatewayUrl, {
    headers: {
      'User-Agent': 'CryptoArt-MVP/1.0',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch from IPFS gateway: ${response.status} ${response.statusText}`);
  }
  
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const contentLength = response.headers.get('content-length');
  
  if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) {
    throw new Error(`Image too large: ${contentLength} bytes (max ${MAX_IMAGE_SIZE})`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error(`Image too large: ${buffer.length} bytes (max ${MAX_IMAGE_SIZE})`);
  }
  
  return { buffer, contentType };
}

/**
 * Cache an IPFS image to Vercel Blob
 * 
 * @param ipfsUrl - IPFS URL (ipfs://, /ipfs/, or gateway URL)
 * @param expiresAt - Optional expiration date (null = never expires)
 * @returns Vercel Blob URL
 */
export async function cacheIPFSImage(
  ipfsUrl: string,
  expiresAt?: Date | null
): Promise<string> {
  // Check if already cached
  const cached = await getCachedIPFSImage(ipfsUrl);
  if (cached) {
    return cached;
  }
  
  // Normalize IPFS URL
  const normalized = normalizeIPFSUrl(ipfsUrl);
  
  // Check if it's actually an IPFS URL
  if (!isIPFSUrl(normalized)) {
    // Not an IPFS URL, return as-is
    return ipfsUrl;
  }
  
  // Convert to gateway URL
  const gatewayUrl = ipfsToGatewayUrl(normalized);
  
  // Try multiple gateways for reliability
  const gateways = [
    process.env.IPFS_GATEWAY_URL || process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://cloudflare-ipfs.com',
    'https://ipfs.io',
    'https://gateway.pinata.cloud',
  ];
  
  let imageBuffer: Buffer | null = null;
  let contentType = 'image/jpeg';
  let lastError: Error | null = null;
  
  // Try each gateway until one works
  for (const gateway of gateways) {
    try {
      const hash = normalized.replace('ipfs://', '');
      const url = `${gateway}/ipfs/${hash}`;
      
      const result = await fetchFromIPFSGateway(url);
      imageBuffer = result.buffer;
      contentType = result.contentType;
      break; // Success, exit loop
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continue to next gateway
    }
  }
  
  if (!imageBuffer) {
    // All gateways failed, throw error
    throw new Error(`Failed to fetch IPFS image from all gateways: ${lastError?.message || 'Unknown error'}`);
  }
  
  // Generate deterministic key for Vercel Blob
  const hash = normalized.replace('ipfs://', '');
  const key = `ipfs-images/${hash}`;
  
  // Upload to Vercel Blob
  const blobUrl = await uploadToVercelBlob(imageBuffer, contentType, key);
  
  // Cache in database
  await cacheIPFSImageUrl(normalized, blobUrl, expiresAt);
  
  return blobUrl;
}

/**
 * Get cached IPFS image URL (synchronous check, doesn't fetch if not cached)
 * Returns null if not cached
 */
export async function getCachedIPFSImageUrl(ipfsUrl: string): Promise<string | null> {
  if (!isIPFSUrl(ipfsUrl)) {
    return null;
  }
  
  return await getCachedIPFSImage(ipfsUrl);
}

