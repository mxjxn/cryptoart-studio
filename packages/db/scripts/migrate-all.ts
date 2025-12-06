#!/usr/bin/env tsx
/**
 * Script to run all pending migrations in order.
 * Each migration is idempotent - it will skip if tables/constraints already exist.
 * 
 * Usage: pnpm db:migrate-all
 * 
 * Migration order:
 *   0000_broad_blur.sql       - Initial tables (user_cache, contract_cache, notifications, etc.)
 *   0001_add_image_cache.sql  - Image cache table
 *   0002_add_follows_favorites.sql - Follows and favorites tables
 *   0003_add_admin_tables.sql - Admin system tables (featured, hidden users, analytics, etc.)
 *   0004_add_pending_allowlist_signatures.sql - Pending allowlist signatures table
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const projectRoot = resolve(__dirname, '../../..');
config({ path: resolve(projectRoot, '.env.local') });
config({ path: resolve(projectRoot, '.env') });
config({ path: resolve(__dirname, '../.env.local') });
config({ path: resolve(__dirname, '../.env') });

const connectionString = process.env.STORAGE_POSTGRES_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('❌ STORAGE_POSTGRES_URL or POSTGRES_URL environment variable is required');
  process.exit(1);
}

// Ordered list of migrations
const MIGRATIONS = [
  '0000_broad_blur.sql',
  '0001_add_image_cache.sql',
  '0002_add_follows_favorites.sql',
  '0003_add_admin_tables.sql',
  '0004_add_pending_allowlist_signatures.sql',
];

// Log which database we're connecting to (without exposing credentials)
const url = new URL(connectionString);
console.log(`\n🔗 Connecting to database: ${url.hostname}${url.pathname}\n`);

async function executeMigration(sql: postgres.Sql, migrationFile: string): Promise<boolean> {
  const migrationPath = resolve(__dirname, '../migrations', migrationFile);
  
  if (!existsSync(migrationPath)) {
    console.log(`  ⚠️  Migration file not found: ${migrationFile}`);
    return false;
  }
  
  const migrationSQL = readFileSync(migrationPath, 'utf-8');
  
  // Split by statement breakpoints and execute each statement
  // Note: Don't filter out statements starting with '--' as they may have SQL after the comment
  const statements = migrationSQL
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  console.log(`  Found ${statements.length} statements to execute`);
  
  let executed = 0;
  let skipped = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement) continue;
    
    try {
      await sql.unsafe(statement);
      executed++;
    } catch (error: any) {
      // Check if it's an "already exists" error - that's okay
      if (
        error?.message?.includes('already exists') || 
        error?.code === '42P07' || // duplicate_table
        error?.code === '42P16' || // duplicate_constraint
        error?.code === '42710'    // duplicate_object (for enums, etc.)
      ) {
        skipped++;
      } else {
        console.error(`\n  ❌ Error in statement ${i + 1}:`, error.message);
        console.error(`  Statement: ${statement.slice(0, 100)}...`);
        throw error;
      }
    }
  }
  
  console.log(`  ✅ Completed: ${executed} executed, ${skipped} skipped (already exist)\n`);
  return true;
}

async function runAllMigrations() {
  const sql = postgres(connectionString);
  
  try {
    console.log('📦 Running all database migrations...\n');
    console.log('═'.repeat(60));
    
    for (let i = 0; i < MIGRATIONS.length; i++) {
      const migration = MIGRATIONS[i];
      console.log(`\n[${i + 1}/${MIGRATIONS.length}] ${migration}`);
      console.log('─'.repeat(60));
      
      await executeMigration(sql, migration);
    }
    
    console.log('═'.repeat(60));
    console.log('\n✅ All migrations completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runAllMigrations();

