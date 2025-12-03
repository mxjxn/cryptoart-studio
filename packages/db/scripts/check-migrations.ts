#!/usr/bin/env tsx
/**
 * Script to check if production database is up to date with all migration changes
 * Compares local migration files with applied migrations in the database
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

// Type assertion after null check
const dbUrl: string = connectionString;

interface LocalMigration {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface AppliedMigration {
  id: number;
  hash: string;
  created_at: Date;
}

async function checkMigrations() {
  const sql = postgres(dbUrl);
  
  try {
    console.log('🔍 Checking migration status...\n');
    
    // 1. Load local migration journal
    const journalPath = resolve(__dirname, '../migrations/meta/_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf-8'));
    const localMigrations: LocalMigration[] = journal.entries || [];
    
    console.log(`📦 Local migrations found: ${localMigrations.length}\n`);
    localMigrations.forEach((migration, idx) => {
      console.log(`  ${idx + 1}. ${migration.tag} (created: ${new Date(migration.when).toISOString()})`);
    });
    
    // 2. Query applied migrations from database
    console.log('\n🔍 Checking database for applied migrations...\n');
    
    let appliedMigrations: AppliedMigration[] = [];
    try {
      // Drizzle stores migrations in the drizzle schema
      appliedMigrations = await sql`
        SELECT id, hash, created_at 
        FROM drizzle.__drizzle_migrations 
        ORDER BY created_at ASC
      `;
    } catch (error: any) {
      if (error?.code === '42P01') {
        // Table doesn't exist - no migrations have been applied
        console.log('⚠️  drizzle.__drizzle_migrations table does not exist.');
        console.log('   This means no migrations have been applied yet.\n');
      } else {
        throw error;
      }
    }
    
    console.log(`📊 Applied migrations in database: ${appliedMigrations.length}\n`);
    if (appliedMigrations.length > 0) {
      appliedMigrations.forEach((migration, idx) => {
        const createdAt = migration.created_at 
          ? (typeof migration.created_at === 'number' 
              ? new Date(migration.created_at).toISOString() 
              : migration.created_at instanceof Date 
                ? migration.created_at.toISOString()
                : String(migration.created_at))
          : 'unknown';
        console.log(`  ${idx + 1}. ${migration.hash} (applied: ${createdAt})`);
      });
    }
    
    // 3. Compare local vs applied
    console.log('\n📋 Comparison:\n');
    
    const localTags = new Set(localMigrations.map(m => m.tag));
    const appliedHashes = new Set(appliedMigrations.map(m => m.hash));
    
    // Calculate hash for each local migration and compare
    const missing: string[] = [];
    const extra: string[] = [];
    
    localMigrations.forEach(migration => {
      // Read the migration SQL file and calculate its hash
      const migrationPath = resolve(__dirname, `../migrations/${migration.tag}.sql`);
      try {
        const migrationSQL = readFileSync(migrationPath, 'utf-8');
        const migrationHash = createHash('sha256').update(migrationSQL).digest('hex');
        
        // Check if this hash exists in applied migrations
        const found = appliedMigrations.some(applied => applied.hash === migrationHash);
        if (!found) {
          missing.push(migration.tag);
        }
      } catch (error) {
        console.warn(`⚠️  Could not read migration file: ${migration.tag}.sql`);
        missing.push(migration.tag);
      }
    });
    
    // Check for extra migrations (applied but not in local)
    // This is less common but could indicate manual changes
    
    // 4. Summary
    console.log('📊 Summary:\n');
    console.log(`  Local migrations: ${localMigrations.length}`);
    console.log(`  Applied migrations: ${appliedMigrations.length}`);
    console.log(`  Missing in production: ${missing.length}`);
    
    if (missing.length > 0) {
      console.log('\n❌ Missing migrations in production:');
      missing.forEach(tag => console.log(`  - ${tag}`));
      console.log('\n💡 To fix this:');
      console.log('   If tables already exist: pnpm db:mark-applied');
      console.log('   If tables are missing: pnpm db:migrate');
      console.log('   Or use: pnpm db:push (slower, but syncs schema directly)');
      process.exit(1);
    } else if (appliedMigrations.length === 0 && localMigrations.length > 0) {
      console.log('\n⚠️  No migrations have been applied to the database.');
      console.log('\n💡 Options:');
      console.log('   If tables already exist: pnpm db:mark-applied');
      console.log('   If tables are missing: pnpm db:migrate or pnpm db:push');
      process.exit(1);
    } else if (appliedMigrations.length < localMigrations.length) {
      console.log('\n⚠️  Some migrations may be missing.');
      console.log('   Run: pnpm db:migrate to apply pending migrations');
      process.exit(1);
    } else {
      console.log('\n✅ Production database is up to date with all migrations!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error checking migrations:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkMigrations();
