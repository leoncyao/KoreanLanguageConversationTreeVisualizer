#!/usr/bin/env node

const path = require('path');
const SchemaManager = require('./schema/schema_manager');

const dbPath = path.join(__dirname, '..', 'data', 'korean_words.db');

async function main() {
  console.log('📦 Korean Language App - Database Migration Tool\n');
  
  const manager = new SchemaManager(dbPath);
  
  try {
    await manager.init();
    console.log('✅ Connected to database:', dbPath);
    
    const command = process.argv[2] || 'migrate';
    
    switch (command) {
      case 'migrate':
      case 'up':
        await manager.runMigrations();
        break;
        
      case 'status':
        await manager.showStatus();
        break;
        
      case 'help':
        console.log('Usage: npm run db:migrate [command]\n');
        console.log('Commands:');
        console.log('  migrate, up  - Run pending migrations (default)');
        console.log('  status       - Show migration status');
        console.log('  help         - Show this help\n');
        break;
        
      default:
        console.log('❌ Unknown command:', command);
        console.log('Run "npm run db:migrate help" for usage');
        process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await manager.close();
  }
}

main();

