-- Initial database schema
-- Migration version: 001
-- Created: 2025-01-01

-- Phrases table: stores user-translated phrases
CREATE TABLE IF NOT EXISTS phrases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  korean_text TEXT NOT NULL,
  english_text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  times_correct INTEGER DEFAULT 0,
  times_incorrect INTEGER DEFAULT 0
);

-- Old words table (legacy)
CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  korean_word TEXT NOT NULL UNIQUE,
  english_meaning TEXT,
  difficulty_level INTEGER DEFAULT 1,
  times_correct INTEGER DEFAULT 0,
  times_incorrect INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

