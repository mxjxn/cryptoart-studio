-- Migration: Add ERC1155 Token Supply Cache Table
-- This table caches the total supply per tokenId for ERC1155 tokens
-- to avoid repeated contract calls and improve performance

-- Create the erc1155_token_supply_cache table
CREATE TABLE IF NOT EXISTS erc1155_token_supply_cache (
  contract_address TEXT NOT NULL,
  token_id TEXT NOT NULL,
  total_supply BIGINT NOT NULL,
  is_lazy_mint BOOLEAN NOT NULL DEFAULT false,
  cached_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (contract_address, token_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS erc1155_token_supply_cache_contract_address_idx 
  ON erc1155_token_supply_cache(contract_address);

CREATE INDEX IF NOT EXISTS erc1155_token_supply_cache_expires_at_idx 
  ON erc1155_token_supply_cache(expires_at);

