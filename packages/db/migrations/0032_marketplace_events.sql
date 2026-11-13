-- Marketplace event tables: bids, purchases, offers, escrows
-- Description: Immutable event records for marketplace activity
-- All tables use (chain_id, transaction_hash, log_index) as unique identifier

-- Bids table
CREATE TABLE IF NOT EXISTS bids (
  chain_id INTEGER NOT NULL,
  listing_id BIGINT NOT NULL,
  referrer TEXT,
  bidder TEXT NOT NULL,
  amount BIGINT NOT NULL,
  timestamp BIGINT NOT NULL,
  block_number BIGINT NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  
  PRIMARY KEY (chain_id, transaction_hash, log_index)
);

CREATE INDEX IF NOT EXISTS bids_listing_idx ON bids(chain_id, listing_id);
CREATE INDEX IF NOT EXISTS bids_bidder_idx ON bids(bidder);
CREATE INDEX IF NOT EXISTS bids_timestamp_idx ON bids(timestamp);

COMMENT ON TABLE bids IS 'All bids on marketplace listings (immutable)';

-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
  chain_id INTEGER NOT NULL,
  listing_id BIGINT NOT NULL,
  referrer TEXT,
  buyer TEXT NOT NULL,
  count INTEGER NOT NULL,
  amount BIGINT NOT NULL,
  timestamp BIGINT NOT NULL,
  block_number BIGINT NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  
  PRIMARY KEY (chain_id, transaction_hash, log_index)
);

CREATE INDEX IF NOT EXISTS purchases_listing_idx ON purchases(chain_id, listing_id);
CREATE INDEX IF NOT EXISTS purchases_buyer_idx ON purchases(buyer);
CREATE INDEX IF NOT EXISTS purchases_timestamp_idx ON purchases(timestamp);

COMMENT ON TABLE purchases IS 'All purchases on marketplace listings (immutable)';

-- Offers table
CREATE TABLE IF NOT EXISTS offers (
  chain_id INTEGER NOT NULL,
  listing_id BIGINT NOT NULL,
  referrer TEXT,
  offerer TEXT NOT NULL,
  amount BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  timestamp BIGINT NOT NULL,
  block_number BIGINT NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  accepted_at BIGINT,
  rescinded_at BIGINT,
  
  PRIMARY KEY (chain_id, transaction_hash, log_index)
);

CREATE INDEX IF NOT EXISTS offers_listing_idx ON offers(chain_id, listing_id);
CREATE INDEX IF NOT EXISTS offers_offerer_idx ON offers(offerer);
CREATE INDEX IF NOT EXISTS offers_status_idx ON offers(status);
CREATE INDEX IF NOT EXISTS offers_timestamp_idx ON offers(timestamp);

COMMENT ON TABLE offers IS 'All offers on marketplace listings (mutable status: PENDING, ACCEPTED, RESCINDED)';

-- Escrows table
CREATE TABLE IF NOT EXISTS escrows (
  chain_id INTEGER NOT NULL,
  receiver TEXT NOT NULL,
  erc20 TEXT NOT NULL,
  amount BIGINT NOT NULL,
  timestamp BIGINT NOT NULL,
  block_number BIGINT NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  
  PRIMARY KEY (chain_id, transaction_hash, log_index)
);

CREATE INDEX IF NOT EXISTS escrows_receiver_idx ON escrows(receiver);
CREATE INDEX IF NOT EXISTS escrows_timestamp_idx ON escrows(timestamp);

COMMENT ON TABLE escrows IS 'Settlement escrow events (immutable)';
