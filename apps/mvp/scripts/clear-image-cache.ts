#!/usr/bin/env tsx
/**
 * Clear Image Cache Script
 * 
 * Clears cached images to force regeneration at new sizes.
 * 
 * By default, clears both:
 * - image_cache: OG images (data URLs for social sharing)
 * - thumbnail_cache: Thumbnails for homepage/listings (Vercel Blob URLs)
 * 
 * Usage:
 *   pnpm clear-image-cache                    # Clear both caches
 *   pnpm clear-image-cache --og-only          # Clear only OG image cache
 *   pnpm clear-image-cache --thumbnails-only  # Clear only thumbnail cache
 *   pnpm clear-image-cache --dry-run          # Preview what would be deleted
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local from the apps/mvp directory
config({ path: resolve(__dirname, '../.env.local') });

// Also try .env in the same directory
config({ path: resolve(__dirname, '../.env') });

// Also try .env.local from project root
const projectRoot = resolve(__dirname, '../../..');
config({ path: resolve(projectRoot, '.env.local') });
config({ path: resolve(projectRoot, '.env') });

async function getThumbnailCache() {
  try {
    const dbModule = await import('@cryptoart/db') as any;
    return dbModule.thumbnailCache || null;
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const ogOnly = args.includes('--og-only');
  const thumbnailsOnly = args.includes('--thumbnails-only');

  // Determine what to clear
  const clearOG = !thumbnailsOnly;
  const clearThumbnails = !ogOnly;

  if (ogOnly && thumbnailsOnly) {
    console.error('❌ Cannot use --og-only and --thumbnails-only together');
    process.exit(1);
  }

  console.log('🔄 Clearing image cache...\n');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  const clearTypes: string[] = [];
  if (clearOG) clearTypes.push('OG images (image_cache)');
  if (clearThumbnails) clearTypes.push('Thumbnails (thumbnail_cache)');
  console.log(`📋 Will clear: ${clearTypes.join(', ')}\n`);

  try {
    const { getDatabase, imageCache } = await import('@cryptoart/db');
    const db = getDatabase();
    
    if (!db) {
      throw new Error('Database connection not available');
    }

    let ogDeleted = 0;
    let thumbnailDeleted = 0;

    // Clear OG image cache
    if (clearOG) {
      if (dryRun) {
        const count = await db
          .select({ imageUrl: imageCache.imageUrl })
          .from(imageCache);
        console.log(`📊 Would delete ${count.length} OG image cache entries`);
        ogDeleted = count.length;
      } else {
        const deleted = await db
          .delete(imageCache)
          .returning({ imageUrl: imageCache.imageUrl });
        ogDeleted = deleted.length;
        console.log(`✅ Deleted ${ogDeleted} OG image cache entries`);
      }
    }

    // Clear thumbnail cache
    if (clearThumbnails) {
      const thumbnailCache = await getThumbnailCache();
      if (!thumbnailCache) {
        console.log('⚠️  thumbnail_cache table not found, skipping thumbnail cache clear');
      } else {
        if (dryRun) {
          const count = await db
            .select({ imageUrl: thumbnailCache.imageUrl })
            .from(thumbnailCache);
          console.log(`📊 Would delete ${count.length} thumbnail cache entries`);
          thumbnailDeleted = count.length;
        } else {
          const deleted = await db
            .delete(thumbnailCache)
            .returning({ imageUrl: thumbnailCache.imageUrl });
          thumbnailDeleted = deleted.length;
          console.log(`✅ Deleted ${thumbnailDeleted} thumbnail cache entries`);
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    if (dryRun) {
      console.log(`📊 Summary: Would delete ${ogDeleted + thumbnailDeleted} total entries`);
      console.log('   - OG images:', ogDeleted);
      console.log('   - Thumbnails:', thumbnailDeleted);
      console.log('\n✅ Dry run complete. Run without --dry-run to actually delete.');
    } else {
      console.log(`🎉 Cache cleared! Deleted ${ogDeleted + thumbnailDeleted} total entries`);
      console.log('   - OG images:', ogDeleted);
      console.log('   - Thumbnails:', thumbnailDeleted);
      console.log('\n✨ Images will be regenerated at new sizes on next request.');
    }
    
  } catch (error) {
    console.error('❌ Error clearing image cache:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
