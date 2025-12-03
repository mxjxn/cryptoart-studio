#!/usr/bin/env tsx
/**
 * Script to inspect what's in the __drizzle_migrations table
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

async function inspectMigrations() {
  const sql = postgres(connectionString);
  
  try {
    console.log('🔍 Inspecting __drizzle_migrations table...\n');
    
    // Check table structure
    const tableInfo = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
      ORDER BY ordinal_position
    `;
    
    console.log('📋 Table structure:');
    tableInfo.forEach((col: any) => {
      console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    console.log();
    
    // Get all migrations
    const migrations = await sql`
      SELECT * FROM drizzle.__drizzle_migrations ORDER BY id
    `;
    
    console.log(`📊 Found ${migrations.length} migration(s):\n`);
    migrations.forEach((m: any, idx: number) => {
      console.log(`${idx + 1}. ID: ${m.id}`);
      console.log(`   Hash: ${m.hash}`);
      console.log(`   Created: ${m.created_at ? new Date(Number(m.created_at)).toISOString() : 'N/A'}`);
      console.log(`   Raw created_at: ${m.created_at}`);
      console.log();
    });
    
  } catch (error: any) {
    if (error?.code === '42P01') {
      console.log('❌ Table drizzle.__drizzle_migrations does not exist');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  } finally {
    await sql.end();
  }
}

inspectMigrations();

