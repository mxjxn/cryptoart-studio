import { MiniAppNotificationDetails } from '@farcaster/miniapp-sdk';
import { Redis as UpstashRedis } from '@upstash/redis';
import { Redis as IORedis } from 'ioredis';
import { APP_NAME } from './constants';

// In-memory fallback storage
const localStore = new Map<string, MiniAppNotificationDetails>();

// Redis client (supports both Upstash and local Redis)
let redis: UpstashRedis | IORedis | null = null;

// Initialize Redis client based on available environment variables
// Priority: 1. Upstash Redis, 2. Local Redis, 3. In-memory fallback
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

function getUserNotificationDetailsKey(fid: number): string {
  return `${APP_NAME}:user:${fid}`;
}

export async function getUserNotificationDetails(
  fid: number
): Promise<MiniAppNotificationDetails | null> {
  const key = getUserNotificationDetailsKey(fid);
  if (redis) {
    if (redis instanceof UpstashRedis) {
      // Upstash Redis
      return await redis.get<MiniAppNotificationDetails>(key);
    } else if (redis instanceof IORedis) {
      // Local Redis (ioredis)
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    }
  }
  return localStore.get(key) || null;
}

export async function setUserNotificationDetails(
  fid: number,
  notificationDetails: MiniAppNotificationDetails
): Promise<void> {
  const key = getUserNotificationDetailsKey(fid);
  if (redis) {
    if (redis instanceof UpstashRedis) {
      // Upstash Redis
      await redis.set(key, notificationDetails);
    } else if (redis instanceof IORedis) {
      // Local Redis (ioredis)
      await redis.set(key, JSON.stringify(notificationDetails));
    }
  } else {
    localStore.set(key, notificationDetails);
  }
}

export async function deleteUserNotificationDetails(
  fid: number
): Promise<void> {
  const key = getUserNotificationDetailsKey(fid);
  if (redis) {
    if (redis instanceof UpstashRedis) {
      // Upstash Redis
      await redis.del(key);
    } else if (redis instanceof IORedis) {
      // Local Redis (ioredis)
      await redis.del(key);
    }
  } else {
    localStore.delete(key);
  }
}
