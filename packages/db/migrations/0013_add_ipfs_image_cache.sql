-- Migration: Add IPFS Image Cache Table
-- This table caches IPFS images to Vercel Blob to avoid repeated gateway calls
-- and serve images from CDN for better performance and reliability

-- Create the ipfs_image_cache table
CREATE TABLE IF NOT EXISTS ipfs_image_cache (
  ipfs_url TEXT PRIMARY KEY NOT NULL,
  blob_url TEXT NOT NULL,
  cached_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS ipfs_image_cache_ipfs_url_idx 
  ON ipfs_image_cache(ipfs_url);

CREATE INDEX IF NOT EXISTS ipfs_image_cache_expires_at_idx 
  ON ipfs_image_cache(expires_at);

