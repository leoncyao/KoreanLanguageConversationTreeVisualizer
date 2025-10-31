#!/usr/bin/env node

require('dotenv').config();
const { generateVerbTenses } = require('./verb_conjugator');
const Database = require('./database');
const path = require('path');

async function testVerbConjugation() {
  console.log('🧪 Testing Verb Conjugation System\n');
  
  // Test verbs
  const testVerbs = [
    { korean: '가다', english: 'to go' },
    { korean: '먹다', english: 'to eat' },
    { korean: '하다', english: 'to do' }
  ];
  
  const db = new Database();
  
  try {
    await db.init();
    console.log('✅ Connected to database\n');
    
    for (const verb of testVerbs) {
      console.log(`\n📝 Testing verb: ${verb.korean} (${verb.english})`);
      console.log('─'.repeat(60));
      
      try {
        // Generate all tenses
        const tenses = await generateVerbTenses(verb.korean, verb.english);
        
        console.log('\n✅ Generated tenses:');
        console.log(`   Base: ${tenses.base_form}`);
        console.log(`   Present informal: ${tenses.present_informal}`);
        console.log(`   Present formal: ${tenses.present_formal}`);
        console.log(`   Past informal: ${tenses.past_informal}`);
        console.log(`   Past formal: ${tenses.past_formal}`);
        console.log(`   Future informal: ${tenses.future_informal}`);
        console.log(`   Progressive: ${tenses.progressive_informal}`);
        console.log(`   Negative: ${tenses.negative_present_informal}`);
        console.log(`   Type: ${tenses.verb_type}`);
        console.log(`   Pattern: ${tenses.conjugation_pattern}`);
        
        // Save to database
        await db.saveVerbWithAllTenses(tenses);
        console.log('\n💾 Saved to database successfully');
        
      } catch (error) {
        console.error(`❌ Failed for ${verb.korean}:`, error.message);
      }
    }
    
    // Query database to verify
    console.log('\n\n📊 Verbs in database:');
    console.log('='.repeat(60));
    
    const verbs = await new Promise((resolve, reject) => {
      db.db.all('SELECT base_form, present_informal, past_informal, future_informal, english FROM verbs', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    verbs.forEach(v => {
      console.log(`\n${v.base_form} (${v.english})`);
      console.log(`  Present: ${v.present_informal}`);
      console.log(`  Past: ${v.past_informal}`);
      console.log(`  Future: ${v.future_informal}`);
    });
    
    console.log('\n\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

testVerbConjugation();

