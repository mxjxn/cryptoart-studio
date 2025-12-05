-- Create error_log_type enum
CREATE TYPE "error_log_type" AS ENUM ('transaction_failed', 'api_error', 'subgraph_error', 'contract_error', 'webhook_error', 'unknown');

--> statement-breakpoint

-- Featured listings table
CREATE TABLE "featured_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" text NOT NULL UNIQUE,
	"display_order" integer NOT NULL DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "featured_listings_display_order_idx" ON "featured_listings" USING btree ("display_order");

--> statement-breakpoint

-- Featured settings table (singleton)
CREATE TABLE "featured_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auto_mode" boolean NOT NULL DEFAULT false,
	"auto_count" integer NOT NULL DEFAULT 5,
	"last_auto_refresh" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Hidden users table
CREATE TABLE "hidden_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_address" text NOT NULL UNIQUE,
	"hidden_at" timestamp DEFAULT now() NOT NULL,
	"hidden_by" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "hidden_users_user_address_idx" ON "hidden_users" USING btree ("user_address");

--> statement-breakpoint

-- Analytics snapshots table
CREATE TABLE "analytics_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_date" timestamp NOT NULL,
	"period_type" text NOT NULL,
	"total_volume_wei" text NOT NULL DEFAULT '0',
	"auction_volume_wei" text NOT NULL DEFAULT '0',
	"fixed_price_volume_wei" text NOT NULL DEFAULT '0',
	"offer_volume_wei" text NOT NULL DEFAULT '0',
	"platform_fees_wei" text NOT NULL DEFAULT '0',
	"referral_fees_wei" text NOT NULL DEFAULT '0',
	"total_sales" integer NOT NULL DEFAULT 0,
	"auction_sales" integer NOT NULL DEFAULT 0,
	"fixed_price_sales" integer NOT NULL DEFAULT 0,
	"offer_sales" integer NOT NULL DEFAULT 0,
	"active_auctions" integer NOT NULL DEFAULT 0,
	"unique_bidders" integer NOT NULL DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "analytics_snapshots_snapshot_date_idx" ON "analytics_snapshots" USING btree ("snapshot_date");
--> statement-breakpoint
CREATE INDEX "analytics_snapshots_period_type_idx" ON "analytics_snapshots" USING btree ("period_type");

--> statement-breakpoint

-- Error logs table
CREATE TABLE "error_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" error_log_type NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"user_address" text,
	"listing_id" text,
	"transaction_hash" text,
	"endpoint" text,
	"metadata" jsonb,
	"resolved" boolean NOT NULL DEFAULT false,
	"resolved_at" timestamp,
	"resolved_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "error_logs_type_idx" ON "error_logs" USING btree ("type");
--> statement-breakpoint
CREATE INDEX "error_logs_resolved_idx" ON "error_logs" USING btree ("resolved");
--> statement-breakpoint
CREATE INDEX "error_logs_created_at_idx" ON "error_logs" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "error_logs_user_address_idx" ON "error_logs" USING btree ("user_address");

--> statement-breakpoint

-- Global notification settings table (singleton)
CREATE TABLE "global_notification_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"new_bid_on_your_auction" boolean NOT NULL DEFAULT true,
	"auction_ending_24h" boolean NOT NULL DEFAULT true,
	"auction_ending_1h" boolean NOT NULL DEFAULT true,
	"offer_received" boolean NOT NULL DEFAULT true,
	"outbid" boolean NOT NULL DEFAULT true,
	"auction_won" boolean NOT NULL DEFAULT true,
	"purchase_confirmation" boolean NOT NULL DEFAULT true,
	"offer_accepted" boolean NOT NULL DEFAULT true,
	"offer_rejected" boolean NOT NULL DEFAULT true,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- User notification preferences table
CREATE TABLE "user_notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_address" text NOT NULL UNIQUE,
	"new_bid_on_your_auction" boolean NOT NULL DEFAULT true,
	"auction_ending_24h" boolean NOT NULL DEFAULT true,
	"auction_ending_1h" boolean NOT NULL DEFAULT true,
	"offer_received" boolean NOT NULL DEFAULT true,
	"outbid" boolean NOT NULL DEFAULT true,
	"auction_won" boolean NOT NULL DEFAULT true,
	"purchase_confirmation" boolean NOT NULL DEFAULT true,
	"offer_accepted" boolean NOT NULL DEFAULT true,
	"offer_rejected" boolean NOT NULL DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "user_notification_preferences_user_address_idx" ON "user_notification_preferences" USING btree ("user_address");

--> statement-breakpoint

-- Seed singleton tables with default values
INSERT INTO "featured_settings" ("auto_mode", "auto_count") VALUES (false, 5);
--> statement-breakpoint
INSERT INTO "global_notification_settings" DEFAULT VALUES;

