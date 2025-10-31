# Database Schema Management

## How It Works

This system uses **versioned SQL migration files** instead of hardcoded schema in JavaScript.

### Directory Structure

```
backend/schema/
├── 001_initial_schema.sql       # Base tables
├── 002_parts_of_speech.sql      # Word categorization tables
├── 003_model_sentence.sql       # Model sentence feature
├── schema_manager.js            # Migration runner
└── README.md                    # This file
```

## Usage

### Run Migrations
```bash
npm run db:migrate
```

This will:
1. Create `schema_migrations` table (tracks applied migrations)
2. Check which migrations have been applied
3. Run any pending migrations in order
4. Record successful migrations

### Check Status
```bash
npm run db:status
```

Shows which migrations are applied vs pending.

## Adding New Migrations

### 1. Create New SQL File

Use the next version number:
```bash
backend/schema/004_your_feature_name.sql
```

### 2. Write SQL

```sql
-- Description of what this migration does
-- Migration version: 004
-- Created: YYYY-MM-DD

CREATE TABLE IF NOT EXISTS your_table (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);
```

### 3. Run Migration

```bash
npm run db:migrate
```

## Migration Naming Convention

```
XXX_description.sql
```

- `XXX` = 3-digit version number (001, 002, 003...)
- `description` = snake_case description
- Always use `.sql` extension

### Examples:
- `001_initial_schema.sql`
- `002_parts_of_speech.sql`
- `003_model_sentence.sql`
- `004_add_user_settings.sql`

## Benefits Over Hardcoded SQL

✅ **Version Control Friendly**
  - Clear git history of schema changes
  - Easy to review schema changes in PRs

✅ **Maintainable**
  - SQL in `.sql` files (proper syntax highlighting)
  - Separate concerns (one feature per file)

✅ **Trackable**
  - `schema_migrations` table shows what's applied
  - Can see migration history

✅ **Replayable**
  - Can rebuild database from scratch
  - Consistent across environments

✅ **Collaborative**
  - Multiple developers can add migrations
  - Merge conflicts are rare

## Migration Table

The system creates a `schema_migrations` table:

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

This tracks which migrations have run.

## Troubleshooting

### Migration Failed?

1. Check the error message
2. Fix the SQL file
3. The migration runner will try again on next run

### Want to Revert?

SQLite doesn't support `ALTER TABLE DROP COLUMN`, so reverting requires:

1. Create new migration with inverse changes
2. Or backup data, drop tables, re-run migrations

### Check Current Schema

```bash
sqlite3 data/korean_words.db ".schema"
```

## Best Practices

1. **Never edit old migrations** - Create new ones instead
2. **Test migrations** on a copy of production data
3. **One feature per migration** - Keep them focused
4. **Add comments** - Explain what and why
5. **Use IF NOT EXISTS** - Makes migrations idempotent

