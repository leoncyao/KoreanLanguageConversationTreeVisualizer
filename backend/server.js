require('dotenv').config();
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const Database = require('./database');
const config = require('./config');

// Import route handlers
const { handleChat } = require('./chat');
const { handleGetSentences, handleCorrectSentence } = require('./sentences');
const { handleTranslate } = require('./translate');
const { handleGenerateVariations } = require('./generate');
const { handleTTS, handleTTSBatch, handleTTSConversation, handleTTSLevel3 } = require('./tts');
const {
  handleGetCurriculumPhrases,
  handleGetRandomCurriculumPhrase,
  handleAddCurriculumPhrase,
  handleUpdateCurriculumPhrase,
  handleDeleteCurriculumPhrase,
  handleUpdateCurriculumPhraseStats,
  handleArchiveCurriculumPhrase
} = require('./curriculum');

const app = express();
app.use(cors());
const port = config.backend.port;

// Initialize database
const db = new Database();

// Middleware to parse JSON bodies
app.use(express.json());

// Route for bundle.js (MUST be before static middleware)
// webpack outputs it to /static/js/bundle.js but HTML references /bundle.js
app.get('/bundle.js', (req, res) => {
  const bundlePath = path.join(__dirname, '..', 'public', 'static', 'js', 'bundle.js');
  if (fs.existsSync(bundlePath)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(bundlePath);
  } else {
    res.status(404).send('bundle.js not found');
  }
});

// Handle favicon requests (browsers automatically request this)
app.get('/favicon.ico', (req, res) => {
  const faviconPath = path.join(__dirname, '..', 'public', 'favicon.ico');
  if (fs.existsSync(faviconPath)) {
    res.sendFile(faviconPath);
  } else {
    // Return 204 No Content if favicon doesn't exist (prevents 404 errors)
    res.status(204).end();
  }
});

// Serve static files (public folder is at project root, one level up from backend)
// This should come AFTER specific routes like /bundle.js
const publicPath = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

// Route for the main page
// Check for webpack-built index.html first, then fallback to template
const webpackIndexPath = path.join(__dirname, '..', 'public', 'static', 'js', 'index.html');
const templateIndexPath = path.join(__dirname, '..', 'public', 'index.html');

app.get('/', (req, res) => {
  // Always prefer webpack-built index.html (has script tag)
  if (fs.existsSync(webpackIndexPath)) {
    res.sendFile(webpackIndexPath);
  } else if (fs.existsSync(templateIndexPath)) {
    // If webpack version doesn't exist, serve template and manually inject script
    const templateHtml = fs.readFileSync(templateIndexPath, 'utf8');
    const htmlWithScript = templateHtml.replace(
      '<!-- The script tag for bundle.js will be injected by HtmlWebpackPlugin -->',
      '<script defer="defer" src="/bundle.js"></script>'
    );
    res.send(htmlWithScript);
  } else {
    res.status(404).send('index.html not found');
  }
});

// API routes
app.post('/api/chat', handleChat);
app.get('/api/sentences', handleGetSentences);
app.post('/api/sentences/:id/correct', handleCorrectSentence);
app.post('/api/translate', handleTranslate);
app.post('/api/generate-variations', handleGenerateVariations);
app.post('/api/tts', handleTTS);
app.post('/api/tts/batch', handleTTSBatch);
app.post('/api/tts/conversation', handleTTSConversation);
app.post('/api/tts/level3', handleTTSLevel3);

