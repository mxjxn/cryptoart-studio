#!/usr/bin/env tsx
/**
 * Quick script to create the thumbnail_cache table directly
 * Faster than waiting for drizzle-kit push or running all migrations
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local from project root first (preferred)
const projectRoot = resolve(__dirname, '../../..');
config({ path: resolve(projectRoot, '.env.local') });
// Also try .env in project root
config({ path: resolve(projectRoot, '.env') });
// Fallback to local .env.local if exists
config({ path: resolve(__dirname, '../.env.local') });
// Fallback to local .env if exists
config({ path: resolve(__dirname, '../.env') });

let connectionString = process.env.STORAGE_POSTGRES_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('❌ STORAGE_POSTGRES_URL or POSTGRES_URL environment variable is required');
  process.exit(1);
}

// For DDL operations (CREATE TABLE), use direct connection instead of pooled
// Convert pooled connection (port 6543) to direct connection (port 5432)
const url = new URL(connectionString);
if (url.port === '6543' || connectionString.includes('pooler') || connectionString.includes('pgbouncer=true')) {
  // Use direct connection for DDL operations
  url.port = '5432';
  url.searchParams.delete('pgbouncer');
  connectionString = url.toString();
  console.log('⚠️  Using direct connection (port 5432) for DDL operations\n');
}

console.log(`🔗 Connecting to database: ${url.hostname}${url.pathname}\n`);

async function createThumbnailCacheTable() {
  // Use minimal connection pool for one-off script
  const sql = postgres(connectionString, {
    max: 1, // Only need 1 connection for this script
    idle_timeout: 20,
    connect_timeout: 10,
  });
  
  // Retry logic for connection pool exhaustion
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      if (retryCount > 0) {
        console.log(`\n🔄 Retry attempt ${retryCount}/${maxRetries - 1}...\n`);
        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // Exponential backoff
      }
      
      console.log('📦 Creating thumbnail_cache table...\n');
      
      // Create table
      await sql`
        CREATE TABLE IF NOT EXISTS "thumbnail_cache" (
          "image_url" text NOT NULL,
          "size" text NOT NULL,
          "thumbnail_url" text NOT NULL,
          "width" integer,
          "height" integer,
          "file_size" integer,
          "content_type" text NOT NULL,
          "cached_at" timestamp DEFAULT now() NOT NULL,
          "expires_at" timestamp NOT NULL,
          CONSTRAINT "thumbnail_cache_pk" PRIMARY KEY("image_url","size")
        )
      `;
      console.log('  ✅ Table created\n');
      
      // Create indexes
      await sql`
        CREATE INDEX IF NOT EXISTS "thumbnail_cache_image_url_size_idx" 
        ON "thumbnail_cache" USING btree ("image_url","size")
      `;
      console.log('  ✅ Index on (image_url, size) created\n');
      
      await sql`
        CREATE INDEX IF NOT EXISTS "thumbnail_cache_expires_at_idx" 
        ON "thumbnail_cache" USING btree ("expires_at")
      `;
      console.log('  ✅ Index on expires_at created\n');
      
      console.log('✅ thumbnail_cache table ready!');
      await sql.end();
      process.exit(0);
    } catch (error: any) {
      if (error?.message?.includes('already exists') || error?.code === '42P07') {
        console.log('⚠️  Table already exists - that\'s okay!');
        await sql.end();
        process.exit(0);
      } else if (error?.code === 'XX000' && error?.message?.includes('timeout') && retryCount < maxRetries - 1) {
        // Connection pool timeout - retry
        retryCount++;
        console.error(`⚠️  Connection pool timeout (attempt ${retryCount}/${maxRetries})`);
        await sql.end();
        continue;
      } else {
        console.error('❌ Error creating table:', error);
        await sql.end();
        process.exit(1);
      }
    }
  }
}

createThumbnailCacheTable();

