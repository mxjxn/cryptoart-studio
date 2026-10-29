import { createPublicClient, http, type Address, isAddress } from "viem";
import { base } from "viem/chains";
import { HYPERSNAP_FARCASTER_URL, fetchFarcasterAccountByAddress } from "../../../../../packages/identity/src/farcasterDirectory";
import { STP_V2_CONTRACT_ADDRESS } from "~/lib/constants";
import { isAdminAddress } from "~/lib/server/admin";
import { getDatabase, membershipCache, eq, and, gt } from "@cryptoart/db";

// Standard ERC721/ERC1155 ABI for balanceOf
const NFT_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// Create a public client for Base chain (server-side)
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

/**
 * Check if an address has membership NFT balance > 0
 * Uses database cache to avoid repeated onchain calls
 */
async function checkAddressBalance(address: Address): Promise<boolean> {
  try {
    const db = getDatabase();
    const addressLower = address.toLowerCase();
    const now = new Date();
    
    // Check cache first
    if (db) {
      const cached = await db
        .select()
        .from(membershipCache)
        .where(
          and(
            eq(membershipCache.address, addressLower),
            eq(membershipCache.hasMembership, true),
            gt(membershipCache.expiresAt, now)
          )
        )
        .limit(1);
      
      if (cached.length > 0) {
        console.log(`[checkAddressBalance] Cache hit for ${addressLower}`);
        return true;
      }
      
      // Check if we have a recent negative cache entry (to avoid repeated failed calls)
      const negativeCache = await db
        .select()
        .from(membershipCache)
        .where(
          and(
            eq(membershipCache.address, addressLower),
            eq(membershipCache.hasMembership, false),
            gt(membershipCache.expiresAt, now)
          )
        )
        .limit(1);
      
      if (negativeCache.length > 0) {
        console.log(`[checkAddressBalance] Negative cache hit for ${addressLower}`);
        return false;
      }
    }
    
    // Cache miss - check onchain
    console.log(`[checkAddressBalance] Cache miss, checking onchain for ${addressLower}`);
    const balance = await publicClient.readContract({
      address: STP_V2_CONTRACT_ADDRESS,
      abi: NFT_BALANCE_ABI,
      functionName: "balanceOf",
      args: [address],
    });

    const hasMembership = balance > 0n;
    
    // Cache the result (5 minute TTL for positive, 1 minute for negative)
    if (db) {
      const expiresAt = new Date(now.getTime() + (hasMembership ? 5 * 60 * 1000 : 1 * 60 * 1000));
      try {
        await db
          .insert(membershipCache)
          .values({
            address: addressLower,
            hasMembership,
            cachedAt: now,
            expiresAt,
          })
          .onConflictDoUpdate({
            target: membershipCache.address,
            set: {
              hasMembership,
              cachedAt: now,
              expiresAt,
            },
          });
        console.log(`[checkAddressBalance] Cached result for ${addressLower}: ${hasMembership}`);
      } catch (cacheError) {
        // Don't fail if caching fails
        console.warn(`[checkAddressBalance] Failed to cache result:`, cacheError);
      }
    }

    return hasMembership;
  } catch (error) {
    console.error(`[checkAddressBalance] Error checking balance for ${address}:`, error);
    return false;
  }
}

/**
 * Addresses listed on the same Farcaster account as this wallet.
 * Used for membership checks. This is not a posting credential.
 */
async function getVerifiedAddresses(address: Address): Promise<Address[]> {
  try {
    const account = await fetchFarcasterAccountByAddress(
      address,
      fetch,
      process.env.HYPERSNAP_BASE_URL || HYPERSNAP_FARCASTER_URL,
    );
    if (!account) return [address];
    const verifiedAddresses: Address[] = [address];
    for (const candidate of account.verifiedAddresses) {
      if (!isAddress(candidate)) continue;
      if (verifiedAddresses.some(current => current.toLowerCase() === candidate.toLowerCase())) continue;
      verifiedAddresses.push(candidate);
    }
    return verifiedAddresses;
  } catch (error) {
    console.error(`[getVerifiedAddresses] Error fetching verified addresses for ${address}:`, error);
    return [address];
  }
}

/**
 * Server-side check if a user has access to galleries (membership NFT balanceOf > 0 or admin).
 * 
 * Admin users always have access. For non-admins:
 * - Checks membership NFT (STP_V2_CONTRACT_ADDRESS) balanceOf > 0
 * - Checks multiple addresses:
 *   1. The provided address
 *   2. Any verifiedAddresses provided by the client (from client-side hook)
 *   3. Falls back to addresses Hypersnap lists for this wallet if verifiedAddresses is not provided
 * 
 * Uses database cache to avoid repeated onchain calls.
 * 
 * @param address - The primary wallet address
 * @param verifiedAddresses - Optional array of verified addresses that have membership (from client-side hook)
 * @returns true if user is admin or any address has membership NFT balanceOf > 0, false otherwise
 */
export async function hasGalleryAccess(
  address: Address,
  verifiedAddresses?: string[]
): Promise<boolean> {
  // Check if user is admin first - admins always have access
  if (isAdminAddress(address)) {
    return true;
  }
  
  try {
    // If client provided verified addresses that have NFT, check those first (trust but verify)
    if (verifiedAddresses && verifiedAddresses.length > 0) {
      const addressesToCheck = verifiedAddresses
        .filter(addr => isAddress(addr))
        .map(addr => addr.toLowerCase() as Address);
      
      // Also include the primary address
      const primaryLower = address.toLowerCase();
      if (!addressesToCheck.includes(primaryLower as Address)) {
        addressesToCheck.push(primaryLower as Address);
      }
      
      // Check all provided addresses
      for (const addr of addressesToCheck) {
        if (await checkAddressBalance(addr)) {
          return true;
        }
      }
    }
    
    // If no verified addresses provided or none had NFT, check the primary address
    if (await checkAddressBalance(address)) {
      return true;
    }
    
    // As a fallback, check addresses Hypersnap lists for this wallet
    // (This helps when client doesn't provide verifiedAddresses, e.g., direct API calls)
    const allVerifiedAddresses = await getVerifiedAddresses(address);
    for (const addr of allVerifiedAddresses) {
      if (addr.toLowerCase() !== address.toLowerCase() && await checkAddressBalance(addr)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`[hasGalleryAccess] Error checking access for ${address}:`, error);
    // Fail closed - if we can't verify, deny access
    return false;
  }
}
