import { 
  getDatabase, 
  userCache, 
  contractCache,
  type UserCacheData,
  type ContractCacheData,
  eq,
  sql
} from '@cryptoart/db';

/**
 * In-memory cache for user lookups within a single request/worker run
 * This prevents repeated database hits for the same user
 * Cache is cleared after worker run completes or after 5 minutes
 */
const inMemoryCache: Map<string, { data: UserCacheData; timestamp: number }> = new Map();
const IN_MEMORY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_IN_MEMORY_CACHE_SIZE = 1000; // Prevent unbounded memory growth

/**
 * Get user from in-memory cache (fastest layer)
 */
function getFromMemoryCache(address: string): UserCacheData | null {
  const normalizedAddress = address.toLowerCase();
  const cached = inMemoryCache.get(normalizedAddress);
  
  if (!cached) {
    return null;
  }
  
  // Check if expired
  if (Date.now() - cached.timestamp > IN_MEMORY_CACHE_TTL_MS) {
    inMemoryCache.delete(normalizedAddress);
    return null;
  }
  
  return cached.data;
}

/**
 * Store user in in-memory cache
 */
function setInMemoryCache(address: string, data: UserCacheData): void {
  const normalizedAddress = address.toLowerCase();
  
  // Prevent unbounded growth - remove oldest entries if at capacity
  if (inMemoryCache.size >= MAX_IN_MEMORY_CACHE_SIZE) {
    // Remove the oldest 10% of entries
    const toRemove = Math.floor(MAX_IN_MEMORY_CACHE_SIZE * 0.1);
    const entries = [...inMemoryCache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, toRemove);
    
    for (const [key] of entries) {
      inMemoryCache.delete(key);
    }
  }
  
  inMemoryCache.set(normalizedAddress, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Clear the in-memory cache
 * Call this after worker run completes or periodically
 */
export function clearInMemoryUserCache(): void {
  inMemoryCache.clear();
}

/**
 * Get in-memory cache stats for logging
 */
export function getInMemoryCacheStats(): { size: number; oldestAge: number | null } {
  if (inMemoryCache.size === 0) {
    return { size: 0, oldestAge: null };
  }
  
  const now = Date.now();
  let oldestTimestamp = now;
  
  for (const entry of inMemoryCache.values()) {
    if (entry.timestamp < oldestTimestamp) {
      oldestTimestamp = entry.timestamp;
    }
  }
  
  return {
    size: inMemoryCache.size,
    oldestAge: now - oldestTimestamp,
  };
}

/**
 * Check if database is available
 */
function isDatabaseAvailable(): boolean {
  return !!(process.env.STORAGE_POSTGRES_URL || process.env.POSTGRES_URL);
}

/**
 * Get user info from cache
 * Returns null if cache miss
 * 
 * Cache layers (checked in order):
 * 1. In-memory cache (fastest, 5-minute TTL)
 * 2. Database cache (slower, 30-day TTL)
 * 
 * Searches both primary ethAddress and verifiedWallets array
 */
export async function getUserFromCache(
  address: string
): Promise<UserCacheData | null> {
  const normalizedAddress = address.toLowerCase();
  
  // Layer 1: Check in-memory cache first (fastest)
  const memoryCached = getFromMemoryCache(normalizedAddress);
  if (memoryCached) {
    return memoryCached;
  }
  
  // Layer 2: Check database cache
  if (!isDatabaseAvailable()) {
    return null;
  }

  try {
    const db = getDatabase();
    
    // First try exact ethAddress match
    const [cached] = await db.select()
      .from(userCache)
      .where(eq(userCache.ethAddress, normalizedAddress))
      .limit(1);
    
    // Check if cache is expired
    if (cached && cached.expiresAt > new Date()) {
      // Store in memory cache for faster subsequent lookups
      setInMemoryCache(normalizedAddress, cached as UserCacheData);
      return cached as UserCacheData;
    }
    
    // If not found by primary address, search in verifiedWallets JSONB array
    // This handles cases where the address is a verified wallet, not the primary
    const [cachedByVerified] = await db.select()
      .from(userCache)
      .where(sql`${userCache.verifiedWallets} @> ${JSON.stringify([normalizedAddress])}::jsonb`)
      .limit(1);
    
    if (cachedByVerified && cachedByVerified.expiresAt > new Date()) {
      // Store in memory cache for faster subsequent lookups
      setInMemoryCache(normalizedAddress, cachedByVerified as UserCacheData);
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
 * Also stores in in-memory cache for fast subsequent lookups
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
  const normalizedAddress = address.toLowerCase();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  // Check if database is configured
  if (!isDatabaseAvailable()) {
    // Return a mock object that matches the expected structure
    const mockData = {
      ethAddress: normalizedAddress,
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
    
    // Still store in memory cache even without database
    setInMemoryCache(normalizedAddress, mockData);
    return mockData;
  }

  try {
    const db = getDatabase();
    
    // Check if record exists
    const [existing] = await db.select()
      .from(userCache)
      .where(eq(userCache.ethAddress, normalizedAddress))
      .limit(1);
    
    let result: UserCacheData;
    
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
      
      result = updated as UserCacheData;
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
      
      result = inserted as UserCacheData;
    }
    
    // Store in memory cache for fast subsequent lookups
    setInMemoryCache(normalizedAddress, result);
    return result;
  } catch (error) {
    // Database connection failure - log but return mock object
    console.warn(`[cacheUserInfo] Database error (returning mock object):`, error instanceof Error ? error.message : String(error));
    const mockData = {
      ethAddress: normalizedAddress,
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
    
    // Still store in memory cache even on DB error
    setInMemoryCache(normalizedAddress, mockData);
    return mockData;
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

// ============================================
// CONTRACT CACHE FUNCTIONS
// ============================================

/**
 * In-memory cache for contract lookups within a single request/worker run
 */
const contractMemoryCache: Map<string, { data: ContractCacheData; timestamp: number }> = new Map();
const CONTRACT_MEMORY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CONTRACT_MEMORY_CACHE_SIZE = 500;

/**
 * Get contract from in-memory cache (fastest layer)
 */
function getContractFromMemoryCache(contractAddress: string): ContractCacheData | null {
  const normalizedAddress = contractAddress.toLowerCase();
  const cached = contractMemoryCache.get(normalizedAddress);
  
  if (!cached) {
    return null;
  }
  
  // Check if expired
  if (Date.now() - cached.timestamp > CONTRACT_MEMORY_CACHE_TTL_MS) {
    contractMemoryCache.delete(normalizedAddress);
    return null;
  }
  
  return cached.data;
}

/**
 * Store contract in in-memory cache
 */
function setContractMemoryCache(contractAddress: string, data: ContractCacheData): void {
  const normalizedAddress = contractAddress.toLowerCase();
  
  // Prevent unbounded growth
  if (contractMemoryCache.size >= MAX_CONTRACT_MEMORY_CACHE_SIZE) {
    const toRemove = Math.floor(MAX_CONTRACT_MEMORY_CACHE_SIZE * 0.1);
    const entries = [...contractMemoryCache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, toRemove);
    
    for (const [key] of entries) {
      contractMemoryCache.delete(key);
    }
  }
  
  contractMemoryCache.set(normalizedAddress, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Get contract info from cache
 * Returns null if cache miss
 */
export async function getContractFromCache(
  contractAddress: string
): Promise<ContractCacheData | null> {
  const normalizedAddress = contractAddress.toLowerCase();
  
  // Layer 1: Check in-memory cache first (fastest)
  const memoryCached = getContractFromMemoryCache(normalizedAddress);
  if (memoryCached) {
    return memoryCached;
  }
  
  // Layer 2: Check database cache
  if (!isDatabaseAvailable()) {
    return null;
  }

  try {
    const db = getDatabase();
    
    const [cached] = await db.select()
      .from(contractCache)
      .where(eq(contractCache.contractAddress, normalizedAddress))
      .limit(1);
    
    // Check if cache is expired
    if (cached && cached.expiresAt > new Date()) {
      const cacheData = cached as ContractCacheData;
      // Store in memory cache for faster subsequent lookups
      setContractMemoryCache(normalizedAddress, cacheData);
      return cacheData;
    }
    
    // Cache expired or doesn't exist
    return null;
  } catch (error) {
    console.warn(`[getContractFromCache] Database error:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Cache contract information
 * Uses upsert pattern to handle existing records
 */
export async function cacheContractInfo(
  contractAddress: string,
  data: {
    name?: string | null;
    symbol?: string | null;
    creatorAddress?: string | null;
    source: 'onchain' | 'alchemy' | 'manual' | 'etherscan';
  }
): Promise<ContractCacheData | null> {
  const normalizedAddress = contractAddress.toLowerCase();
  const normalizedCreator = data.creatorAddress?.toLowerCase() || null;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  // Map 'etherscan' to 'onchain' for storage (both are external data sources)
  const normalizedSource: 'onchain' | 'alchemy' | 'manual' = 
    data.source === 'etherscan' ? 'onchain' : data.source;
  
  // Check if database is configured
  if (!isDatabaseAvailable()) {
    // Return a mock object that matches the expected structure
    const mockData: ContractCacheData = {
      contractAddress: normalizedAddress,
      name: data.name ?? null,
      symbol: data.symbol ?? null,
      creatorAddress: normalizedCreator,
      source: normalizedSource,
      cachedAt: new Date(),
      expiresAt,
      refreshedAt: new Date(),
    };
    
    // Still store in memory cache even without database
    setContractMemoryCache(normalizedAddress, mockData);
    return mockData;
  }

  try {
    const db = getDatabase();
    
    // Check if record exists
    const [existing] = await db.select()
      .from(contractCache)
      .where(eq(contractCache.contractAddress, normalizedAddress))
      .limit(1);
    
    let result: ContractCacheData;
    
    if (existing) {
      // Update existing record - only update fields that are provided
      const [updated] = await db.update(contractCache)
        .set({
          name: data.name ?? existing.name,
          symbol: data.symbol ?? existing.symbol,
          creatorAddress: normalizedCreator ?? existing.creatorAddress,
          source: normalizedSource,
          expiresAt,
          refreshedAt: new Date(),
        })
        .where(eq(contractCache.contractAddress, normalizedAddress))
        .returning();
      
      result = updated as ContractCacheData;
    } else {
      // Insert new record
      const [inserted] = await db.insert(contractCache).values({
        contractAddress: normalizedAddress,
        name: data.name ?? null,
        symbol: data.symbol ?? null,
        creatorAddress: normalizedCreator,
        source: normalizedSource,
        cachedAt: new Date(),
        expiresAt,
        refreshedAt: new Date(),
      }).returning();
      
      result = inserted as ContractCacheData;
    }
    
    // Store in memory cache for fast subsequent lookups
    setContractMemoryCache(normalizedAddress, result);
    console.log(`[cacheContractInfo] Cached contract ${normalizedAddress} with creator ${normalizedCreator}`);
    return result;
  } catch (error) {
    console.warn(`[cacheContractInfo] Database error:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Clear the contract in-memory cache
 */
export function clearContractMemoryCache(): void {
  contractMemoryCache.clear();
}

