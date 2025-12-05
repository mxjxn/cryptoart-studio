import { 
  getDatabase, 
  userCache, 
  type UserCacheData,
  eq,
  sql
} from '@cryptoart/db';

/**
 * Check if database is available
 */
function isDatabaseAvailable(): boolean {
  return !!(process.env.STORAGE_POSTGRES_URL || process.env.POSTGRES_URL);
}

/**
 * Get user info from cache
 * Returns null if database is not available or cache miss
 * Searches both primary ethAddress and verifiedWallets array
 */
export async function getUserFromCache(
  address: string
): Promise<UserCacheData | null> {
  // Check if database is configured
  if (!isDatabaseAvailable()) {
    return null;
  }

  try {
    const db = getDatabase();
    const normalizedAddress = address.toLowerCase();
    
    // First try exact ethAddress match
    const [cached] = await db.select()
      .from(userCache)
      .where(eq(userCache.ethAddress, normalizedAddress))
      .limit(1);
    
    // Check if cache is expired
    if (cached && cached.expiresAt > new Date()) {
      return cached as UserCacheData;
    }
    
    // If not found by primary address, search in verifiedWallets JSONB array
    // This handles cases where the address is a verified wallet, not the primary
    const [cachedByVerified] = await db.select()
      .from(userCache)
      .where(sql`${userCache.verifiedWallets} @> ${JSON.stringify([normalizedAddress])}::jsonb`)
      .limit(1);
    
    if (cachedByVerified && cachedByVerified.expiresAt > new Date()) {
      return cachedByVerified as UserCacheData;
    }
    
    // Cache expired or doesn't exist
    return null;
  } catch (error) {
    // Database connection failure - log but don't throw
    console.warn(`[getUserFromCache] Database error (continuing without cache):`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Cache user information
 * Uses upsert (INSERT ... ON CONFLICT DO UPDATE) to handle existing records
 * Returns a mock object if database is not available
 */
export async function cacheUserInfo(
  address: string,
  data: {
    fid?: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
    verifiedWallets?: string[];
    ensName?: string;
    source: 'neynar' | 'ens' | 'manual' | 'contract-creator';
  }
): Promise<UserCacheData> {
  // Check if database is configured
  if (!isDatabaseAvailable()) {
    // Return a mock object that matches the expected structure
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return {
      ethAddress: address.toLowerCase(),
      fid: data.fid ?? null,
      username: data.username ?? null,
      displayName: data.displayName ?? null,
      pfpUrl: data.pfpUrl ?? null,
      verifiedWallets: data.verifiedWallets ?? null,
      ensName: data.ensName ?? null,
      source: data.source,
      cachedAt: new Date(),
      expiresAt,
      refreshedAt: new Date(),
    } as UserCacheData;
  }

  try {
    const db = getDatabase();
    const normalizedAddress = address.toLowerCase();
  
    // Calculate expiration (30 days from now)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    // Check if record exists
    const [existing] = await db.select()
      .from(userCache)
      .where(eq(userCache.ethAddress, normalizedAddress))
      .limit(1);
    
    if (existing) {
      // Update existing record
      const [updated] = await db.update(userCache)
        .set({
          fid: data.fid ?? existing.fid,
          username: data.username ?? existing.username,
          displayName: data.displayName ?? existing.displayName,
          pfpUrl: data.pfpUrl ?? existing.pfpUrl,
          verifiedWallets: data.verifiedWallets ?? existing.verifiedWallets,
          ensName: data.ensName ?? existing.ensName,
          source: data.source,
          expiresAt,
          refreshedAt: new Date(),
        })
        .where(eq(userCache.ethAddress, normalizedAddress))
        .returning();
      
      return updated as UserCacheData;
    } else {
      // Insert new record
      const [inserted] = await db.insert(userCache).values({
        ethAddress: normalizedAddress,
        fid: data.fid,
        username: data.username,
        displayName: data.displayName,
        pfpUrl: data.pfpUrl,
        verifiedWallets: data.verifiedWallets || null,
        ensName: data.ensName,
        source: data.source,
        cachedAt: new Date(),
        expiresAt,
        refreshedAt: new Date(),
      }).returning();
      
      return inserted as UserCacheData;
    }
  } catch (error) {
    // Database connection failure - log but return mock object
    console.warn(`[cacheUserInfo] Database error (returning mock object):`, error instanceof Error ? error.message : String(error));
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return {
      ethAddress: address.toLowerCase(),
      fid: data.fid ?? null,
      username: data.username ?? null,
      displayName: data.displayName ?? null,
      pfpUrl: data.pfpUrl ?? null,
      verifiedWallets: data.verifiedWallets ?? null,
      ensName: data.ensName ?? null,
      source: data.source,
      cachedAt: new Date(),
      expiresAt,
      refreshedAt: new Date(),
    } as UserCacheData;
  }
}

/**
 * Get or fetch user info with caching
 * Checks cache first, then fetches if needed
 */
export async function getOrFetchUserInfo(
  address: string,
  fetchFn: () => Promise<{ name: string; fid?: number; username?: string; displayName?: string; pfpUrl?: string } | null>
): Promise<{ name: string; fid?: number; username?: string; displayName?: string; pfpUrl?: string } | null> {
  // Check cache first
  const cached = await getUserFromCache(address);
  if (cached && cached.expiresAt > new Date()) {
    return {
      name: cached.username || cached.displayName || cached.ensName || `${address.slice(0, 6)}...${address.slice(-4)}`,
      fid: cached.fid || undefined,
      username: cached.username || undefined,
      displayName: cached.displayName || undefined,
      pfpUrl: cached.pfpUrl || undefined,
    };
  }
  
  // Cache miss or expired - fetch fresh data
  const fresh = await fetchFn();
  if (fresh) {
    // Cache the result
    await cacheUserInfo(address, {
      fid: fresh.fid,
      username: fresh.username,
      displayName: fresh.displayName,
      pfpUrl: fresh.pfpUrl,
      source: 'neynar',
    });
  }
  
  return fresh;
}

