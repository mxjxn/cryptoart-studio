CREATE TABLE "thumbnail_cache" (
	"image_url" text NOT NULL,
	"size" text NOT NULL,
	"thumbnail_url" text NOT NULL,
	"width" integer,
	"height" integer,
	"file_size" integer,
	"content_type" text NOT NULL,
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "thumbnail_cache_pk" PRIMARY KEY("image_url","size")
);
--> statement-breakpoint
CREATE INDEX "thumbnail_cache_image_url_size_idx" ON "thumbnail_cache" USING btree ("image_url","size");--> statement-breakpoint
CREATE INDEX "thumbnail_cache_expires_at_idx" ON "thumbnail_cache" USING btree ("expires_at");






