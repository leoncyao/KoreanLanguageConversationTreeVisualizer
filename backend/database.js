const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, '..', 'data', 'korean_words.db');
  }

  async init() {
    return new Promise((resolve, reject) => {
      // Ensure data directory exists
      const fs = require('fs');
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      const createTablesSQL = `
        -- Phrases table: stores user-translated phrases
        CREATE TABLE IF NOT EXISTS phrases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          korean_text TEXT NOT NULL,
          english_text TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          times_correct INTEGER DEFAULT 0,
          times_incorrect INTEGER DEFAULT 0
        );

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

        -- Particles/Postpositions table: 조사 (Korean particles are more common than prepositions)
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

        -- Phrase words junction table: links phrases to their constituent words
        CREATE TABLE IF NOT EXISTS phrase_words (
          phrase_id INTEGER,
          word_id INTEGER,
          word_type TEXT,
          position_in_phrase INTEGER,
          PRIMARY KEY (phrase_id, word_id, word_type),
          FOREIGN KEY (phrase_id) REFERENCES phrases (id)
        );

        -- Model sentence table: stores the current active model sentence (singleton)
        CREATE TABLE IF NOT EXISTS model_sentence (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          english TEXT NOT NULL,
          korean TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;

      this.db.exec(createTablesSQL, (err) => {
        if (err) {
          console.error('Error creating tables:', err);
          reject(err);
        } else {
          console.log('Database tables created successfully');
          resolve();
        }
      });
    });
  }

  async savePhrase(koreanText, englishText) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO phrases (korean_text, english_text)
        VALUES (?, ?)
      `;
      
      this.db.run(sql, [koreanText, englishText], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async getRandomPhrase() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, korean_text, english_text, times_correct, times_incorrect
        FROM phrases
        ORDER BY RANDOM()
        LIMIT 1
      `;
      
      this.db.get(sql, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async updatePhraseStats(phraseId, isCorrect) {
    return new Promise((resolve, reject) => {
      const field = isCorrect ? 'times_correct' : 'times_incorrect';
      const sql = `UPDATE phrases SET ${field} = ${field} + 1 WHERE id = ?`;
      
      this.db.run(sql, [phraseId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async getAllPhrases() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, korean_text, english_text, times_correct, times_incorrect, created_at
        FROM phrases
        ORDER BY created_at DESC
      `;
      
      this.db.all(sql, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async saveWord(wordType, wordData) {
    return new Promise((resolve, reject) => {
      const { korean, english, romanization, ...extras } = wordData;
      
      // Build the SQL based on word type
      const tableName = wordType + 's'; // nouns, verbs, etc.
      let columns = ['korean', 'english', 'romanization'];
      let values = [korean, english, romanization];
      let placeholders = ['?', '?', '?'];
      
      // Add extra fields based on word type
      if (wordType === 'verb' && extras.base_form) {
        columns.push('base_form', 'conjugation_type');
        values.push(extras.base_form, extras.conjugation_type || null);
        placeholders.push('?', '?');
      } else if (wordType === 'adjective' && extras.base_form) {
        columns.push('base_form');
        values.push(extras.base_form);
        placeholders.push('?');
      } else if (wordType === 'pronoun' && extras.pronoun_type) {
        columns.push('pronoun_type');
        values.push(extras.pronoun_type);
        placeholders.push('?');
      } else if (wordType === 'particle' && extras.particle_type) {
        columns.push('particle_type');
        values.push(extras.particle_type);
        placeholders.push('?');
      }

      const sql = `
        INSERT INTO ${tableName} (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
        ON CONFLICT(korean) DO UPDATE SET
          times_seen = times_seen + 1,
          english = excluded.english,
          romanization = excluded.romanization
      `;
      
      this.db.run(sql, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID || this.changes);
        }
      });
    });
  }

  async saveVerbWithAllTenses(verbData) {
    return new Promise((resolve, reject) => {
      const columns = [];
      const values = [];
      const placeholders = [];
      const updateFields = [];

      // Map all fields from verbData
      const fieldMapping = {
        base_form: verbData.base_form,
        base_form_romanization: verbData.base_form_romanization,
        english: verbData.english,
        present_informal: verbData.present_informal,
        present_formal: verbData.present_formal,
        present_honorific: verbData.present_honorific,
        past_informal: verbData.past_informal,
        past_formal: verbData.past_formal,
        past_honorific: verbData.past_honorific,
        future_informal: verbData.future_informal,
        future_formal: verbData.future_formal,
        future_honorific: verbData.future_honorific,
        progressive_informal: verbData.progressive_informal,
        progressive_formal: verbData.progressive_formal,
        negative_present_informal: verbData.negative_present_informal,
        negative_present_formal: verbData.negative_present_formal,
        negative_past_informal: verbData.negative_past_informal,
        negative_past_formal: verbData.negative_past_formal,
        verb_type: verbData.verb_type,
        conjugation_pattern: verbData.conjugation_pattern
      };

      // Build column lists
      Object.entries(fieldMapping).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          columns.push(key);
          values.push(value);
          placeholders.push('?');
          if (key !== 'base_form') {
            updateFields.push(`${key} = excluded.${key}`);
          }
        }
      });

      updateFields.push('times_seen = times_seen + 1');
      updateFields.push('last_updated = CURRENT_TIMESTAMP');

      const sql = `
        INSERT INTO verbs (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
        ON CONFLICT(base_form) DO UPDATE SET
          ${updateFields.join(',\n          ')}
      `;
      
      this.db.run(sql, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID || this.changes);
        }
      });
    });
  }

  async linkPhraseToWord(phraseId, wordId, wordType, position) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR IGNORE INTO phrase_words (phrase_id, word_id, word_type, position_in_phrase)
        VALUES (?, ?, ?, ?)
      `;
      
      this.db.run(sql, [phraseId, wordId, wordType, position], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async getWordsByType(wordType, limit = 50) {
    return new Promise((resolve, reject) => {
      const tableName = wordType + 's';
      const sql = `
        SELECT * FROM ${tableName}
        ORDER BY times_seen DESC, created_at DESC
        LIMIT ?
      `;
      
      this.db.all(sql, [limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getModelSentence() {
    return new Promise((resolve, reject) => {
      const sql = `SELECT english, korean, updated_at FROM model_sentence WHERE id = 1`;
      
      this.db.get(sql, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  async saveModelSentence(english, korean) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO model_sentence (id, english, korean, updated_at)
        VALUES (1, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          english = excluded.english,
          korean = excluded.korean,
          updated_at = CURRENT_TIMESTAMP
      `;
      
      this.db.run(sql, [english, korean], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async clearModelSentence() {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM model_sentence WHERE id = 1`;
      
      this.db.run(sql, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async incrementWordCorrect(koreanWord) {
    return new Promise((resolve, reject) => {
      const tables = ['nouns', 'verbs', 'adjectives', 'adverbs', 'pronouns', 'conjunctions', 'particles'];
      let totalChanges = 0;

      const updateNext = (index) => {
        if (index >= tables.length) {
          return resolve(totalChanges);
        }

        const table = tables[index];
        const sql = `UPDATE ${table} SET times_correct = times_correct + 1, times_seen = times_seen + 1 WHERE korean = ?`;
        this.db.run(sql, [koreanWord], function(err) {
          if (err) {
            return reject(err);
          }
          totalChanges += this.changes || 0;
          updateNext(index + 1);
        });
      };

      updateNext(0);
    });
  }

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          } else {
            console.log('Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = Database;
