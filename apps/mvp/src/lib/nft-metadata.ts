import { Address } from 'viem';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { CHAIN_ID } from './contracts/marketplace';
import { isDataURI, isJsonDataURI, parseJsonDataURI } from './media-utils';

// Minimal ERC721 ABI for tokenURI
const ERC721_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Minimal ERC1155 ABI for uri
const ERC1155_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'uri',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const publicClient = createPublicClient({
  chain: base,
  transport: http(
    process.env.NEXT_PUBLIC_RPC_URL || 
    process.env.RPC_URL || 
    process.env.NEXT_PUBLIC_BASE_RPC_URL || 
    'https://mainnet.base.org'
  ),
});

export interface NFTMetadata {
  name?: string;
  title?: string;
  description?: string;
  image?: string;
  // animation_url per OpenSea metadata standard - can be audio, video, 3D model, or HTML
  animation_url?: string;
  // Some APIs use camelCase
  animationUrl?: string;
  artist?: string;
  creator?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  // Additional OpenSea fields
  external_url?: string;
  background_color?: string;
  // Animation details (from Manifold and similar platforms)
  animation_details?: {
    format?: string;
    duration?: number;
    width?: number;
    height?: number;
    bytes?: number;
    codecs?: string[];
  };
}

/**
 * Convert IPFS URL to HTTP gateway URL
 * Passes through data URIs unchanged (for onchain art)
 */
function ipfsToGateway(url: string): string {
  // Data URIs are self-contained, no conversion needed
  if (isDataURI(url)) {
    return url;
  }
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }
  if (url.startsWith('ipfs/')) {
    return `https://ipfs.io/${url}`;
  }
  // Handle Arweave URLs
  if (url.startsWith('ar://')) {
    return url.replace('ar://', 'https://arweave.net/');
  }
  return url;
}

/**
 * Extract IPFS hash from various URL formats
 */
function extractIPFSHash(url: string): string | null {
  // Remove protocol if present
  let normalized = url.replace(/^ipfs:\/\//, '');
  
  // Extract IPFS hash
  if (normalized.startsWith('Qm') || normalized.startsWith('baf')) {
    // Direct hash (ipfs://Qm... or ipfs://baf...)
    return normalized.split('/')[0];
  } else if (normalized.includes('/ipfs/')) {
    // Gateway URL format: https://gateway.com/ipfs/Qm...
    const match = normalized.match(/\/ipfs\/([^\/]+)/);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Check if an IPFS URL points to a directory (not a file)
 * Returns true if the URL is a directory, false if it's a file or unknown
 */
async function isIPFSDirectory(ipfsUrl: string): Promise<boolean> {
  const hash = extractIPFSHash(ipfsUrl);
  if (!hash) {
    return false;
  }
  
  // If the URL has a path component after the hash, it's likely a file
  // e.g., ipfs://QmHash/file.jpg is a file, ipfs://QmHash is potentially a directory
  // Check if there's anything after the hash in the path
  const hashIndex = ipfsUrl.indexOf(hash);
  if (hashIndex !== -1) {
    const afterHash = ipfsUrl.slice(hashIndex + hash.length);
    // If there's a path after the hash (not just / or empty), it's a file
    if (afterHash && afterHash !== '/' && afterHash.trim() !== '') {
      // Has path component after hash, likely a file
      return false;
    }
  }
  
  // Check if accessing the hash directly returns HTML (directory listing) or JSON
  try {
    const gatewayUrl = `https://ipfs.io/ipfs/${hash}`;
    const response = await fetch(gatewayUrl, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });
    
    const contentType = response.headers.get('content-type') || '';
    
    // If it returns HTML, it's likely a directory listing
    if (contentType.includes('text/html')) {
      return true;
    }
    
    // If it returns JSON, it might be a directory listing (some gateways)
    if (contentType.includes('application/json')) {
      return true;
    }
    
    // If it returns an image, it's definitely a file
    if (contentType.startsWith('image/')) {
      return false;
    }
    
    // Default: assume it's a file if we can't determine
    return false;
  } catch (error) {
    // On error, assume it's not a directory
    return false;
  }
}

/**
 * Find image files in an IPFS directory
 * Tries common image file names and patterns
 */
async function findImageInIPFSDirectory(directoryHash: string): Promise<string | null> {
  const commonImageNames = [
    'image',
    'image.png',
    'image.jpg',
    'image.jpeg',
    'image.webp',
    '0',
    '1',
    'token.png',
    'token.jpg',
    'token.webp',
    'nft.png',
    'nft.jpg',
    'nft.webp',
  ];
  
  const gateways = [
    'https://ipfs.io',
    'https://cloudflare-ipfs.com',
    'https://gateway.pinata.cloud',
  ];
  
  // Try each gateway
  for (const gateway of gateways) {
    // Try common image file names
    for (const fileName of commonImageNames) {
      const testUrl = `${gateway}/ipfs/${directoryHash}/${fileName}`;
      try {
        const response = await fetch(testUrl, { 
          method: 'HEAD',
          signal: AbortSignal.timeout(2000), // 2 second timeout per attempt
        });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.startsWith('image/')) {
            // Found an image! Return the IPFS URL format
            return `ipfs://${directoryHash}/${fileName}`;
          }
        }
      } catch {
        // Continue to next attempt
      }
    }
    
    // Also try to parse directory listing HTML/JSON if available
    try {
      const dirUrl = `${gateway}/ipfs/${directoryHash}`;
      const dirResponse = await fetch(dirUrl, {
        signal: AbortSignal.timeout(3000),
      });
      
      if (dirResponse.ok) {
        const contentType = dirResponse.headers.get('content-type') || '';
        
        if (contentType.includes('text/html')) {
          // Parse HTML directory listing
          const html = await dirResponse.text();
          // Look for image file links in HTML
          const imagePattern = /href=["']([^"']*\.(jpg|jpeg|png|gif|webp|svg))["']/gi;
          const matches = Array.from(html.matchAll(imagePattern));
          
          if (matches.length > 0) {
            // Use the first image file found
            const imagePath = matches[0][1];
            // Remove leading slash if present
            const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
            return `ipfs://${directoryHash}/${cleanPath}`;
          }
        } else if (contentType.includes('application/json')) {
          // Parse JSON directory listing (some gateways use this)
          const dirData = await dirResponse.json();
          // Look for image files in the directory listing
          if (Array.isArray(dirData)) {
            const imageFile = dirData.find((entry: any) => {
              const name = entry.name || entry.Name || entry.filename || '';
              return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);
            });
            
            if (imageFile) {
              const fileName = imageFile.name || imageFile.Name || imageFile.filename;
              return `ipfs://${directoryHash}/${fileName}`;
            }
          }
        }
      }
    } catch {
      // Continue to next gateway
    }
  }
  
  return null;
}

