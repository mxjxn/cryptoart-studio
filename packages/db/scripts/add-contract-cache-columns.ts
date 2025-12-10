#!/usr/bin/env tsx
/**
 * Script to add token_type and last_checked_block columns to contract_cache table
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

async function addContractCacheColumns() {
  const sql = postgres(connectionString);
  
  try {
    console.log('📦 Adding columns to contract_cache table...\n');
    
    // Add token_type column
    console.log('  Adding token_type column...');
    try {
      await sql`
        ALTER TABLE "contract_cache" 
        ADD COLUMN IF NOT EXISTS "token_type" text
      `;
      console.log('  ✅ token_type column added\n');
    } catch (error: any) {
      if (error?.code === '42701' || error?.message?.includes('already exists')) {
        console.log('  ⚠️  token_type column already exists\n');
      } else {
        throw error;
      }
    }
    
    // Add last_checked_block column
    console.log('  Adding last_checked_block column...');
    try {
      await sql`
        ALTER TABLE "contract_cache" 
        ADD COLUMN IF NOT EXISTS "last_checked_block" bigint
      `;
      console.log('  ✅ last_checked_block column added\n');
    } catch (error: any) {
      if (error?.code === '42701' || error?.message?.includes('already exists')) {
        console.log('  ⚠️  last_checked_block column already exists\n');
      } else {
        throw error;
      }
    }
    
    // Create index on last_checked_block
    console.log('  Creating index on last_checked_block...');
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS "contract_cache_last_checked_block_idx" 
        ON "contract_cache" USING btree ("last_checked_block")
      `;
      console.log('  ✅ last_checked_block index created\n');
    } catch (error: any) {
      if (error?.code === '42P07' || error?.message?.includes('already exists')) {
        console.log('  ⚠️  last_checked_block index already exists\n');
      } else {
        throw error;
      }
    }
    
    console.log('✅ contract_cache table updated successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error adding columns:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

addContractCacheColumns();






