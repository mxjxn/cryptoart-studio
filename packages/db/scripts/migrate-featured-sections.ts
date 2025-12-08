/**
 * Script to run the featured sections migration (0009_add_featured_sections.sql).
 * This creates the featured_sections, featured_section_items, and curation tables.
 * 
 * Usage: pnpm db:migrate-featured-sections
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

  // Split by statement breakpoints if present
  let statements: string[];
  if (migrationSQL.includes('--> statement-breakpoint')) {
    statements = migrationSQL
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
  } else {
    statements = [migrationSQL.trim()].filter(s => s.length > 0);
  }

  console.log(`  Found ${statements.length} statement(s) to execute`);
  
  let executed = 0;
  let skipped = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement || statement.trim().length === 0) continue;

    try {
      // Skip comment-only statements
      if (statement.trim().startsWith('--')) {
        continue;
      }

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
        console.log(`  ⏭️  Statement ${i + 1}/${statements.length} skipped (already exists)`);
        continue;
      }
      console.error(`\n  ❌ Error in statement ${i + 1}:`, error.message);
      console.error(`  Statement: ${statement.slice(0, 100)}...`);
      throw error;
    }
  }
  
  console.log(`  ✅ Completed: ${executed} executed, ${skipped} skipped (already exist)\n`);
  return true;
}

async function runFeaturedSectionsMigration() {
  const sql = postgres(connectionString);

  try {
    console.log('📦 Running featured sections migration (0009_add_featured_sections.sql)...\n');
    console.log('═'.repeat(60));
    
    await executeMigration(sql, '0009_add_featured_sections.sql');
    
    console.log('═'.repeat(60));
    console.log(`\n✅ Featured sections migration completed!`);
    console.log(`\n📋 Created tables:`);
    console.log(`   - featured_sections`);
    console.log(`   - featured_section_items`);
    console.log(`   - curation (prepared for future features)\n`);
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error);
    if (error?.message) {
      console.error(`   Error: ${error.message}`);
    }
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runFeaturedSectionsMigration();

