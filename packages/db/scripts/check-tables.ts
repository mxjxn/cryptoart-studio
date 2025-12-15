#!/usr/bin/env tsx
/**
 * Script to check what tables currently exist in the database
 * and compare against what the schema expects.
 * 
 * Usage: pnpm db:status
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

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

// All expected tables in order of migration
const EXPECTED_TABLES = {
  '0000_broad_blur': [
    'user_cache',
    'contract_cache', 
    'notifications',
    'notification_preferences',
    'notification_worker_state',
  ],
  '0001_add_image_cache': [
    'image_cache',
  ],
  '0002_add_follows_favorites': [
    'follows',
    'favorites',
  ],
  '0003_add_admin_tables': [
    'featured_listings',
    'featured_settings',
    'hidden_users',
    'analytics_snapshots',
    'error_logs',
    'global_notification_settings',
    'user_notification_preferences',
  ],
};

// Log which database we're connecting to
const url = new URL(connectionString);
console.log(`\n🔗 Connecting to database: ${url.hostname}${url.pathname}\n`);

async function checkTables() {
  const sql = postgres(connectionString);
  
  try {
    console.log('📋 Checking database schema status...\n');
    console.log('═'.repeat(60));
    
    // Get all existing tables
    const existingTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    const existingSet = new Set(existingTables.map(t => t.table_name));
    
    // Check each migration
    let allPresent = true;
    
    for (const [migration, tables] of Object.entries(EXPECTED_TABLES)) {
      console.log(`\n📦 ${migration}`);
      console.log('─'.repeat(60));
      
      let migrationComplete = true;
      for (const table of tables) {
        const exists = existingSet.has(table);
        const icon = exists ? '✅' : '❌';
        console.log(`  ${icon} ${table}`);
        if (!exists) {
          migrationComplete = false;
          allPresent = false;
        }
      }
      
      if (migrationComplete) {
        console.log(`  → Migration complete`);
      } else {
        console.log(`  → ⚠️  Migration needed`);
      }
    }
    
    // Check for extra tables (not in expected list)
    const allExpected = new Set(Object.values(EXPECTED_TABLES).flat());
    const extraTables = [...existingSet].filter(t => !allExpected.has(t));
    
    if (extraTables.length > 0) {
      console.log(`\n📌 Other tables in database:`);
      console.log('─'.repeat(60));
      for (const table of extraTables) {
        console.log(`  • ${table}`);
      }
    }
    
    // Check for custom types (enums)
    console.log(`\n🏷️  Custom Types:`);
    console.log('─'.repeat(60));
    const customTypes = await sql`
      SELECT typname 
      FROM pg_type 
      WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND typtype = 'e'
      ORDER BY typname
    `;
    
    if (customTypes.length === 0) {
      console.log(`  (none)`);
    } else {
      for (const t of customTypes) {
        console.log(`  • ${t.typname}`);
      }
    }
    
    // Summary
    console.log('\n' + '═'.repeat(60));
    if (allPresent) {
      console.log('\n✅ All expected tables exist!\n');
    } else {
      console.log('\n⚠️  Some tables are missing. Run migrations to fix:\n');
      console.log('   pnpm db:migrate-all     # Run all migrations');
      console.log('   pnpm db:migrate-admin   # Run just admin tables (0003)\n');
    }
    
    process.exit(allPresent ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Error checking tables:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkTables();









