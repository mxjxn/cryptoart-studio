CREATE TABLE "achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"fid" integer NOT NULL,
	"badge_type" text NOT NULL,
	"badge_category" text NOT NULL,
	"platform" text NOT NULL,
	"awarded_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "achievements_unique_badge" UNIQUE("fid","badge_type")
);
--> statement-breakpoint
CREATE TABLE "auction_completions_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"token_contract" text NOT NULL,
	"token_id" text NOT NULL,
	"nft_metadata" jsonb,
	"final_bid" text NOT NULL,
	"bid_count" integer DEFAULT 0 NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"completed_at" timestamp NOT NULL,
	"seller" text NOT NULL,
	"seller_fid" integer,
	"winner" text NOT NULL,
	"winner_fid" integer,
	"referrer" text,
	"curator_fid" integer,
	"curator_earnings" text,
	"featured" boolean DEFAULT false NOT NULL,
	"is_first_win" boolean DEFAULT false NOT NULL,
	"is_record_price" boolean DEFAULT false NOT NULL,
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "auction_completions_cache_listing_id_unique" UNIQUE("listing_id")
);
--> statement-breakpoint
CREATE TABLE "creator_core_extensions" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_address" text NOT NULL,
	"extension_address" text NOT NULL,
	"base_uri" text,
	"registered_at" timestamp,
	"registered_at_block" integer,
	"unregistered_at" timestamp,
	"unregistered_at_block" integer,
	"is_blacklisted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "creator_core_extensions_contract_extension_unique" UNIQUE("contract_address","extension_address")
);
--> statement-breakpoint
CREATE TABLE "curator_performance" (
	"id" serial PRIMARY KEY NOT NULL,
	"curator_fid" integer NOT NULL,
	"gallery_id" integer,
	"views" integer DEFAULT 0 NOT NULL,
	"unique_viewers" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"referral_clicks" integer DEFAULT 0 NOT NULL,
	"referral_sales" integer DEFAULT 0 NOT NULL,
	"conversion_rate" text DEFAULT '0' NOT NULL,
	"total_referral_revenue" text DEFAULT '0' NOT NULL,
	"market_referrals" text DEFAULT '0' NOT NULL,
	"gallery_referrals" text DEFAULT '0' NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "curator_performance_unique_curator_gallery" UNIQUE("curator_fid","gallery_id")
);
--> statement-breakpoint
CREATE TABLE "market_swaps_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"tx_hash" text NOT NULL,
	"pool_address" text NOT NULL,
	"pool_type" text NOT NULL,
	"nft_contract" text NOT NULL,
	"token_ids" jsonb NOT NULL,
	"trader" text NOT NULL,
	"trader_fid" integer,
	"is_buy" boolean NOT NULL,
	"eth_amount" text NOT NULL,
	"nft_amount" integer NOT NULL,
	"spot_price" text NOT NULL,
	"pool_fee" text,
	"protocol_fee" text,
	"timestamp" timestamp NOT NULL,
	"block_number" integer NOT NULL,
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "market_swaps_cache_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
CREATE TABLE "patronships" (
	"id" serial PRIMARY KEY NOT NULL,
	"collector_fid" integer NOT NULL,
	"creator_fid" integer NOT NULL,
	"first_purchase" timestamp NOT NULL,
	"last_purchase" timestamp NOT NULL,
	"total_spent" text DEFAULT '0' NOT NULL,
	"items_owned" integer DEFAULT 0 NOT NULL,
	"market_purchases" integer DEFAULT 0 NOT NULL,
	"gallery_purchases" integer DEFAULT 0 NOT NULL,
	"patron_tier" text NOT NULL,
	"is_top_patron" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "patronships_unique_relationship" UNIQUE("collector_fid","creator_fid")
);
--> statement-breakpoint
CREATE TABLE "reputation_scores" (
	"fid" integer PRIMARY KEY NOT NULL,
	"creator_score" integer DEFAULT 0 NOT NULL,
	"collections_deployed" integer DEFAULT 0 NOT NULL,
	"total_minted" integer DEFAULT 0 NOT NULL,
	"creator_revenue" text DEFAULT '0' NOT NULL,
	"unique_collectors" integer DEFAULT 0 NOT NULL,
	"trader_score" integer DEFAULT 0 NOT NULL,
	"trade_volume" text DEFAULT '0' NOT NULL,
	"pools_created" integer DEFAULT 0 NOT NULL,
	"lp_fees_earned" text DEFAULT '0' NOT NULL,
	"collector_score" integer DEFAULT 0 NOT NULL,
	"total_spent" text DEFAULT '0' NOT NULL,
	"auctions_won" integer DEFAULT 0 NOT NULL,
	"items_collected" integer DEFAULT 0 NOT NULL,
	"curator_score" integer DEFAULT 0 NOT NULL,
	"galleries_curated" integer DEFAULT 0 NOT NULL,
	"referral_revenue" text DEFAULT '0' NOT NULL,
	"referral_conversions" integer DEFAULT 0 NOT NULL,
	"overall_rank" integer,
	"badges" jsonb,
	"last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"fid" integer PRIMARY KEY NOT NULL,
	"username" text,
	"display_name" text,
	"avatar" text,
	"bio" text,
	"verified_addresses" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_fid_user_profiles_fid_fk" FOREIGN KEY ("fid") REFERENCES "public"."user_profiles"("fid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curator_performance" ADD CONSTRAINT "curator_performance_curator_fid_user_profiles_fid_fk" FOREIGN KEY ("curator_fid") REFERENCES "public"."user_profiles"("fid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curator_performance" ADD CONSTRAINT "curator_performance_gallery_id_curated_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."curated_galleries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patronships" ADD CONSTRAINT "patronships_collector_fid_user_profiles_fid_fk" FOREIGN KEY ("collector_fid") REFERENCES "public"."user_profiles"("fid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patronships" ADD CONSTRAINT "patronships_creator_fid_user_profiles_fid_fk" FOREIGN KEY ("creator_fid") REFERENCES "public"."user_profiles"("fid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reputation_scores" ADD CONSTRAINT "reputation_scores_fid_user_profiles_fid_fk" FOREIGN KEY ("fid") REFERENCES "public"."user_profiles"("fid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "achievements_fid_idx" ON "achievements" USING btree ("fid");--> statement-breakpoint
CREATE INDEX "achievements_badge_type_idx" ON "achievements" USING btree ("badge_type");--> statement-breakpoint
CREATE INDEX "achievements_badge_category_idx" ON "achievements" USING btree ("badge_category");--> statement-breakpoint
CREATE INDEX "achievements_platform_idx" ON "achievements" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "auction_completions_cache_listing_id_idx" ON "auction_completions_cache" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "auction_completions_cache_completed_at_idx" ON "auction_completions_cache" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "auction_completions_cache_winner_fid_idx" ON "auction_completions_cache" USING btree ("winner_fid");--> statement-breakpoint
CREATE INDEX "auction_completions_cache_seller_fid_idx" ON "auction_completions_cache" USING btree ("seller_fid");--> statement-breakpoint
CREATE INDEX "auction_completions_cache_curator_fid_idx" ON "auction_completions_cache" USING btree ("curator_fid");--> statement-breakpoint
CREATE INDEX "auction_completions_cache_token_contract_idx" ON "auction_completions_cache" USING btree ("token_contract");--> statement-breakpoint
CREATE INDEX "auction_completions_cache_expires_at_idx" ON "auction_completions_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auction_completions_cache_featured_idx" ON "auction_completions_cache" USING btree ("featured");--> statement-breakpoint
CREATE INDEX "creator_core_extensions_contract_address_idx" ON "creator_core_extensions" USING btree ("contract_address");--> statement-breakpoint
CREATE INDEX "creator_core_extensions_extension_address_idx" ON "creator_core_extensions" USING btree ("extension_address");--> statement-breakpoint
CREATE INDEX "curator_performance_curator_fid_idx" ON "curator_performance" USING btree ("curator_fid");--> statement-breakpoint
CREATE INDEX "curator_performance_gallery_id_idx" ON "curator_performance" USING btree ("gallery_id");--> statement-breakpoint
CREATE INDEX "market_swaps_cache_tx_hash_idx" ON "market_swaps_cache" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "market_swaps_cache_pool_address_idx" ON "market_swaps_cache" USING btree ("pool_address");--> statement-breakpoint
CREATE INDEX "market_swaps_cache_trader_fid_idx" ON "market_swaps_cache" USING btree ("trader_fid");--> statement-breakpoint
CREATE INDEX "market_swaps_cache_nft_contract_idx" ON "market_swaps_cache" USING btree ("nft_contract");--> statement-breakpoint
CREATE INDEX "market_swaps_cache_timestamp_idx" ON "market_swaps_cache" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "market_swaps_cache_expires_at_idx" ON "market_swaps_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "patronships_collector_fid_idx" ON "patronships" USING btree ("collector_fid");--> statement-breakpoint
CREATE INDEX "patronships_creator_fid_idx" ON "patronships" USING btree ("creator_fid");--> statement-breakpoint
CREATE INDEX "patronships_patron_tier_idx" ON "patronships" USING btree ("patron_tier");--> statement-breakpoint
CREATE INDEX "patronships_is_top_patron_idx" ON "patronships" USING btree ("is_top_patron");--> statement-breakpoint
CREATE INDEX "patronships_total_spent_idx" ON "patronships" USING btree ("total_spent");--> statement-breakpoint
CREATE INDEX "reputation_scores_creator_score_idx" ON "reputation_scores" USING btree ("creator_score");--> statement-breakpoint
CREATE INDEX "reputation_scores_trader_score_idx" ON "reputation_scores" USING btree ("trader_score");--> statement-breakpoint
CREATE INDEX "reputation_scores_collector_score_idx" ON "reputation_scores" USING btree ("collector_score");--> statement-breakpoint
CREATE INDEX "reputation_scores_curator_score_idx" ON "reputation_scores" USING btree ("curator_score");--> statement-breakpoint
CREATE INDEX "reputation_scores_overall_rank_idx" ON "reputation_scores" USING btree ("overall_rank");--> statement-breakpoint
CREATE INDEX "user_profiles_username_idx" ON "user_profiles" USING btree ("username");