/**
 * Resolve IPFS image URL - handles both files and directories
 * If the URL points to a directory, attempts to find an image file within it
 */
async function resolveIPFSImageUrl(imageUrl: string): Promise<string> {
  // If it's not an IPFS URL, just convert it normally
  if (!imageUrl.startsWith('ipfs://') && !imageUrl.includes('/ipfs/')) {
    return ipfsToGateway(imageUrl);
  }
  
  // Check if it's a directory
  const isDirectory = await isIPFSDirectory(imageUrl);
  
  if (isDirectory) {
    const hash = extractIPFSHash(imageUrl);
    if (hash) {
      // Try to find an image file in the directory
      const foundImage = await findImageInIPFSDirectory(hash);
      if (foundImage) {
        console.log(`[NFT Metadata] Found image in IPFS directory: ${foundImage}`);
        return ipfsToGateway(foundImage);
      } else {
        console.warn(`[NFT Metadata] IPFS directory detected but no image file found: ${imageUrl}`);
        // Fall back to the original URL (might work if gateway handles it)
        return ipfsToGateway(imageUrl);
      }
    }
  }
  
  // Not a directory or already has a file path, convert normally
  return ipfsToGateway(imageUrl);
}

/**
 * Fetch NFT metadata from token URI
 * Handles both HTTP/IPFS URLs and data URIs (onchain metadata)
 */
