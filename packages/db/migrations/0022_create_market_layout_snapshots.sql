-- 0022_create_market_layout_snapshots.sql
-- Add table market_layout_snapshots for cached market layout JSON snapshots
CREATE TABLE IF NOT EXISTS public.market_layout_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surface text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS market_layout_snapshots_surface_created_idx ON public.market_layout_snapshots (surface, created_at DESC);
