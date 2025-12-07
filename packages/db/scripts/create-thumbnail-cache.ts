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

// Prefer direct connection for DDL, fallback to pooled
let connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.STORAGE_POSTGRES_URL_NON_POOLING;
let isPooled = false;

// If no direct connection URL, try to construct one from env vars or use pooled
if (!connectionString) {
  connectionString = process.env.STORAGE_POSTGRES_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('❌ STORAGE_POSTGRES_URL or POSTGRES_URL environment variable is required');
    process.exit(1);
  }
  
  // Try to construct direct connection from pooled URL
  const url = new URL(connectionString);
  isPooled = url.port === '6543' || connectionString.includes('pooler') || connectionString.includes('pgbouncer=true');
  
  if (isPooled) {
    // Construct direct connection URL from pooled URL
    // Replace pooler hostname with direct hostname (db.*.supabase.co)
    const directHost = process.env.STORAGE_POSTGRES_HOST || url.hostname.replace('pooler', 'db').replace('aws-1-us-east-1.pooler', 'db');
    
    // Build direct connection URL
    const directUrl = new URL(connectionString);
    directUrl.hostname = directHost;
    directUrl.port = '5432';
    directUrl.searchParams.delete('pgbouncer');
    directUrl.searchParams.delete('supa');
    connectionString = directUrl.toString();
    
    console.log('⚠️  Constructed direct connection from pooled URL\n');
    console.log(`   Direct host: ${directHost}:5432\n`);
  }
} else {
  // Check if the non-pooling URL is actually using pooler hostname (incorrect)
  const url = new URL(connectionString);
  if (url.hostname.includes('pooler') && url.port === '5432') {
    // Fix it - replace pooler hostname with direct hostname
    const directHost = process.env.STORAGE_POSTGRES_HOST || url.hostname.replace('pooler', 'db').replace('aws-1-us-east-1.pooler', 'db');
    url.hostname = directHost;
    connectionString = url.toString();
    console.log('⚠️  Fixed non-pooling URL to use direct hostname\n');
  }
}

const url = new URL(connectionString);
isPooled = url.port === '6543' || connectionString.includes('pooler') || connectionString.includes('pgbouncer=true');

if (isPooled) {
  console.log('⚠️  Using pooled connection - CREATE TABLE should work, but may be slower\n');
} else {
  console.log('✅ Using direct connection for DDL operations\n');
}

console.log(`🔗 Connecting to database: ${url.hostname}${url.pathname}\n`);

async function createThumbnailCacheTable() {
  // Use minimal connection pool for one-off script
  // Increase timeout for direct connections which may be slower
  const sql = postgres(connectionString, {
    max: 1, // Only need 1 connection for this script
    idle_timeout: 20,
    connect_timeout: isPooled ? 10 : 30, // Longer timeout for direct connections
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

