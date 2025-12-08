-- Migration: Add Token Image Cache Table
-- Purpose: Cache ERC20 token logo images to avoid repeated API calls

-- Token image cache table
CREATE TABLE "token_image_cache" (
	"token_address" text PRIMARY KEY NOT NULL,
	"image_url" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "token_image_cache_expires_at_idx" ON "token_image_cache" USING btree ("expires_at");

