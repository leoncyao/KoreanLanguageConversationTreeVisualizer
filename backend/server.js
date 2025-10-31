require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const Database = require('./database');
const config = require('./config');

// Import route handlers
const { handleChat } = require('./chat');
const { handleGetSentences, handleCorrectSentence } = require('./sentences');
const { handleTranslate } = require('./translate');
const { handleGenerateVariations } = require('./generate');

const app = express();
app.use(cors());
const port = config.backend.port;

// Initialize database
const db = new Database();

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files only in development (when frontend is not running separately)
if (process.env.NODE_ENV === 'development') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// Route for the main page (only in development)
if (process.env.NODE_ENV === 'development') {
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// API routes
app.post('/api/chat', handleChat);
app.get('/api/sentences', handleGetSentences);
app.post('/api/sentences/:id/correct', handleCorrectSentence);
app.post('/api/translate', handleTranslate);
app.post('/api/generate-variations', handleGenerateVariations);

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

// Words API routes by part of speech
app.get('/api/words/:type', async (req, res) => {
  try {
    const wordType = req.params.type; // noun, verb, adjective, adverb, pronoun, conjunction, particle
    const limit = parseInt(req.query.limit) || 50;
    
    const validTypes = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'conjunction', 'particle'];
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

// Initialize database and start server
async function startServer() {
  try {
    await db.init();
    console.log('Database initialized successfully');
    
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server running at http://0.0.0.0:${port}`);
      console.log(`Access from mobile: http://YOUR_IP:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 