export async function fetchNFTMetadata(
  contractAddress: Address,
  tokenId: string | undefined,
  tokenSpec: 'ERC721' | 'ERC1155' | number
): Promise<NFTMetadata | null> {
  if (!tokenId) {
    return null;
  }

  try {
    const tokenIdBigInt = BigInt(tokenId);
    let tokenURI: string | null = null;

    // Try to get tokenURI based on token spec
    if (tokenSpec === 'ERC721' || tokenSpec === 1) {
      try {
        tokenURI = await publicClient.readContract({
          address: contractAddress,
          abi: ERC721_ABI,
          functionName: 'tokenURI',
          args: [tokenIdBigInt],
        });
      } catch (error) {
        console.error('Error reading ERC721 tokenURI:', error);
      }
    } else if (tokenSpec === 'ERC1155' || tokenSpec === 2) {
      try {
        tokenURI = await publicClient.readContract({
          address: contractAddress,
          abi: ERC1155_ABI,
          functionName: 'uri',
          args: [tokenIdBigInt],
        });
      } catch (error) {
        console.error('Error reading ERC1155 uri:', error);
      }
    }

    if (!tokenURI || tokenURI.trim() === '') {
      return null;
    }

    let metadata: NFTMetadata;

    // Handle onchain metadata (data URI)
    if (isJsonDataURI(tokenURI)) {
      const parsed = parseJsonDataURI<NFTMetadata>(tokenURI);
      if (!parsed) {
        console.error('Failed to parse onchain metadata from data URI');
        return null;
      }
      metadata = parsed;
    } else {
      // Convert IPFS/Arweave URL if needed
      const gatewayUrl = ipfsToGateway(tokenURI);

      // Fetch metadata from URL
      const response = await fetch(gatewayUrl);
      if (!response.ok) {
        return null;
      }

      metadata = await response.json() as NFTMetadata;
    }

    // Convert image URL if it's IPFS (skip if already a data URI)
    if (metadata.image) {
      const imageUrl = metadata.image; // Store in const to ensure it's defined
      
      // Resolve IPFS image URL (handles directories and files)
      // This will detect if the URL points to a directory and find the image file within it
      let resolvedImageUrl: string;
      if (imageUrl.startsWith('ipfs://') || imageUrl.includes('/ipfs/')) {
        // Resolve IPFS URL (handles directories)
        resolvedImageUrl = await resolveIPFSImageUrl(imageUrl);
      } else {
        // Not IPFS, just convert if needed
        resolvedImageUrl = ipfsToGateway(imageUrl);
      }
      
      // Check if it's an IPFS URL and try to get cached version (server-side only)
      if (resolvedImageUrl.includes('/ipfs/') || resolvedImageUrl.startsWith('ipfs://')) {
        // Only try IPFS caching on server-side (check for Node.js environment)
        if (typeof window === 'undefined' && typeof process !== 'undefined' && process.env) {
          try {
            // Use a shorter timeout for IPFS cache check to avoid blocking
            const cacheCheckPromise = (async () => {
              try {
                const { getCachedIPFSImageUrl } = await import('./server/ipfs-cache');
                // Use the resolved URL (which may have found a file in a directory)
                return await getCachedIPFSImageUrl(resolvedImageUrl);
              } catch (error) {
                // If cache check fails, return null to use gateway
                console.warn(`[NFT Metadata] IPFS cache check failed:`, error instanceof Error ? error.message : String(error));
                return null;
              }
            })();
            
            const timeoutPromise = new Promise<string | null>((resolve) => {
              setTimeout(() => resolve(null), 1000); // 1 second timeout for cache check
            });
            
            const cached = await Promise.race([cacheCheckPromise, timeoutPromise]);
            if (cached) {
              // Validate cached URL is actually an image before using it
              // Check if it looks like a Vercel Blob URL and validate it's not HTML
              try {
                const validateResponse = await fetch(cached, { method: 'HEAD' });
                const cachedContentType = validateResponse.headers.get('content-type') || '';
                
                // If cached URL returns HTML, it's probably broken - fall back to gateway
                if (cachedContentType.startsWith('text/html')) {
                  console.warn(`[NFT Metadata] Cached IPFS image URL returns HTML instead of image, using gateway fallback: ${resolvedImageUrl}`);
                  metadata.image = resolvedImageUrl;
                } else {
                  metadata.image = cached;
                }
              } catch (error) {
                // If validation fails, fall back to gateway URL
                console.warn(`[NFT Metadata] Failed to validate cached IPFS image, using gateway fallback:`, error instanceof Error ? error.message : String(error));
                metadata.image = resolvedImageUrl;
              }
            } else {
              // Not cached or cache check timed out, use resolved gateway URL
              // Cache in background (don't wait for it)
              (async () => {
                try {
                  const { cacheIPFSImage } = await import('./server/ipfs-cache');
                  await cacheIPFSImage(resolvedImageUrl).catch(() => {
                    // Ignore background cache errors
                  });
                } catch {
                  // Ignore import or cache errors in background
                }
              })();
              metadata.image = resolvedImageUrl;
            }
          } catch (error) {
            // If IPFS cache fails, fall back to resolved gateway URL
            console.warn(`[NFT Metadata] IPFS cache error, using gateway:`, error instanceof Error ? error.message : String(error));
            metadata.image = resolvedImageUrl;
          }
        } else {
          // Client-side: use resolved gateway URL
          metadata.image = resolvedImageUrl;
        }
      } else {
        // Not IPFS, use resolved URL
        metadata.image = resolvedImageUrl;
      }
    }

    // Handle animation_url - normalize camelCase variant and convert IPFS
    // Some APIs use animationUrl, OpenSea standard uses animation_url
    if (metadata.animationUrl && !metadata.animation_url) {
      metadata.animation_url = metadata.animationUrl;
    }
    if (metadata.animation_url) {
      metadata.animation_url = ipfsToGateway(metadata.animation_url);
    }

    // Normalize title/name
    if (!metadata.title && metadata.name) {
      metadata.title = metadata.name;
    }

    // Normalize artist/creator
    if (!metadata.artist && metadata.creator) {
      metadata.artist = metadata.creator;
    }

    return metadata;
  } catch (error) {
    console.error('Error fetching NFT metadata:', error);
    return null;
  }
}

