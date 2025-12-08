#!/usr/bin/env tsx
/**
 * Quick script to create the follows and favorites tables directly
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

async function createFollowsAndFavoritesTables() {
  const sql = postgres(connectionString);
  
  try {
    console.log('📦 Creating follows and favorites tables...\n');
    
    // Create follows table
    console.log('  Creating follows table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "follows" (
        "id" serial PRIMARY KEY NOT NULL,
        "follower_address" text NOT NULL,
        "following_address" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `;
    console.log('  ✅ follows table created\n');
    
    // Create follows indexes
    await sql`
      CREATE INDEX IF NOT EXISTS "follows_follower_address_idx" 
      ON "follows" USING btree ("follower_address")
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS "follows_following_address_idx" 
      ON "follows" USING btree ("following_address")
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS "follows_unique_follow_idx" 
      ON "follows" USING btree ("follower_address", "following_address")
    `;
    console.log('  ✅ follows indexes created\n');
    
    // Create favorites table
    console.log('  Creating favorites table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "favorites" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_address" text NOT NULL,
        "listing_id" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `;
    console.log('  ✅ favorites table created\n');
    
    // Create favorites indexes
    await sql`
      CREATE INDEX IF NOT EXISTS "favorites_user_address_idx" 
      ON "favorites" USING btree ("user_address")
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS "favorites_listing_id_idx" 
      ON "favorites" USING btree ("listing_id")
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS "favorites_unique_favorite_idx" 
      ON "favorites" USING btree ("user_address", "listing_id")
    `;
    console.log('  ✅ favorites indexes created\n');
    
    // Add unique constraint to prevent duplicate follows
    console.log('  Adding unique constraints...');
    try {
      await sql`
        ALTER TABLE "follows" 
        ADD CONSTRAINT "follows_unique_follower_following" 
        UNIQUE ("follower_address", "following_address")
      `;
      console.log('  ✅ follows unique constraint added\n');
    } catch (error: any) {
      if (error?.code === '42P16' || error?.message?.includes('already exists')) {
        console.log('  ⚠️  follows unique constraint already exists\n');
      } else {
        throw error;
      }
    }
    
    // Add unique constraint to prevent duplicate favorites
    try {
      await sql`
        ALTER TABLE "favorites" 
        ADD CONSTRAINT "favorites_unique_user_listing" 
        UNIQUE ("user_address", "listing_id")
      `;
      console.log('  ✅ favorites unique constraint added\n');
    } catch (error: any) {
      if (error?.code === '42P16' || error?.message?.includes('already exists')) {
        console.log('  ⚠️  favorites unique constraint already exists\n');
      } else {
        throw error;
      }
    }
    
    console.log('✅ follows and favorites tables ready!');
    process.exit(0);
  } catch (error: any) {
    if (error?.message?.includes('already exists') || error?.code === '42P07') {
      console.log('⚠️  Tables already exist - that\'s okay!');
      process.exit(0);
    } else {
      console.error('❌ Error creating tables:', error);
      process.exit(1);
    }
  } finally {
    await sql.end();
  }
}

createFollowsAndFavoritesTables();