// Conversations API (synced save/load)
app.get('/api/conversations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const list = await db.getConversations(null, limit);
    res.json(list);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

app.post('/api/conversations', async (req, res) => {
  try {
    const { title, items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array required' });
    }
    const id = await db.addConversation(null, String(title || 'Untitled'), items);
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error saving conversation:', error);
    res.status(500).json({ error: 'Failed to save conversation' });
  }
});

app.put('/api/conversations/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
    const { title, items } = req.body || {};
    const changes = await db.updateConversation(id, null, { title, items });
    res.json({ success: true, updated: changes });
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

app.delete('/api/conversations/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
    const deleted = await db.deleteConversation(id, null);
    res.json({ success: true, deleted });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// Mix state API
app.get('/api/mix', async (req, res) => {
  try {
    const state = await db.getMixState();
    if (state === null) {
      // Return 404 when no mix exists
      return res.status(404).json({ error: 'No mix state found' });
    }
    res.json(state);
  } catch (error) {
    console.error('Error fetching mix state:', error);
    res.status(500).json({ error: 'Failed to fetch mix state' });
  }
});

app.post('/api/mix/generate', async (req, res) => {
  try {
    const { mixItems } = req.body || {};
    if (!Array.isArray(mixItems)) {
      return res.status(400).json({ error: 'mixItems array required' });
    }
    console.log(`Saving mix with ${mixItems.length} items to database`);
    await db.setMixState(mixItems, 0);
    // Verify it was saved
    const saved = await db.getMixState();
    if (saved && saved.mix_items && saved.mix_items.length === mixItems.length) {
      console.log(`Mix saved successfully: ${saved.mix_items.length} items`);
      res.json({ success: true, itemCount: mixItems.length });
    } else {
      console.error('Mix save verification failed:', saved);
      res.status(500).json({ error: 'Failed to verify mix was saved' });
    }
  } catch (error) {
    console.error('Error generating mix:', error);
    res.status(500).json({ error: 'Failed to generate mix' });
  }
});

app.put('/api/mix/update-items', async (req, res) => {
  try {
    const { mixItems } = req.body || {};
    if (!Array.isArray(mixItems)) {
      return res.status(400).json({ error: 'mixItems array required' });
    }
    // Get current state to preserve current_index
    const currentState = await db.getMixState();
    const currentIndex = currentState ? (currentState.current_index || 0) : 0;
    console.log(`Updating mix items (preserving index ${currentIndex})`);
    await db.setMixState(mixItems, currentIndex);
    res.json({ success: true, itemCount: mixItems.length });
  } catch (error) {
    console.error('Error updating mix items:', error);
    res.status(500).json({ error: 'Failed to update mix items' });
  }
});

app.put('/api/mix/index', async (req, res) => {
  try {
    const { index } = req.body || {};
    if (typeof index !== 'number' || index < 0) {
      return res.status(400).json({ error: 'valid index required' });
    }
    const updated = await db.updateMixIndex(index);
    res.json({ success: true, updated });
  } catch (error) {
    console.error('Error updating mix index:', error);
    res.status(500).json({ error: 'Failed to update mix index' });
  }
});

app.post('/api/mix/increment-first-try', async (req, res) => {
  try {
    const updated = await db.incrementMixFirstTryCorrect();
    res.json({ success: true, updated });
  } catch (error) {
    console.error('Error incrementing first try correct:', error);
    res.status(500).json({ error: 'Failed to increment first try correct' });
  }
});

app.post('/api/mix/save-score', async (req, res) => {
  try {
    const { totalQuestions, firstTryCorrect } = req.body || {};
    if (typeof totalQuestions !== 'number' || typeof firstTryCorrect !== 'number') {
      return res.status(400).json({ error: 'totalQuestions and firstTryCorrect required' });
    }
    const saved = await db.saveMixScore(totalQuestions, firstTryCorrect);
    res.json({ success: true, saved });
  } catch (error) {
    console.error('Error saving mix score:', error);
    res.status(500).json({ error: 'Failed to save mix score' });
  }
});

app.get('/api/mix/scores', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const scores = await db.getMixScores(limit);
    res.json(scores);
  } catch (error) {
    console.error('Error fetching mix scores:', error);
    res.status(500).json({ error: 'Failed to fetch mix scores' });
  }
});

app.post('/api/mix/reset', async (req, res) => {
  try {
    const updated = await db.resetMixState();
    res.json({ success: true, updated });
  } catch (error) {
    console.error('Error resetting mix state:', error);
    res.status(500).json({ error: 'Failed to reset mix state' });
  }
});

// Lightweight health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    time: new Date().toISOString()
  });
});

