CREATE TABLE "user_cache" (
	"eth_address" text PRIMARY KEY NOT NULL,
	"fid" integer,
	"username" text,
	"display_name" text,
	"pfp_url" text,
	"verified_wallets" jsonb,
	"ens_name" text,
	"source" text NOT NULL,
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"refreshed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "contract_cache" (
	"contract_address" text PRIMARY KEY NOT NULL,
	"name" text,
	"symbol" text,
	"creator_address" text,
	"source" text NOT NULL,
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"refreshed_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "user_cache_fid_idx" ON "user_cache" USING btree ("fid");--> statement-breakpoint
CREATE INDEX "user_cache_username_idx" ON "user_cache" USING btree ("username");--> statement-breakpoint
CREATE INDEX "user_cache_expires_at_idx" ON "user_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "contract_cache_creator_address_idx" ON "contract_cache" USING btree ("creator_address");--> statement-breakpoint
CREATE INDEX "contract_cache_expires_at_idx" ON "contract_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_address" text NOT NULL,
	"fid" integer,
	"type" text NOT NULL,
	"listing_id" text,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"pushed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_address" text PRIMARY KEY NOT NULL,
	"fid" integer,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"email_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "notifications_user_address_idx" ON "notifications" USING btree ("user_address");--> statement-breakpoint
CREATE INDEX "notifications_fid_idx" ON "notifications" USING btree ("fid");--> statement-breakpoint
CREATE INDEX "notifications_listing_id_idx" ON "notifications" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "notifications_read_idx" ON "notifications" USING btree ("read");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notification_preferences_fid_idx" ON "notification_preferences" USING btree ("fid");--> statement-breakpoint
CREATE TABLE "notification_worker_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"last_processed_block" bigint NOT NULL,
	"last_processed_timestamp" bigint NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);