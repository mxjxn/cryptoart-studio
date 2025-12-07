#!/usr/bin/env tsx
/**
 * Script to run only the optimize indexes migration (0005_optimize_indexes.sql).
 * Use this if you already have the earlier migrations applied.
 * 
 * Usage: pnpm db:migrate-optimize-indexes
 * 
 * This creates the following indexes:
 *   - notifications_user_read_created_idx - Composite index for notification queries
 *   - user_cache_expired_cleanup_idx - Index for cleanup queries
 *   - contract_cache_expired_cleanup_idx - Index for cleanup queries
 *   - follows_follower_created_idx - Composite index for follower lookups
 *   - follows_following_created_idx - Composite index for following lookups
 *   - favorites_user_created_idx - Composite index for favorites queries
 *   - user_cache_verified_wallets_gin_idx - GIN index for JSONB verified_wallets lookups
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import { readFileSync } from 'fs';

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

// Log which database we're connecting to (without exposing credentials)
const url = new URL(connectionString);
console.log(`\n🔗 Connecting to database: ${url.hostname}${url.pathname}\n`);

async function runOptimizeIndexesMigration() {
  const sql = postgres(connectionString);
  
  try {
    console.log('📦 Running optimize indexes migration (0005_optimize_indexes.sql)...\n');
    console.log('═'.repeat(60));
    
    const migrationPath = resolve(__dirname, '../migrations/0005_optimize_indexes.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Parse SQL statements - split by semicolons and filter out comments
    const lines = migrationSQL.split('\n');
    const statements: string[] = [];
    let currentStatement = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comment-only lines
      if (!trimmed || trimmed.startsWith('--') && !trimmed.includes('CREATE') && !trimmed.includes('ANALYZE')) {
        continue;
      }
      
      currentStatement += line + '\n';
      
      // If line ends with semicolon, it's a complete statement
      if (trimmed.endsWith(';')) {
        const stmt = currentStatement.trim();
        if (stmt && (stmt.includes('CREATE INDEX') || stmt.includes('ANALYZE'))) {
          statements.push(stmt);
        }
        currentStatement = '';
      }
    }
    
    // Add any remaining statement
    if (currentStatement.trim()) {
      const stmt = currentStatement.trim();
      if (stmt && (stmt.includes('CREATE INDEX') || stmt.includes('ANALYZE'))) {
        statements.push(stmt);
      }
    }
    
    console.log(`Found ${statements.length} statements to execute\n`);
    
    let executed = 0;
    let skipped = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;
      
      // Extract a description from the statement
      let desc = 'Executing statement';
      if (statement.includes('CREATE INDEX')) {
        const match = statement.match(/CREATE INDEX.*?"?(\w+)"?/i);
        if (match) desc = `Creating index: ${match[1]}`;
      } else if (statement.includes('ANALYZE')) {
        const match = statement.match(/ANALYZE\s+"?(\w+)"?/i);
        if (match) desc = `Analyzing table: ${match[1]}`;
      }
      
      console.log(`[${i + 1}/${statements.length}] ${desc}...`);
      
      try {
        await sql.unsafe(statement);
        console.log(`  ✅ Success\n`);
        executed++;
      } catch (error: any) {
        // Check if it's an "already exists" error - that's okay
        if (
          error?.message?.includes('already exists') || 
          error?.code === '42P07' || // duplicate_table
          error?.code === '42P16' || // duplicate_constraint
          error?.code === '42710'    // duplicate_object
        ) {
          console.log(`  ⚠️  Skipped (already exists)\n`);
          skipped++;
        } else {
          console.error(`\n  ❌ Error:`, error.message);
          throw error;
        }
      }
    }
    
    console.log('═'.repeat(60));
    console.log(`\n✅ Optimize indexes migration completed!`);
    console.log(`   ${executed} statements executed`);
    console.log(`   ${skipped} statements skipped (already exist)\n`);
    
    // List created indexes
    console.log('📋 Indexes ready:');
    console.log('   - notifications_user_read_created_idx');
    console.log('   - user_cache_expired_cleanup_idx');
    console.log('   - contract_cache_expired_cleanup_idx');
    console.log('   - follows_follower_created_idx');
    console.log('   - follows_following_created_idx');
    console.log('   - favorites_user_created_idx');
    console.log('   - user_cache_verified_wallets_gin_idx\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runOptimizeIndexesMigration();

