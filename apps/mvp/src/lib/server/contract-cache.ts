import { getDatabase, contractCache, eq, and, gte, resetDatabaseConnection } from "@cryptoart/db";
import type { ContractCacheData } from "@cryptoart/db";

/**
 * Check if database is available
 */
function isDatabaseAvailable(): boolean {
  return !!(process.env.STORAGE_POSTGRES_URL || process.env.POSTGRES_URL);
}

/**
 * Get cached contracts for a creator address
 * Returns contracts from cache with their tokenType and other metadata
 */
export async function getCachedContracts(
  creatorAddress: string
): Promise<Array<{ address: string; name: string | null; tokenType: string }>> {
  const normalizedAddress = creatorAddress.toLowerCase();
  
  if (!isDatabaseAvailable()) {
    return [];
  }

  try {
    const db = getDatabase();
    const now = new Date();
    
    const cached = await db
      .select()
      .from(contractCache)
      .where(
        and(
          eq(contractCache.creatorAddress, normalizedAddress),
          gte(contractCache.expiresAt, now), // Only non-expired entries
        )
      );
    
    // Filter entries with tokenType (NFT contracts) and format response
    return cached
      .filter((c) => c.tokenType) // Only return entries with tokenType (NFT contracts)
      .map((c) => ({
        address: c.contractAddress,
        name: c.name || null,
        tokenType: c.tokenType || "ERC721", // Default to ERC721 if missing
      }))
      .sort((a, b) => {
        if (!a.name && !b.name) return 0;
        if (!a.name) return 1;
        if (!b.name) return -1;
        return a.name.localeCompare(b.name);
      });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[getCachedContracts] Database error:`, errorMessage);
    
    // If connection is closed, reset it and retry once
    if (errorMessage.includes('CONNECTION_CLOSED') || errorMessage.includes('connection closed')) {
      try {
        resetDatabaseConnection();
        const db = getDatabase();
        const now = new Date();
        
        const cached = await db
          .select()
          .from(contractCache)
          .where(
            and(
              eq(contractCache.creatorAddress, normalizedAddress),
              gte(contractCache.expiresAt, now),
            )
          );
        
        return cached
          .filter((c) => c.tokenType)
          .map((c) => ({
            address: c.contractAddress,
            name: c.name || null,
            tokenType: c.tokenType || "ERC721",
          }))
          .sort((a, b) => {
            if (!a.name && !b.name) return 0;
            if (!a.name) return 1;
            if (!b.name) return -1;
            return a.name.localeCompare(b.name);
          });
      } catch (retryError) {
        console.error(`[getCachedContracts] Retry failed:`, retryError instanceof Error ? retryError.message : String(retryError));
        return [];
      }
    }
    
    return [];
  }
}

/**
 * Get the last checked block for a creator address
 * Returns the maximum lastCheckedBlock across all contracts for this creator
 */
export async function getLastCheckedBlock(
  creatorAddress: string
): Promise<number | null> {
  const normalizedAddress = creatorAddress.toLowerCase();
  
  if (!isDatabaseAvailable()) {
    return null;
  }

  try {
    const db = getDatabase();
    
    // Get all lastCheckedBlock values for this creator
    const results = await db
      .select({
        lastCheckedBlock: contractCache.lastCheckedBlock,
      })
      .from(contractCache)
      .where(eq(contractCache.creatorAddress, normalizedAddress));
    
    const blocks = results
      .map((r) => r.lastCheckedBlock)
      .filter((b): b is number => b !== null && b !== undefined);
    
    return blocks.length > 0 ? Math.max(...blocks) : null;
  } catch (error) {
    console.error(`[getLastCheckedBlock] Database error:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Cache a deployed contract
 */
export async function cacheDeployedContract(
  contractAddress: string,
  data: {
    name: string | null;
    tokenType: string;
    creatorAddress: string;
    lastCheckedBlock: number;
  }
): Promise<void> {
  const normalizedAddress = contractAddress.toLowerCase();
  const normalizedCreator = data.creatorAddress.toLowerCase();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  if (!isDatabaseAvailable()) {
    return;
  }

  try {
    const db = getDatabase();
    
    // Check if record exists
    const [existing] = await db
      .select()
      .from(contractCache)
      .where(eq(contractCache.contractAddress, normalizedAddress))
      .limit(1);
    
    if (existing) {
      // Update existing record
      await db
        .update(contractCache)
        .set({
          name: data.name,
          tokenType: data.tokenType,
          creatorAddress: normalizedCreator,
          lastCheckedBlock: data.lastCheckedBlock,
          expiresAt,
          refreshedAt: new Date(),
        })
        .where(eq(contractCache.contractAddress, normalizedAddress));
    } else {
      // Insert new record
      await db.insert(contractCache).values({
        contractAddress: normalizedAddress,
        name: data.name,
        tokenType: data.tokenType,
        creatorAddress: normalizedCreator,
        lastCheckedBlock: data.lastCheckedBlock,
        source: "alchemy",
        expiresAt,
        cachedAt: new Date(),
      });
    }
  } catch (error) {
    console.error(`[cacheDeployedContract] Database error:`, error instanceof Error ? error.message : String(error));
  }
}

/**
 * Update last checked block for all contracts from a creator
 */
export async function updateLastCheckedBlockForCreator(
  creatorAddress: string,
  blockNumber: number
): Promise<void> {
  const normalizedAddress = creatorAddress.toLowerCase();
  
  if (!isDatabaseAvailable()) {
    return;
  }

  try {
    const db = getDatabase();
    
    await db
      .update(contractCache)
      .set({
        lastCheckedBlock: blockNumber,
        refreshedAt: new Date(),
      })
      .where(eq(contractCache.creatorAddress, normalizedAddress));
  } catch (error) {
    console.error(`[updateLastCheckedBlockForCreator] Database error:`, error instanceof Error ? error.message : String(error));
  }
}

