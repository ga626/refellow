-- Backward-compatible R2 metadata table.
-- The legacy chunks table is intentionally preserved so an older Worker can
-- continue reading and writing D1 BLOB media during rollout.
CREATE TABLE IF NOT EXISTS chunk_meta (
  upload_id TEXT NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  chunk_size INTEGER NOT NULL,
  PRIMARY KEY(upload_id,position)
);
