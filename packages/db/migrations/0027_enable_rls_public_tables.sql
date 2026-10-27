-- Enable RLS on public tables that the Supabase advisor flagged as exposed to
-- anon/authenticated via the Data API. No policies are added: that denies
-- PostgREST access until we add explicit policies.
--
-- Server-side Drizzle uses the database owner / service role, which bypasses
-- RLS. Do not FORCE ROW LEVEL SECURITY — that would block the table owner.
-- Missing tables are skipped so this is safe on older and newer schemas.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'user_cache',
    'contract_cache',
    'notifications',
    'notification_preferences',
    'notification_worker_state',
    '__drizzle_migrations',
    'image_cache',
    'follows',
    'favorites',
    'featured_listings',
    'featured_settings',
    'hidden_users',
    'analytics_snapshots',
    'error_logs',
    'global_notification_settings',
    'user_notification_preferences',
    'pending_allowlist_signatures',
    'notification_tokens',
    'listing_page_status',
    'token_image_cache',
    'featured_sections',
    'featured_section_items',
    'curation',
    'curation_items',
    'homepage_layout_sections',
    'erc1155_token_supply_cache',
    'ipfs_image_cache',
    'thumbnail_cache',
    'membership_cache',
    'listing_media_preview',
    'listing_seller_theme',
    'listing_theme_override',
    'market_layout_snapshots',
    'collections',
    'collection_tokens',
    'collection_deployments',
    'collection_extensions',
    'collection_royalties',
    'transfer_events',
    'indexed_contracts',
    'homepage_spotlight_settings',
    'homepage_spotlight_listings',
    'siwe_nonces',
    'wallet_sessions',
    'role_grants',
    'audit_events',
    'exhibitions',
    'exhibition_items',
    'exhibition_slots',
    'upload_jobs',
    'payment_receipts'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
  END IF;
END $$;
