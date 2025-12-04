CREATE TABLE "image_cache" (
	"image_url" text PRIMARY KEY NOT NULL,
	"data_url" text NOT NULL,
	"content_type" text NOT NULL,
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "image_cache_expires_at_idx" ON "image_cache" USING btree ("expires_at");


