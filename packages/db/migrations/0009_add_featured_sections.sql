-- Featured sections table - Dynamic sections for homepage curation
CREATE TABLE "featured_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"config" jsonb,
	"display_order" integer NOT NULL DEFAULT 0,
	"is_active" boolean NOT NULL DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "featured_sections_display_order_idx" ON "featured_sections" USING btree ("display_order");
--> statement-breakpoint
CREATE INDEX "featured_sections_is_active_idx" ON "featured_sections" USING btree ("is_active");
--> statement-breakpoint
CREATE INDEX "featured_sections_type_idx" ON "featured_sections" USING btree ("type");

--> statement-breakpoint

-- Featured section items table - Items within each section
CREATE TABLE "featured_section_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"item_id" text NOT NULL,
	"display_order" integer NOT NULL DEFAULT 0,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "featured_section_items_section_id_featured_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "featured_sections"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "featured_section_items_section_id_idx" ON "featured_section_items" USING btree ("section_id");
--> statement-breakpoint
CREATE INDEX "featured_section_items_item_type_idx" ON "featured_section_items" USING btree ("item_type");
--> statement-breakpoint
CREATE INDEX "featured_section_items_item_id_idx" ON "featured_section_items" USING btree ("item_id");
--> statement-breakpoint
CREATE INDEX "featured_section_items_display_order_idx" ON "featured_section_items" USING btree ("display_order");

--> statement-breakpoint

-- Curation table - For future curation features
CREATE TABLE "curation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"curator_address" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"slug" text,
	"is_published" boolean NOT NULL DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "curation_curator_address_idx" ON "curation" USING btree ("curator_address");
--> statement-breakpoint
CREATE INDEX "curation_slug_idx" ON "curation" USING btree ("slug");

