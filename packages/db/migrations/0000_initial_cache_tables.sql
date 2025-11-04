-- Initial migration for Hypersub cache tables
-- Run this migration to create the cache tables

-- Create subscriptions_cache table
CREATE TABLE IF NOT EXISTS subscriptions_cache (
    id SERIAL PRIMARY KEY,
    fid INTEGER NOT NULL,
    contract_address TEXT NOT NULL,
    metadata JSONB NOT NULL,
    cached_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create subscribers_cache table
CREATE TABLE IF NOT EXISTS subscribers_cache (
    id SERIAL PRIMARY KEY,
    fid INTEGER NOT NULL,
    contract_address TEXT NOT NULL,
    subscriber_data JSONB NOT NULL,
    subscriber_count INTEGER NOT NULL,
    cached_at TIMESTAMP DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP NOT NULL
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS subscriptions_cache_fid_idx ON subscriptions_cache(fid);
CREATE INDEX IF NOT EXISTS subscriptions_cache_contract_address_idx ON subscriptions_cache(contract_address);
CREATE INDEX IF NOT EXISTS subscriptions_cache_fid_contract_idx ON subscriptions_cache(fid, contract_address);

CREATE INDEX IF NOT EXISTS subscribers_cache_fid_idx ON subscribers_cache(fid);
CREATE INDEX IF NOT EXISTS subscribers_cache_contract_address_idx ON subscribers_cache(contract_address);
CREATE INDEX IF NOT EXISTS subscribers_cache_fid_contract_idx ON subscribers_cache(fid, contract_address);
CREATE INDEX IF NOT EXISTS subscribers_cache_expires_at_idx ON subscribers_cache(expires_at);
