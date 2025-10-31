-- Add comprehensive verb tense storage
-- Migration version: 004
-- Created: 2025-10-28

-- Drop old verbs table and recreate with all tense columns
DROP TABLE IF EXISTS verbs;

CREATE TABLE verbs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Base form (dictionary form)
  base_form TEXT NOT NULL UNIQUE,
  base_form_romanization TEXT,
  english TEXT,
  
  -- Present tense (현재)
  present_informal TEXT,
  present_formal TEXT,
  present_honorific TEXT,
  
  -- Past tense (과거)
  past_informal TEXT,
  past_formal TEXT,
  past_honorific TEXT,
  
  -- Future tense (미래)
  future_informal TEXT,
  future_formal TEXT,
  future_honorific TEXT,
  
  -- Progressive/Continuous (진행형)
  progressive_informal TEXT,
  progressive_formal TEXT,
  
  -- Negative forms (부정)
  negative_present_informal TEXT,
  negative_present_formal TEXT,
  negative_past_informal TEXT,
  negative_past_formal TEXT,
  
  -- Verb type classification
  verb_type TEXT,  -- regular, irregular, 하다-verb, etc.
  conjugation_pattern TEXT,
  
  -- Metadata
  times_seen INTEGER DEFAULT 1,
  times_correct INTEGER DEFAULT 0,
  times_incorrect INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_verbs_base_form ON verbs(base_form);
CREATE INDEX IF NOT EXISTS idx_verbs_english ON verbs(english);

