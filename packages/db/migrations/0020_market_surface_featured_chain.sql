-- Market layout surface (home vs market) + featured listings chain_id for cross-chain uniqueness
ALTER TABLE "homepage_layout_sections" ADD COLUMN IF NOT EXISTS "surface" text NOT NULL DEFAULT 'home';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "homepage_layout_sections_surface_display_order_idx" ON "homepage_layout_sections" USING btree ("surface", "display_order");
--> statement-breakpoint
ALTER TABLE "featured_listings" ADD COLUMN IF NOT EXISTS "chain_id" integer NOT NULL DEFAULT 8453;
--> statement-breakpoint
ALTER TABLE "featured_listings" DROP CONSTRAINT IF EXISTS "featured_listings_listing_id_key";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "featured_listings_listing_id_chain_id_unique" ON "featured_listings" ("listing_id", "chain_id");
