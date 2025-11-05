/**
 * NFT metadata fetching utilities
 */

import { type Address } from 'viem';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

// ERC721 ABI for tokenURI
const ERC721_ABI = [
  {
    type: 'function',
    name: 'tokenURI',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
] as const;

// Public client for Base Mainnet
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

/**
 * Convert IPFS URL to gateway URL
 */
function ipfsToGateway(url: string): string {
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }
  if (url.startsWith('ipfs/')) {
    return `https://ipfs.io/ipfs/${url.slice(5)}`;
  }
  return url;
}

/**
 * Fetch NFT metadata from token URI
 */
export async function fetchNFTMetadata(
  contractAddress: Address,
  tokenId: bigint
): Promise<{ name?: string; description?: string; image?: string; [key: string]: any } | null> {
  try {
    // Get tokenURI from contract
    const tokenURI = await publicClient.readContract({
      address: contractAddress,
      abi: ERC721_ABI,
      functionName: 'tokenURI',
      args: [tokenId],
    });

    if (!tokenURI) {
      return null;
    }

    // Convert IPFS URL if needed
    const gatewayUrl = ipfsToGateway(tokenURI);

    // Fetch metadata
    const response = await fetch(gatewayUrl);
    if (!response.ok) {
      return null;
    }

    const metadata = await response.json();

    // Convert image URL if it's IPFS
    if (metadata.image) {
      metadata.image = ipfsToGateway(metadata.image);
    }

    return metadata;
  } catch (error) {
    console.error('Error fetching NFT metadata:', error);
    return null;
  }
}

/**
 * Cache for NFT metadata
 */
const metadataCache = new Map<string, { metadata: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch NFT metadata with caching
 */
export async function getNFTMetadata(
  contractAddress: Address,
  tokenId: bigint
): Promise<{ name?: string; description?: string; image?: string; [key: string]: any } | null> {
  const cacheKey = `${contractAddress}-${tokenId}`;
  const cached = metadataCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.metadata;
  }

  const metadata = await fetchNFTMetadata(contractAddress, tokenId);
  if (metadata) {
    metadataCache.set(cacheKey, { metadata, timestamp: Date.now() });
  }

  return metadata;
}

