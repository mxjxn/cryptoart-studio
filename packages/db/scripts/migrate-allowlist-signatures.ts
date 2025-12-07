#!/usr/bin/env tsx
/**
 * Script to run only the pending allowlist signatures migration (0004_add_pending_allowlist_signatures.sql).
 * Use this if you already have the earlier migrations applied.
 * 
 * Usage: pnpm db:migrate-allowlist
 * 
 * This creates the following table:
 *   - pending_allowlist_signatures - Stores signatures for secure allowlist flow
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

async function runAllowlistMigration() {
  const sql = postgres(connectionString);
  
  try {
    console.log('📦 Running pending allowlist signatures migration (0004_add_pending_allowlist_signatures.sql)...\n');
    console.log('═'.repeat(60));
    
    const migrationPath = resolve(__dirname, '../migrations/0004_add_pending_allowlist_signatures.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Split by statement breakpoints and execute each statement
    const statements = migrationSQL
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`Found ${statements.length} statements to execute\n`);
    
    let executed = 0;
    let skipped = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;
      
      // Extract a description from the statement
      let desc = 'Executing statement';
      if (statement.includes('CREATE TABLE')) {
        const match = statement.match(/CREATE TABLE "?(\w+)"?/);
        if (match) desc = `Creating table: ${match[1]}`;
      } else if (statement.includes('CREATE INDEX')) {
        const match = statement.match(/CREATE INDEX "?(\w+)"?/);
        if (match) desc = `Creating index: ${match[1]}`;
      } else if (statement.includes('CREATE UNIQUE INDEX')) {
        const match = statement.match(/CREATE UNIQUE INDEX "?(\w+)"?/);
        if (match) desc = `Creating unique index: ${match[1]}`;
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
          error?.code === '42710' || // duplicate_object
          error?.code === '23505'    // unique_violation
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
    console.log(`\n✅ Allowlist migration completed!`);
    console.log(`   ${executed} statements executed`);
    console.log(`   ${skipped} statements skipped (already exist)\n`);
    
    // List created table
    console.log('📋 Allowlist table ready:');
    console.log('   - pending_allowlist_signatures\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runAllowlistMigration();


