#!/usr/bin/env tsx
/**
 * Quick script to create the membership_cache table directly
 * Faster than waiting for drizzle-kit push
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

const connectionString = process.env.STORAGE_POSTGRES_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('❌ STORAGE_POSTGRES_URL or POSTGRES_URL environment variable is required');
  process.exit(1);
}

const url = new URL(connectionString);
console.log(`🔗 Connecting to database: ${url.hostname}${url.pathname}\n`);

async function createMembershipCacheTable() {
  const sql = postgres(connectionString);
  
  try {
    console.log('📦 Creating membership_cache table...\n');
    
    // Create table
    await sql`
      CREATE TABLE IF NOT EXISTS "membership_cache" (
        "address" text PRIMARY KEY NOT NULL,
        "has_membership" boolean NOT NULL,
        "cached_at" timestamp DEFAULT now() NOT NULL,
        "expires_at" timestamp NOT NULL
      )
    `;
    console.log('  ✅ Table created\n');
    
    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS "membership_cache_expires_at_idx" 
      ON "membership_cache" USING btree ("expires_at")
    `;
    console.log('  ✅ expires_at index created\n');
    
    await sql`
      CREATE INDEX IF NOT EXISTS "membership_cache_has_membership_idx" 
      ON "membership_cache" USING btree ("has_membership")
    `;
    console.log('  ✅ has_membership index created\n');
    
    console.log('✅ membership_cache table ready!');
    process.exit(0);
  } catch (error: any) {
    if (error?.message?.includes('already exists') || error?.code === '42P07') {
      console.log('⚠️  Table already exists - that\'s okay!');
      process.exit(0);
    } else {
      console.error('❌ Error creating table:', error);
      process.exit(1);
    }
  } finally {
    await sql.end();
  }
}

createMembershipCacheTable();
