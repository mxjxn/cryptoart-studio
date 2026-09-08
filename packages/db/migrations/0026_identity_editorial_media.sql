-- SIWE, roles, audit, exhibitions, and paid upload jobs

CREATE TABLE IF NOT EXISTS siwe_nonces (
  nonce TEXT PRIMARY KEY NOT NULL,
  address TEXT NOT NULL,
  domain TEXT NOT NULL,
  uri TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS siwe_nonces_address_idx ON siwe_nonces (address);
CREATE INDEX IF NOT EXISTS siwe_nonces_expires_at_idx ON siwe_nonces (expires_at);

CREATE TABLE IF NOT EXISTS wallet_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL,
  address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  fid INTEGER,
  domain TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_sessions_token_hash_idx ON wallet_sessions (token_hash);
CREATE INDEX IF NOT EXISTS wallet_sessions_address_idx ON wallet_sessions (address);
CREATE INDEX IF NOT EXISTS wallet_sessions_expires_at_idx ON wallet_sessions (expires_at);

CREATE TABLE IF NOT EXISTS role_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  role TEXT NOT NULL,
  capability TEXT NOT NULL,
  scope JSONB,
  granted_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP,
  revoked_by TEXT
);
CREATE INDEX IF NOT EXISTS role_grants_wallet_address_idx ON role_grants (wallet_address);
CREATE INDEX IF NOT EXISTS role_grants_role_idx ON role_grants (role);
CREATE INDEX IF NOT EXISTS role_grants_capability_idx ON role_grants (capability);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMP NOT NULL DEFAULT NOW(),
  actor_address TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload JSONB
);
CREATE INDEX IF NOT EXISTS audit_events_occurred_at_idx ON audit_events (occurred_at);
CREATE INDEX IF NOT EXISTS audit_events_actor_address_idx ON audit_events (actor_address);
CREATE INDEX IF NOT EXISTS audit_events_entity_idx ON audit_events (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS exhibitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  curator_address TEXT NOT NULL,
  curator_label TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  published_at TIMESTAMP,
  unpublished_at TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS exhibitions_slug_idx ON exhibitions (slug);
CREATE INDEX IF NOT EXISTS exhibitions_status_idx ON exhibitions (status);
CREATE INDEX IF NOT EXISTS exhibitions_curator_address_idx ON exhibitions (curator_address);

CREATE TABLE IF NOT EXISTS exhibition_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibition_id UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  caption TEXT,
  chain_id INTEGER NOT NULL DEFAULT 1,
  contract_address TEXT NOT NULL,
  token_id TEXT NOT NULL,
  listing_id TEXT,
  title TEXT NOT NULL,
  artist TEXT,
  preview_url TEXT,
  canonical_url TEXT
);
CREATE INDEX IF NOT EXISTS exhibition_items_exhibition_id_idx ON exhibition_items (exhibition_id);

CREATE TABLE IF NOT EXISTS exhibition_slots (
  slot_key TEXT PRIMARY KEY NOT NULL,
  exhibition_id UUID REFERENCES exhibitions(id) ON DELETE SET NULL,
  assigned_by TEXT,
  assigned_at TIMESTAMP,
  scheduled_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS upload_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL,
  payer_address TEXT NOT NULL,
  status TEXT NOT NULL,
  quote JSONB NOT NULL,
  payment JSONB,
  media JSONB,
  metadata JSONB,
  confirmation JSONB,
  credit JSONB,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS upload_jobs_idempotency_key_idx ON upload_jobs (idempotency_key);
CREATE INDEX IF NOT EXISTS upload_jobs_payer_address_idx ON upload_jobs (payer_address);
CREATE INDEX IF NOT EXISTS upload_jobs_status_idx ON upload_jobs (status);

CREATE TABLE IF NOT EXISTS payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES upload_jobs(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  network TEXT NOT NULL,
  asset TEXT NOT NULL,
  amount TEXT NOT NULL,
  payer TEXT NOT NULL,
  pay_to TEXT NOT NULL,
  settlement_tx TEXT,
  facilitator TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_receipts_idempotency_key_idx ON payment_receipts (idempotency_key);
CREATE INDEX IF NOT EXISTS payment_receipts_job_id_idx ON payment_receipts (job_id);
