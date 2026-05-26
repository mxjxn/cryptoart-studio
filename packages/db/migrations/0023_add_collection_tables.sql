-- Collection management tables for custom indexer-backed NFT collection tracking

CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  chain_id INTEGER NOT NULL DEFAULT 8453,
  contract_address TEXT NOT NULL,
  factory_address TEXT NOT NULL,
  deploy_tx_hash TEXT NOT NULL,
  deploy_block_number BIGINT,
  owner_address TEXT NOT NULL,
  royalty_receiver TEXT,
  royalty_bps INTEGER DEFAULT 0,
  description TEXT,
  image_url TEXT,
  banner_url TEXT,
  status TEXT NOT NULL DEFAULT 'deploying',
  total_supply INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS collections_contract_chain_idx ON collections (contract_address, chain_id);
CREATE INDEX IF NOT EXISTS collections_owner_address_idx ON collections (owner_address);
CREATE INDEX IF NOT EXISTS collections_status_idx ON collections (status);
CREATE INDEX IF NOT EXISTS collections_factory_address_idx ON collections (factory_address);

CREATE TABLE IF NOT EXISTS collection_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL DEFAULT 8453,
  contract_address TEXT NOT NULL,
  token_id BIGINT NOT NULL,
  token_uri TEXT,
  name TEXT,
  description TEXT,
  image_url TEXT,
  animation_url TEXT,
  attributes JSONB,
  owner_address TEXT NOT NULL,
  mint_tx_hash TEXT NOT NULL,
  mint_block_number BIGINT,
  minted_by_extension TEXT,
  metadata_status TEXT NOT NULL DEFAULT 'pending',
  metadata_retries INTEGER NOT NULL DEFAULT 0,
  burned_at TIMESTAMP,
  minted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS collection_tokens_contract_token_idx ON collection_tokens (contract_address, chain_id, token_id);
CREATE INDEX IF NOT EXISTS collection_tokens_collection_id_idx ON collection_tokens (collection_id);
CREATE INDEX IF NOT EXISTS collection_tokens_owner_address_idx ON collection_tokens (owner_address);
CREATE INDEX IF NOT EXISTS collection_tokens_metadata_status_idx ON collection_tokens (metadata_status);

CREATE TABLE IF NOT EXISTS collection_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID,
  chain_id INTEGER NOT NULL DEFAULT 8453,
  tx_hash TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  royalty_receiver TEXT,
  royalty_bps INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  block_number BIGINT,
  gas_used BIGINT,
  effective_gas_price BIGINT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMP,
  failed_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS collection_deployments_tx_hash_idx ON collection_deployments (tx_hash, chain_id);
CREATE INDEX IF NOT EXISTS collection_deployments_status_idx ON collection_deployments (status);
CREATE INDEX IF NOT EXISTS collection_deployments_from_address_idx ON collection_deployments (from_address);
CREATE INDEX IF NOT EXISTS collection_deployments_submitted_at_idx ON collection_deployments (submitted_at);

CREATE TABLE IF NOT EXISTS collection_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL DEFAULT 8453,
  contract_address TEXT NOT NULL,
  extension_address TEXT NOT NULL,
  base_uri TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  registered_block BIGINT,
  unregistered_at TIMESTAMP,
  unregistered_block BIGINT
);

CREATE UNIQUE INDEX IF NOT EXISTS collection_extensions_collection_ext_idx ON collection_extensions (contract_address, chain_id, extension_address);
CREATE INDEX IF NOT EXISTS collection_extensions_collection_id_idx ON collection_extensions (collection_id);
CREATE INDEX IF NOT EXISTS collection_extensions_status_idx ON collection_extensions (status);

CREATE TABLE IF NOT EXISTS collection_royalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL DEFAULT 8453,
  contract_address TEXT NOT NULL,
  token_id BIGINT,
  receiver_address TEXT NOT NULL,
  bps INTEGER NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS collection_royalties_default_idx ON collection_royalties (contract_address, chain_id, token_id);
CREATE INDEX IF NOT EXISTS collection_royalties_collection_id_idx ON collection_royalties (collection_id);

CREATE TABLE IF NOT EXISTS transfer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL DEFAULT 8453,
  contract_address TEXT NOT NULL,
  token_id BIGINT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  event_type TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  log_index INTEGER NOT NULL,
  timestamp TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS transfer_events_tx_log_idx ON transfer_events (tx_hash, log_index);
CREATE INDEX IF NOT EXISTS transfer_events_collection_token_idx ON transfer_events (collection_id, token_id);
CREATE INDEX IF NOT EXISTS transfer_events_from_address_idx ON transfer_events (from_address);
CREATE INDEX IF NOT EXISTS transfer_events_to_address_idx ON transfer_events (to_address);
CREATE INDEX IF NOT EXISTS transfer_events_block_number_idx ON transfer_events (block_number);

CREATE TABLE IF NOT EXISTS indexed_contracts (
  contract_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL DEFAULT 8453,
  last_indexed_block BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  contract_type TEXT NOT NULL DEFAULT 'such_collection',
  discovered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  error_message TEXT,
  PRIMARY KEY (contract_address, chain_id)
);

CREATE INDEX IF NOT EXISTS indexed_contracts_status_idx ON indexed_contracts (status);
