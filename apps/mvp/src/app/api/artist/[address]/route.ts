import { NextRequest, NextResponse } from "next/server";
import { getArtistOverride } from "~/lib/artistOverrides";
import { getContractCreator } from "~/lib/contract-creator";
import {
  lookupNeynarByAddress,
  resolveEnsName,
} from "~/lib/artist-name-resolution";

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
 */

type NameSource = "farcaster" | "ens" | "override" | "contract-creator" | null;

interface ArtistNameResponse {
  name: string | null;
  source: NameSource;
  address: string;
  creatorAddress?: string | null; // Contract creator address if found but name not resolved
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<ArtistNameResponse>> {
  const { address } = await params;
  const { searchParams } = new URL(request.url);
  const contractAddress = searchParams.get("contractAddress");
  const tokenIdParam = searchParams.get("tokenId");

  // If contractAddress is provided, we can skip address validation
  // (address might be a dummy value when only looking up contract creator)
  if (!contractAddress && (!address || !/^0x[a-fA-F0-9]{40}$/.test(address))) {
    return NextResponse.json(
      { name: null, source: null, address: address || "" },
      { status: 400 }
    );
  }

  // Normalize address (use dummy if not provided but contractAddress is)
  const normalizedAddress = address ? address.toLowerCase() : '0x0000000000000000000000000000000000000000';

  // If contractAddress provided, prioritize contract creator lookup
  // This ensures we show the NFT creator, not the auction seller
  if (contractAddress && /^0x[a-fA-F0-9]{40}$/i.test(contractAddress)) {
    console.log('[artist API] Contract address provided:', contractAddress);
    try {
      const tokenId = tokenIdParam ? BigInt(tokenIdParam) : undefined;
      console.log('[artist API] Getting contract creator for:', contractAddress, 'tokenId:', tokenId);
      const creatorResult = await getContractCreator(contractAddress, tokenId);
      console.log('[artist API] Contract creator result:', creatorResult);
      
      if (creatorResult.creator && creatorResult.creator.toLowerCase() === normalizedAddress) {
        // The address IS the contract creator, but we couldn't resolve a name
        // This is fine - we'll return null and let the UI show "Unknown Artist"
        console.log('[artist API] Address is the contract creator, but no name resolved');
      } else if (creatorResult.creator && creatorResult.creator.toLowerCase() !== normalizedAddress) {
        // The contract creator is different - resolve the creator's name
        const creatorAddress = creatorResult.creator.toLowerCase();
        console.log('[artist API] Contract creator found:', creatorAddress, 'different from address:', normalizedAddress);
        
        // Try to resolve the creator's name (prioritize creator over seller)
        console.log('[artist API] Looking up creator name via Neynar for:', creatorAddress);
        const creatorNeynar = await lookupNeynarByAddress(creatorAddress);
        console.log('[artist API] Creator Neynar lookup result:', creatorNeynar);
        
        if (creatorNeynar) {
          console.log('[artist API] Returning creator name:', creatorNeynar.name);
          return NextResponse.json({
            name: creatorNeynar.name,
            source: "contract-creator",
            address: normalizedAddress,
            creatorAddress: creatorAddress,
          });
        }
        
        // Try ENS for creator
        const creatorEns = await resolveEnsName(creatorAddress);
        if (creatorEns) {
          return NextResponse.json({
            name: creatorEns,
            source: "contract-creator",
            address: normalizedAddress,
            creatorAddress: creatorAddress,
          });
        }
        
        // Try manual overrides for creator
        const creatorOverride = getArtistOverride(creatorAddress);
        if (creatorOverride) {
          return NextResponse.json({
            name: creatorOverride,
            source: "contract-creator",
            address: normalizedAddress,
            creatorAddress: creatorAddress,
          });
        }
        
        // Creator found but name couldn't be resolved - return creator address
        return NextResponse.json({
          name: null,
          source: "contract-creator",
          address: normalizedAddress,
          creatorAddress: creatorAddress,
        });
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
    return NextResponse.json({
      name: neynarResult.name,
      source: "farcaster",
      address: normalizedAddress,
    });
  }

  // 2. Try ENS
  const ensName = await resolveEnsName(normalizedAddress);
  if (ensName) {
    return NextResponse.json({
      name: ensName,
      source: "ens",
      address: normalizedAddress,
    });
  }

  // 3. Try manual overrides
  const overrideName = getArtistOverride(normalizedAddress);
  if (overrideName) {
    return NextResponse.json({
      name: overrideName,
      source: "override",
      address: normalizedAddress,
    });
  }

  // No name found
  return NextResponse.json({
    name: null,
    source: null,
    address: normalizedAddress,
  });
}

