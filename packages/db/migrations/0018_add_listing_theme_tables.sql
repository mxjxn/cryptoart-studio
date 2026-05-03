CREATE TABLE "listing_seller_theme" (
	"seller_address" text PRIMARY KEY NOT NULL,
	"theme" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "listing_seller_theme_updated_at_idx" ON "listing_seller_theme" USING btree ("updated_at");
--> statement-breakpoint
CREATE TABLE "listing_theme_override" (
	"listing_id" text PRIMARY KEY NOT NULL,
	"seller_address" text NOT NULL,
	"theme" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "listing_theme_override_seller_address_idx" ON "listing_theme_override" USING btree ("seller_address");
