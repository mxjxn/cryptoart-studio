# Thumbnail Backfill Script

This script generates thumbnails for all existing listings that don't have them yet. This is useful for generating thumbnails for listings created before the background generation system was implemented.

## Usage

```bash
# Basic usage - processes up to 1000 listings, 10 at a time
pnpm backfill-thumbnails

# Process only 100 listings
pnpm backfill-thumbnails --limit 100

# Process in smaller batches (5 at a time)
pnpm backfill-thumbnails --batch-size 5

# Regenerate thumbnails even if they're already cached
pnpm backfill-thumbnails --skip-cached

# Generate only small thumbnails (faster)
pnpm backfill-thumbnails --sizes small

# Generate multiple sizes
pnpm backfill-thumbnails --sizes small,medium,large

# Combine options
pnpm backfill-thumbnails --limit 500 --batch-size 20 --sizes small
```

## Options

- `--limit <number>`: Maximum number of listings to process (default: 1000)
- `--batch-size <number>`: Number of listings to process in parallel (default: 10)
- `--skip-cached`: Regenerate thumbnails even if they're already cached
- `--sizes <comma-separated>`: Thumbnail sizes to generate (default: small,medium)

## How It Works

1. **Fetches all active listings** from the subgraph
2. **Filters out** cancelled, finalized, sold-out, and hidden user listings
3. **Fetches metadata** for each listing to get the image URL
4. **Checks cache** to see if thumbnail already exists (unless `--skip-cached`)
5. **Generates thumbnails** in batches to avoid overwhelming the system
6. **Shows progress** with statistics

## Output

The script will show:
- Progress as it processes batches
- Summary at the end:
  - Total processed
  - Successfully generated
  - Already cached (skipped)
  - Failed (with error messages)

## Notes

- The script processes listings in batches with a 1-second delay between batches
- Failed thumbnails are logged but don't stop the script
- Thumbnails are generated in the background (non-blocking)
- The script respects the same filtering rules as the homepage (hidden users, etc.)

## Environment Variables

Make sure these are set:
- `NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL` - Subgraph endpoint
- `GRAPH_STUDIO_API_KEY` - Optional, for authenticated subgraph requests



