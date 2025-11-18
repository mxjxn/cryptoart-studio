import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Database client singleton for shared Postgres connection
let db: ReturnType<typeof drizzle> | null = null;
let client: ReturnType<typeof postgres> | null = null;

/**
 * Get shared Postgres database connection
 * Uses connection pooling for efficient resource usage
 */
export function getSharedDatabase() {
  if (!db) {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error('POSTGRES_URL environment variable is required');
    }
    
    // Create postgres client with connection pooling
    client = postgres(connectionString, {
      max: 10, // Maximum number of connections in the pool
      idle_timeout: 20, // Close idle connections after 20 seconds
      connect_timeout: 10, // Connection timeout in seconds
    });
    
    db = drizzle(client);
  }
  return db;
}

/**
 * Close database connection (useful for cleanup in tests or shutdown)
 */
export async function closeDatabase() {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}

/**
 * Get raw postgres client (for advanced use cases)
 */
export function getPostgresClient() {
  if (!client) {
    getSharedDatabase(); // Initialize if not already initialized
  }
  return client;
}

