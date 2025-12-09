-- Migration: Add Listing Page Status Table
-- Purpose: Track when listing pages are ready to view, show "building" state while page is being generated

-- Listing page status table
CREATE TABLE "listing_page_status" (
	"listing_id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL DEFAULT 'building',
	"seller_address" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ready_at" timestamp,
	"error_message" text,
	"last_checked_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "listing_page_status_status_idx" ON "listing_page_status" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "listing_page_status_seller_address_idx" ON "listing_page_status" USING btree ("seller_address");
--> statement-breakpoint
CREATE INDEX "listing_page_status_created_at_idx" ON "listing_page_status" USING btree ("created_at");



