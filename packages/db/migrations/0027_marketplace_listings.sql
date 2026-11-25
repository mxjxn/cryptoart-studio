-- Marketplace listings domain model
-- Description: Derived from CreateListing, CreateListingTokenDetails, CreateListingFees events
-- Supports Base and Ethereum marketplace contracts plus future factory-created marketplaces

CREATE TABLE IF NOT EXISTS chain_indexer_listings (
  chain_id INTEGER NOT NULL,
  listing_id NUMERIC(78,0) NOT NULL,
  marketplace TEXT NOT NULL,
  seller TEXT NOT NULL,
  
  -- Token details
  token_address TEXT NOT NULL,
  token_id NUMERIC(78,0),
  token_spec INTEGER NOT NULL,
  lazy INTEGER NOT NULL DEFAULT 0,
  
  -- Listing details
  listing_type INTEGER NOT NULL,
  initial_amount NUMERIC(78,0) NOT NULL,
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
  deliver_fixed NUMERIC(78,0) NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  has_bid INTEGER NOT NULL DEFAULT 0,
  finalized INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL,
  created_at_block BIGINT NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  updated_at_block BIGINT NOT NULL,
  
  PRIMARY KEY (chain_id, listing_id, marketplace)
);

CREATE INDEX IF NOT EXISTS chain_indexer_listings_seller_idx ON chain_indexer_listings(seller);
CREATE INDEX IF NOT EXISTS chain_indexer_listings_status_idx ON chain_indexer_listings(status);
CREATE INDEX IF NOT EXISTS chain_indexer_listings_token_idx ON chain_indexer_listings(chain_id, token_address, token_id);
CREATE INDEX IF NOT EXISTS chain_indexer_listings_created_at_idx ON chain_indexer_listings(created_at);
CREATE INDEX IF NOT EXISTS chain_indexer_listings_end_time_idx ON chain_indexer_listings(end_time);

COMMENT ON TABLE chain_indexer_listings IS 'Marketplace listings from CreateListing events across all chains and marketplaces';
COMMENT ON COLUMN chain_indexer_listings.token_spec IS '0=NONE, 1=ERC721, 2=ERC1155';
COMMENT ON COLUMN chain_indexer_listings.listing_type IS '1=INDIVIDUAL_AUCTION, 2=FIXED_PRICE, 3=DYNAMIC_PRICE, 4=OFFERS_ONLY';
COMMENT ON COLUMN chain_indexer_listings.status IS 'ACTIVE, CANCELLED, or FINALIZED';
COMMENT ON COLUMN chain_indexer_listings.has_bid IS '0=false, 1=true (integer for PostgreSQL compatibility)';
COMMENT ON COLUMN chain_indexer_listings.lazy IS '0=false, 1=true (integer for PostgreSQL compatibility)';
COMMENT ON COLUMN chain_indexer_listings.finalized IS '0=false, 1=true (integer for PostgreSQL compatibility)';
