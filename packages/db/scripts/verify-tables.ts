#!/usr/bin/env tsx
/**
 * Verification script to check if all expected database tables exist
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

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('❌ POSTGRES_URL environment variable is required');
  process.exit(1);
}

// MVP-only tables
const expectedTables = [
  'artist_cache',
  'contract_cache',
];

async function verifyTables() {
  const sql = postgres(connectionString);
  
  try {
    console.log('🔍 Checking database tables...\n');
    
    // Query all tables in the public schema
    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    const existingTables = result.map((row: any) => row.table_name);
    
    console.log(`Found ${existingTables.length} tables in database:\n`);
    existingTables.forEach(table => console.log(`  ✓ ${table}`));
    
    console.log(`\n📋 Checking expected tables (${expectedTables.length}):\n`);
    
    const missing: string[] = [];
    const extra: string[] = [];
    
    expectedTables.forEach(table => {
      if (existingTables.includes(table)) {
        console.log(`  ✅ ${table}`);
      } else {
        console.log(`  ❌ ${table} - MISSING`);
        missing.push(table);
      }
    });
    
    existingTables.forEach(table => {
      if (!expectedTables.includes(table)) {
        extra.push(table);
      }
    });
    
    console.log('\n📊 Summary:');
    console.log(`  Expected: ${expectedTables.length}`);
    console.log(`  Found: ${existingTables.length}`);
    console.log(`  Missing: ${missing.length}`);
    console.log(`  Extra: ${extra.length}`);
    
    if (missing.length > 0) {
      console.log('\n❌ Missing tables:');
      missing.forEach(table => console.log(`  - ${table}`));
    }
    
    if (extra.length > 0) {
      console.log('\n⚠️  Extra tables (not in schema):');
      extra.forEach(table => console.log(`  - ${table}`));
    }
    
    if (missing.length === 0) {
      console.log('\n✅ All expected tables exist!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tables are missing. Run `pnpm db:push` to create them.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error checking tables:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

verifyTables();
