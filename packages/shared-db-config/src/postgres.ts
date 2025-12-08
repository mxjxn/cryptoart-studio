import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Global singleton pattern for Next.js serverless environments
// This ensures we reuse the same connection pool across all function invocations
const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle> | null;
  client: ReturnType<typeof postgres> | null;
  connectionString: string | null;
};

// Initialize global state if it doesn't exist
if (!globalForDb.db) {
  globalForDb.db = null;
  globalForDb.client = null;
  globalForDb.connectionString = null;
}

/**
 * Get shared Postgres database connection
 * Uses connection pooling for efficient resource usage
 */
export function getSharedDatabase() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('POSTGRES_URL environment variable is required');
  }
  
  // Check if we need to recreate the connection
  const needsReconnect = 
    !globalForDb.client || 
    !globalForDb.db || 
    globalForDb.connectionString !== connectionString;
  
  if (needsReconnect) {
    // Close existing connection if it exists
    if (globalForDb.client) {
      try {
        globalForDb.client.end({ timeout: 5 });
      } catch (error) {
        // Ignore errors when closing
      }
    }
    
    // Determine if we're using a pooled connection string
    const isPooledConnection = 
      connectionString.includes(':6543') || 
      connectionString.includes('pgbouncer=true') ||
      connectionString.includes('pooler.supabase.com');
    
    // Create postgres client with optimized connection pooling for serverless
    // CRITICAL: Use max: 2-3 for serverless to prevent connection exhaustion
    globalForDb.client = postgres(connectionString, {
      max: isPooledConnection ? 2 : 3, // Lower for pooled connections
      idle_timeout: 10, // Close idle connections faster
      connect_timeout: 5, // Faster connection timeout
      onnotice: () => {}, // Suppress notices
      transform: {
        undefined: null,
      },
    });
    
    globalForDb.db = drizzle(globalForDb.client);
    globalForDb.connectionString = connectionString;
  }
  
  return globalForDb.db;
}

/**
 * Close database connection (useful for cleanup in tests or shutdown)
 */
export async function closeDatabase() {
  if (globalForDb.client) {
    await globalForDb.client.end();
    globalForDb.client = null;
    globalForDb.db = null;
    globalForDb.connectionString = null;
  }
}

/**
 * Get raw postgres client (for advanced use cases)
 */
export function getPostgresClient() {
  if (!globalForDb.client) {
    getSharedDatabase(); // Initialize if not already initialized
  }
  return globalForDb.client;
}

