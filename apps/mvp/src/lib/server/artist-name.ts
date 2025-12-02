import { getContractCreator } from "~/lib/contract-creator";
import {
  lookupNeynarByAddress,
  resolveEnsName,
} from "~/lib/artist-name-resolution";
import { getArtistOverride } from "~/lib/artistOverrides";

export type NameSource = "farcaster" | "ens" | "override" | "contract-creator" | null;

export interface ArtistNameResult {
  name: string | null;
  source: NameSource;
}

/**
 * Server-side artist name resolution.
 * Follows the exact same resolution flow as the auction page:
 * 1. Get contract creator address via Etherscan API
 * 2. Look up creator address on Neynar for Farcaster username
 * 3. Fallback to ENS reverse resolution
 * 4. Fallback to manual overrides
 * 
 * This ensures OpenGraph images show the exact same artist name as the auction page.
 * 
 * @param contractAddress - The NFT contract address
 * @param tokenId - Optional token ID for contract creator lookup
 * @returns Artist name and source
 */
export async function getArtistNameServer(
  contractAddress: string,
  tokenId?: string | bigint
): Promise<ArtistNameResult> {
  console.log(`[OG Image] [getArtistNameServer] Fetching artist name for contract ${contractAddress}, tokenId: ${tokenId || 'none'}`);
  
  if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/i.test(contractAddress)) {
    console.warn(`[OG Image] [getArtistNameServer] Invalid contract address: ${contractAddress}`);
    return { name: null, source: null };
  }

  // Step 1: Get contract creator address via Etherscan API (or on-chain methods)
  try {
    const tokenIdBigInt = tokenId ? (typeof tokenId === 'bigint' ? tokenId : BigInt(tokenId)) : undefined;
    const creatorResult = await getContractCreator(contractAddress, tokenIdBigInt);

    if (creatorResult.creator && creatorResult.creator !== "0x0000000000000000000000000000000000000000") {
      const creatorAddress = creatorResult.creator.toLowerCase();

      // Step 2: Look up creator address on Neynar for Farcaster username
      console.log(`[OG Image] [getArtistNameServer] Looking up creator ${creatorAddress} on Neynar...`);
      const creatorNeynar = await lookupNeynarByAddress(creatorAddress);
      if (creatorNeynar) {
        console.log(`[OG Image] [getArtistNameServer] Found artist name via Neynar: ${creatorNeynar.name}`);
        return {
          name: creatorNeynar.name,
          source: "contract-creator",
        };
      }

      // Step 3: Fallback to ENS reverse resolution
      const creatorEns = await resolveEnsName(creatorAddress);
      if (creatorEns) {
        return {
          name: creatorEns,
          source: "contract-creator",
        };
      }

      // Step 4: Fallback to manual overrides
      const creatorOverride = getArtistOverride(creatorAddress);
      if (creatorOverride) {
        return {
          name: creatorOverride,
          source: "contract-creator",
        };
      }

      // Creator found but name couldn't be resolved
      return {
        name: null,
        source: "contract-creator",
      };
    }
  } catch (error) {
    console.error(`[OG Image] [getArtistNameServer] Error in artist name resolution:`, error);
    if (error instanceof Error) {
      console.error(`[OG Image] [getArtistNameServer] Error stack:`, error.stack);
    }
    // Continue and return null below
  }

  // No creator found or error occurred
  console.log(`[OG Image] [getArtistNameServer] No artist name found for contract ${contractAddress}`);
  return { name: null, source: null };
}

