ALTER TABLE shares ADD COLUMN manage_token_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(manage_token_hash);
