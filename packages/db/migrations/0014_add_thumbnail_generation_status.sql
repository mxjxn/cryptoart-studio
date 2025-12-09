-- Add status tracking to thumbnail cache
-- This allows us to track when thumbnails are being generated vs ready
ALTER TABLE "thumbnail_cache" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'ready' NOT NULL;
ALTER TABLE "thumbnail_cache" ADD COLUMN IF NOT EXISTS "generated_at" timestamp;
ALTER TABLE "thumbnail_cache" ADD COLUMN IF NOT EXISTS "error_message" text;

-- Create index for status lookups
CREATE INDEX IF NOT EXISTS "thumbnail_cache_status_idx" ON "thumbnail_cache" USING btree ("status");

-- Update existing rows to have 'ready' status
UPDATE "thumbnail_cache" SET "status" = 'ready', "generated_at" = "cached_at" WHERE "status" IS NULL;

