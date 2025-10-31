-- Add part-of-speech tables
-- Migration version: 002
-- Created: 2025-10-28

-- Nouns table: 명사
CREATE TABLE IF NOT EXISTS nouns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  korean TEXT NOT NULL UNIQUE,
  english TEXT,
  romanization TEXT,
  times_seen INTEGER DEFAULT 1,
  times_correct INTEGER DEFAULT 0,
  times_incorrect INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Verbs table: 동사
CREATE TABLE IF NOT EXISTS verbs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  korean TEXT NOT NULL UNIQUE,
  english TEXT,
  romanization TEXT,
  base_form TEXT,
  conjugation_type TEXT,
  times_seen INTEGER DEFAULT 1,
  times_correct INTEGER DEFAULT 0,
  times_incorrect INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Adjectives table: 형용사
CREATE TABLE IF NOT EXISTS adjectives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  korean TEXT NOT NULL UNIQUE,
  english TEXT,
  romanization TEXT,
  base_form TEXT,
  times_seen INTEGER DEFAULT 1,
  times_correct INTEGER DEFAULT 0,
  times_incorrect INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Adverbs table: 부사
CREATE TABLE IF NOT EXISTS adverbs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  korean TEXT NOT NULL UNIQUE,
  english TEXT,
  romanization TEXT,
  times_seen INTEGER DEFAULT 1,
  times_correct INTEGER DEFAULT 0,
  times_incorrect INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pronouns table: 대명사
CREATE TABLE IF NOT EXISTS pronouns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  korean TEXT NOT NULL UNIQUE,
  english TEXT,
  romanization TEXT,
  pronoun_type TEXT,
  times_seen INTEGER DEFAULT 1,
  times_correct INTEGER DEFAULT 0,
  times_incorrect INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Conjunctions table: 접속사
CREATE TABLE IF NOT EXISTS conjunctions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  korean TEXT NOT NULL UNIQUE,
  english TEXT,
  romanization TEXT,
  times_seen INTEGER DEFAULT 1,
  times_correct INTEGER DEFAULT 0,
  times_incorrect INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Particles/Postpositions table: 조사
CREATE TABLE IF NOT EXISTS particles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  korean TEXT NOT NULL UNIQUE,
  english TEXT,
  romanization TEXT,
  particle_type TEXT,
  times_seen INTEGER DEFAULT 1,
  times_correct INTEGER DEFAULT 0,
  times_incorrect INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Phrase words junction table
CREATE TABLE IF NOT EXISTS phrase_words (
  phrase_id INTEGER,
  word_id INTEGER,
  word_type TEXT,
  position_in_phrase INTEGER,
  PRIMARY KEY (phrase_id, word_id, word_type),
  FOREIGN KEY (phrase_id) REFERENCES phrases (id)
);

