import { Redis } from '@upstash/redis';
import { Redis as IORedis } from 'ioredis';

// Redis client singleton
let redis: Redis | IORedis | null = null;
let redisType: 'upstash' | 'ioredis' | null = null;

/**
 * Get shared Redis connection
 * Supports both Upstash Redis (via REST API) and standard Redis (via ioredis)
 * 
 * Priority:
 * 1. Upstash Redis (if KV_REST_API_URL and KV_REST_API_TOKEN are set)
 * 2. Standard Redis (if REDIS_URL is set)
 * 3. Throws error if neither is configured
 */
export function getSharedRedis(): Redis | IORedis {
  if (redis) {
    return redis;
  }

  // Try Upstash Redis first
  const upstashUrl = process.env.KV_REST_API_URL;
  const upstashToken = process.env.KV_REST_API_TOKEN;

  if (upstashUrl && upstashToken) {
    redis = new Redis({
      url: upstashUrl,
      token: upstashToken,
    });
    redisType = 'upstash';
    return redis;
  }

  // Fall back to standard Redis
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
    redisType = 'ioredis';
    return redis;
  }

  throw new Error(
    'Redis not configured. Set either KV_REST_API_URL/KV_REST_API_TOKEN (for Upstash) or REDIS_URL (for standard Redis)'
  );
}

/**
 * Get Redis key with project prefix
 * Ensures keys are namespaced per project to avoid conflicts
 * 
 * @param project - Project identifier (e.g., 'cryptoart-studio', 'lssvm2', 'such-gallery')
 * @param key - The key to prefix
 */
export function getPrefixedKey(project: string, key: string): string {
  return `${project}:${key}`;
}

/**
 * Close Redis connection (useful for cleanup)
 */
export async function closeRedis() {
  if (redis) {
    if (redisType === 'ioredis' && redis instanceof IORedis) {
      await redis.quit();
    }
    // Upstash Redis doesn't need explicit closing
    redis = null;
    redisType = null;
  }
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  try {
    getSharedRedis();
    return true;
  } catch {
    return false;
  }
}

