CREATE TABLE "admin_users" (
	"fid" integer PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "airdrop_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_fid" integer NOT NULL,
	"token_address" text NOT NULL,
	"chain" integer NOT NULL,
	"recipient_count" integer NOT NULL,
	"total_amount" text NOT NULL,
	"tx_hash" text,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "airdrop_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_fid" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clanker_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_fid" integer NOT NULL,
	"token_address" text NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"chain" integer NOT NULL,
	"deploy_tx_hash" text,
	"deployed_at" timestamp DEFAULT now(),
	"metadata" jsonb,
	"status" text NOT NULL,
	CONSTRAINT "clanker_tokens_token_address_unique" UNIQUE("token_address")
);
--> statement-breakpoint
CREATE TABLE "collection_mints" (
	"id" serial PRIMARY KEY NOT NULL,
	"collection_id" integer,
	"token_id" text NOT NULL,
	"recipient_address" text NOT NULL,
	"recipient_fid" integer,
	"tx_hash" text,
	"minted_at" timestamp DEFAULT now(),
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "creator_core_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_address" text NOT NULL,
	"contract_type" text NOT NULL,
	"creator_fid" integer,
	"deployer_address" text NOT NULL,
	"deploy_tx_hash" text,
	"implementation_address" text,
	"proxy_admin_address" text,
	"is_upgradeable" boolean DEFAULT false NOT NULL,
	"name" text,
	"symbol" text,
	"chain_id" integer NOT NULL,
	"deployed_at" timestamp,
	"deployed_at_block" integer,
	"metadata" jsonb,
	CONSTRAINT "creator_core_contracts_contract_address_unique" UNIQUE("contract_address")
);
--> statement-breakpoint
CREATE TABLE "creator_core_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_address" text NOT NULL,
	"token_id" text NOT NULL,
	"mint_tx_hash" text,
	"minted_by" text NOT NULL,
	"minted_at" timestamp,
	"minted_at_block" integer,
	"current_owner" text,
	"token_uri" text,
	"metadata" jsonb,
	"extension_address" text,
	"total_supply" text,
	CONSTRAINT "creator_core_tokens_contract_token_unique" UNIQUE("contract_address","token_id")
);
--> statement-breakpoint
CREATE TABLE "creator_core_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_address" text NOT NULL,
	"token_id" text NOT NULL,
	"from" text NOT NULL,
	"to" text NOT NULL,
	"amount" text NOT NULL,
	"tx_hash" text NOT NULL,
	"block_number" integer NOT NULL,
	"timestamp" timestamp,
	"log_index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curated_galleries" (
	"id" serial PRIMARY KEY NOT NULL,
	"curator_fid" integer NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curated_gallery_nfts" (
	"curated_gallery_id" integer NOT NULL,
	"contract_address" text NOT NULL,
	"token_id" text NOT NULL,
	"curator_comment" text,
	"show_description" boolean DEFAULT true NOT NULL,
	"show_attributes" boolean DEFAULT false NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "curated_gallery_nfts_pk" UNIQUE("curated_gallery_id","contract_address","token_id")
);
--> statement-breakpoint
CREATE TABLE "list_recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"list_id" integer,
	"fid" integer,
	"wallet_address" text,
	"added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "nft_collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_fid" integer NOT NULL,
	"contract_address" text NOT NULL,
	"contract_type" text NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"chain" integer NOT NULL,
	"deploy_tx_hash" text,
	"deployed_at" timestamp DEFAULT now(),
	"metadata" jsonb,
	"status" text NOT NULL,
	CONSTRAINT "nft_collections_contract_address_unique" UNIQUE("contract_address")
);
--> statement-breakpoint
CREATE TABLE "nft_metadata_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_address" text NOT NULL,
	"token_id" text NOT NULL,
	"name" text,
	"description" text,
	"image_uri" text,
	"animation_uri" text,
	"attributes" jsonb,
	"token_uri" text,
	"metadata_source" text NOT NULL,
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"refreshed_at" timestamp,
	CONSTRAINT "nft_metadata_cache_unique_contract_token_idx" UNIQUE("contract_address","token_id")
);
--> statement-breakpoint
CREATE TABLE "quote_casts" (
	"id" serial PRIMARY KEY NOT NULL,
	"curator_fid" integer NOT NULL,
	"cast_hash" text NOT NULL,
	"target_type" text NOT NULL,
	"target_gallery_id" integer,
	"target_contract_address" text,
	"target_token_id" text,
	"referral_address" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscribers_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"fid" integer NOT NULL,
	"contract_address" text NOT NULL,
	"subscriber_data" jsonb NOT NULL,
	"subscriber_count" integer NOT NULL,
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"fid" integer NOT NULL,
	"contract_address" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"cached_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "such_gallery_users" (
	"fid" integer PRIMARY KEY NOT NULL,
	"eth_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_mints" ADD CONSTRAINT "collection_mints_collection_id_nft_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."nft_collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curated_galleries" ADD CONSTRAINT "curated_galleries_curator_fid_such_gallery_users_fid_fk" FOREIGN KEY ("curator_fid") REFERENCES "public"."such_gallery_users"("fid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curated_gallery_nfts" ADD CONSTRAINT "curated_gallery_nfts_curated_gallery_id_curated_galleries_id_fk" FOREIGN KEY ("curated_gallery_id") REFERENCES "public"."curated_galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_recipients" ADD CONSTRAINT "list_recipients_list_id_airdrop_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."airdrop_lists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_casts" ADD CONSTRAINT "quote_casts_curator_fid_such_gallery_users_fid_fk" FOREIGN KEY ("curator_fid") REFERENCES "public"."such_gallery_users"("fid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_casts" ADD CONSTRAINT "quote_casts_target_gallery_id_curated_galleries_id_fk" FOREIGN KEY ("target_gallery_id") REFERENCES "public"."curated_galleries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "airdrop_history_creator_fid_idx" ON "airdrop_history" USING btree ("creator_fid");--> statement-breakpoint
CREATE INDEX "airdrop_history_token_address_idx" ON "airdrop_history" USING btree ("token_address");--> statement-breakpoint
CREATE INDEX "airdrop_history_status_idx" ON "airdrop_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "airdrop_lists_creator_fid_idx" ON "airdrop_lists" USING btree ("creator_fid");--> statement-breakpoint
CREATE INDEX "clanker_tokens_creator_fid_idx" ON "clanker_tokens" USING btree ("creator_fid");--> statement-breakpoint
CREATE INDEX "clanker_tokens_token_address_idx" ON "clanker_tokens" USING btree ("token_address");--> statement-breakpoint
CREATE INDEX "clanker_tokens_status_idx" ON "clanker_tokens" USING btree ("status");--> statement-breakpoint
CREATE INDEX "collection_mints_collection_id_idx" ON "collection_mints" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "collection_mints_recipient_address_idx" ON "collection_mints" USING btree ("recipient_address");--> statement-breakpoint
CREATE INDEX "collection_mints_recipient_fid_idx" ON "collection_mints" USING btree ("recipient_fid");--> statement-breakpoint
CREATE INDEX "creator_core_contracts_contract_address_idx" ON "creator_core_contracts" USING btree ("contract_address");--> statement-breakpoint
CREATE INDEX "creator_core_contracts_creator_fid_idx" ON "creator_core_contracts" USING btree ("creator_fid");--> statement-breakpoint
CREATE INDEX "creator_core_contracts_contract_type_idx" ON "creator_core_contracts" USING btree ("contract_type");--> statement-breakpoint
CREATE INDEX "creator_core_contracts_chain_id_idx" ON "creator_core_contracts" USING btree ("chain_id");--> statement-breakpoint
CREATE INDEX "creator_core_tokens_contract_address_idx" ON "creator_core_tokens" USING btree ("contract_address");--> statement-breakpoint
CREATE INDEX "creator_core_tokens_token_id_idx" ON "creator_core_tokens" USING btree ("token_id");--> statement-breakpoint
CREATE INDEX "creator_core_tokens_current_owner_idx" ON "creator_core_tokens" USING btree ("current_owner");--> statement-breakpoint
CREATE INDEX "creator_core_tokens_extension_address_idx" ON "creator_core_tokens" USING btree ("extension_address");--> statement-breakpoint
CREATE INDEX "creator_core_transfers_contract_token_idx" ON "creator_core_transfers" USING btree ("contract_address","token_id");--> statement-breakpoint
CREATE INDEX "creator_core_transfers_tx_hash_idx" ON "creator_core_transfers" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "creator_core_transfers_block_number_idx" ON "creator_core_transfers" USING btree ("block_number");--> statement-breakpoint
CREATE INDEX "creator_core_transfers_from_idx" ON "creator_core_transfers" USING btree ("from");--> statement-breakpoint
CREATE INDEX "creator_core_transfers_to_idx" ON "creator_core_transfers" USING btree ("to");--> statement-breakpoint
CREATE INDEX "curated_galleries_curator_fid_idx" ON "curated_galleries" USING btree ("curator_fid");--> statement-breakpoint
CREATE INDEX "curated_galleries_curator_slug_idx" ON "curated_galleries" USING btree ("curator_fid","slug");--> statement-breakpoint
CREATE INDEX "curated_gallery_nfts_gallery_idx" ON "curated_gallery_nfts" USING btree ("curated_gallery_id");--> statement-breakpoint
CREATE INDEX "curated_gallery_nfts_contract_token_idx" ON "curated_gallery_nfts" USING btree ("contract_address","token_id");--> statement-breakpoint
CREATE INDEX "list_recipients_list_id_idx" ON "list_recipients" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "list_recipients_fid_idx" ON "list_recipients" USING btree ("fid");--> statement-breakpoint
CREATE INDEX "list_recipients_wallet_address_idx" ON "list_recipients" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "nft_collections_creator_fid_idx" ON "nft_collections" USING btree ("creator_fid");--> statement-breakpoint
CREATE INDEX "nft_collections_contract_address_idx" ON "nft_collections" USING btree ("contract_address");--> statement-breakpoint
CREATE INDEX "nft_collections_status_idx" ON "nft_collections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "nft_metadata_cache_contract_token_idx" ON "nft_metadata_cache" USING btree ("contract_address","token_id");--> statement-breakpoint
CREATE INDEX "quote_casts_curator_fid_idx" ON "quote_casts" USING btree ("curator_fid");--> statement-breakpoint
CREATE INDEX "quote_casts_cast_hash_idx" ON "quote_casts" USING btree ("cast_hash");--> statement-breakpoint
CREATE INDEX "quote_casts_target_gallery_idx" ON "quote_casts" USING btree ("target_gallery_id");--> statement-breakpoint
CREATE INDEX "quote_casts_target_nft_idx" ON "quote_casts" USING btree ("target_contract_address","target_token_id");--> statement-breakpoint
CREATE INDEX "subscribers_cache_fid_idx" ON "subscribers_cache" USING btree ("fid");--> statement-breakpoint
CREATE INDEX "subscribers_cache_contract_address_idx" ON "subscribers_cache" USING btree ("contract_address");--> statement-breakpoint
CREATE INDEX "subscribers_cache_fid_contract_idx" ON "subscribers_cache" USING btree ("fid","contract_address");--> statement-breakpoint
CREATE INDEX "subscribers_cache_expires_at_idx" ON "subscribers_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "subscriptions_cache_fid_idx" ON "subscriptions_cache" USING btree ("fid");--> statement-breakpoint
CREATE INDEX "subscriptions_cache_contract_address_idx" ON "subscriptions_cache" USING btree ("contract_address");--> statement-breakpoint
CREATE INDEX "subscriptions_cache_fid_contract_idx" ON "subscriptions_cache" USING btree ("fid","contract_address");--> statement-breakpoint
CREATE INDEX "such_gallery_users_eth_address_idx" ON "such_gallery_users" USING btree ("eth_address");