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
          // Enable foreign keys for CASCADE DELETE
          this.db.run('PRAGMA foreign_keys = ON', (pragmaErr) => {
            if (pragmaErr) {
              console.warn('Warning: Could not enable foreign keys:', pragmaErr);
            }
            this.createTables().then(resolve).catch(reject);
          });
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
          first_try_correct INTEGER DEFAULT 0,
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
          first_try_correct INTEGER DEFAULT 0,
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
          first_try_correct INTEGER DEFAULT 0,
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
          first_try_correct INTEGER DEFAULT 0,
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
          first_try_correct INTEGER DEFAULT 0,
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
          first_try_correct INTEGER DEFAULT 0,
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
          first_try_correct INTEGER DEFAULT 0,
          times_incorrect INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Proper Nouns table: 고유명사
        CREATE TABLE IF NOT EXISTS proper_nouns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          korean TEXT NOT NULL UNIQUE,
          english TEXT,
          romanization TEXT,
          times_seen INTEGER DEFAULT 1,
          times_correct INTEGER DEFAULT 0,
          first_try_correct INTEGER DEFAULT 0,
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

        -- Grammar rules table
        CREATE TABLE IF NOT EXISTS grammar_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          example_korean TEXT,
          example_english TEXT,
          model_korean TEXT,
          model_english TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Cached variations for current model sentence
        CREATE TABLE IF NOT EXISTS variations_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          model_english TEXT NOT NULL,
          model_korean TEXT NOT NULL,
          variations_json TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Curriculum phrases table: stores phrases for practice with editable blank positions
        CREATE TABLE IF NOT EXISTS curriculum_phrases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          korean_text TEXT NOT NULL,
          english_text TEXT NOT NULL,
          correct_answers_json TEXT,
          grammar_breakdown_json TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          times_correct INTEGER DEFAULT 0,
          times_incorrect INTEGER DEFAULT 0
        );

        -- Curriculum phrase blanks table: stores which word indices are blank for each phrase
        CREATE TABLE IF NOT EXISTS curriculum_phrase_blanks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phrase_id INTEGER NOT NULL,
          word_index INTEGER NOT NULL,
          correct_answer TEXT,
          word_type TEXT,
          FOREIGN KEY (phrase_id) REFERENCES curriculum_phrases(id) ON DELETE CASCADE
        );

        -- Journal entries table
        CREATE TABLE IF NOT EXISTS journal_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_date TEXT NOT NULL,
          english_text TEXT,
          korean_text TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
      `;

      this.db.exec(createTablesSQL, (err) => {
        if (err) {
          console.error('Error creating tables:', err);
          reject(err);
        } else {
          console.log('Database tables created successfully');
          // Ensure tag columns exist on all word tables for existing DBs
          this.ensureTagColumns()
            .then(() => this.ensureCurriculumPhrasesColumns())
            .then(() => this.seedDefaultGrammarRulesIfEmpty())
            .then(() => resolve())
            .catch((e) => {
              console.warn('Warning ensuring columns:', e);
              resolve();
            });
        }
      });
    });
  }

  // Journal methods
  async addJournalEntry(entryDate, englishText, koreanText) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO journal_entries (entry_date, english_text, korean_text)
        VALUES (?, ?, ?)
      `;
      this.db.run(sql, [entryDate, englishText || null, koreanText], function(err) {
        if (err) return reject(err);
        resolve(this.lastID);
      });
    });
  }

  async getJournalEntriesByDate(entryDate) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, entry_date, english_text, korean_text, created_at
        FROM journal_entries
        WHERE entry_date = ?
        ORDER BY created_at DESC, id DESC
      `;
      this.db.all(sql, [entryDate], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  async getJournalDays(limit = 60) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT entry_date AS date, COUNT(1) AS count
        FROM journal_entries
        GROUP BY entry_date
        ORDER BY entry_date DESC
        LIMIT ?
      `;
      this.db.all(sql, [limit], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
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

  // Curriculum phrases methods
  async getAllCurriculumPhrases() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, korean_text, english_text, correct_answers_json, grammar_breakdown_json,
               times_correct, times_incorrect, created_at
        FROM curriculum_phrases
        ORDER BY created_at DESC
      `;
      
      this.db.all(sql, async (err, rows) => {
        if (err) {
          reject(err);
        } else {
            try {
              const phrases = await Promise.all(rows.map(async (row) => {
              // Get blank indices from separate table
              const blanks = await new Promise((resolve, reject) => {
                this.db.all(
                  'SELECT word_index, correct_answer, word_type FROM curriculum_phrase_blanks WHERE phrase_id = ? ORDER BY word_index',
                  [row.id],
                  (err, blankRows) => {
                    if (err) reject(err);
                    else resolve(blankRows || []);
                  }
                );
              });
              
              const blankWordIndices = blanks.map(b => b.word_index);
              const correctAnswers = blanks.map(b => b.correct_answer).filter(a => a);
              const blankWordTypes = blanks.map(b => b.word_type).filter(t => t);
              
              return {
                ...row,
                blank_word_indices: blankWordIndices,
                blank_word_types: blankWordTypes,
                correct_answers: correctAnswers.length > 0 ? correctAnswers : (row.correct_answers_json ? JSON.parse(row.correct_answers_json) : []),
                grammar_breakdown: row.grammar_breakdown_json ? JSON.parse(row.grammar_breakdown_json) : null
              };
            }));
            resolve(phrases);
          } catch (e) {
            reject(e);
          }
        }
      });
    });
  }

  async getRandomCurriculumPhrase() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, korean_text, english_text, correct_answers_json, grammar_breakdown_json,
               times_correct, times_incorrect
        FROM curriculum_phrases
        ORDER BY RANDOM()
        LIMIT 1
      `;
      
      this.db.get(sql, async (err, row) => {
        if (err) {
          reject(err);
        } else {
          if (!row) {
            resolve(null);
          } else {
            try {
              // Get blank indices from separate table
              const blanks = await new Promise((resolve, reject) => {
                this.db.all(
                  'SELECT word_index, correct_answer, word_type FROM curriculum_phrase_blanks WHERE phrase_id = ? ORDER BY word_index',
                  [row.id],
                  (err, blankRows) => {
                    if (err) reject(err);
                    else resolve(blankRows || []);
                  }
                );
              });
              
              const blankWordIndices = blanks.map(b => b.word_index);
              const correctAnswers = blanks.map(b => b.correct_answer).filter(a => a);
              const blankWordTypes = blanks.map(b => b.word_type).filter(t => t);
              
              resolve({
                ...row,
                blank_word_indices: blankWordIndices,
                blank_word_types: blankWordTypes,
                correct_answers: correctAnswers.length > 0 ? correctAnswers : (row.correct_answers_json ? JSON.parse(row.correct_answers_json) : []),
                grammar_breakdown: row.grammar_breakdown_json ? JSON.parse(row.grammar_breakdown_json) : null
              });
            } catch (e) {
              reject(e);
            }
          }
        }
      });
    });
  }

  async addCurriculumPhrase(koreanText, englishText, blankWordIndices = [], correctAnswers = [], grammarBreakdown = null, blankWordTypes = []) {
    return new Promise(async (resolve, reject) => {
      try {
        // Check if old columns exist (for databases with old schema)
        const cols = await new Promise((resolve, reject) => {
          this.db.all(`PRAGMA table_info(curriculum_phrases)`, (err, cols) => {
            if (err) reject(err);
            else resolve(cols || []);
          });
        });
        const colNames = cols.map(c => c.name);
        const hasOldColumns = colNames.includes('blank_word_index');
        
        const correctAnswersJson = JSON.stringify(Array.isArray(correctAnswers) ? correctAnswers : []);
        const grammarBreakdownJson = grammarBreakdown ? JSON.stringify(grammarBreakdown) : null;
        
        let sql, params;
        if (hasOldColumns) {
          // Old schema has blank_word_index with NOT NULL - provide dummy value (we don't use it)
          // We only store blanks in curriculum_phrase_blanks table
          const dummyBlankIndex = 0; // Dummy value to satisfy NOT NULL constraint
          sql = `
            INSERT INTO curriculum_phrases (korean_text, english_text, blank_word_index, correct_answers_json, grammar_breakdown_json)
            VALUES (?, ?, ?, ?, ?)
          `;
          params = [koreanText, englishText, dummyBlankIndex, correctAnswersJson, grammarBreakdownJson];
        } else {
          // New schema without old columns
          sql = `
            INSERT INTO curriculum_phrases (korean_text, english_text, correct_answers_json, grammar_breakdown_json)
            VALUES (?, ?, ?, ?)
          `;
          params = [koreanText, englishText, correctAnswersJson, grammarBreakdownJson];
        }
        
        // Capture db reference before callback
        const db = this.db;
        this.db.run(sql, params, async function(err) {
          if (err) {
            reject(err);
          } else {
          const phraseId = this.lastID;
          // Insert blank indices into separate table
          if (Array.isArray(blankWordIndices) && blankWordIndices.length > 0) {
            try {
              const blankPromises = blankWordIndices.map((wordIndex, idx) => {
                return new Promise((resolve, reject) => {
                  const correctAnswer = Array.isArray(correctAnswers) && idx < correctAnswers.length 
                    ? correctAnswers[idx] 
                    : null;
                  const wordType = Array.isArray(blankWordTypes) && idx < blankWordTypes.length 
                    ? blankWordTypes[idx] 
                    : null;
                  db.run(
                    'INSERT INTO curriculum_phrase_blanks (phrase_id, word_index, correct_answer, word_type) VALUES (?, ?, ?, ?)',
                    [phraseId, wordIndex, correctAnswer, wordType],
                    function(err) {
                      if (err) reject(err);
                      else resolve();
                    }
                  );
                });
              });
              await Promise.all(blankPromises);
            } catch (e) {
              // If blank insertion fails, delete the phrase and reject
              console.error('Error inserting blank indices, rolling back phrase:', e);
              db.run('DELETE FROM curriculum_phrases WHERE id = ?', [phraseId], (delErr) => {
                if (delErr) console.error('Error deleting phrase during rollback:', delErr);
              });
              reject(e);
              return;
            }
          }
          resolve(phraseId);
        }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  async updateCurriculumPhrase(id, koreanText, englishText, blankWordIndices = [], correctAnswers = [], grammarBreakdown = null, blankWordTypes = []) {
    return new Promise(async (resolve, reject) => {
      try {
        // Check if old columns exist (for databases with old schema)
        const cols = await new Promise((resolve, reject) => {
          this.db.all(`PRAGMA table_info(curriculum_phrases)`, (err, cols) => {
            if (err) reject(err);
            else resolve(cols || []);
          });
        });
        const colNames = cols.map(c => c.name);
        const hasOldColumns = colNames.includes('blank_word_index');
        
        const correctAnswersJson = JSON.stringify(Array.isArray(correctAnswers) ? correctAnswers : []);
        const grammarBreakdownJson = grammarBreakdown ? JSON.stringify(grammarBreakdown) : null;
        
        let sql, params;
        if (hasOldColumns) {
          // Old schema has blank_word_index - provide dummy value (we don't use it)
          const dummyBlankIndex = 0; // Dummy value to satisfy NOT NULL constraint
          sql = `
            UPDATE curriculum_phrases 
            SET korean_text = ?, english_text = ?, blank_word_index = ?, correct_answers_json = ?, grammar_breakdown_json = ?
            WHERE id = ?
          `;
          params = [koreanText, englishText, dummyBlankIndex, correctAnswersJson, grammarBreakdownJson, id];
        } else {
          // New schema without old columns
          sql = `
            UPDATE curriculum_phrases 
            SET korean_text = ?, english_text = ?, correct_answers_json = ?, grammar_breakdown_json = ?
            WHERE id = ?
          `;
          params = [koreanText, englishText, correctAnswersJson, grammarBreakdownJson, id];
        }
        
        // Capture db reference before callback
        const db = this.db;
        this.db.run(sql, params, async function(err) {
          if (err) {
            reject(err);
          } else {
            // Delete existing blanks and insert new ones
            await new Promise((resolve, reject) => {
              db.run('DELETE FROM curriculum_phrase_blanks WHERE phrase_id = ?', [id], function(err) {
                if (err) reject(err);
                else resolve();
              });
            });
            
            // Insert new blank indices
            if (Array.isArray(blankWordIndices) && blankWordIndices.length > 0) {
              const blankPromises = blankWordIndices.map((wordIndex, idx) => {
                return new Promise((resolve, reject) => {
                  const correctAnswer = Array.isArray(correctAnswers) && idx < correctAnswers.length 
                    ? correctAnswers[idx] 
                    : null;
                  const wordType = Array.isArray(blankWordTypes) && idx < blankWordTypes.length 
                    ? blankWordTypes[idx] 
                    : null;
                  db.run(
                    'INSERT INTO curriculum_phrase_blanks (phrase_id, word_index, correct_answer, word_type) VALUES (?, ?, ?, ?)',
                    [id, wordIndex, correctAnswer, wordType],
                    function(err) {
                      if (err) reject(err);
                      else resolve();
                    }
                  );
                });
              });
              await Promise.all(blankPromises);
            }
            
            resolve(this.changes);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  async deleteCurriculumPhrase(id) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM curriculum_phrases WHERE id = ?`;
      
      this.db.run(sql, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async updateCurriculumPhraseStats(phraseId, isCorrect) {
    return new Promise((resolve, reject) => {
      const field = isCorrect ? 'times_correct' : 'times_incorrect';
      const sql = `UPDATE curriculum_phrases SET ${field} = ${field} + 1 WHERE id = ?`;
      
      this.db.run(sql, [phraseId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async saveWord(wordType, wordData) {
    return new Promise((resolve, reject) => {
      const { korean, english, romanization, ...extras } = wordData;
      
      // Build the SQL based on word type
      const tableName = this._mapWordTypeToTable(wordType);
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

      // Mark new inserts as learning by default
      columns.push('is_learning');
      values.push(1);
      placeholders.push('?');

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

      // Mark new inserts as learning by default (do not force on update)
      columns.push('is_learning');
      values.push(1);
      placeholders.push('?');

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
      const tableName = this._mapWordTypeToTable(wordType);
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

  async getGrammarRules(limit = 200) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, title, description, example_korean, example_english, model_korean, model_english, created_at
        FROM grammar_rules
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `;
      this.db.all(sql, [limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  async addGrammarRule({ title, description, example_korean, example_english, model_korean, model_english }) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO grammar_rules (title, description, example_korean, example_english, model_korean, model_english)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      this.db.run(sql, [title, description || null, example_korean || null, example_english || null, model_korean || null, model_english || null], function(err) {
        if (err) return reject(err);
        resolve(this.lastID);
      });
    });
  }

  async deleteGrammarRule(id) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM grammar_rules WHERE id = ?`;
      this.db.run(sql, [id], function(err) {
        if (err) return reject(err);
        resolve(this.changes || 0);
      });
    });
  }

  async seedDefaultGrammarRulesIfEmpty() {
    // Insert a small starter set of consonant/vowel ending rules if table is empty
    return new Promise((resolve, reject) => {
      const countSql = 'SELECT COUNT(1) as c FROM grammar_rules';
      this.db.get(countSql, (err, row) => {
        if (err) return reject(err);
        const count = (row && row.c) || 0;
        if (count > 0) return resolve();

        const rules = [
          {
            title: 'Topic particle: 은/는',
            description: 'Attach 은 after a final consonant; 는 after a vowel. Marks topic/contrast.',
            example_korean: '책은, 학교는',
            example_english: 'As for the book..., As for school...',
            model_korean: '저는 학생이에요',
            model_english: 'I am a student.'
          },
          {
            title: 'Subject particle: 이/가',
            description: 'Attach 이 after a final consonant; 가 after a vowel. Marks subject/emphasis.',
            example_korean: '학생이, 의사가',
            example_english: 'The student (as subject), The doctor (as subject)',
            model_korean: '고양이가 있어요',
            model_english: 'There is a cat.'
          },
          {
            title: 'Object particle: 을/를',
            description: 'Attach 을 after a final consonant; 를 after a vowel. Marks direct object.',
            example_korean: '밥을 먹어요, 차를 마셔요',
            example_english: 'I eat rice, I drink tea',
            model_korean: '책을 읽어요',
            model_english: 'I read a book.'
          },
          {
            title: 'And/with: 과/와',
            description: 'Attach 과 after a final consonant; 와 after a vowel. Means and/with.',
            example_korean: '책과 펜, 사과와 배',
            example_english: 'book and pen, apple and pear',
            model_korean: '친구와 영화 봐요',
            model_english: 'I watch a movie with a friend.'
          },
          {
            title: 'Noun + 이에요/예요',
            description: 'Attach 이에요 after a final consonant; 예요 after a vowel. Polite to be.',
            example_korean: '학생이에요, 의사예요',
            example_english: 'I am a student, I am a doctor',
            model_korean: '저는 선생님이에요',
            model_english: 'I am a teacher.'
          },
          {
            title: 'Directional: (으)로',
            description: 'Attach 으로 after a final consonant; 로 after a vowel or ㄹ-final. Means toward/with/by means of.',
            example_korean: '왼쪽으로 가요, 버스로 가요',
            example_english: 'Go to the left, I go by bus',
            model_korean: '지하철로 가요',
            model_english: 'I go by subway.'
          }
        ];

        const insertSql = `
          INSERT INTO grammar_rules (title, description, example_korean, example_english, model_korean, model_english)
          VALUES (?, ?, ?, ?, ?, ?)
        `;

        const runNext = (i) => {
          if (i >= rules.length) return resolve();
          const r = rules[i];
          this.db.run(insertSql, [r.title, r.description, r.example_korean, r.example_english, r.model_korean, r.model_english], (e) => {
            if (e) return reject(e);
            runNext(i + 1);
          });
        };
        runNext(0);
      });
    });
  }

  async getLearningWords(limit = 50) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM (
          SELECT 'noun' AS type, korean AS korean, english, created_at FROM nouns WHERE is_learning = 1
          UNION ALL SELECT 'proper-noun', korean, english, created_at FROM proper_nouns WHERE is_learning = 1
          UNION ALL SELECT 'verb', base_form AS korean, english, created_at FROM verbs WHERE is_learning = 1
          UNION ALL SELECT 'adjective', korean, english, created_at FROM adjectives WHERE is_learning = 1
          UNION ALL SELECT 'adverb', korean, english, created_at FROM adverbs WHERE is_learning = 1
          UNION ALL SELECT 'pronoun', korean, english, created_at FROM pronouns WHERE is_learning = 1
          UNION ALL SELECT 'conjunction', korean, english, created_at FROM conjunctions WHERE is_learning = 1
          UNION ALL SELECT 'particle', korean, english, created_at FROM particles WHERE is_learning = 1
        ) t
        ORDER BY datetime(COALESCE(created_at, '1970-01-01')) ASC
        LIMIT ?
      `;
      this.db.all(sql, [limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  async updateWordTags(wordType, korean, { is_favorite, is_learning, is_learned }) {
    return new Promise((resolve, reject) => {
      const tableName = this._mapWordTypeToTable(wordType);
      const keyColumn = (wordType === 'verb' || wordType === 'adjective') ? 'base_form' : 'korean';
      const sets = [];
      const params = [];
      if (typeof is_favorite === 'boolean') { sets.push('is_favorite = ?'); params.push(is_favorite ? 1 : 0); }
      if (typeof is_learning === 'boolean') { sets.push('is_learning = ?'); params.push(is_learning ? 1 : 0); }
      if (typeof is_learned === 'boolean') { sets.push('is_learned = ?'); params.push(is_learned ? 1 : 0); }
      if (sets.length === 0) return resolve(0);
      const sql = `UPDATE ${tableName} SET ${sets.join(', ')} WHERE ${keyColumn} = ?`;
      params.push(korean);
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes || 0);
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

  async getModelVariations() {
    const model = await this.getModelSentence();
    if (!model) return null;
    return new Promise((resolve, reject) => {
      const sql = `SELECT variations_json, updated_at FROM variations_cache WHERE model_english = ? AND model_korean = ? ORDER BY updated_at DESC LIMIT 1`;
      this.db.get(sql, [model.english, model.korean], (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        try {
          resolve({ variations: JSON.parse(row.variations_json || '[]'), updated_at: row.updated_at });
        } catch (_) {
          resolve(null);
        }
      });
    });
  }

  async saveModelVariations(variations) {
    const model = await this.getModelSentence();
    if (!model) throw new Error('No model sentence set');
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO variations_cache (model_english, model_korean, variations_json, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;
      this.db.run(sql, [model.english, model.korean, JSON.stringify(variations || [])], function(err) {
        if (err) return reject(err);
        resolve(this.lastID);
      });
    });
  }

  async clearModelVariations() {
    const model = await this.getModelSentence();
    if (!model) return 0;
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM variations_cache WHERE model_english = ? AND model_korean = ?`;
      this.db.run(sql, [model.english, model.korean], function(err) {
        if (err) return reject(err);
        resolve(this.changes || 0);
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

  _mapWordTypeToTable(wordType) {
    if (wordType === 'proper-noun') return 'proper_nouns';
    return wordType + 's';
  }

  async ensureTagColumns() {
    const tables = ['nouns','verbs','adjectives','adverbs','pronouns','conjunctions','particles','proper_nouns'];
    return new Promise((resolve, reject) => {
      const addForIndex = (idx) => {
        if (idx >= tables.length) return resolve();
        const table = tables[idx];
        this.db.all(`PRAGMA table_info(${table})`, (err, cols) => {
          if (err) return reject(err);
          const names = (cols || []).map(c => c.name);
          const stmts = [];
          if (!names.includes('is_favorite')) stmts.push(`ALTER TABLE ${table} ADD COLUMN is_favorite INTEGER DEFAULT 0`);
          if (!names.includes('is_learning')) stmts.push(`ALTER TABLE ${table} ADD COLUMN is_learning INTEGER DEFAULT 0`);
          if (!names.includes('is_learned')) stmts.push(`ALTER TABLE ${table} ADD COLUMN is_learned INTEGER DEFAULT 0`);
          if (!names.includes('first_try_correct')) stmts.push(`ALTER TABLE ${table} ADD COLUMN first_try_correct INTEGER DEFAULT 0`);
          if (stmts.length === 0) return addForIndex(idx + 1);
          this.db.exec(stmts.join(';\n') + ';', (e) => {
            if (e) return reject(e);
            addForIndex(idx + 1);
          });
        });
      };
      addForIndex(0);
    });
  }

  async ensureCurriculumPhrasesColumns() {
    return new Promise((resolve, reject) => {
      // Check if curriculum_phrases table exists
      this.db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name='curriculum_phrases'`, (err, tables) => {
        if (err) return reject(err);
        if (!tables || tables.length === 0) {
          // Table doesn't exist, will be created by createTables
          return resolve();
        }
        
        // Check if curriculum_phrase_blanks table exists, create if not
        this.db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name='curriculum_phrase_blanks'`, (err, blankTables) => {
          if (err) return reject(err);
          if (!blankTables || blankTables.length === 0) {
            // Create the blanks table
            this.db.run(`
              CREATE TABLE IF NOT EXISTS curriculum_phrase_blanks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phrase_id INTEGER NOT NULL,
                word_index INTEGER NOT NULL,
                correct_answer TEXT,
                word_type TEXT,
                FOREIGN KEY (phrase_id) REFERENCES curriculum_phrases(id) ON DELETE CASCADE
              )
            `, (e) => {
              if (e) return reject(e);
              // Also enable foreign keys if not already enabled
              this.db.run('PRAGMA foreign_keys = ON', () => {
                resolve();
              });
            });
          } else {
            // Table exists, check if it needs word_type column
            this.db.all(`PRAGMA table_info(curriculum_phrase_blanks)`, (err, blankCols) => {
              if (err) return reject(err);
              const blankColNames = (blankCols || []).map(c => c.name);
              const blankStmts = [];
              if (!blankColNames.includes('word_type')) {
                blankStmts.push(`ALTER TABLE curriculum_phrase_blanks ADD COLUMN word_type TEXT`);
              }
              
              // Check columns on curriculum_phrases table
              this.db.all(`PRAGMA table_info(curriculum_phrases)`, (err, cols) => {
                if (err) return reject(err);
                const names = (cols || []).map(c => c.name);
                const stmts = [];
                // Remove old columns if they exist - we'll migrate data to the new table
                // Just ensure the new structure is in place
                if (!names.includes('grammar_breakdown_json')) {
                  stmts.push(`ALTER TABLE curriculum_phrases ADD COLUMN grammar_breakdown_json TEXT`);
                }
                // Combine all statements
                const allStmts = [...blankStmts, ...stmts];
                if (allStmts.length === 0) return resolve();
                this.db.exec(allStmts.join(';\n') + ';', (e) => {
                  if (e) return reject(e);
                  resolve();
                });
              });
            });
          }
        });
      });
    });
  }

  async incrementWordCorrect(koreanWord) {
    return new Promise((resolve, reject) => {
      const tables = [
        { table: 'nouns', key: 'korean' },
        { table: 'verbs', key: 'base_form' },
        { table: 'adjectives', key: 'korean' },
        { table: 'adverbs', key: 'korean' },
        { table: 'pronouns', key: 'korean' },
        { table: 'conjunctions', key: 'korean' },
        { table: 'particles', key: 'korean' },
        { table: 'proper_nouns', key: 'korean' }
      ];
      let totalChanges = 0;

      const updateNext = (index) => {
        if (index >= tables.length) {
          return resolve(totalChanges);
        }

        const { table, key } = tables[index];
        const sql = `UPDATE ${table} SET times_correct = times_correct + 1, first_try_correct = first_try_correct + 1, times_seen = times_seen + 1 WHERE ${key} = ?`;
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

  async enforceLearnedThreshold(koreanWord, threshold = 20) {
    return new Promise((resolve, reject) => {
      const tables = [
        { table: 'nouns', key: 'korean' },
        { table: 'verbs', key: 'base_form' },
        { table: 'adjectives', key: 'korean' },
        { table: 'adverbs', key: 'korean' },
        { table: 'pronouns', key: 'korean' },
        { table: 'conjunctions', key: 'korean' },
        { table: 'particles', key: 'korean' },
        { table: 'proper_nouns', key: 'korean' }
      ];
      let totalUpdated = 0;
      const updateNext = (i) => {
        if (i >= tables.length) return resolve(totalUpdated);
        const { table, key } = tables[i];
        const sql = `UPDATE ${table} SET is_learned = 1, is_learning = 0 WHERE ${key} = ? AND times_correct >= ?`;
        this.db.run(sql, [koreanWord, threshold], function(err) {
          if (err) return reject(err);
          totalUpdated += this.changes || 0;
          updateNext(i + 1);
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
