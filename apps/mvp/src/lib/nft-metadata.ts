import { Address } from 'viem';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { CHAIN_ID } from './contracts/marketplace';

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
  artist?: string;
  creator?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

/**
 * Convert IPFS URL to HTTP gateway URL
 */
function ipfsToGateway(url: string): string {
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }
  if (url.startsWith('ipfs/')) {
    return `https://ipfs.io/${url}`;
  }
  return url;
}

/**
 * Fetch NFT metadata from token URI
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

    // Convert IPFS URL if needed
    const gatewayUrl = ipfsToGateway(tokenURI);

    // Fetch metadata
    const response = await fetch(gatewayUrl);
    if (!response.ok) {
      return null;
    }

    const metadata = await response.json() as NFTMetadata;

    // Convert image URL if it's IPFS
    if (metadata.image) {
      metadata.image = ipfsToGateway(metadata.image);
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

