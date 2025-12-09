import { getDatabase, eq, and, gte } from '@cryptoart/db';
import { erc1155TokenSupplyCache } from '@cryptoart/db';
import { fetchERC1155TotalSupply } from '~/lib/erc1155-supply';

/**
 * Check if database is available
 */
function isDatabaseAvailable(): boolean {
  try {
    getDatabase();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get cached ERC1155 total supply from database
 * Returns null if not cached or expired
 * Gracefully handles missing table (returns null)
 */
export async function getCachedERC1155TotalSupply(
  contractAddress: string,
  tokenId: string
): Promise<{ totalSupply: bigint; isLazyMint: boolean } | null> {
  const normalizedAddress = contractAddress.toLowerCase();
  
  if (!isDatabaseAvailable()) {
    return null;
  }

  try {
    const db = getDatabase();
    const now = new Date();
    
    const [cached] = await db
      .select()
      .from(erc1155TokenSupplyCache)
      .where(
        and(
          eq(erc1155TokenSupplyCache.contractAddress, normalizedAddress),
          eq(erc1155TokenSupplyCache.tokenId, tokenId),
          gte(erc1155TokenSupplyCache.expiresAt, now) // Only non-expired entries
        )
      )
      .limit(1);
    
    if (cached) {
      return {
        totalSupply: cached.totalSupply,
        isLazyMint: cached.isLazyMint,
      };
    }
    
    return null;
  } catch (error: any) {
    // Handle table not found or other database errors gracefully
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation') || errorMessage.includes('table')) {
      // Table doesn't exist yet - this is okay, just return null
      console.log(`[getCachedERC1155TotalSupply] Table not found (migration pending), skipping cache`);
      return null;
    }
    console.error(`[getCachedERC1155TotalSupply] Database error:`, errorMessage);
    return null;
  }
}

/**
 * Cache ERC1155 total supply in database
 * Uses upsert pattern to handle existing records
 * Gracefully handles missing table (silently fails)
 */
export async function cacheERC1155TotalSupply(
  contractAddress: string,
  tokenId: string,
  totalSupply: bigint,
  isLazyMint: boolean = false
): Promise<void> {
  const normalizedAddress = contractAddress.toLowerCase();
  
  if (!isDatabaseAvailable()) {
    return;
  }

  try {
    const db = getDatabase();
    const now = new Date();
    
    // TTL: 30 days for non-lazy-mint tokens, 1 day for lazy mint tokens
    const ttlDays = isLazyMint ? 1 : 30;
    const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
    
    // Check if record exists
    const [existing] = await db
      .select()
      .from(erc1155TokenSupplyCache)
      .where(
        and(
          eq(erc1155TokenSupplyCache.contractAddress, normalizedAddress),
          eq(erc1155TokenSupplyCache.tokenId, tokenId)
        )
      )
      .limit(1);
    
    if (existing) {
      // Update existing record
      await db
        .update(erc1155TokenSupplyCache)
        .set({
          totalSupply,
          isLazyMint,
          expiresAt,
          updatedAt: now,
        })
        .where(
          and(
            eq(erc1155TokenSupplyCache.contractAddress, normalizedAddress),
            eq(erc1155TokenSupplyCache.tokenId, tokenId)
          )
        );
    } else {
      // Insert new record
      await db.insert(erc1155TokenSupplyCache).values({
        contractAddress: normalizedAddress,
        tokenId,
        totalSupply,
        isLazyMint,
        cachedAt: now,
        expiresAt,
        updatedAt: now,
      });
    }
  } catch (error: any) {
    // Handle table not found or other database errors gracefully
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation') || errorMessage.includes('table')) {
      // Table doesn't exist yet - this is okay, just skip caching
      console.log(`[cacheERC1155TotalSupply] Table not found (migration pending), skipping cache`);
      return;
    }
    console.error(`[cacheERC1155TotalSupply] Database error:`, errorMessage);
    // Don't throw - caching is best effort
  }
}

/**
 * Get ERC1155 total supply with caching
 * Checks cache first, then fetches if needed
 * Never throws - returns null on any error
 */
export async function getERC1155TotalSupply(
  contractAddress: string,
  tokenId: string
): Promise<bigint | null> {
  try {
    // Check cache first
    const cached = await getCachedERC1155TotalSupply(contractAddress, tokenId);
    if (cached) {
      return cached.totalSupply;
    }
    
    // Fetch from API/contract
    const totalSupply = await fetchERC1155TotalSupply(contractAddress, tokenId);
    
    if (totalSupply !== null) {
      // Cache the result (best effort, don't wait)
      cacheERC1155TotalSupply(contractAddress, tokenId, totalSupply, false).catch(err => {
        console.error('[getERC1155TotalSupply] Failed to cache supply:', err);
      });
    }
    
    return totalSupply;
  } catch (error: any) {
    // Never throw - this is optional enrichment data
    const errorMsg = error?.message || String(error);
    console.error(`[getERC1155TotalSupply] Error for ${contractAddress}:${tokenId}:`, errorMsg);
    return null;
  }
}

/**
 * Invalidate cache for a specific token (useful for lazy mint scenarios)
 * Gracefully handles missing table
 */
export async function invalidateERC1155SupplyCache(
  contractAddress: string,
  tokenId: string
): Promise<void> {
  const normalizedAddress = contractAddress.toLowerCase();
  
  if (!isDatabaseAvailable()) {
    return;
  }

  try {
    const db = getDatabase();
    
    await db
      .delete(erc1155TokenSupplyCache)
      .where(
        and(
          eq(erc1155TokenSupplyCache.contractAddress, normalizedAddress),
          eq(erc1155TokenSupplyCache.tokenId, tokenId)
        )
      );
  } catch (error: any) {
    // Handle table not found or other database errors gracefully
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation') || errorMessage.includes('table')) {
      // Table doesn't exist yet - this is okay
      return;
    }
    console.error(`[invalidateERC1155SupplyCache] Database error:`, errorMessage);
  }
}

