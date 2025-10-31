const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'korean_words.db');

console.log('📦 Starting database migration...');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to database');
});

const migrations = `
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

  -- Model sentence table: stores the current active model sentence (singleton)
  CREATE TABLE IF NOT EXISTS model_sentence (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    english TEXT NOT NULL,
    korean TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Update phrase_words table to add word_type column if it doesn't exist
  -- Note: SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we need to check
`;

db.exec(migrations, (err) => {
  if (err) {
    console.error('❌ Migration failed:', err);
    db.close();
    process.exit(1);
  }
  
  console.log('✅ New tables created successfully');
  
  // List all tables to verify
  db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, tables) => {
    if (err) {
      console.error('Error listing tables:', err);
    } else {
      console.log('\n📊 Current database tables:');
      tables.forEach(table => {
        console.log(`  - ${table.name}`);
      });
    }
    
    // Check if phrase_words needs updating
    db.all("PRAGMA table_info(phrase_words)", (err, columns) => {
      if (err) {
        console.error('Error checking phrase_words:', err);
        db.close();
        process.exit(1);
      }
      
      const hasWordType = columns.some(col => col.name === 'word_type');
      
      if (!hasWordType) {
        console.log('\n🔧 Updating phrase_words table to add word_type column...');
        
        // SQLite requires recreating the table to add columns with constraints
        const updateSQL = `
          CREATE TABLE IF NOT EXISTS phrase_words_new (
            phrase_id INTEGER,
            word_id INTEGER,
            word_type TEXT,
            position_in_phrase INTEGER,
            PRIMARY KEY (phrase_id, word_id, word_type),
            FOREIGN KEY (phrase_id) REFERENCES phrases (id)
          );
          
          INSERT OR IGNORE INTO phrase_words_new (phrase_id, word_id, word_type, position_in_phrase)
          SELECT phrase_id, word_id, 'unknown', position_in_phrase FROM phrase_words;
          
          DROP TABLE phrase_words;
          
          ALTER TABLE phrase_words_new RENAME TO phrase_words;
        `;
        
        db.exec(updateSQL, (err) => {
          if (err) {
            console.error('⚠️  Warning: Could not update phrase_words table:', err);
          } else {
            console.log('✅ phrase_words table updated');
          }
          
          console.log('\n🎉 Migration completed successfully!');
          console.log('You can now restart your server.');
          db.close();
        });
      } else {
        console.log('✅ phrase_words table already up to date');
        console.log('\n🎉 Migration completed successfully!');
        console.log('You can now restart your server.');
        db.close();
      }
    });
  });
});

