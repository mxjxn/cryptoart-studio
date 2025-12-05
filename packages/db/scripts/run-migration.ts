#!/usr/bin/env tsx
/**
 * Script to run the migration SQL file directly against the database
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local from packages/db directory first (where user put the env vars)
config({ path: resolve(__dirname, '../.env.local') });
// Fallback to local .env if exists
config({ path: resolve(__dirname, '../.env') });
// Also try .env.local from project root
const projectRoot = resolve(__dirname, '../../..');
config({ path: resolve(projectRoot, '.env.local') });
// Also try .env in project root
config({ path: resolve(projectRoot, '.env') });

const connectionString = process.env.STORAGE_POSTGRES_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('❌ STORAGE_POSTGRES_URL or POSTGRES_URL environment variable is required');
  process.exit(1);
}

// Log which database we're connecting to (without exposing credentials)
const url = new URL(connectionString);
console.log(`🔗 Connecting to database: ${url.hostname}${url.pathname}\n`);

async function runMigration() {
  const sql = postgres(connectionString);
  
  try {
    console.log('📦 Reading migration file...\n');
    const migrationPath = resolve(__dirname, '../migrations/0000_broad_blur.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Split by statement breakpoints and execute each statement
    // Note: Don't filter out statements starting with '--' as they may have SQL after the comment
    const statements = migrationSQL
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`Found ${statements.length} statements to execute\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;
      
      try {
        console.log(`[${i + 1}/${statements.length}] Executing statement...`);
        await sql.unsafe(statement);
        console.log(`  ✅ Statement ${i + 1} executed successfully\n`);
      } catch (error: any) {
        // Check if it's a "already exists" error - that's okay
        if (error?.message?.includes('already exists') || error?.code === '42P07') {
          console.log(`  ⚠️  Statement ${i + 1} skipped (already exists)\n`);
        } else {
          console.error(`  ❌ Error executing statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error running migration:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();

