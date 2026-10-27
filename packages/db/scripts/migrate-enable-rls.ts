#!/usr/bin/env tsx
/**
 * Enable RLS on public tables (no policies) so anon/authenticated cannot
 * use the Supabase Data API. Server Drizzle connections are unaffected.
 *
 * Usage: pnpm --dir packages/db db:migrate-rls
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env.local') });
config({ path: resolve(__dirname, '../.env') });
config({ path: resolve(__dirname, '../../../.env.local') });
config({ path: resolve(__dirname, '../../../.env') });

const connectionString = process.env.STORAGE_POSTGRES_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('STORAGE_POSTGRES_URL or POSTGRES_URL is required');
  process.exit(1);
}

const url = new URL(connectionString);
console.log(`Connecting to ${url.hostname}${url.pathname}`);

const sql = postgres(connectionString);
const migrationSQL = readFileSync(
  resolve(__dirname, '../migrations/0027_enable_rls_public_tables.sql'),
  'utf-8',
);

try {
  await sql.unsafe(migrationSQL);
  console.log('Applied 0027_enable_rls_public_tables.sql');
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
} finally {
  await sql.end();
}
