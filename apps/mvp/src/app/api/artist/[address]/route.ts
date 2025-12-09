import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getArtistOverride } from "~/lib/artistOverrides";
import { getContractCreator } from "~/lib/contract-creator";
import {
  lookupNeynarByAddress,
  resolveEnsName,
} from "~/lib/artist-name-resolution";
import { withTimeout } from "~/lib/utils";

// Set route timeout to 10 seconds
export const maxDuration = 10;

/**
 * Artist name resolution API endpoint.
 * 
 * Resolution priority:
 * 1. Neynar API - lookup user by verified ETH address
 * 2. ENS - reverse resolve address to ENS name
 * 3. Manual overrides - server-side config file
 * 
 * Optional query params:
 * - contractAddress: If provided, will also try to resolve contract creator
 * - tokenId: Optional token ID for contract creator lookup
 * 
 * GET /api/artist/[address]?contractAddress=0x...&tokenId=123
 * Returns: { name: string | null, source: 'farcaster' | 'ens' | 'override' | 'contract-creator' | null }
 * 
 * Route-level caching: 5 minutes (prevents database pool exhaustion)
 */

type NameSource = "farcaster" | "ens" | "override" | "contract-creator" | null;

interface ArtistNameResponse {
  name: string | null;
  source: NameSource;
  address: string;
  creatorAddress?: string | null; // Contract creator address if found but name not resolved
}

async function resolveArtistName(
  address: string,
  contractAddress: string | null,
  tokenIdParam: string | null
): Promise<ArtistNameResponse> {
  // If contractAddress is provided, we can skip address validation
  // (address might be a dummy value when only looking up contract creator)
  if (!contractAddress && (!address || !/^0x[a-fA-F0-9]{40}$/.test(address))) {
    return { name: null, source: null, address: address || "" };
  }

  // Normalize address (use dummy if not provided but contractAddress is)
  const normalizedAddress = address ? address.toLowerCase() : '0x0000000000000000000000000000000000000000';

  // If contractAddress provided, prioritize contract creator lookup
  // This ensures we show the NFT creator, not the auction seller
  if (contractAddress && /^0x[a-fA-F0-9]{40}$/i.test(contractAddress)) {
    try {
      const tokenId = tokenIdParam ? BigInt(tokenIdParam) : undefined;
      const creatorResult = await getContractCreator(contractAddress, tokenId);
      
      if (creatorResult.creator && creatorResult.creator.toLowerCase() === normalizedAddress) {
        // The address IS the contract creator, but we couldn't resolve a name
        // This is fine - we'll return null and let the UI show "Unknown Artist"
      } else if (creatorResult.creator && creatorResult.creator.toLowerCase() !== normalizedAddress) {
        // The contract creator is different - resolve the creator's name
        const creatorAddress = creatorResult.creator.toLowerCase();
        
        // Try to resolve the creator's name (prioritize creator over seller)
        const creatorNeynar = await lookupNeynarByAddress(creatorAddress);
        
        if (creatorNeynar) {
          return {
            name: creatorNeynar.name,
            source: "contract-creator",
            address: normalizedAddress,
            creatorAddress: creatorAddress,
          };
        }
        
        // Try ENS for creator
        const creatorEns = await resolveEnsName(creatorAddress);
        if (creatorEns) {
          return {
            name: creatorEns,
            source: "contract-creator",
            address: normalizedAddress,
            creatorAddress: creatorAddress,
          };
        }
        
        // Try manual overrides for creator
        const creatorOverride = getArtistOverride(creatorAddress);
        if (creatorOverride) {
          return {
            name: creatorOverride,
            source: "contract-creator",
            address: normalizedAddress,
            creatorAddress: creatorAddress,
          };
        }
        
        // Creator found but name couldn't be resolved - return creator address
        return {
          name: null,
          source: "contract-creator",
          address: normalizedAddress,
          creatorAddress: creatorAddress,
        };
      }
    } catch (error) {
      console.error("Error checking contract creator:", error);
      // Fall through to seller address resolution
    }
  }

  // Fallback: If no contract address or contract creator not found,
  // try to resolve the seller address (for backwards compatibility)
  // 1. Try Neynar (Farcaster)
  const neynarResult = await lookupNeynarByAddress(normalizedAddress);
  if (neynarResult) {
    return {
      name: neynarResult.name,
      source: "farcaster",
      address: normalizedAddress,
    };
  }

  // 2. Try ENS
  const ensName = await resolveEnsName(normalizedAddress);
  if (ensName) {
    return {
      name: ensName,
      source: "ens",
      address: normalizedAddress,
    };
  }

  // 3. Try manual overrides
  const overrideName = getArtistOverride(normalizedAddress);
  if (overrideName) {
    return {
      name: overrideName,
      source: "override",
      address: normalizedAddress,
    };
  }

  // No name found
  return {
    name: null,
    source: null,
    address: normalizedAddress,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<ArtistNameResponse>> {
  let normalizedAddress = '0x0000000000000000000000000000000000000000';
  
  try {
    const { address } = await params;
    const { searchParams } = new URL(request.url);
    const contractAddress = searchParams.get("contractAddress");
    const tokenIdParam = searchParams.get("tokenId");

    // Normalize address for cache key
    normalizedAddress = address ? address.toLowerCase() : '0x0000000000000000000000000000000000000000';
    const cacheKey = `artist-${normalizedAddress}-${contractAddress || ''}-${tokenIdParam || ''}`;

    // Use unstable_cache to prevent database pool exhaustion
    // Wrap in timeout to prevent hanging if database is slow
    const result = await withTimeout(
      unstable_cache(
        async () => {
          return resolveArtistName(address, contractAddress, tokenIdParam);
        },
        ['artist-name', cacheKey],
        {
          revalidate: 300, // Cache for 5 minutes
          tags: ['artists', `artist-${normalizedAddress}`], // Can be invalidated with revalidateTag
        }
      )(),
      5000, // 5 second timeout
      { name: null, source: null, address: normalizedAddress } // Fallback on timeout
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('[artist API] Error:', error);
    // Return null result on error instead of crashing
    // If we didn't get the address in try block, try to get it now
    if (normalizedAddress === '0x0000000000000000000000000000000000000000') {
      try {
        const { address } = await params;
        normalizedAddress = address ? address.toLowerCase() : '0x0000000000000000000000000000000000000000';
      } catch {
        // Ignore errors getting params
      }
    }
    return NextResponse.json({ name: null, source: null, address: normalizedAddress });
  }
}

