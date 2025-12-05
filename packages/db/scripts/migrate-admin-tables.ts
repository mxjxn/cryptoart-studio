#!/usr/bin/env tsx
/**
 * Script to run only the admin tables migration (0003_add_admin_tables.sql).
 * Use this if you already have the earlier migrations applied.
 * 
 * Usage: pnpm db:migrate-admin
 * 
 * This creates the following tables:
 *   - featured_listings     - Manual/auto featured listings
 *   - featured_settings     - Featured system settings (singleton)
 *   - hidden_users          - Users hidden from algorithmic feeds
 *   - analytics_snapshots   - Periodic analytics data
 *   - error_logs            - Application error tracking
 *   - global_notification_settings - Platform-wide notification controls
 *   - user_notification_preferences - Per-user notification settings
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

async function runAdminMigration() {
  const sql = postgres(connectionString);
  
  try {
    console.log('📦 Running admin tables migration (0003_add_admin_tables.sql)...\n');
    console.log('═'.repeat(60));
    
    const migrationPath = resolve(__dirname, '../migrations/0003_add_admin_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Split by statement breakpoints and execute each statement
    // Note: Don't filter out statements starting with '--' as they may have SQL after the comment
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
      } else if (statement.includes('CREATE TYPE')) {
        const match = statement.match(/CREATE TYPE "?(\w+)"?/);
        if (match) desc = `Creating type: ${match[1]}`;
      } else if (statement.includes('INSERT INTO')) {
        const match = statement.match(/INSERT INTO "?(\w+)"?/);
        if (match) desc = `Seeding data: ${match[1]}`;
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
          error?.code === '42710' || // duplicate_object (for enums)
          error?.code === '23505'    // unique_violation (for seed data)
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
    console.log(`\n✅ Admin migration completed!`);
    console.log(`   ${executed} statements executed`);
    console.log(`   ${skipped} statements skipped (already exist)\n`);
    
    // List created tables
    console.log('📋 Admin tables ready:');
    console.log('   - featured_listings');
    console.log('   - featured_settings (with default seed)');
    console.log('   - hidden_users');
    console.log('   - analytics_snapshots');
    console.log('   - error_logs');
    console.log('   - global_notification_settings (with default seed)');
    console.log('   - user_notification_preferences\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runAdminMigration();

