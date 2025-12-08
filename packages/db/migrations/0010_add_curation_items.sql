-- Curation items table - Listings within each curated gallery
CREATE TABLE "curation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"curation_id" uuid NOT NULL,
	"listing_id" text NOT NULL,
	"display_order" integer NOT NULL DEFAULT 0,
	"notes" text,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "curation_items_curation_id_curation_id_fk" FOREIGN KEY ("curation_id") REFERENCES "curation"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "curation_items_curation_id_idx" ON "curation_items" USING btree ("curation_id");
--> statement-breakpoint
CREATE INDEX "curation_items_listing_id_idx" ON "curation_items" USING btree ("listing_id");
--> statement-breakpoint
CREATE INDEX "curation_items_display_order_idx" ON "curation_items" USING btree ("display_order");
--> statement-breakpoint
CREATE UNIQUE INDEX "curation_items_curation_listing_unique_idx" ON "curation_items" USING btree ("curation_id", "listing_id");

