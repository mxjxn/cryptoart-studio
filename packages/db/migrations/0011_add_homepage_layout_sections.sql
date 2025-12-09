-- Homepage layout sections - controls homepage ordering and configuration
CREATE TABLE "homepage_layout_sections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "section_type" text NOT NULL,
  "title" text,
  "description" text,
  "config" jsonb,
  "display_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "homepage_layout_sections_display_order_idx" ON "homepage_layout_sections" USING btree ("display_order");
--> statement-breakpoint
CREATE INDEX "homepage_layout_sections_is_active_idx" ON "homepage_layout_sections" USING btree ("is_active");
--> statement-breakpoint
CREATE INDEX "homepage_layout_sections_type_idx" ON "homepage_layout_sections" USING btree ("section_type");

