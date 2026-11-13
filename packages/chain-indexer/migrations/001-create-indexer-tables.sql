-- Migration: Create chain indexer tables
-- Description: Creates tables for chain event indexing, replacing the hosted subgraph
-- Author: Chain Indexer Package
-- Date: 2026-11-13

-- Indexer checkpoints table
CREATE TABLE IF NOT EXISTS indexer_checkpoints (
  chain_id INTEGER NOT NULL,
  contract TEXT NOT NULL,
  last_block BIGINT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, contract)
);

CREATE INDEX IF NOT EXISTS indexer_checkpoints_updated_at_idx ON indexer_checkpoints(updated_at);

-- Generic chain events table
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

-- Listings table
CREATE TABLE IF NOT EXISTS listings (
  chain_id INTEGER NOT NULL,
  listing_id BIGINT NOT NULL,
  marketplace TEXT NOT NULL,
  seller TEXT NOT NULL,
  
  -- Token details
  token_address TEXT NOT NULL,
  token_id BIGINT,
  token_spec INTEGER NOT NULL,
  lazy INTEGER NOT NULL DEFAULT 0,
  
  -- Listing details
  listing_type INTEGER NOT NULL,
  initial_amount BIGINT NOT NULL,
  total_available INTEGER NOT NULL,
  total_per_sale INTEGER NOT NULL,
  total_sold INTEGER NOT NULL DEFAULT 0,
  
  -- Timing
  start_time BIGINT NOT NULL,
  end_time BIGINT NOT NULL,
  
  -- Auction settings
  extension_interval INTEGER NOT NULL,
  min_increment_bps INTEGER NOT NULL,
  
  -- Payment
  erc20 TEXT,
  identity_verifier TEXT,
  
  -- Fees
  marketplace_bps INTEGER NOT NULL,
  referrer_bps INTEGER NOT NULL,
  deliver_bps INTEGER NOT NULL,
  deliver_fixed BIGINT NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  has_bid INTEGER NOT NULL DEFAULT 0,
  finalized INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL,
  created_at_block BIGINT NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  updated_at_block BIGINT NOT NULL,
  
  PRIMARY KEY (chain_id, listing_id)
);

CREATE INDEX IF NOT EXISTS listings_seller_idx ON listings(seller);
CREATE INDEX IF NOT EXISTS listings_status_idx ON listings(status);
CREATE INDEX IF NOT EXISTS listings_token_idx ON listings(chain_id, token_address, token_id);
CREATE INDEX IF NOT EXISTS listings_created_at_idx ON listings(created_at);
CREATE INDEX IF NOT EXISTS listings_end_time_idx ON listings(end_time);

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

-- Add comments
COMMENT ON TABLE indexer_checkpoints IS 'Track indexing progress per contract/chain';
COMMENT ON TABLE chain_events IS 'Raw chain events for all indexed contracts';
COMMENT ON TABLE listings IS 'Marketplace listings derived from CreateListing events';
COMMENT ON TABLE bids IS 'All bids on marketplace listings';
COMMENT ON TABLE purchases IS 'All purchases on marketplace listings';
COMMENT ON TABLE offers IS 'All offers on marketplace listings';
COMMENT ON TABLE escrows IS 'Settlement escrow events';
