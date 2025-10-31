-- Add model sentence table
-- Migration version: 003
-- Created: 2025-10-28

-- Model sentence table: stores the current active model sentence (singleton)
CREATE TABLE IF NOT EXISTS model_sentence (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  english TEXT NOT NULL,
  korean TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

