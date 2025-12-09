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
      // Check if it's an IPFS URL and try to get cached version (server-side only)
      if (imageUrl.startsWith('ipfs://') || imageUrl.includes('/ipfs/')) {
        // Only try IPFS caching on server-side (check for Node.js environment)
        if (typeof window === 'undefined' && typeof process !== 'undefined' && process.env) {
          try {
            const { getCachedIPFSImageUrl, cacheIPFSImage } = await import('./server/ipfs-cache');
            // First check if already cached (fast path)
            const cached = await getCachedIPFSImageUrl(imageUrl);
            if (cached) {
              metadata.image = cached;
            } else {
              // Not cached, try to cache it with timeout
              // Use Promise.race to avoid blocking too long
              const cachePromise = cacheIPFSImage(imageUrl);
              const timeoutPromise = new Promise<string>((resolve) => {
                setTimeout(() => resolve(ipfsToGateway(imageUrl)), 5000); // 5 second timeout
              });
              
              try {
                metadata.image = await Promise.race([cachePromise, timeoutPromise]);
              } catch (error) {
                // If caching fails, fall back to gateway URL
                console.warn(`[NFT Metadata] Failed to cache IPFS image ${imageUrl}:`, error);
                metadata.image = ipfsToGateway(imageUrl);
              }
            }
          } catch (error) {
            // If IPFS cache fails, fall back to gateway
            console.warn(`[NFT Metadata] IPFS cache error, using gateway:`, error);
            metadata.image = ipfsToGateway(imageUrl);
          }
        } else {
          // Client-side: just convert to gateway URL
          metadata.image = ipfsToGateway(imageUrl);
        }
      } else {
        // Not IPFS, just convert if needed
        metadata.image = ipfsToGateway(imageUrl);
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

