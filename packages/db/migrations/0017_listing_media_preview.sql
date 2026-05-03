CREATE TABLE "listing_media_preview" (
	"listing_id" text PRIMARY KEY NOT NULL,
	"token_address" text NOT NULL,
	"token_id" text NOT NULL,
	"image_url" text,
	"thumbnail_small_url" text,
	"title" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "listing_media_preview_updated_at_idx" ON "listing_media_preview" USING btree ("updated_at");
