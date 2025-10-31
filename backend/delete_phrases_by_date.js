const Database = require('./database');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt user for input
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

// Function to delete phrases by date
async function deletePhrasesByDate(targetDate) {
  const db = new Database();
  
  try {
    await db.init();
    console.log('Connected to database successfully');
    
    // First, let's see what phrases exist for this date
    const checkSql = `
      SELECT id, korean_text, english_text, created_at
      FROM phrases
      WHERE DATE(created_at) = ?
      ORDER BY created_at
    `;
    
    const phrases = await new Promise((resolve, reject) => {
      db.db.all(checkSql, [targetDate], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    if (phrases.length === 0) {
      console.log(`No phrases found for date: ${targetDate}`);
      return;
    }
    
    console.log(`\nFound ${phrases.length} phrases for date ${targetDate}:`);
    console.log('=' .repeat(60));
    phrases.forEach((phrase, index) => {
      console.log(`${index + 1}. ID: ${phrase.id}`);
      console.log(`   Korean: ${phrase.korean_text}`);
      console.log(`   English: ${phrase.english_text}`);
      console.log(`   Created: ${phrase.created_at}`);
      console.log('-'.repeat(40));
    });
    
    // Ask for confirmation
    const confirm = await askQuestion(`\nDo you want to delete these ${phrases.length} phrases? (yes/no): `);
    
    if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
      // Delete phrases
      const deleteSql = `DELETE FROM phrases WHERE DATE(created_at) = ?`;
      
      const result = await new Promise((resolve, reject) => {
        db.db.run(deleteSql, [targetDate], function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        });
      });
      
      console.log(`\n✅ Successfully deleted ${result} phrases from ${targetDate}`);
    } else {
      console.log('❌ Deletion cancelled');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.close();
    rl.close();
  }
}

// Function to show recent dates with phrases
async function showRecentDates() {
  const db = new Database();
  
  try {
    await db.init();
    
    const sql = `
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM phrases
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 10
    `;
    
    const dates = await new Promise((resolve, reject) => {
      db.db.all(sql, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    if (dates.length === 0) {
      console.log('No phrases found in database');
      return;
    }
    
    console.log('\nRecent dates with phrases:');
    console.log('=' .repeat(30));
    dates.forEach(date => {
      console.log(`${date.date}: ${date.count} phrases`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.close();
  }
}

// Main function
async function main() {
  console.log('🗑️  Korean Phrases Database Cleanup Tool');
  console.log('=' .repeat(40));
  
  // Show recent dates first
  await showRecentDates();
  
  // Get target date from user
  const targetDate = await askQuestion('\nEnter the date to delete phrases from (YYYY-MM-DD): ');
  
  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(targetDate)) {
    console.log('❌ Invalid date format. Please use YYYY-MM-DD format.');
    rl.close();
    return;
  }
  
  // Confirm and delete
  await deletePhrasesByDate(targetDate);
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { deletePhrasesByDate, showRecentDates };
