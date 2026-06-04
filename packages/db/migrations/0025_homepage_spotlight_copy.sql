-- Copy fields for homepage lime spotlight hero (admin-editable)
ALTER TABLE "homepage_spotlight_settings" ADD COLUMN IF NOT EXISTS "section_title" text NOT NULL DEFAULT 'First listing';
ALTER TABLE "homepage_spotlight_settings" ADD COLUMN IF NOT EXISTS "section_subline" text NOT NULL DEFAULT 'Physical artwork';
ALTER TABLE "homepage_spotlight_settings" ADD COLUMN IF NOT EXISTS "eyebrow" text NOT NULL DEFAULT 'Now live';
ALTER TABLE "homepage_spotlight_settings" ADD COLUMN IF NOT EXISTS "headline" text NOT NULL DEFAULT 'Ethereum mainnet';
ALTER TABLE "homepage_spotlight_settings" ADD COLUMN IF NOT EXISTS "description" text NOT NULL DEFAULT 'List and collect on Ethereum from the same app as Base. Create a listing, pick your chain first, then approve on the network where your NFT lives. Browse Ethereum-native auctions at paths like /listing/eth/1.';
ALTER TABLE "homepage_spotlight_settings" ADD COLUMN IF NOT EXISTS "cta_label" text NOT NULL DEFAULT 'Create listing';
ALTER TABLE "homepage_spotlight_settings" ADD COLUMN IF NOT EXISTS "cta_href" text NOT NULL DEFAULT '/create';
