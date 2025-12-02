export { 
  getDatabase, 
  artistCache, 
  contractCache
} from './client.js';
export type { ArtistCacheData, ContractCacheData } from './schema.js';

// Re-export common drizzle-orm functions to ensure type compatibility
export { eq, and, or, desc, asc, sql, count, lt, gt, gte, lte, ne, not, like, ilike, inArray } from 'drizzle-orm';
