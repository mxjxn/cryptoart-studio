ALTER TABLE collection_tokens
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS audio_url text;

CREATE INDEX IF NOT EXISTS collection_tokens_media_type_idx ON collection_tokens (media_type);