-- Token standard for SuchCollection (erc721) vs SuchCollection1155 (erc1155)
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS token_standard text NOT NULL DEFAULT 'erc721';

CREATE INDEX IF NOT EXISTS collections_token_standard_idx ON collections (token_standard);
