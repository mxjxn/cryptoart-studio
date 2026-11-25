-- Marketplace event tables: bids, purchases, offers, escrows
-- Description: Immutable event records for marketplace activity
-- All tables use (chain_id, transaction_hash, log_index) as unique identifier

-- Bids table
CREATE TABLE IF NOT EXISTS chain_indexer_bids (
  chain_id INTEGER NOT NULL,
  listing_id NUMERIC(78,0) NOT NULL,
  referrer TEXT,
  bidder TEXT NOT NULL,
  amount NUMERIC(78,0) NOT NULL,
  timestamp BIGINT NOT NULL,
  block_number BIGINT NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  
  PRIMARY KEY (chain_id, transaction_hash, log_index)
);

CREATE INDEX IF NOT EXISTS chain_indexer_bids_listing_idx ON chain_indexer_bids(chain_id, listing_id);
CREATE INDEX IF NOT EXISTS chain_indexer_bids_bidder_idx ON chain_indexer_bids(bidder);
CREATE INDEX IF NOT EXISTS chain_indexer_bids_timestamp_idx ON chain_indexer_bids(timestamp);

COMMENT ON TABLE chain_indexer_bids IS 'All bids on marketplace listings (immutable)';

-- Purchases table
CREATE TABLE IF NOT EXISTS chain_indexer_purchases (
  chain_id INTEGER NOT NULL,
  listing_id NUMERIC(78,0) NOT NULL,
  referrer TEXT,
  buyer TEXT NOT NULL,
  count INTEGER NOT NULL,
  amount NUMERIC(78,0) NOT NULL,
  timestamp BIGINT NOT NULL,
  block_number BIGINT NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  
  PRIMARY KEY (chain_id, transaction_hash, log_index)
);

CREATE INDEX IF NOT EXISTS chain_indexer_purchases_listing_idx ON chain_indexer_purchases(chain_id, listing_id);
CREATE INDEX IF NOT EXISTS chain_indexer_purchases_buyer_idx ON chain_indexer_purchases(buyer);
CREATE INDEX IF NOT EXISTS chain_indexer_purchases_timestamp_idx ON chain_indexer_purchases(timestamp);

COMMENT ON TABLE chain_indexer_purchases IS 'All purchases on marketplace listings (immutable)';

-- Offers table
CREATE TABLE IF NOT EXISTS chain_indexer_offers (
  chain_id INTEGER NOT NULL,
  listing_id NUMERIC(78,0) NOT NULL,
  referrer TEXT,
  offerer TEXT NOT NULL,
  amount NUMERIC(78,0) NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  timestamp BIGINT NOT NULL,
  block_number BIGINT NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  accepted_at BIGINT,
  rescinded_at BIGINT,
  
  PRIMARY KEY (chain_id, transaction_hash, log_index)
);

CREATE INDEX IF NOT EXISTS chain_indexer_offers_listing_idx ON chain_indexer_offers(chain_id, listing_id);
CREATE INDEX IF NOT EXISTS chain_indexer_offers_offerer_idx ON chain_indexer_offers(offerer);
CREATE INDEX IF NOT EXISTS chain_indexer_offers_status_idx ON chain_indexer_offers(status);
CREATE INDEX IF NOT EXISTS chain_indexer_offers_timestamp_idx ON chain_indexer_offers(timestamp);

COMMENT ON TABLE chain_indexer_offers IS 'All offers on marketplace listings (mutable status: PENDING, ACCEPTED, RESCINDED)';

-- Escrows table
CREATE TABLE IF NOT EXISTS chain_indexer_escrows (
  chain_id INTEGER NOT NULL,
  receiver TEXT NOT NULL,
  erc20 TEXT NOT NULL,
  amount NUMERIC(78,0) NOT NULL,
  timestamp BIGINT NOT NULL,
  block_number BIGINT NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  
  PRIMARY KEY (chain_id, transaction_hash, log_index)
);

CREATE INDEX IF NOT EXISTS chain_indexer_escrows_receiver_idx ON chain_indexer_escrows(receiver);
CREATE INDEX IF NOT EXISTS chain_indexer_escrows_timestamp_idx ON chain_indexer_escrows(timestamp);

COMMENT ON TABLE chain_indexer_escrows IS 'Settlement escrow events (immutable)';
