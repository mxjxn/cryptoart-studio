import { Redis as UpstashRedis } from '@upstash/redis';
import { Redis as IORedis } from 'ioredis';

// In-memory fallback storage
const localStore = new Map<string, unknown>();

// Redis client (supports both Upstash and local Redis)
// Lazy-loaded to avoid initialization at module load time (prevents build-time errors)
let redis: UpstashRedis | IORedis | null = null;
let redisInitialized = false;

/**
 * Initialize Redis client based on available environment variables
 * Priority: 1. Upstash Redis, 2. Local Redis, 3. In-memory fallback
 * This is called lazily on first use, not at module load time
 */
function initializeRedis(): UpstashRedis | IORedis | null {
  if (redisInitialized) {
    return redis;
  }

  redisInitialized = true;

  const upstashUrl = process.env.KV_REST_API_URL;
  const upstashToken = process.env.KV_REST_API_TOKEN;
  const redisUrl = process.env.REDIS_URL;

  if (upstashUrl && upstashToken) {
    // Use Upstash Redis (REST API)
    redis = new UpstashRedis({
      url: upstashUrl,
      token: upstashToken,
    });
  } else if (redisUrl) {
    // Use local Redis (ioredis)
    redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
  }

  return redis;
}

/**
 * Build a namespaced key for KV storage
 * @param namespace - The app or service namespace (e.g., 'cryptoart-studio-app', 'auctionhouse')
 * @param key - The key to namespace
 */
export function buildKey(namespace: string, key: string): string {
  return `${namespace}:${key}`;
}

/**
 * Get a value from KV storage (Redis or in-memory fallback)
 * @param key - The key to retrieve
 * @returns The stored value or null if not found
 */
export async function get<T = unknown>(key: string): Promise<T | null> {
  const redisClient = initializeRedis();
  if (redisClient) {
    if (redisClient instanceof UpstashRedis) {
      // Upstash Redis
      return await redisClient.get<T>(key);
    } else if (redisClient instanceof IORedis) {
      // Local Redis (ioredis)
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    }
  }
  return (localStore.get(key) as T) || null;
}

/**
 * Set a value in KV storage (Redis or in-memory fallback)
 * @param key - The key to set
 * @param value - The value to store
 */
export async function set<T = unknown>(key: string, value: T): Promise<void> {
  const redisClient = initializeRedis();
  if (redisClient) {
    if (redisClient instanceof UpstashRedis) {
      // Upstash Redis
      await redisClient.set(key, value);
    } else if (redisClient instanceof IORedis) {
      // Local Redis (ioredis)
      await redisClient.set(key, JSON.stringify(value));
    }
  } else {
    localStore.set(key, value);
  }
}

/**
 * Delete a value from KV storage (Redis or in-memory fallback)
 * @param key - The key to delete
 */
export async function del(key: string): Promise<void> {
  const redisClient = initializeRedis();
  if (redisClient) {
    if (redisClient instanceof UpstashRedis) {
      // Upstash Redis
      await redisClient.del(key);
    } else if (redisClient instanceof IORedis) {
      // Local Redis (ioredis)
      await redisClient.del(key);
    }
  } else {
    localStore.delete(key);
  }
}

/**
 * Check if Redis is available (not using in-memory fallback)
 */
export function isRedisConnected(): boolean {
  return initializeRedis() !== null;
}
