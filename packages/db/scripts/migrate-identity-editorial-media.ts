#!/usr/bin/env tsx
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

const sql = postgres(connectionString);
const migrationSQL = readFileSync(resolve(__dirname, '../migrations/0026_identity_editorial_media.sql'), 'utf-8');

try {
  await sql.unsafe(migrationSQL);
  console.log('Applied 0026_identity_editorial_media.sql');
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('already exists') || (error as { code?: string }).code === '42P07') {
    console.log('0026 already applied');
  } else {
    console.error(message);
    process.exit(1);
  }
} finally {
  await sql.end();
}
