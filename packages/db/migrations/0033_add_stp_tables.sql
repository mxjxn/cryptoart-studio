-- STP v2 subscription NFT tracking tables
-- PARKED FEATURE: Not for day-one relaunch. These tables support future subscription NFT features.

-- Track deployed STP contracts (one per artist/creator)
CREATE TABLE IF NOT EXISTS "stp_contracts" (
  "id" serial PRIMARY KEY,
  "chain_id" integer NOT NULL,
  "address" text NOT NULL,
  "creator_address" text NOT NULL,
  "name" text,
  "symbol" text,
  "currency_address" text,
  "deploy_block" bigint NOT NULL,
  "deploy_tx_hash" text NOT NULL,
  "deploy_timestamp" timestamp NOT NULL DEFAULT now(),
  "tier_count" integer DEFAULT 0,
  "sub_count" bigint DEFAULT 0,
  "supply_cap" bigint DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "stp_contracts_chain_address_unique" UNIQUE("chain_id", "address")
);

CREATE INDEX IF NOT EXISTS "stp_contracts_creator_idx" ON "stp_contracts"("creator_address");
CREATE INDEX IF NOT EXISTS "stp_contracts_chain_id_idx" ON "stp_contracts"("chain_id");
CREATE INDEX IF NOT EXISTS "stp_contracts_active_idx" ON "stp_contracts"("is_active") WHERE "is_active" = true;

-- Track individual subscriptions (NFT ownership and expiry)
CREATE TABLE IF NOT EXISTS "stp_subscriptions" (
  "id" serial PRIMARY KEY,
  "chain_id" integer NOT NULL,
  "contract_address" text NOT NULL,
  "token_id" bigint NOT NULL,
  "owner_address" text NOT NULL,
  "tier_id" integer NOT NULL DEFAULT 0,
  "expires_at" timestamp,
  "purchase_expires_at" timestamp,
  "reward_shares" numeric(78, 0) DEFAULT 0,
  "last_purchase_amount" numeric(78, 0),
  "last_purchase_tx_hash" text,
  "last_purchase_timestamp" timestamp,
  "is_active" boolean DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "stp_subscriptions_chain_contract_token_unique" UNIQUE("chain_id", "contract_address", "token_id")
);

CREATE INDEX IF NOT EXISTS "stp_subscriptions_owner_idx" ON "stp_subscriptions"("owner_address");
CREATE INDEX IF NOT EXISTS "stp_subscriptions_contract_idx" ON "stp_subscriptions"("contract_address");
CREATE INDEX IF NOT EXISTS "stp_subscriptions_active_idx" ON "stp_subscriptions"("is_active") WHERE "is_active" = true;
CREATE INDEX IF NOT EXISTS "stp_subscriptions_expiry_idx" ON "stp_subscriptions"("expires_at");
CREATE INDEX IF NOT EXISTS "stp_subscriptions_tier_idx" ON "stp_subscriptions"("tier_id");
CREATE INDEX IF NOT EXISTS "stp_subscriptions_owner_active_idx" ON "stp_subscriptions"("owner_address", "is_active") WHERE "is_active" = true;

-- Track tier configurations
CREATE TABLE IF NOT EXISTS "stp_tiers" (
  "id" serial PRIMARY KEY,
  "chain_id" integer NOT NULL,
  "contract_address" text NOT NULL,
  "tier_id" integer NOT NULL,
  "period_duration_seconds" integer,
  "max_supply" bigint,
  "max_commitment_seconds" integer,
  "start_timestamp" timestamp,
  "end_timestamp" timestamp,
  "paused" boolean DEFAULT false,
  "transferrable" boolean DEFAULT true,
  "reward_curve_id" integer,
  "reward_basis_points" integer,
  "price_per_period" numeric(78, 0),
  "sub_count" bigint DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "stp_tiers_chain_contract_tier_unique" UNIQUE("chain_id", "contract_address", "tier_id")
);

CREATE INDEX IF NOT EXISTS "stp_tiers_contract_idx" ON "stp_tiers"("contract_address");
CREATE INDEX IF NOT EXISTS "stp_tiers_active_idx" ON "stp_tiers"("paused") WHERE "paused" = false;

-- Raw event storage (idempotent, same pattern as chain-indexer)
CREATE TABLE IF NOT EXISTS "stp_events" (
  "id" serial PRIMARY KEY,
  "chain_id" integer NOT NULL,
  "block_number" bigint NOT NULL,
  "tx_hash" text NOT NULL,
  "log_index" integer NOT NULL,
  "contract_address" text NOT NULL,
  "event_name" text NOT NULL,
  "event_data" jsonb NOT NULL,
  "timestamp" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "stp_events_chain_tx_log_unique" UNIQUE("chain_id", "tx_hash", "log_index")
);

CREATE INDEX IF NOT EXISTS "stp_events_contract_idx" ON "stp_events"("contract_address");
CREATE INDEX IF NOT EXISTS "stp_events_block_idx" ON "stp_events"("block_number");
CREATE INDEX IF NOT EXISTS "stp_events_event_name_idx" ON "stp_events"("event_name");
CREATE INDEX IF NOT EXISTS "stp_events_timestamp_idx" ON "stp_events"("timestamp");

-- App-level membership perks (for cryptoart.social)
CREATE TABLE IF NOT EXISTS "app_perks" (
  "id" serial PRIMARY KEY,
  "perk_name" text NOT NULL UNIQUE,
  "description" text,
  "requires_stp_contract" text,
  "requires_stp_chain_id" integer,
  "enabled" boolean DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "app_perks_name_unique" UNIQUE("perk_name")
);

-- Pre-populate default perks
INSERT INTO "app_perks" ("perk_name", "description", "enabled") 
VALUES 
  ('custom_gallery_uri', 'Ability to set custom gallery URIs', true),
  ('profile_customization', 'Advanced profile customization options', true)
ON CONFLICT ("perk_name") DO NOTHING;

COMMENT ON TABLE "stp_contracts" IS 'PARKED FEATURE: Tracks deployed STP v2 subscription NFT contracts';
COMMENT ON TABLE "stp_subscriptions" IS 'PARKED FEATURE: Tracks individual subscription NFT ownership and expiry state';
COMMENT ON TABLE "stp_tiers" IS 'PARKED FEATURE: Tracks tier configurations for each STP contract';
COMMENT ON TABLE "stp_events" IS 'PARKED FEATURE: Raw event log storage for STP contracts (idempotent)';
COMMENT ON TABLE "app_perks" IS 'PARKED FEATURE: App-level membership perks unlocked by STP subscriptions';