// Version endpoint for update checking
app.get('/api/version', (req, res) => {
  try {
    const packageJson = require('../package.json');
    // Read Service Worker version from sw.js file
    const swPath = path.join(__dirname, '..', 'public', 'sw.js');
    let swVersion = 'v1.0.1'; // Default
    try {
      const swContent = fs.readFileSync(swPath, 'utf8');
      const versionMatch = swContent.match(/const VERSION = ['"]([^'"]+)['"]/);
      if (versionMatch) {
        swVersion = versionMatch[1];
      }
    } catch (_) {
      // Use default if file can't be read
    }
    
    res.json({
      appVersion: packageJson.version,
      serviceWorkerVersion: swVersion,
      buildDate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting version:', error);
    res.status(500).json({ error: 'Failed to get version' });
  }
});

// Journal API routes
app.post('/api/journal', async (req, res) => {
  try {
    const { date, english_text, korean_text } = req.body || {};
    const hasKorean = typeof korean_text === 'string' && korean_text.trim().length > 0;
    const hasEnglish = typeof english_text === 'string' && english_text.trim().length > 0;
    if (!hasKorean && !hasEnglish) {
      return res.status(400).json({ error: 'At least one of english_text or korean_text is required' });
    }

    // Compute YYYY-MM-DD (prefer client-provided date if valid)
    const toDateString = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const entryDate = (typeof date === 'string' && /\d{4}-\d{2}-\d{2}/.test(date)) ? date : toDateString(new Date());

    const id = await db.addJournalEntry(entryDate, hasEnglish ? english_text.trim() : null, hasKorean ? korean_text.trim() : null);
    res.json({ success: true, id, entry_date: entryDate });
  } catch (error) {
    console.error('Error saving journal entry:', error);
    res.status(500).json({ error: 'Failed to save journal entry' });
  }
});

app.get('/api/journal', async (req, res) => {
  try {
    const date = req.query.date;
    if (!date || !/\d{4}-\d{2}-\d{2}/.test(date)) {
      return res.status(400).json({ error: 'date query param required as YYYY-MM-DD' });
    }
    const entries = await db.getJournalEntriesByDate(date);
    res.json(entries);
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
});

app.get('/api/journal/days', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 60;
    const days = await db.getJournalDays(limit);
    res.json(days);
  } catch (error) {
    console.error('Error fetching journal days:', error);
    res.status(500).json({ error: 'Failed to fetch journal days' });
  }
});

// Database API routes
app.get('/api/phrases', async (req, res) => {
  try {
    const phrases = await db.getAllPhrases();
    res.json(phrases);
  } catch (error) {
    console.error('Error fetching phrases:', error);
    res.status(500).json({ error: 'Failed to fetch phrases' });
  }
});

app.get('/api/phrases/random', async (req, res) => {
  try {
    const phrase = await db.getRandomPhrase();
    if (!phrase) {
      return res.status(404).json({ error: 'No phrases found' });
    }
    res.json(phrase);
  } catch (error) {
    console.error('Error fetching random phrase:', error);
    res.status(500).json({ error: 'Failed to fetch random phrase' });
  }
});

app.post('/api/phrases/:id/correct', async (req, res) => {
  try {
    const phraseId = req.params.id;
    const isCorrect = req.body.correct !== false; // Default to true if not specified
    
    await db.updatePhraseStats(phraseId, isCorrect);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating phrase stats:', error);
    res.status(500).json({ error: 'Failed to update phrase stats' });
  }
});

// Increment correct count for a specific Korean word across word tables
app.post('/api/words/correct', async (req, res) => {
  try {
    const { word } = req.body || {};
    if (!word || typeof word !== 'string') {
      return res.status(400).json({ error: 'word is required' });
    }
    const updated = await db.incrementWordCorrect(word);
    res.json({ success: true, updated });
  } catch (error) {
    console.error('Error updating word correct count:', error);
    res.status(500).json({ error: 'Failed to update word correct count' });
  }
});

// Check and mark a word as learned if it meets threshold
app.post('/api/words/check-learned', async (req, res) => {
  try {
    const { word, threshold } = req.body || {};
    if (!word || typeof word !== 'string') {
      return res.status(400).json({ error: 'word is required' });
    }
    const updated = await db.enforceLearnedThreshold(word, Number.isFinite(threshold) ? threshold : 20);
    res.json({ success: true, learned: updated > 0, updated });
  } catch (error) {
    console.error('Error enforcing learned threshold:', error);
    res.status(500).json({ error: 'Failed to enforce learned threshold' });
  }
});

// Update tags for a specific word by type and korean
app.post('/api/words/tags', async (req, res) => {
  try {
    const { type, korean, is_favorite, is_learning, is_learned, priority_level } = req.body || {};
    const validTypes = ['noun', 'proper-noun', 'verb', 'adjective', 'adverb', 'pronoun', 'conjunction', 'particle'];
    if (!type || !validTypes.includes(type)) return res.status(400).json({ error: 'invalid type' });
    if (!korean || typeof korean !== 'string') return res.status(400).json({ error: 'korean is required' });
    const changes = await db.updateWordTags(type, korean, { is_favorite, is_learning, is_learned, priority_level });
    res.json({ success: true, updated: changes });
  } catch (error) {
    console.error('Error updating word tags:', error);
    res.status(500).json({ error: 'Failed to update word tags' });
  }
});

// Update word fields (korean, english) for a specific word by type and korean
app.post('/api/words/update', async (req, res) => {
  try {
    const { type, korean: oldKorean, newKorean, english } = req.body || {};
    const validTypes = ['noun', 'proper-noun', 'verb', 'adjective', 'adverb', 'pronoun', 'conjunction', 'particle'];
    if (!type || !validTypes.includes(type)) return res.status(400).json({ error: 'invalid type' });
    if (!oldKorean || typeof oldKorean !== 'string') return res.status(400).json({ error: 'korean (old) is required' });
    const changes = await db.updateWordFields(type, oldKorean, { korean: newKorean, english });
    if (changes === 0) {
      return res.status(404).json({ error: 'Word not found' });
    }
    res.json({ success: true, updated: changes });
  } catch (error) {
    console.error('Error updating word fields:', error);
    res.status(500).json({ error: 'Failed to update word fields' });
  }
});

// Get learning words (all types), optional ?limit=
// IMPORTANT: define BEFORE /api/words/:type to avoid route capture
app.get('/api/words/learning', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 200;
    const words = await db.getLearningWords(limit);
    res.json(words);
  } catch (error) {
    console.error('Error fetching learning words:', error);
    res.status(500).json({ error: 'Failed to fetch learning words' });
  }
});

