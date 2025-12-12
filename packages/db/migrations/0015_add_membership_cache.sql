CREATE TABLE "membership_cache" (
	"address" text PRIMARY KEY NOT NULL,
	"has_membership" boolean NOT NULL,
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "membership_cache_expires_at_idx" ON "membership_cache" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "membership_cache_has_membership_idx" ON "membership_cache" USING btree ("has_membership");
