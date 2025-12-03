#!/usr/bin/env tsx
/**
 * Script to mark a migration as applied without running it
 * Useful when tables already exist but migration wasn't recorded in __drizzle_migrations
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
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

/**
 * Calculate migration hash the same way Drizzle does
 * Drizzle uses SHA256 hash of the migration SQL content
 */
function calculateMigrationHash(migrationSQL: string): string {
  return createHash('sha256').update(migrationSQL).digest('hex');
}

async function markMigrationApplied() {
  const sql = postgres(connectionString);
  
  try {
    console.log('🔍 Checking migration status...\n');
    
    // 1. Load migration file
    const migrationPath = resolve(__dirname, '../migrations/0000_broad_blur.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    const migrationHash = calculateMigrationHash(migrationSQL);
    
    console.log(`📦 Migration: 0000_broad_blur`);
    console.log(`   Hash: ${migrationHash}\n`);
    
    // 2. Ensure drizzle schema exists
    await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
    
    // 3. Check if __drizzle_migrations table exists, create if not
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at bigint
        )
      `;
      console.log('✅ __drizzle_migrations table ready\n');
    } catch (error: any) {
      console.error('❌ Error creating migrations table:', error.message);
      throw error;
    }
    
    // 4. Check if migration is already recorded
    const existing = await sql`
      SELECT id, hash, created_at 
      FROM drizzle.__drizzle_migrations 
      WHERE hash = ${migrationHash}
    `;
    
    if (existing.length > 0) {
      console.log('✅ Migration is already marked as applied!');
      console.log(`   Record ID: ${existing[0].id}`);
      console.log(`   Applied at: ${existing[0].created_at ? new Date(Number(existing[0].created_at)).toISOString() : 'unknown'}\n`);
      process.exit(0);
    }
    
    // 4. Check if tables from this migration already exist
    const expectedTables = ['user_cache', 'contract_cache', 'notifications', 'notification_preferences', 'notification_worker_state'];
    const existingTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ANY(${expectedTables})
    `;
    
    const foundTables = existingTables.map((row: any) => row.table_name);
    const missingTables = expectedTables.filter(t => !foundTables.includes(t));
    
    console.log(`📊 Table check:`);
    console.log(`   Expected: ${expectedTables.length} tables`);
    console.log(`   Found: ${foundTables.length} tables`);
    if (foundTables.length > 0) {
      foundTables.forEach(t => console.log(`     ✓ ${t}`));
    }
    if (missingTables.length > 0) {
      missingTables.forEach(t => console.log(`     ✗ ${t} (missing)`));
    }
    console.log();
    
    // 5. If tables exist, mark migration as applied
    if (foundTables.length === expectedTables.length) {
      console.log('✅ All tables exist. Marking migration as applied...\n');
      
      const now = Date.now();
      await sql`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${migrationHash}, ${now})
      `;
      
      console.log('✅ Migration marked as applied!');
      console.log(`   Hash: ${migrationHash}`);
      console.log(`   Timestamp: ${new Date(now).toISOString()}\n`);
      console.log('💡 You can now run `pnpm db:migrate` safely - it will skip this migration.');
      process.exit(0);
    } else if (foundTables.length > 0) {
      console.log('⚠️  Some tables exist but not all.');
      console.log('   This might indicate a partial migration.');
      console.log('   Missing tables:', missingTables.join(', '));
      console.log('\n💡 Options:');
      console.log('   1. Run `pnpm db:push` to create missing tables');
      console.log('   2. Manually create missing tables');
      console.log('   3. If you want to mark anyway, edit this script to allow partial migrations');
      process.exit(1);
    } else {
      console.log('⚠️  No tables from this migration exist.');
      console.log('   This migration should be run normally.');
      console.log('\n💡 Run: pnpm db:migrate');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

markMigrationApplied();