// Words API routes by part of speech
app.get('/api/words/:type', async (req, res) => {
  try {
    const wordType = req.params.type; // noun, verb, adjective, adverb, pronoun, conjunction, particle
    const limit = parseInt(req.query.limit) || 50;
    
    const validTypes = ['noun', 'proper-noun', 'verb', 'adjective', 'adverb', 'pronoun', 'conjunction', 'particle'];
    if (!validTypes.includes(wordType)) {
      return res.status(400).json({ error: 'Invalid word type' });
    }
    
    const words = await db.getWordsByType(wordType, limit);
    res.json(words);
  } catch (error) {
    console.error(`Error fetching ${req.params.type}s:`, error);
    res.status(500).json({ error: `Failed to fetch ${req.params.type}s` });
  }
});

// Get all word types summary
app.get('/api/words/stats/summary', async (req, res) => {
  try {
    const wordTypes = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'conjunction', 'particle'];
    const summary = {};
    
    for (const type of wordTypes) {
      const words = await db.getWordsByType(type, 1000);
      summary[type] = {
        count: words.length,
        totalSeen: words.reduce((sum, w) => sum + w.times_seen, 0)
      };
    }
    
    res.json(summary);
  } catch (error) {
    console.error('Error fetching words summary:', error);
    res.status(500).json({ error: 'Failed to fetch words summary' });
  }
});

// Model variations cache
app.get('/api/model-variations', async (req, res) => {
  try {
    const cached = await db.getModelVariations();
    if (!cached) return res.json({ cached: false, variations: [] });
    res.json({ cached: true, variations: cached.variations, updated_at: cached.updated_at });
  } catch (error) {
    console.error('Error fetching cached variations:', error);
    res.status(500).json({ error: 'Failed to fetch cached variations' });
  }
});

app.post('/api/model-variations', async (req, res) => {
  try {
    const { variations } = req.body || {};
    if (!Array.isArray(variations)) return res.status(400).json({ error: 'variations array is required' });
    const id = await db.saveModelVariations(variations);
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error saving cached variations:', error);
    res.status(500).json({ error: 'Failed to save cached variations' });
  }
});

app.delete('/api/model-variations', async (req, res) => {
  try {
    const changes = await db.clearModelVariations();
    res.json({ success: true, cleared: changes });
  } catch (error) {
    console.error('Error clearing cached variations:', error);
    res.status(500).json({ error: 'Failed to clear cached variations' });
  }
});

// Grammar rules
app.get('/api/grammar-rules', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 200;
    const rules = await db.getGrammarRules(limit);
    res.json(rules);
  } catch (error) {
    console.error('Error fetching grammar rules:', error);
    res.status(500).json({ error: 'Failed to fetch grammar rules' });
  }
});

