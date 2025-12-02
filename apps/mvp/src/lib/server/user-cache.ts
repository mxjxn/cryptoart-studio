import { 
  getDatabase, 
  userCache, 
  type UserCacheData,
  eq,
  sql
} from '@cryptoart/db';

/**
 * Get user info from cache
 */
export async function getUserFromCache(
  address: string
): Promise<UserCacheData | null> {
  const db = getDatabase();
  const normalizedAddress = address.toLowerCase();
  
  const [cached] = await db.select()
    .from(userCache)
    .where(eq(userCache.ethAddress, normalizedAddress))
    .limit(1);
  
  // Check if cache is expired
  if (cached && cached.expiresAt > new Date()) {
    return cached as UserCacheData;
  }
  
  // Cache expired or doesn't exist
  return null;
}

/**
 * Cache user information
 * Uses upsert (INSERT ... ON CONFLICT DO UPDATE) to handle existing records
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

