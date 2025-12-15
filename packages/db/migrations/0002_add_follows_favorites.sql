CREATE TABLE "follows" (
	"id" serial PRIMARY KEY NOT NULL,
	"follower_address" text NOT NULL,
	"following_address" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "follows_follower_address_idx" ON "follows" USING btree ("follower_address");--> statement-breakpoint
CREATE INDEX "follows_following_address_idx" ON "follows" USING btree ("following_address");--> statement-breakpoint
CREATE INDEX "follows_unique_follow_idx" ON "follows" USING btree ("follower_address", "following_address");--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_unique_follower_following" UNIQUE ("follower_address", "following_address");--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_address" text NOT NULL,
	"listing_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "favorites_user_address_idx" ON "favorites" USING btree ("user_address");--> statement-breakpoint
CREATE INDEX "favorites_listing_id_idx" ON "favorites" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "favorites_unique_favorite_idx" ON "favorites" USING btree ("user_address", "listing_id");--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_unique_user_listing" UNIQUE ("user_address", "listing_id");








