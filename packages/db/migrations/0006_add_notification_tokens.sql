-- Migration: Add Notification Tokens Table
-- Purpose: Store Farcaster Mini App notification tokens for self-hosted webhook handling
-- This table is used when not using Neynar's managed notification service

-- ============================================
-- NOTIFICATION TOKENS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS "notification_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "fid" integer NOT NULL,
  "url" text NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS "notification_tokens_fid_idx" ON "notification_tokens" USING btree ("fid");
CREATE INDEX IF NOT EXISTS "notification_tokens_token_idx" ON "notification_tokens" USING btree ("token");
CREATE INDEX IF NOT EXISTS "notification_tokens_fid_token_idx" ON "notification_tokens" USING btree ("fid", "token");

-- Comments for documentation
COMMENT ON TABLE "notification_tokens" IS 'Stores Farcaster Mini App notification tokens for self-hosted webhook handling. Each FID can have multiple tokens (one per client app).';
COMMENT ON COLUMN "notification_tokens"."fid" IS 'Farcaster ID of the user';
COMMENT ON COLUMN "notification_tokens"."url" IS 'Notification URL from webhook (e.g., https://api.farcaster.xyz/v1/frame-notifications)';
COMMENT ON COLUMN "notification_tokens"."token" IS 'Notification token from webhook, unique per (client, app, user) combination';

