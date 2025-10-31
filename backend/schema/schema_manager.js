const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class SchemaManager {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.schemaDir = path.join(__dirname);
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async createMigrationsTable() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      this.db.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getAppliedMigrations() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT version FROM schema_migrations ORDER BY version', (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => r.version));
      });
    });
  }

  async applyMigration(version, filename) {
    const sqlPath = path.join(this.schemaDir, filename);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          // Record the migration
          this.db.run(
            'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
            [version, filename],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        }
      });
    });
  }

  async runMigrations() {
    console.log('🔍 Checking for pending migrations...');
    
    await this.createMigrationsTable();
    const applied = await this.getAppliedMigrations();
    
    // Get all SQL files in schema directory
    const files = fs.readdirSync(this.schemaDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let migrationsRun = 0;

    for (const file of files) {
      const version = parseInt(file.split('_')[0]);
      
      if (!applied.includes(version)) {
        console.log(`⬆️  Applying migration ${version}: ${file}`);
        try {
          await this.applyMigration(version, file);
          console.log(`✅ Migration ${version} applied successfully`);
          migrationsRun++;
        } catch (err) {
          console.error(`❌ Migration ${version} failed:`, err);
          throw err;
        }
      }
    }

    if (migrationsRun === 0) {
      console.log('✅ Database is up to date');
    } else {
      console.log(`🎉 Applied ${migrationsRun} migration(s)`);
    }

    return migrationsRun;
  }

  async showStatus() {
    const applied = await this.getAppliedMigrations();
    const files = fs.readdirSync(this.schemaDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log('\n📊 Migration Status:');
    console.log('─'.repeat(60));

    for (const file of files) {
      const version = parseInt(file.split('_')[0]);
      const status = applied.includes(version) ? '✅ Applied' : '⏳ Pending';
      console.log(`${status} | ${file}`);
    }
    console.log('─'.repeat(60));
  }

  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

module.exports = SchemaManager;

