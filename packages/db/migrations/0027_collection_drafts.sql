-- Studio collection deploy/mint drafts

CREATE TABLE IF NOT EXISTS collection_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS collection_drafts_owner_address_idx ON collection_drafts (owner_address);
CREATE INDEX IF NOT EXISTS collection_drafts_updated_at_idx ON collection_drafts (updated_at);
