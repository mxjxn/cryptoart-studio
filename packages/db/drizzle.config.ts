import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local from project root first (preferred)
const projectRoot = resolve(__dirname, '../..');
config({ path: resolve(projectRoot, '.env.local') });
// Also try .env in project root
config({ path: resolve(projectRoot, '.env') });
// Fallback to local .env.local if exists
config({ path: resolve(__dirname, '.env.local') });
// Fallback to local .env if exists
config({ path: resolve(__dirname, '.env') });

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Support both STORAGE_POSTGRES_URL (Supabase) and POSTGRES_URL for backward compatibility
    url: process.env.STORAGE_POSTGRES_URL || process.env.POSTGRES_URL!,
  },
});
