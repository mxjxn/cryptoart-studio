-- Chain event indexer: raw events table
-- Description: Generic chain events storage for marketplace and factory events
-- This table stores all indexed events in a generic format for replay and debugging
-- Domain-specific tables (listings, bids, etc.) are derived from these raw events

CREATE TABLE IF NOT EXISTS chain_events (
  chain_id INTEGER NOT NULL,
  contract TEXT NOT NULL,
  event_name TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  block_hash TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  args JSONB NOT NULL,
  indexed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, transaction_hash, log_index)
);

CREATE INDEX IF NOT EXISTS chain_events_block_number_idx ON chain_events(chain_id, block_number);
CREATE INDEX IF NOT EXISTS chain_events_contract_idx ON chain_events(chain_id, contract);
CREATE INDEX IF NOT EXISTS chain_events_event_name_idx ON chain_events(event_name);
CREATE INDEX IF NOT EXISTS chain_events_indexed_at_idx ON chain_events(indexed_at);

COMMENT ON TABLE chain_events IS 'Raw chain events for all indexed contracts (marketplace, factory, collections)';
COMMENT ON COLUMN chain_events.args IS 'Event arguments as JSONB for flexible querying and replay';
