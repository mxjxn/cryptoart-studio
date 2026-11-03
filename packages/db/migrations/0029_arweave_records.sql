-- Canonical Arweave transaction records for paid upload jobs (media + metadata).
CREATE TABLE IF NOT EXISTS arweave_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES upload_jobs(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'media' | 'metadata'
  tx_id TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  gateways JSONB NOT NULL DEFAULT '[]'::jsonb,
  simulated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS arweave_records_job_role_idx ON arweave_records (job_id, role);
CREATE INDEX IF NOT EXISTS arweave_records_tx_id_idx ON arweave_records (tx_id);
