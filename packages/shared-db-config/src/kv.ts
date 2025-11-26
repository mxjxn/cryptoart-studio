// Simple in-memory storage (no Redis needed)
const localStore = new Map<string, unknown>();

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
  return (localStore.get(key) as T) || null;
}

/**
 * Set a value in KV storage (Redis or in-memory fallback)
 * @param key - The key to set
 * @param value - The value to store
 */
export async function set<T = unknown>(key: string, value: T): Promise<void> {
  localStore.set(key, value);
}

/**
 * Delete a value from KV storage (Redis or in-memory fallback)
 * @param key - The key to delete
 */
export async function del(key: string): Promise<void> {
  localStore.delete(key);
}

/**
 * Check if storage is available (always true for in-memory storage)
 */
export function isRedisConnected(): boolean {
  return true;
}
