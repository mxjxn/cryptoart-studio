-- Homepage V2 lime section: admin-pinned spotlight listing cards (listing id + chain)
CREATE TABLE IF NOT EXISTS "homepage_spotlight_settings" (
  "id" text PRIMARY KEY DEFAULT 'default',
  "cards_visible" boolean NOT NULL DEFAULT false,
  "section_title" text NOT NULL DEFAULT 'First listing',
  "section_subline" text NOT NULL DEFAULT 'Physical artwork',
  "eyebrow" text NOT NULL DEFAULT 'Now live',
  "headline" text NOT NULL DEFAULT 'Ethereum mainnet',
  "description" text NOT NULL DEFAULT 'List and collect on Ethereum from the same app as Base. Create a listing, pick your chain first, then approve on the network where your NFT lives. Browse Ethereum-native auctions at paths like /listing/eth/1.',
  "cta_label" text NOT NULL DEFAULT 'Create listing',
  "cta_href" text NOT NULL DEFAULT '/create',
  "updated_at" timestamp NOT NULL DEFAULT now()
);

INSERT INTO "homepage_spotlight_settings" ("id", "cards_visible")
VALUES ('default', false)
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "homepage_spotlight_listings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "listing_id" text NOT NULL,
  "chain_id" integer NOT NULL,
  "display_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "homepage_spotlight_listings_listing_chain_unique"
  ON "homepage_spotlight_listings" ("listing_id", "chain_id");

CREATE INDEX IF NOT EXISTS "homepage_spotlight_listings_display_order_idx"
  ON "homepage_spotlight_listings" ("display_order");