app.post('/api/grammar-rules', async (req, res) => {
  try {
    const { title, description, example_korean, example_english, model_korean, model_english } = req.body || {};
    if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title is required' });
    const id = await db.addGrammarRule({ title, description, example_korean, example_english, model_korean, model_english });
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error adding grammar rule:', error);
    res.status(500).json({ error: 'Failed to add grammar rule' });
  }
});

app.delete('/api/grammar-rules/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
    const deleted = await db.deleteGrammarRule(id);
    res.json({ success: true, deleted });
  } catch (error) {
    console.error('Error deleting grammar rule:', error);
    res.status(500).json({ error: 'Failed to delete grammar rule' });
  }
});

// Debug grammar table schema and count
app.get('/api/grammar-rules/debug', async (req, res) => {
  try {
    const sqlite3 = require('sqlite3').verbose();
    const info = await new Promise((resolve, reject) => {
      db.db.all("PRAGMA table_info(grammar_rules)", (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
    const count = await new Promise((resolve, reject) => {
      db.db.get('SELECT COUNT(1) as c FROM grammar_rules', (err, row) => {
        if (err) return reject(err);
        resolve((row && row.c) || 0);
      });
    });
    res.json({ info, count });
  } catch (error) {
    console.error('Error debugging grammar rules:', error);
    res.status(500).json({ error: 'Failed to inspect grammar rules', details: String(error && error.message || error) });
  }
});

// Force seed default grammar rules if empty
app.post('/api/grammar-rules/seed', async (req, res) => {
  try {
    await db.seedDefaultGrammarRulesIfEmpty();
    res.json({ success: true });
  } catch (error) {
    console.error('Error seeding grammar rules:', error);
    res.status(500).json({ error: 'Failed to seed grammar rules' });
  }
});

// Model sentence routes
app.get('/api/model-sentence', async (req, res) => {
  try {
    const modelSentence = await db.getModelSentence();
    if (!modelSentence) {
      return res.status(404).json({ error: 'No model sentence set' });
    }
    res.json(modelSentence);
  } catch (error) {
    console.error('Error fetching model sentence:', error);
    res.status(500).json({ error: 'Failed to fetch model sentence' });
  }
});

app.post('/api/model-sentence', async (req, res) => {
  try {
    const { english, korean } = req.body;
    if (!english || !korean) {
      return res.status(400).json({ error: 'Both english and korean are required' });
    }
    
    await db.saveModelSentence(english, korean);
    res.json({ success: true, english, korean });
  } catch (error) {
    console.error('Error saving model sentence:', error);
    res.status(500).json({ error: 'Failed to save model sentence' });
  }
});

app.delete('/api/model-sentence', async (req, res) => {
  try {
    await db.clearModelSentence();
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing model sentence:', error);
    res.status(500).json({ error: 'Failed to clear model sentence' });
  }
});

// Curriculum phrases routes
app.get('/api/curriculum-phrases', handleGetCurriculumPhrases);
app.get('/api/curriculum-phrases/random', handleGetRandomCurriculumPhrase);
app.post('/api/curriculum-phrases', handleAddCurriculumPhrase);
app.put('/api/curriculum-phrases/:id', handleUpdateCurriculumPhrase);
app.delete('/api/curriculum-phrases/:id', handleDeleteCurriculumPhrase);
app.post('/api/curriculum-phrases/:id/correct', handleUpdateCurriculumPhraseStats);
app.post('/api/curriculum-phrases/:id/archive', handleArchiveCurriculumPhrase);

// Explanation API endpoints
app.get('/api/explanations/:phraseId/:phraseType', async (req, res) => {
  try {
    const { phraseId, phraseType } = req.params;
    const explanation = await db.getPhraseExplanation(phraseId, phraseType);
    if (explanation) {
      res.json({ explanation });
    } else {
      res.status(404).json({ error: 'Explanation not found' });
    }
  } catch (error) {
    console.error('Error fetching explanation:', error);
    res.status(500).json({ error: 'Failed to fetch explanation' });
  }
});

app.post('/api/explanations', async (req, res) => {
  try {
    const { phraseId, phraseType, koreanText, englishText, explanation } = req.body || {};
    if (!phraseId || !phraseType || !koreanText || !englishText || !explanation) {
      return res.status(400).json({ error: 'phraseId, phraseType, koreanText, englishText, and explanation are required' });
    }
    await db.savePhraseExplanation(phraseId, phraseType, koreanText, englishText, explanation);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving explanation:', error);
    res.status(500).json({ error: 'Failed to save explanation' });
  }
});

app.get('/api/explanations/by-text', async (req, res) => {
  try {
    const { koreanText, englishText } = req.query || {};
    if (!koreanText || !englishText) {
      return res.status(400).json({ error: 'koreanText and englishText are required' });
    }
    const explanation = await db.getPhraseExplanationByText(koreanText, englishText);
    if (explanation) {
      res.json({ explanation });
    } else {
      res.status(404).json({ error: 'Explanation not found' });
    }
  } catch (error) {
    console.error('Error fetching explanation by text:', error);
    res.status(500).json({ error: 'Failed to fetch explanation' });
  }
});

// Initialize database and start server
async function startServer() {
  try {
    await db.init();
    console.log('Database initialized successfully');
    
    // Check for HTTPS certificates
    // Options: HTTPS_PORT env var, or port + 1 (default)
    const httpsPort = process.env.HTTPS_PORT 
      ? parseInt(process.env.HTTPS_PORT)
      : (parseInt(process.env.PORT) + 1 || port + 1);
    const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, 'ssl', 'cert.pem');
    const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, 'ssl', 'key.pem');
    
    let httpsOptions = null;
    let hasHttps = false;
    
    // Try to load SSL certificates
    try {
      if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        httpsOptions = {
          cert: fs.readFileSync(certPath, 'utf8'),
          key: fs.readFileSync(keyPath, 'utf8')
        };
        hasHttps = true;
        console.log('SSL certificates found. HTTPS will be enabled.');
      }
    } catch (err) {
      console.log('No SSL certificates found. Running HTTP only.');
      console.log('To enable HTTPS:');
      console.log('  1. Place cert.pem and key.pem in backend/ssl/');
      console.log('  2. Or set SSL_CERT_PATH and SSL_KEY_PATH environment variables');
      console.log('  3. For Let\'s Encrypt: cert.pem -> fullchain.pem, key.pem -> privkey.pem');
    }
    
    // Start HTTPS server first if certificates are available
    if (hasHttps && httpsOptions) {
      const httpsServer = https.createServer(httpsOptions, app);
      
      // Add error handling for HTTPS server
      httpsServer.on('error', (err) => {
        console.error('HTTPS server error:', err);
        if (err.code === 'EADDRINUSE') {
          console.error(`Port ${httpsPort} is already in use.`);
        }
      });
      
      httpsServer.listen(httpsPort, '0.0.0.0', () => {
        console.log(`HTTPS server running at https://0.0.0.0:${httpsPort}`);
        console.log(`Access from mobile: https://99.230.251.252:${httpsPort}`);
        console.log(`Access locally: https://localhost:${httpsPort}`);
        console.log('✅ HTTPS enabled. Recording should work on Android.\n');
      }).on('error', (err) => {
        console.error('Failed to start HTTPS server:', err);
        if (err.code === 'EADDRINUSE') {
          console.error(`Port ${httpsPort} is already in use.`);
        } else {
          console.error('HTTPS server error:', err.message);
        }
      });
    }
    
    // Start HTTP server (optionally redirect to HTTPS)
    const httpApp = hasHttps && process.env.REDIRECT_HTTP_TO_HTTPS === 'true' 
      ? express().use((req, res) => {
          const host = req.get('host') || `${req.hostname}:${port}`;
          res.redirect(301, `https://${host.replace(`:${port}`, `:${httpsPort}`)}${req.url}`);
        })
      : app;
    
    const httpServer = http.createServer(httpApp);
    httpServer.listen(port, '0.0.0.0', () => {
      console.log(`HTTP server running at http://0.0.0.0:${port}`);
      console.log(`Access from mobile: http://YOUR_IP:${port}`);
      
      if (hasHttps && process.env.REDIRECT_HTTP_TO_HTTPS === 'true') {
        console.log('⚠️  HTTP requests will redirect to HTTPS.\n');
      } else if (!hasHttps) {
        console.log('\n⚠️  HTTPS not enabled. Recording requires HTTPS on Android.');
        console.log('For local development, use localhost (works on HTTP).');
        console.log('For production, set up HTTPS certificates.\n');
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 